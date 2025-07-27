// src/routes/restaurantRoutes.js
const express = require("express");
const router = express.Router();


const {
  createRestaurant,
  getAllRestaurants,
  getRestaurantById,
  updateRestaurant,
  deleteRestaurant,
  getNearbyRestaurants, // <-- MODIFIED: Add getNearbyRestaurants to imports
} = require("../controller/restaurantCRUD");


// POST
router.post("/seed", createRestaurant); // As discussed, this is a seed endpoint

// GET
router.get("/", getAllRestaurants);

// GET
router.get("/:id", getRestaurantById);

// --- ADDED: Endpoint for Nearby Restaurants ---
// Endpoint: GET /restaurant/nearby
// Purpose: Find restaurants within a geographical bounding box.
// Query Params: lat (latitude), lng (longitude), radiusKm (optional, default to 10km in controller)
// Example usage: GET /restaurant/nearby?lat=19.076&lng=72.8777&radiusKm=5
router.get("/nearby", getNearbyRestaurants); // <-- MODIFIED: New route for nearby search
// --- END ADDED ---

// PUT
router.put("/:id", updateRestaurant);

// DELETE
router.delete("/:id", deleteRestaurant);


module.exports = router;
