// src/controller/reviewController.js

// MODIFIED: Import admin and db directly from the firebase.js file
const { admin, db } = require('../firebase'); 

// These functions assume that 'req.user' (authenticated user's UID and other claims)
// is populated by the 'authenticate' middleware which is applied in the route.
// 'req.params.restaurantId' is available due to { mergeParams: true } in the router.


// GET all reviews for a specific restaurant
// MODIFIED: Uses directly imported 'db'
const getRestaurantReviews = async (req, res) => {
const restaurantId = req.params.restaurantId;

try {
const reviewsSnapshot = await db.collection('restaurants').doc(restaurantId).collection('reviews') // Use directly imported 'db'
.orderBy('createdAt', 'desc')
.get();
const reviews = reviewsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
res.status(200).json(reviews);
} catch (error) {
console.error(`Error fetching reviews for restaurant ${restaurantId}:`, error);
res.status(500).send('Failed to fetch reviews.');
}
};

// POST submit a new review for a restaurant
// MODIFIED: Uses directly imported 'db' and 'admin'
const submitRestaurantReview = async (req, res) => {
const restaurantId = req.params.restaurantId;
const authenticatedUserId = req.user.uid; // User submitting the review
const { rating, comment } = req.body;

if (rating == null || rating < 1 || rating > 5) {
return res.status(400).send('Rating is required and must be between 1 and 5.');
}
if (!comment || comment.trim() === '') {
return res.status(400).send('Comment is required.');
}

try {
// Optional: Prevent a user from submitting multiple reviews for the same restaurant
const existingReview = await db.collection('restaurants').doc(restaurantId).collection('reviews') // Use directly imported 'db'
.where('userId', '==', authenticatedUserId)
.limit(1)
.get();
if (!existingReview.empty) {
return res.status(409).send('You have already submitted a review for this restaurant.');
}

const userDoc = await db.collection('users').doc(authenticatedUserId).get(); // Use directly imported 'db'
const userName = userDoc.exists ? (userDoc.data().displayName || userDoc.data().name || 'Anonymous') : 'Anonymous';

const newReviewRef = await db.collection('restaurants').doc(restaurantId).collection('reviews').add({ // Use directly imported 'db'
userId: authenticatedUserId,
userName: userName,
rating: parseInt(rating),
comment: comment.trim(),
createdAt: admin.firestore.FieldValue.serverTimestamp(), // Use directly imported 'admin'
});

// Update Restaurant's Average Rating (within a transaction for atomicity)
const restaurantRef = db.collection('restaurants').doc(restaurantId); // Use directly imported 'db'
await db.runTransaction(async (transaction) => { // Use directly imported 'db'
const restaurantDoc = await transaction.get(restaurantRef);
if (!restaurantDoc.exists) {
throw new Error("Restaurant does not exist.");
}

const currentRatingSum = restaurantDoc.data().ratingSum || 0;
const currentReviewCount = restaurantDoc.data().reviewCount || 0;

const newRatingSum = currentRatingSum + parseInt(rating);
const newReviewCount = currentReviewCount + 1;
const newAverageRating = newRatingSum / newReviewCount;

transaction.update(restaurantRef, {
ratingSum: newRatingSum,
reviewCount: newReviewCount,
averageRating: parseFloat(newAverageRating.toFixed(1)), // Store with one decimal place
updatedAt: admin.firestore.FieldValue.serverTimestamp(), // Use directly imported 'admin'
});
});

res.status(201).json({ id: newReviewRef.id, message: 'Review submitted successfully!' });
} catch (error) {
console.error(`Error submitting review for restaurant ${restaurantId} by user ${authenticatedUserId}:`, error);
if (error.message === "Restaurant does not exist.") {
return res.status(404).send(error.message);
}
res.status(500).send('Failed to submit review.');
}
};

module.exports = {
getRestaurantReviews,
submitRestaurantReview,
};