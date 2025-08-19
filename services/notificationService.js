// src/services/notificationService.js
/* eslint-disable no-console */

/**
 * Notification Service (FCM + Firestore)
 * Channels: Push (FCM) + In-App (Firestore)
 *
 * Firestore:
 * - notifications (collection)
 *   doc: {
 *     ownerType: 'user' | 'restaurant',
 *     ownerId: string,
 *     type: string,                 // template or custom
 *     title: string,
 *     body: string,
 *     data: Record<string,string>,
 *     read: boolean,
 *     status: 'queued'|'sent'|'partial'|'failed',
 *     idempotencyKey?: string,
 *     error?: string,
 *     createdAt, updatedAt: Timestamp
 *   }
 *
 * - deviceTokens (collection)
 *   doc: {
 *     ownerType: 'user' | 'restaurant',
 *     ownerId: string,
 *     token: string,
 *     platform?: 'ios'|'android'|'web',
 *     locale?: string,
 *     appVersion?: string,
 *     active: boolean,
 *     lastUsedAt, createdAt, updatedAt: Timestamp
 *   }
 */

const { admin, db } = require("../firebase");

const messaging = admin.messaging();

const COLLECTIONS = {
  NOTIFICATIONS: "notifications",
  DEVICE_TOKENS: "deviceTokens",
};

const MAX_TOKENS_PER_BATCH = 500; // FCM limit for sendMulticast

// --------- Utilities ---------

const nowTs = () => admin.firestore.FieldValue.serverTimestamp();

const chunk = (arr = [], size = 500) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

const safeStr = (v, max = 200) =>
  String(v == null ? "" : v).slice(0, max);

const toStringRecord = (obj = {}) => {
  const out = {};
  Object.entries(obj).forEach(([k, v]) => {
    // FCM data values MUST be strings
    out[k] = v == null ? "" : String(v);
  });
  return out;
};

// --------- Templates ---------

/**
 * Build a notification from a template + context.
 * @param {string} type
 * @param {object} ctx
 * @returns {{title:string, body:string, data:Record<string,string>}}
 */
function buildFromTemplate(type, ctx = {}) {
  switch (type) {
    case "QUOTE_CREATED": {
      const when = ctx.bookingTime ? new Date(ctx.bookingTime).toLocaleString() : "your selected time";
      return {
        title: "Quote Ready 💡",
        body: `Your quote for ${ctx.restaurantName || "the restaurant"} is ready for ${when}. Total: ₹${ctx.total}.`,
        data: toStringRecord({ kind: "quote", quoteId: ctx.quoteId || "", restaurantId: ctx.restaurantId || "" }),
      };
    }
    case "PREORDER_CONFIRMED":
      return {
        title: "Pre-order Confirmed ✅",
        body: `Your pre-order at ${ctx.restaurantName || "the restaurant"} is confirmed for ${ctx.slot || "your time"}.`,
        data: toStringRecord({ kind: "preorder", orderId: ctx.orderId || "", restaurantId: ctx.restaurantId || "" }),
      };
    case "PAYMENT_SUCCESS":
      return {
        title: "Payment Successful 💳",
        body: `We received ₹${ctx.amount} for ${ctx.context || "your order"}. Thanks!`,
        data: toStringRecord({ kind: "payment", orderId: ctx.orderId || "", amount: String(ctx.amount || "") }),
      };
    case "TABLE_READY":
      return {
        title: "Your Table is Ready 🍽️",
        body: `Table ${ctx.tableNumber || ""} is ready at ${ctx.restaurantName || "the restaurant"}.`,
        data: toStringRecord({ kind: "table", tableId: ctx.tableId || "" }),
      };
    case "ORDER_READY":
      return {
        title: "Order Ready 🔔",
        body: `Your order is ready for serving/pickup at ${ctx.restaurantName || "the restaurant"}.`,
        data: toStringRecord({ kind: "order", orderId: ctx.orderId || "" }),
      };
    case "BOOKING_REMINDER":
      return {
        title: "Booking Reminder ⏰",
        body: `Reminder: your booking at ${ctx.restaurantName || "the restaurant"} is at ${ctx.when || "the scheduled time"}.`,
        data: toStringRecord({ kind: "booking", bookingId: ctx.bookingId || "" }),
      };
    case "DISCOUNT_APPLIED":
      return {
        title: "Discount Applied 🎉",
        body: `${ctx.code ? `Promo ${ctx.code}` : "Discount"} applied. You saved ₹${ctx.saved || 0}.`,
        data: toStringRecord({ kind: "discount", code: ctx.code || "" }),
      };
    case "BOOKING_CANCELED":
      return {
        title: "Booking Canceled ❌",
        body: `Your booking at ${ctx.restaurantName || "the restaurant"} was canceled.`,
        data: toStringRecord({ kind: "booking", bookingId: ctx.bookingId || "" }),
      };
    default:
      // Custom
      return {
        title: safeStr(ctx.title || "Notification"),
        body: safeStr(ctx.body || ""),
        data: toStringRecord(ctx.data || {}),
      };
  }
}

// --------- Device Tokens ---------

