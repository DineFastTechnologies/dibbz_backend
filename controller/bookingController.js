// src/controller/bookingController.js

// MODIFIED: Import admin, db, bucket directly from the firebase.js file
const { admin, db, bucket } = require('../firebase'); 

// Helper to check if the authenticated user owns the target restaurant (for staff/admin actions)
// MODIFIED: Uses directly imported 'db' and 'admin'
const checkRestaurantOwnership = async (req, res, restaurantId) => {
  const authenticatedUserId = req.user.uid; // req.user is from authenticate middleware

  try {
    const userDoc = await db.collection('users').doc(authenticatedUserId).get();
    if (!userDoc.exists) {
      res.status(403).send('Forbidden: User profile not found.');
      return false;
    }
    const userRole = userDoc.data()?.role;
    const ownedRestaurantId = userDoc.data()?.ownedRestaurantId;

    if (userRole === 'admin') {
      return true;
    }
    if (userRole === 'restaurant_owner' && ownedRestaurantId === restaurantId) {
      return true;
    }

    res.status(403).send('Forbidden: Not authorized to manage this restaurant.');
    return false;
  } catch (error) {
    console.error('Error checking restaurant ownership:', error);
    res.status(500).send('Server error during ownership check.');
    return false;
  }
};

// Helper for table availability check (Internal function)
// MODIFIED: Uses directly imported 'db' and 'admin'
// Removed 'dbInstance' argument as 'db' is now directly available
const getAvailabilityStatus = async (restaurantId, partySize, bookingDate, bookingTime, bookingIdToExclude = null) => {
    const targetBookingDateTime = new Date(`${bookingDate}T${bookingTime}:00Z`);

    // 1. Fetch all 'active' bookings for this restaurant on this date
    // Uses directly imported 'db'
    const bookingsSnapshot = await db.collection('bookings')
                                          .where('restaurantId', '==', restaurantId)
                                          .where('bookingDate', '==', bookingDate)
                                          .where('status', 'in', ['pending_payment', 'confirmed', 'checked_in'])
                                          .get();

    let totalBookedCapacity = 0;
    for (const doc of bookingsSnapshot.docs) {
        if (doc.id === bookingIdToExclude) continue;

        const existingBookingTime = doc.data().bookingTime;
        const existingBookingDateTime = new Date(`${bookingDate}T${existingBookingTime}:00Z`);

        const timeDiffMs = Math.abs(targetBookingDateTime.getTime() - existingBookingDateTime.getTime());
        const timeDiffHours = timeDiffMs / (1000 * 60 * 60);

        const assumedBookingDurationHours = 1.5;

        if (timeDiffHours < assumedBookingDurationHours) {
            totalBookedCapacity += doc.data().partySize || 0;
        }
    }

    // 2. Fetch total capacity of the restaurant from its tables subcollection
    // Uses directly imported 'db'
    const restaurantTablesSnapshot = await db.collection('restaurants').doc(restaurantId).collection('tables').get();
    let totalRestaurantCapacity = 0;
    restaurantTablesSnapshot.docs.forEach(doc => {
        if (doc.data().isBookable !== false) {
            totalRestaurantCapacity += doc.data().capacity || 0;
        }
    });

    const remainingCapacity = totalRestaurantCapacity - totalBookedCapacity;

    return {
      isAvailable: remainingCapacity >= partySize,
      remainingCapacity: remainingCapacity,
      totalRestaurantCapacity: totalRestaurantCapacity,
      totalBookedCapacity: totalBookedCapacity,
    };
};

// GET check table availability for a specific date/time/partySize (Public API for frontend)
// MODIFIED: Removed req.db from arguments passed to getAvailabilityStatus
const checkTableAvailabilityByAPI = async (req, res) => {
  const { restaurantId, partySize, bookingDate, bookingTime } = req.query;

  if (!restaurantId || !partySize || !bookingDate || !bookingTime) {
    return res.status(400).send('Missing required query parameters: restaurantId, partySize, bookingDate, bookingTime.');
  }
  const parsedPartySize = parseInt(partySize);
  if (isNaN(parsedPartySize) || parsedPartySize <= 0) {
    return res.status(400).send('Invalid partySize.');
  }

  try {
    const availability = await getAvailabilityStatus(restaurantId, parsedPartySize, bookingDate, bookingTime);
    res.status(200).json({
      isAvailable: availability.isAvailable,
      message: availability.isAvailable ? 'Tables are available.' : 'No tables available for this time.',
      details: {
        remainingCapacity: availability.remainingCapacity,
        totalRestaurantCapacity: availability.totalRestaurantCapacity,
        totalBookedCapacity: availability.totalBookedCapacity,
      }
    });
  } catch (error) {
    console.error(`Error checking availability for restaurant ${restaurantId}:`, error);
    res.status(500).send('Failed to check table availability.');
  }
};


