// src/routes/restaurantRoutes.js
const express = require("express");
const router = express.Router();
const {
  createRestaurant,
  getAllRestaurants,
  getRestaurantById,
  updateRestaurant,
  deleteRestaurant,
  getNearbyRestaurants,
  uploadRestaurantImage
} = require("../controller/restaurantCRUD");

//const { authenticate } = require("../middleware/authMiddleware"); 
const multer = require("multer");
const upload = multer({ storage: multer.memoryStorage() });

router.post("/", createRestaurant);
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

module.exports = router;
