// controller/notificationController.js
const { db } = require('../firebase');

// GET /api/notifications - Get all notifications for the authenticated user
exports.getNotifications = async (req, res) => {
  const userId = req.user.uid;
  try {
    const notificationsSnapshot = await db.collection('users').doc(userId).collection('notifications').orderBy('createdAt', 'desc').get();
    const notifications = notificationsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.status(200).json(notifications);
  } catch (error) {
    console.error(`Error fetching notifications for user ${userId}:`, error);
    res.status(500).send('Failed to fetch notifications.');
  }
};

// PUT /api/notifications/:notificationId/read - Mark a notification as read
exports.markAsRead = async (req, res) => {
  const { notificationId } = req.params;
  const userId = req.user.uid;

  try {
    await db.collection('users').doc(userId).collection('notifications').doc(notificationId).update({ isRead: true });
    res.status(200).send('Notification marked as read.');
  } catch (error) {
    console.error(`Error marking notification ${notificationId} as read for user ${userId}:`, error);
    res.status(500).send('Failed to mark notification as read.');
  }
};

// PUT /api/notifications/read-all - Mark all notifications as read
exports.markAllAsRead = async (req, res) => {
  const userId = req.user.uid;

  try {
    const notificationsSnapshot = await db.collection('users').doc(userId).collection('notifications').where('isRead', '==', false).get();
    const batch = db.batch();
    notificationsSnapshot.docs.forEach(doc => {
      batch.update(doc.ref, { isRead: true });
    });
    await batch.commit();
    res.status(200).send('All notifications marked as read.');
  } catch (error) {
    console.error(`Error marking all notifications as read for user ${userId}:`, error);
    res.status(500).send('Failed to mark all notifications as read.');
  }
};

// POST /api/notifications/register-device - Register a device for push notifications
exports.registerDevice = async (req, res) => {
  const { token } = req.body;
  const userId = req.user.uid;

  if (!token) {
    return res.status(400).send('Device token is required.');
  }

  try {
    await db.collection('users').doc(userId).collection('deviceTokens').doc(token).set({
      createdAt: new Date().toISOString(),
      platform: req.headers['user-agent'] 
    });
    res.status(200).send('Device registered successfully.');
  } catch (error) {
    console.error(`Error registering device for user ${userId}:`, error);
    res.status(500).send('Failed to register device.');
  }
};

// DELETE /api/notifications/unregister-device - Unregister a device for push notifications
exports.unregisterDevice = async (req, res) => {
  const { token } = req.body;
  const userId = req.user.uid;

  if (!token) {
    return res.status(400).send('Device token is required.');
  }

  try {
    await db.collection('users').doc(userId).collection('deviceTokens').doc(token).delete();
    res.status(200).send('Device unregistered successfully.');
  } catch (error) {
    console.error(`Error unregistering device for user ${userId}:`, error);
    res.status(500).send('Failed to unregister device.');
  }
};