// POST create a new table reservation
// MODIFIED: Uses directly imported 'db' and 'admin'
const createBooking = async (req, res) => {
  const userId = req.user.uid;
  const { restaurantId, partySize, bookingDate, bookingTime, specialRequests, orderId } = req.body;

  if (!restaurantId || !partySize || !bookingDate || !bookingTime) {
    return res.status(400).send('Missing required fields: restaurantId, partySize, bookingDate, bookingTime.');
  }
  if (typeof partySize !== 'number' || partySize <= 0) {
    return res.status(400).send('Party size must be a positive number.');
  }

  try {
    // 1. Check table availability
    const availability = await getAvailabilityStatus(restaurantId, partySize, bookingDate, bookingTime);
    if (!availability.isAvailable) {
      return res.status(409).send('No tables available for the selected time and party size.');
    }

    // 2. Create booking record
    const bookingRef = db.collection('bookings').doc(); // Uses directly imported 'db'
    const bookingData = {
      userId,
      restaurantId,
      partySize: parseInt(partySize),
      bookingDate,
      bookingTime,
      status: 'pending_payment',
      specialRequests: specialRequests || '',
      orderId: orderId || null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(), // Uses directly imported 'admin'
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    await bookingRef.set(bookingData);

    if (orderId) {
      await db.collection('orders').doc(orderId).update({ bookingId: bookingRef.id }); // Uses directly imported 'db'
    }

    res.status(201).json({ bookingId: bookingRef.id, message: 'Table reservation initiated. Awaiting payment/confirmation.' });

  } catch (error) {
    console.error(`Error creating booking for user ${userId}:`, error);
    res.status(500).send('Failed to create booking.');
  }
};

// GET user's bookings (past and upcoming)
// MODIFIED: Uses directly imported 'db'
const getUserBookings = async (req, res) => {
  const userId = req.user.uid;

  try {
    const bookingsSnapshot = await db.collection('bookings')
                                       .where('userId', '==', userId)
                                       .orderBy('bookingDate', 'desc')
                                       .orderBy('bookingTime', 'desc')
                                       .get();
    const bookings = bookingsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.status(200).json(bookings);
  } catch (error) {
    console.error(`Error fetching bookings for user ${userId}:`, error);
    res.status(500).send('Failed to fetch bookings.');
  }
};

// GET a specific booking detail
// MODIFIED: Uses directly imported 'db'
const getBookingDetail = async (req, res) => {
  const userId = req.user.uid;
  const bookingId = req.params.bookingId;

  try {
    const bookingDoc = await db.collection('bookings').doc(bookingId).get();

    if (!bookingDoc.exists) {
      return res.status(404).send('Booking not found.');
    }
    if (bookingDoc.data().userId !== userId) {
      return res.status(403).send('Forbidden: You can only view your own bookings.');
    }

    res.status(200).json({ id: bookingDoc.id, ...bookingDoc.data() });
  } catch (error) {
    console.error(`Error fetching booking ${bookingId} for user ${userId}:`, error);
    res.status(500).send('Failed to fetch booking details.');
  }
};

// PUT update booking status (e.g., by restaurant owner/staff)
// MODIFIED: Uses directly imported 'db' and 'admin'
const updateBookingStatus = async (req, res) => {
  const bookingId = req.params.bookingId;
  const { status } = req.body;

  if (!status) {
    return res.status(400).send('New status is required.');
  }
  const validStatuses = ['confirmed', 'checked_in', 'completed', 'cancelled', 'no_show'];
  if (!validStatuses.includes(status)) {
    return res.status(400).send(`Invalid status. Must be one of: ${validStatuses.join(', ')}.`);
  }

  try {
    const bookingRef = db.collection('bookings').doc(bookingId);
    const bookingDoc = await bookingRef.get();
    if (!bookingDoc.exists) {
      return res.status(404).send('Booking not found.');
    }

    if (!await checkRestaurantOwnership(req, res, bookingDoc.data().restaurantId)) {
        return;
    }

    await bookingRef.update({
      status,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.status(200).send('Booking status updated successfully.');
  } catch (error) {
    console.error(`Error updating status for booking ${bookingId}:`, error);
    res.status(500).send('Failed to update booking status.');
  }
};

// PATCH cancel a booking (by user)
// MODIFIED: Uses directly imported 'db' and 'admin'
const cancelBooking = async (req, res) => {
  const userId = req.user.uid;
  const bookingId = req.params.bookingId;

  try {
    const bookingRef = db.collection('bookings').doc(bookingId);
    const bookingDoc = await bookingRef.get();

    if (!bookingDoc.exists) {
      return res.status(404).send('Booking not found.');
    }
    if (bookingDoc.data().userId !== userId) {
      return res.status(403).send('Forbidden: You can only cancel your own booking.');
    }

    const currentStatus = bookingDoc.data().status;
    if (['checked_in', 'completed', 'cancelled', 'no_show'].includes(currentStatus)) {
      return res.status(400).send(`Booking cannot be cancelled in '${currentStatus}' status.`);
    }

    await bookingRef.update({
      status: 'cancelled',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.status(200).send('Booking cancelled successfully.');
  } catch (error) {
    console.error(`Error cancelling booking ${bookingId} for user ${userId}:`, error);
    res.status(500).send('Failed to cancel booking.');
  }
};


module.exports = {
  createBooking,
  getUserBookings,
  getBookingDetail,
  updateBookingStatus,
  cancelBooking,
  checkTableAvailabilityByAPI,
};