// services/pricingService.js
const admin = require("firebase-admin");
const db = admin.firestore();

/**
 * Quote request shape
 * {
 *   userId: string,
 *   restaurantId: string,
 *   items: [{ itemId: string, qty: number }],
 *   promoCode?: string,
 *   orderType?: 'dine-in' | 'preorder',
 *   bookingTime?: string | number | Date  // ISO/date used for time-based promos
 * }
 */

// ---------- Helpers ----------

const toNumber = (v, def = 0) => (typeof v === "number" && !isNaN(v) ? v : def);

const INR = (n) => Math.max(0, Number(n || 0)); // rupees (not paise)

/** Round to paise-friendly rupees with two decimals */
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Convert rupees → paise (integer) for Razorpay */
const paise = (rupees) => Math.round(INR(rupees) * 100);

/** Returns JS Date from any input safely */
const asDate = (d) => (d ? new Date(d) : new Date());

// ---------- Firestore fetchers ----------

async function getRestaurantConfig(restaurantId) {
  const snap = await db.collection("restaurants").doc(restaurantId).get();
  const d = snap.exists ? snap.data() : {};
  return {
    gstRate: toNumber(d?.gstRate, 5),                // % GST (restaurant-configurable)
    serviceChargeRate: toNumber(d?.serviceChargeRate, 0), // % service charge (optional)
    deliveryFee: INR(d?.deliveryFee || 0),
    preorderSplitPercent: toNumber(d?.preorderSplitPercent, 50), // default 50/50
    currency: d?.currency || "INR",
  };
}

/**
 * Reads an item document. Adjust path if your menu is nested differently.
 * Expected path: restaurants/{restaurantId}/menu/{itemId}
 */
async function getMenuItem(restaurantId, itemId) {
  const ref = db
    .collection("restaurants")
    .doc(restaurantId)
    .collection("menu")
    .doc(itemId);
  const snap = await ref.get();
  if (!snap.exists) return null;
  const d = snap.data();
  return {
    id: itemId,
    name: d.name || itemId,
    price: INR(d.price), // rupees
    active: d.active !== false,
  };
}

/**
 * Fetch promotion by code. Priority: restaurant promo → global promo.
 * restaurant path: restaurants/{restaurantId}/promotions/{code}
 * global path: global/promotions/codes/{code}
 */
async function getPromo(restaurantId, code) {
  if (!code) return null;

  // restaurant-scoped promo
  const rRef = db
    .collection("restaurants")
    .doc(restaurantId)
    .collection("promotions")
    .doc(code);
  const rSnap = await rRef.get();
  if (rSnap.exists) return { source: "restaurant", code, ...rSnap.data() };

  // global promo
  const gRef = db
    .collection("global")
    .doc("promotions")
    .collection("codes")
    .doc(code);
  const gSnap = await gRef.get();
  if (gSnap.exists) return { source: "global", code, ...gSnap.data() };

  return null;
}

// ---------- Promo validation & application ----------

function isWithinDate(d, from, to) {
  const now = asDate(d).getTime();
  const start = from ? new Date(from).getTime() : -Infinity;
  const end = to ? new Date(to).getTime() : Infinity;
  return now >= start && now <= end;
}

function isWithinTimeWindow(d, timeBased) {
  if (!timeBased) return true;
  const date = asDate(d);
  const hour = date.getHours();
  const dow = date.getDay(); // 0 Sun ... 6 Sat
  const {
    startHour,         // e.g. 12
    endHour,           // e.g. 15 (inclusive-start, exclusive-end)
    daysOfWeek,        // optional array of [0..6]
  } = timeBased;

  const hourOk =
    typeof startHour === "number" && typeof endHour === "number"
      ? hour >= startHour && hour < endHour
      : true;

  const dowOk = Array.isArray(daysOfWeek)
    ? daysOfWeek.includes(dow)
    : true;

  return hourOk && dowOk;
}

function orderTypeAllowed(orderType, promo) {
  if (!promo?.allowOrderTypes || !Array.isArray(promo.allowOrderTypes)) return true;
  return promo.allowOrderTypes.includes(orderType || "dine-in");
}