/**
 * Register/update a device token.
 * @param {{ ownerType:'user'|'restaurant', ownerId:string, token:string, platform?:string, appVersion?:string, locale?:string }} p
 */
async function registerDeviceToken(p) {
  const { ownerType, ownerId, token, platform, appVersion, locale } = p || {};
  if (!ownerType || !ownerId || !token) throw new Error("ownerType, ownerId and token are required");

  // De-duplicate by token+ownerType+ownerId
  const q = await db
    .collection(COLLECTIONS.DEVICE_TOKENS)
    .where("ownerType", "==", ownerType)
    .where("ownerId", "==", ownerId)
    .where("token", "==", token)
    .limit(1)
    .get();

  if (!q.empty) {
    const ref = q.docs[0].ref;
    await ref.update({
      platform: platform || admin.firestore.FieldValue.delete(),
      appVersion: appVersion || admin.firestore.FieldValue.delete(),
      locale: locale || admin.firestore.FieldValue.delete(),
      active: true,
      updatedAt: nowTs(),
      lastUsedAt: nowTs(),
    });
    return { updated: true, id: ref.id };
  }

  const ref = await db.collection(COLLECTIONS.DEVICE_TOKENS).add({
    ownerType,
    ownerId,
    token,
    platform: platform || null,
    appVersion: appVersion || null,
    locale: locale || null,
    active: true,
    createdAt: nowTs(),
    updatedAt: nowTs(),
    lastUsedAt: nowTs(),
  });
  return { created: true, id: ref.id };
}

/**
 * Mark a token inactive or delete it.
 */
async function unregisterDeviceToken({ ownerType, ownerId, token }) {
  if (!ownerType || !ownerId || !token) throw new Error("ownerType, ownerId and token are required");

  const q = await db
    .collection(COLLECTIONS.DEVICE_TOKENS)
    .where("ownerType", "==", ownerType)
    .where("ownerId", "==", ownerId)
    .where("token", "==", token)
    .get();

  const batch = db.batch();
  q.forEach((doc) => batch.update(doc.ref, { active: false, updatedAt: nowTs() }));
  await batch.commit();
  return { count: q.size };
}

async function getOwnerTokens(ownerType, ownerId) {
  const q = await db
    .collection(COLLECTIONS.DEVICE_TOKENS)
    .where("ownerType", "==", ownerType)
    .where("ownerId", "==", ownerId)
    .where("active", "==", true)
    .get();

  const tokens = [];
  q.forEach((d) => tokens.push(d.data().token));
  return tokens;
}

// --------- In-App (Firestore) ---------

/**
 * Persist an in-app notification (with idempotency).
 * @param {{ ownerType:'user'|'restaurant', ownerId:string, type?:string, title:string, body:string, data?:object, idempotencyKey?:string }} p
 */
async function saveInApp(p) {
  const { ownerType, ownerId, type = "CUSTOM", title, body, data, idempotencyKey } = p || {};
  if (!ownerType || !ownerId) throw new Error("ownerType and ownerId are required");
  if (!title) throw new Error("title is required");

  if (idempotencyKey) {
    const exists = await db
      .collection(COLLECTIONS.NOTIFICATIONS)
      .where("ownerType", "==", ownerType)
      .where("ownerId", "==", ownerId)
      .where("idempotencyKey", "==", idempotencyKey)
      .limit(1)
      .get();
    if (!exists.empty) {
      return { idempotent: true, ref: exists.docs[0].ref, id: exists.docs[0].id };
    }
  }

  const ref = await db.collection(COLLECTIONS.NOTIFICATIONS).add({
    ownerType,
    ownerId,
    type,
    title: safeStr(title, 150),
    body: safeStr(body, 500),
    data: toStringRecord(data),
    read: false,
    status: "queued",
    idempotencyKey: idempotencyKey || null,
    createdAt: nowTs(),
    updatedAt: nowTs(),
  });

  return { id: ref.id, ref };
}

/**
 * Mark a notification as read.
 */
async function markNotificationRead({ notificationId }) {
  if (!notificationId) throw new Error("notificationId is required");
  await db.collection(COLLECTIONS.NOTIFICATIONS).doc(notificationId).update({
    read: true,
    updatedAt: nowTs(),
  });
  return { ok: true };
}

// --------- Push (FCM) ---------

