// routes/restaurantRoutes.js
const express = require("express");
const router = express.Router();
const multer = require('multer');

// MODIFIED: Import authenticate and checkRole directly from the auth middleware file
const { authenticate, checkRole } = require('../middleware/auth'); 

const upload = multer({ storage: multer.memoryStorage() });

const {
  createRestaurant,
  createNewRestaurant,
  getAllRestaurants,
  getRestaurantById,
  updateRestaurant,
  deleteRestaurant,
  getNearbyRestaurants,
  uploadRestaurantImage,
} = require("../controller/restaurantCRUD");


// POST /restaurant/seed - For initial data seeding (consider removing in production)
router.post("/seed", createRestaurant);

// POST /restaurant - Create new restaurant (requires authentication)
router.post("/", authenticate, createNewRestaurant);

// GET /restaurant - Get all restaurants (publicly accessible)
router.get("/", getAllRestaurants);

// GET /restaurant/:id - Get a single restaurant by ID (publicly accessible)
router.get("/:id", getRestaurantById);

// GET /restaurant/nearby - Get nearby restaurants (publicly accessible)
router.get("/nearby", getNearbyRestaurants);

// --- MODIFIED: PUT /restaurant/:id - Update restaurant (requires owner/admin role) ---
// Now apply middleware functions directly
router.put("/:id", authenticate, checkRole('restaurant_owner'), updateRestaurant);

// --- MODIFIED: DELETE /restaurant/:id - Delete restaurant (requires owner/admin role) ---
// Now apply middleware functions directly
router.delete("/:id", authenticate, checkRole('restaurant_owner'), deleteRestaurant);

// --- ADDED: POST /restaurant/:id/images - Upload restaurant images (requires owner/admin role) ---
// Now apply middleware functions directly
router.post("/:id/images", 
  authenticate, 
  checkRole('restaurant_owner'), 
  upload.single('image'), 
  uploadRestaurantImage
);

module.exports = router;