function applyPromo(subtotal, promo) {
  if (!promo) return { discount: 0, reason: "NO_PROMO" };

  const { type = "percent", value = 0, maxDiscount, minSpend } = promo;
  if (minSpend && subtotal < INR(minSpend)) {
    return { discount: 0, reason: "MIN_SPEND_NOT_MET" };
  }

  let discount = 0;
  if (type === "flat") {
    discount = INR(value);
  } else { // percent
    discount = INR(subtotal * (Number(value || 0) / 100));
  }

  if (maxDiscount) discount = Math.min(discount, INR(maxDiscount));
  discount = Math.min(discount, subtotal); // never more than subtotal
  return { discount: round2(discount), reason: "APPLIED" };
}

// ---------- Core: Quote ----------

/**
 * Compute full pricing for an order/preorder.
 */
async function quote({
  userId,
  restaurantId,
  items = [],
  promoCode,
  orderType = "dine-in",
  bookingTime, // optional, used for time-based promos
}) {
  if (!restaurantId || !Array.isArray(items) || items.length === 0) {
    throw new Error("Missing restaurantId or items");
  }

  // 1) Load config
  const config = await getRestaurantConfig(restaurantId);

  // 2) Resolve menu items & compute line totals
  const resolved = [];
  for (const raw of items) {
    const qty = Math.max(1, Number(raw.qty || 1));
    const item = await getMenuItem(restaurantId, raw.itemId);
    if (!item || !item.active) {
      throw new Error(`Menu item not found/inactive: ${raw.itemId}`);
    }
    const lineTotal = round2(item.price * qty);
    resolved.push({
      itemId: item.id,
      name: item.name,
      unitPrice: item.price,
      qty,
      lineTotal,
    });
  }
  const subtotal = round2(resolved.reduce((s, r) => s + r.lineTotal, 0));

  // 3) Load/validate promo
  let promo = null;
  let promoMeta = { applied: false, reason: "NO_PROMO" };
  if (promoCode) {
    const p = await getPromo(restaurantId, promoCode);
    if (p) {
      const dateOk = isWithinDate(bookingTime || Date.now(), p.validFrom, p.validTo);
      const timeOk = isWithinTimeWindow(bookingTime || Date.now(), p.timeBased);
      const typeOk = orderTypeAllowed(orderType, p);

      if (dateOk && timeOk && typeOk) {
        const { discount, reason } = applyPromo(subtotal, p);
        promo = p;
        promoMeta = { applied: discount > 0, reason, discount };
      } else {
        promoMeta = {
          applied: false,
          reason: !dateOk ? "OUT_OF_DATE" : !timeOk ? "OUT_OF_TIME_WINDOW" : "ORDER_TYPE_NOT_ALLOWED",
          discount: 0,
        };
      }
    } else {
      promoMeta = { applied: false, reason: "INVALID_CODE", discount: 0 };
    }
  }

  const discount = round2(promoMeta.discount || 0);
  const discountedSub = round2(subtotal - discount);

  // 4) Fees & taxes
  const serviceChargeAmt = round2(discountedSub * (config.serviceChargeRate / 100));
  const taxableAmount = round2(discountedSub + serviceChargeAmt);
  const gstAmount = round2(taxableAmount * (config.gstRate / 100));
  const deliveryFee = orderType === "delivery" ? INR(config.deliveryFee) : 0;

  const totalPayable = round2(taxableAmount + gstAmount + deliveryFee);

  // 5) Optional preorder split (default 50/50)
  const splitPercent = Number(config.preorderSplitPercent || 50);
  let split = { enabled: false, percent: splitPercent, now: 0, later: 0, nowPaise: 0, laterPaise: 0 };
  if (orderType === "preorder") {
    const now = round2(totalPayable * (splitPercent / 100));
    const later = round2(totalPayable - now);
    split = { enabled: true, percent: splitPercent, now, later, nowPaise: paise(now), laterPaise: paise(later) };
  }

  return {
    restaurantId,
    userId: userId || null,
    orderType,
    bookingTime: bookingTime ? new Date(bookingTime).toISOString() : null,
    currency: config.currency,
    items: resolved,
    pricing: {
      subtotal,
      discount,
      promoCodeApplied: promoMeta.applied ? promo?.code : null,
      promoSource: promoMeta.applied ? promo?.source : null,
      promoReason: promoMeta.reason,
      serviceCharge: { rate: config.serviceChargeRate, amount: serviceChargeAmt },
      taxableAmount,
      gst: { rate: config.gstRate, amount: gstAmount },
      deliveryFee,
      totalPayable,
      totalPayablePaise: paise(totalPayable),
    },
    split,
  };
}

module.exports = { quote };
