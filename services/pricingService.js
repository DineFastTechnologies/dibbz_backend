// services/pricingService.js
'use strict';

const admin = require('firebase-admin');
const db = admin.firestore();

/**
 * Quote input shape
 * {
 *   userId?: string,
 *   restaurantId: string,
 *   items: [{ itemId: string, qty: number }],
 *   promoCode?: string,              // optional coupon
 *   orderType?: 'dine-in' | 'preorder' | 'delivery',
 *   bookingTime?: string|number|Date,// ISO/epoch/Date for time-slot matching
 *   pricingPhase?: 'booking' | 'preorder' | 'finalBill' | 'payment' // helps appliesTo checks
 * }
 *
 * This service:
 * - Loads menu items in parallel (fast).
 * - Applies either coupon (priority) or auto time-slot discount (fallback).
 * - Optional stacking is controlled by restaurant config flag allowDiscountStacking (default false).
 * - Computes service charge -> GST -> delivery -> preorder split.
 * - Returns a complete, rounded breakdown + minor metadata for auditing.
 */

// ----------------------------- Config & Constants -----------------------------

const DEFAULTS = {
  GST_RATE: 5,              // %
  SERVICE_CHARGE_RATE: 0,   // %
  DELIVERY_FEE: 0,          // ₹
  PREORDER_SPLIT_PERCENT: 50,
  CURRENCY: 'INR',
  MAX_QTY_PER_ITEM: 20,
  ALLOW_DISCOUNT_STACKING: false,
};

const PHASE_ALIAS_FOR_ORDER_TYPE = {
  'dine-in': 'finalBill',
  'preorder': 'preorder',
  'delivery': 'finalBill',
};

// ----------------------------- Small Utilities -------------------------------

const toNumber = (v, def = 0) => (typeof v === 'number' && !isNaN(v) ? v : def);
const INR = (n) => Math.max(0, Number(n || 0));
const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const paise = (rupees) => Math.round(INR(rupees) * 100);
const asDate = (d) => (d ? new Date(d) : new Date());

const safeQty = (rawQty, maxQty) =>
  Math.min(Math.max(1, Number(rawQty || 1)), Math.max(1, Number(maxQty || DEFAULTS.MAX_QTY_PER_ITEM)));

const hasString = (s) => typeof s === 'string' && s.trim().length > 0;

// ----------------------------- Firestore Fetchers ----------------------------

async function getRestaurantConfig(restaurantId) {
  const snap = await db.collection('restaurants').doc(restaurantId).get();
  const d = snap.exists ? snap.data() : {};
  return {
    gstRate: toNumber(d?.gstRate, DEFAULTS.GST_RATE),
    serviceChargeRate: toNumber(d?.serviceChargeRate, DEFAULTS.SERVICE_CHARGE_RATE),
    deliveryFee: INR(d?.deliveryFee ?? DEFAULTS.DELIVERY_FEE),
    preorderSplitPercent: toNumber(d?.preorderSplitPercent, DEFAULTS.PREORDER_SPLIT_PERCENT),
    currency: d?.currency || DEFAULTS.CURRENCY,
    maxQtyPerItem: toNumber(d?.maxQtyPerItem, DEFAULTS.MAX_QTY_PER_ITEM),
    allowDiscountStacking: !!d?.allowDiscountStacking ?? DEFAULTS.ALLOW_DISCOUNT_STACKING,
  };
}

/**
 * Batch fetch menu items in parallel.
 * Expected path: restaurants/{restaurantId}/menu/{itemId}
 */
async function getMenuItemsParallel(restaurantId, items) {
  const fetches = items.map(({ itemId, qty }) =>
    db
      .collection('restaurants')
      .doc(restaurantId)
      .collection('menu')
      .doc(itemId)
      .get()
      .then((snap) => ({ snap, itemId, qty }))
  );

  const docs = await Promise.all(fetches);

  const resolved = [];
  for (const { snap, itemId, qty } of docs) {
    if (!snap.exists) throw new Error(`Menu item not found: ${itemId}`);
    const d = snap.data();
    if (d.active === false) throw new Error(`Menu item inactive: ${itemId}`);
    resolved.push({
      id: itemId,
      name: d.name || itemId,
      unitPrice: INR(d.price),
      qty,
    });
  }
  return resolved;
}

/**
 * Fetch coupon discount by code from top-level discounts collection.
 * Matches your discountController schema.
 */
