// src/routes/bookings.js
const express = require('express');
const router = express.Router();

const {
  createBooking,
  getUserBookings,
  getBookingDetail,
  updateBookingStatus, // For restaurant staff/admin
  cancelBooking, // For user
  checkTableAvailabilityByAPI, // For frontend to check before booking
} = require('../controller/bookingController'); // This controller will be created next

// GET check table availability for a specific date/time/partySize
// Endpoint: /api/bookings/check-availability?restaurantId=...&bookingDate=...&bookingTime=...&partySize=...
router.get('/check-availability', checkTableAvailabilityByAPI); // Publicly accessible

// POST create a new table reservation
router.post('/', createBooking);

// GET user's bookings (past and upcoming)
router.get('/', getUserBookings);

// GET a specific booking detail
router.get('/:bookingId', getBookingDetail);

// PUT update booking status (e.g., by restaurant owner/staff)
router.put('/:bookingId/status', updateBookingStatus);

// PATCH cancel a booking (by user)
router.patch('/:bookingId/cancel', cancelBooking);

module.exports = router;