async function sendToTokens({ tokens = [], title, body, data = {}, image }) {
  if (!tokens.length) return { successCount: 0, failureCount: 0, invalidTokens: [] };

  const invalidTokens = [];
  let successCount = 0;
  let failureCount = 0;

  const messageBase = {
    notification: { title: safeStr(title, 150), body: safeStr(body, 500) },
    data: toStringRecord(data),
    android: { priority: "high", notification: { channelId: "default" } },
    apns: {
      headers: { "apns-priority": "10" },
      payload: { aps: { sound: "default" } },
    },
    webpush: { headers: { Urgency: "high" } },
  };

  if (image) {
    messageBase.notification.imageUrl = image;
  }

  const batches = chunk(tokens, MAX_TOKENS_PER_BATCH);
  for (const batch of batches) {
    const resp = await messaging.sendEachForMulticast({
      tokens: batch,
      ...messageBase,
    });

    successCount += resp.successCount;
    failureCount += resp.failureCount;

    resp.responses.forEach((r, i) => {
      if (!r.success) {
        const code = r.error?.code || "";
        if (code === "messaging/registration-token-not-registered" || code === "messaging/invalid-registration-token") {
          invalidTokens.push(batch[i]);
        }
      }
    });
  }

  // Auto-clean invalid tokens
  if (invalidTokens.length) {
    const q = await db
      .collection(COLLECTIONS.DEVICE_TOKENS)
      .where("token", "in", invalidTokens.slice(0, 10)) // Firestore 'in' cap 10; loop if needed
      .get();

    const groups = chunk(invalidTokens, 10);
    for (const g of groups) {
      const snap = await db.collection(COLLECTIONS.DEVICE_TOKENS).where("token", "in", g).get();
      const batch = db.batch();
      snap.forEach((doc) => batch.update(doc.ref, { active: false, updatedAt: nowTs() }));
      await batch.commit();
    }
  }

  return { successCount, failureCount, invalidTokens };
}

/**
 * Core send: in-app + push to owner (user/restaurant).
 * @param {{ ownerType:'user'|'restaurant', ownerId:string, type?:string, template?:string, context?:object, title?:string, body?:string, data?:object, idempotencyKey?:string, image?:string }} p
 */
async function sendToOwner(p) {
  const {
    ownerType,
    ownerId,
    type = "CUSTOM",
    template,       // optional template name to build message
    context = {},   // template context
    title,
    body,
    data = {},
    idempotencyKey,
    image,
  } = p || {};

  if (!ownerType || !ownerId) throw new Error("ownerType and ownerId are required");

  const built = template ? buildFromTemplate(template, context) : { title, body, data };
  const notif = {
    ownerType,
    ownerId,
    type: template || type,
    title: built.title,
    body: built.body,
    data: built.data,
    idempotencyKey,
  };

  // 1) Save in-app notification (idempotent)
  const saved = await saveInApp(notif);

  // 2) Fetch tokens
  const tokens = await getOwnerTokens(ownerType, ownerId);

  // 3) Send push
  let pushResult = { successCount: 0, failureCount: 0, invalidTokens: [] };
  if (tokens.length) {
    pushResult = await sendToTokens({
      tokens,
      title: notif.title,
      body: notif.body,
      data: { ...notif.data, notificationId: saved.id || saved.ref?.id || "" },
      image,
    });
  }

  // 4) Update notification status
  const ref = saved.ref || db.collection(COLLECTIONS.NOTIFICATIONS).doc(saved.id);
  await ref.update({
    status: pushResult.failureCount > 0 && pushResult.successCount > 0
      ? "partial"
      : pushResult.failureCount > 0 && pushResult.successCount === 0
      ? "failed"
      : "sent",
    updatedAt: nowTs(),
    error: pushResult.failureCount ? `failures=${pushResult.failureCount}` : admin.firestore.FieldValue.delete(),
  });

  return { id: saved.id || saved.ref?.id, push: pushResult };
}

// Convenience wrappers
async function sendToUser(userId, payload) {
  return sendToOwner({ ownerType: "user", ownerId: userId, ...payload });
}
async function sendToRestaurant(restaurantId, payload) {
  return sendToOwner({ ownerType: "restaurant", ownerId: restaurantId, ...payload });
}

// --------- Topics (optional broadcast) ---------

async function subscribeToTopic({ tokens = [], topic }) {
  if (!tokens.length || !topic) return { successCount: 0, failureCount: 0 };
  const resp = await messaging.subscribeToTopic(tokens, topic);
  return resp;
}

async function unsubscribeFromTopic({ tokens = [], topic }) {
  if (!tokens.length || !topic) return { successCount: 0, failureCount: 0 };
  const resp = await messaging.unsubscribeFromTopic(tokens, topic);
  return resp;
}

async function broadcastToTopic({ topic, title, body, data = {} }) {
  if (!topic || !title) throw new Error("topic and title are required");

  const message = {
    topic,
    notification: { title: safeStr(title, 150), body: safeStr(body, 500) },
    data: toStringRecord(data),
    android: { priority: "high", notification: { channelId: "default" } },
    apns: { headers: { "apns-priority": "10" }, payload: { aps: { sound: "default" } } },
    webpush: { headers: { Urgency: "high" } },
  };

  const resp = await messaging.send(message, true);
  // In-app persistence for broadcast is optional; skip for now or implement per-topic mirror.
  return { messageId: resp };
}

// --------- Exports ---------

module.exports = {
  // device tokens
  registerDeviceToken,
  unregisterDeviceToken,
  getOwnerTokens,

  // send
  sendToOwner,
  sendToUser,
  sendToRestaurant,
  sendToTokens,

  // in-app
  saveInApp,
  markNotificationRead,

  // templates
  buildFromTemplate,

  // topics
  subscribeToTopic,
  unsubscribeFromTopic,
  broadcastToTopic,
};
