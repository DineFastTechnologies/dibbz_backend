// src/routes/reviews.js
const express = require('express');
// { mergeParams: true } is essential here because it's nested under /api/restaurants/:restaurantId
const router = express.Router({ mergeParams: true }); 

const {
  getRestaurantReviews,
  submitRestaurantReview,
  // Optional: updateRestaurantReview, deleteRestaurantReview
} = require('../controller/reviewController'); // This controller will be created next

// GET all reviews for a specific restaurant (publicly accessible)
// Endpoint: /api/restaurants/:restaurantId/reviews
router.get('/', getRestaurantReviews);

// POST a new review for a specific restaurant (requires customer authentication)
// Endpoint: /api/restaurants/:restaurantId/reviews
router.post('/', submitRestaurantReview);

// Optional: PUT update a specific review (requires authentication and review ownership)
// router.put('/:reviewId', updateRestaurantReview);

// Optional: DELETE a specific review (requires authentication and review ownership or admin role)
// router.delete('/:reviewId', deleteRestaurantReview);

module.exports = router;