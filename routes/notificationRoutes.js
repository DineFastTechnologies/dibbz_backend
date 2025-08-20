// routes/notificationRoutes.js
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  getNotifications,
  markAsRead,
  markAllAsRead,
  registerDevice,
  unregisterDevice,
} = require('../controller/notificationController');

// GET /api/notifications - Get all notifications for the authenticated user
router.get('/', authenticate, getNotifications);

// PUT /api/notifications/:notificationId/read - Mark a notification as read
router.put('/:notificationId/read', authenticate, markAsRead);

// PUT /api/notifications/read-all - Mark all notifications as read
router.put('/read-all', authenticate, markAllAsRead);

// POST /api/notifications/register-device - Register a device for push notifications
router.post('/register-device', authenticate, registerDevice);

// DELETE /api/notifications/unregister-device - Unregister a device for push notifications
router.delete('/unregister-device', authenticate, unregisterDevice);

module.exports = router;
