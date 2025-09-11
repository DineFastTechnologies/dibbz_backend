// src/routes/restaurantRoutes.js
const express = require("express");
const router = express.Router();
const {
  createRestaurant,
  createNewRestaurant,
  getAllRestaurants,
  getRestaurantById,
  updateRestaurant,
  deleteRestaurant,
  getNearbyRestaurants,
  uploadRestaurantImage,
  checkRestaurantSetup
} = require("../controller/restaurantCRUD");

const { authenticate } = require("../middleware/auth"); 
const multer = require("multer");
const upload = multer({ storage: multer.memoryStorage() });

// POST /restaurant/seed - For initial data seeding (consider removing in production)
router.post("/seed", createRestaurant);

// POST /restaurant - Create new restaurant (requires authentication)
router.post("/", authenticate, createNewRestaurant);

// GET /restaurant - Get all restaurants (publicly accessible)
router.get("/", getAllRestaurants);
router.get("/:id", getRestaurantById);
// ✅ Update restaurant (must own it or be admin)
router.put("/:id", updateRestaurant);
// ✅ Delete restaurant (must own it or be admin)
router.delete("/:id", deleteRestaurant);
// ✅ Get nearby restaurants
router.get("/search/nearby", getNearbyRestaurants);
// ✅ Upload image
router.post("/:id/images", upload.single("image"), uploadRestaurantImage);
// ✅ Check if user has completed restaurant setup
router.get("/check-setup/:userId", checkRestaurantSetup);

module.exports = router;