async function getCouponDiscount(restaurantId, code) {
  if (!hasString(code)) return null;

  const qs = await db
    .collection('discounts')
    .where('restaurantId', '==', restaurantId)
    .where('isActive', '==', true)
    .where('type', '==', 'coupon')
    .where('couponCode', '==', code.trim())
    .get();

  if (qs.empty) return null;
  // Prefer the most recent
  const doc = qs.docs[0];
  return { id: doc.id, ...doc.data(), source: 'coupon' };
}

/**
 * Fetch active time-slot discount(s) for the restaurant, then filter in memory
 * for validFrom/validUntil and HH:mm window. Returns the first applicable one.
 */
async function getActiveTimeSlotDiscount(restaurantId, bookingTime, appliesPhase) {
  const qs = await db
    .collection('discounts')
    .where('restaurantId', '==', restaurantId)
    .where('isActive', '==', true)
    .where('type', '==', 'time_slot')
    .get();

  if (qs.empty) return null;

  const now = asDate(bookingTime || Date.now());

  for (const doc of qs.docs) {
    const d = doc.data();
    const passesDate = isWithinDate(now, d.validFrom, d.validUntil);
    const passesTime = isWithinHHmmWindow(now, d.timeSlot);
    const passesPhase = appliesToPhase(appliesPhase, d.appliesTo);
    if (passesDate && passesTime && passesPhase) {
      return { id: doc.id, ...d, source: 'time_slot' };
    }
  }
  return null;
}

// ----------------------------- Validation Helpers ----------------------------

function isWithinDate(nowDate, from, until) {
  const now = asDate(nowDate).getTime();
  const start = from ? new Date(from).getTime() : -Infinity;
  const end = until ? new Date(until).getTime() : Infinity;
  return now >= start && now <= end;
}

/**
 * timeSlot: { start: "HH:mm", end: "HH:mm" } inclusive start, exclusive end
 */
function isWithinHHmmWindow(date, timeSlot) {
  if (!timeSlot || !timeSlot.start || !timeSlot.end) return true;
  const [sh, sm] = timeSlot.start.split(':').map((n) => parseInt(n, 10));
  const [eh, em] = timeSlot.end.split(':').map((n) => parseInt(n, 10));
  if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) return true;

  const mins = date.getHours() * 60 + date.getMinutes();
  const startMins = sh * 60 + (sm || 0);
  const endMins = eh * 60 + (em || 0);

  // Support same-day start<end (e.g., 18:00-20:00) and overnight (e.g., 22:00-02:00)
  if (endMins > startMins) {
    return mins >= startMins && mins < endMins;
  } else if (endMins < startMins) {
    // overnight window
    return mins >= startMins || mins < endMins;
  }
  // start == end => treat as full-day active
  return true;
}

function appliesToPhase(phase, appliesTo) {
  if (!Array.isArray(appliesTo) || appliesTo.length === 0) return true;
  return appliesTo.includes(phase || 'finalBill');
}

/**
 * Compute discount from your schema:
 * - discountMode: "percentage" | "flat"
 * - amount: number
 * Optional caps: minSpend, maxDiscount
 */
function computeDiscount(subtotal, discountDoc) {
  if (!discountDoc) return { amount: 0, reason: 'NO_DISCOUNT' };

  const minSpend = INR(discountDoc.minSpend || 0);
  if (minSpend && subtotal < minSpend) {
    return { amount: 0, reason: 'MIN_SPEND_NOT_MET' };
  }

  const mode = discountDoc.discountMode || 'percentage';
  const val = toNumber(discountDoc.amount, 0);

  let disc = 0;
  if (mode === 'flat') disc = INR(val);
  else disc = INR(subtotal * (val / 100));

  const maxD = INR(discountDoc.maxDiscount || 0);
  if (maxD) disc = Math.min(disc, maxD);

  disc = Math.min(disc, subtotal);
  return { amount: round2(disc), reason: 'APPLIED' };
}

// ----------------------------- Core: Quote -----------------------------------

/**
 * Main pricing entry point.
 */
