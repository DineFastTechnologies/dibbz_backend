// services/notificationService.js
const { admin, db } = require('../firebase');

/**
 * Creates a notification in Firestore and sends a push notification to the user's devices.
 *
 * @param {string} userId The ID of the user to notify.
 * @param {string} title The title of the notification.
 * @param {string} body The body of the notification.
 * @param {object} data Optional data to include with the notification.
 */
const createNotification = async (userId, title, body, data = {}) => {
  try {
    // 1. Save the notification to Firestore
    const notification = {
      title,
      body,
      data,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      isRead: false,
    };
    await db.collection('users').doc(userId).collection('notifications').add(notification);

    // 2. Get the user's device tokens
    const tokensSnapshot = await db.collection('users').doc(userId).collection('deviceTokens').get();
    const tokens = tokensSnapshot.docs.map(doc => doc.id);

    if (tokens.length === 0) {
      console.log(`User ${userId} has no registered devices for push notifications.`);
      return;
    }

    // 3. Send a push notification to each device
    const message = {
      notification: {
        title,
        body,
      },
      data,
      tokens,
    };

    const response = await admin.messaging().sendMulticast(message);
    console.log(`Successfully sent notification to ${response.successCount} devices.`);
    if (response.failureCount > 0) {
      console.warn(`Failed to send notification to ${response.failureCount} devices.`);
    }
  } catch (error) {
    console.error(`Error creating notification for user ${userId}:`, error);
  }
};

module.exports = {
  createNotification,
};