async function quote({
  userId,
  restaurantId,
  items = [],
  promoCode,
  orderType = 'dine-in',
  bookingTime,
  pricingPhase, // if not provided, we derive from orderType
}) {
  if (!restaurantId) throw new Error('restaurantId is required');
  if (!Array.isArray(items) || items.length === 0) throw new Error('items are required');

  // 0) Load restaurant config
  const cfg = await getRestaurantConfig(restaurantId);
  const phase = pricingPhase || PHASE_ALIAS_FOR_ORDER_TYPE[orderType] || 'finalBill';

  // 1) Sanitize & batch-fetch menu items (parallel)
  const sanitized = items.map(({ itemId, qty }) => ({
    itemId,
    qty: safeQty(qty, cfg.maxQtyPerItem),
  }));

  const menu = await getMenuItemsParallel(restaurantId, sanitized);

  const lineItems = menu.map((m, i) => {
    const qty = sanitized[i].qty;
    const lineTotal = round2(m.unitPrice * qty);
    return {
      itemId: m.id,
      name: m.name,
      unitPrice: m.unitPrice,
      qty,
      lineTotal,
    };
  });

  const subtotal = round2(lineItems.reduce((s, li) => s + li.lineTotal, 0));

  // 2) Resolve discounts
  let appliedDiscounts = [];
  let totalDiscount = 0;
  let discountReason = 'NONE';

  // Priority 1: coupon (promoCode)
  let couponDoc = null;
  if (hasString(promoCode)) {
    const cd = await getCouponDiscount(restaurantId, promoCode.trim());
    if (cd && isWithinDate(bookingTime || Date.now(), cd.validFrom, cd.validUntil) && appliesToPhase(phase, cd.appliesTo)) {
      const { amount, reason } = computeDiscount(subtotal, cd);
      if (amount > 0) {
        appliedDiscounts.push({
          id: cd.id,
          type: cd.type || 'coupon',
          source: 'coupon',
          code: cd.couponCode || promoCode.trim(),
          mode: cd.discountMode,
          value: cd.amount,
          reason,
          amount,
        });
        totalDiscount += amount;
        discountReason = reason;
      } else {
        discountReason = reason; // e.g., MIN_SPEND_NOT_MET
      }
    } else {
      discountReason = 'INVALID_OR_OUT_OF_WINDOW';
    }
  }

  // Priority 2: auto time-slot (if no coupon applied or stacking allowed)
  if (totalDiscount === 0 || cfg.allowDiscountStacking) {
    const tsDoc = await getActiveTimeSlotDiscount(restaurantId, bookingTime, phase);
    if (tsDoc) {
      const { amount, reason } = computeDiscount(subtotal - totalDiscount, tsDoc);
      if (amount > 0) {
        appliedDiscounts.push({
          id: tsDoc.id,
          type: tsDoc.type || 'time_slot',
          source: 'time_slot',
          mode: tsDoc.discountMode,
          value: tsDoc.amount,
          reason,
          amount,
        });
        totalDiscount = round2(totalDiscount + amount);
        discountReason = reason;
      }
    }
  }

  // Ensure not exceeding subtotal
  totalDiscount = Math.min(totalDiscount, subtotal);
  const discountedSub = round2(subtotal - totalDiscount);

  // 3) Charges & taxes (serviceCharge -> GST -> delivery)
  const serviceChargeAmt = round2(discountedSub * (cfg.serviceChargeRate / 100));
  const taxableAmount = round2(discountedSub + serviceChargeAmt);
  const gstAmount = round2(taxableAmount * (cfg.gstRate / 100));
  const deliveryFee = orderType === 'delivery' ? INR(cfg.deliveryFee) : 0;

  const totalPayable = round2(taxableAmount + gstAmount + deliveryFee);

  // 4) Preorder split
  const splitPercent = Number(cfg.preorderSplitPercent || DEFAULTS.PREORDER_SPLIT_PERCENT);
  let split = { enabled: false, percent: splitPercent, now: 0, later: 0, nowPaise: 0, laterPaise: 0 };
  if (orderType === 'preorder') {
    const now = round2(totalPayable * (splitPercent / 100));
    const later = round2(totalPayable - now);
    split = {
      enabled: true,
      percent: splitPercent,
      now,
      later,
      nowPaise: paise(now),
      laterPaise: paise(later),
    };
  }

  return {
    meta: {
      restaurantId,
      userId: userId || null,
      orderType,
      pricingPhase: phase,
      bookingTime: bookingTime ? new Date(bookingTime).toISOString() : null,
      currency: cfg.currency,
      allowDiscountStacking: cfg.allowDiscountStacking,
    },
    items: lineItems,
    pricing: {
      subtotal,
      discounts: {
        total: totalDiscount,
        reason: discountReason,
        applied: appliedDiscounts, // array for audit (coupon/time_slot)
      },
      serviceCharge: { rate: cfg.serviceChargeRate, amount: serviceChargeAmt },
      taxableAmount,
      gst: { rate: cfg.gstRate, amount: gstAmount },
      deliveryFee,
      totalPayable,
      totalPayablePaise: paise(totalPayable),
    },
    split,
  };
}

module.exports = { quote };
