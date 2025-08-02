const express = require("express");
const router = express.Router();
const cartController = require("../controller/cartController");

// Add item to cart
router.post("/add", cartController.addItemToCart);

// Get all items in cart
router.get("/:userId", cartController.getCart);

// Remove a single item
router.delete("/:userId/:itemId", cartController.removeItemFromCart);

// Clear all cart items
router.delete("/clear/:userId", cartController.clearCart);

module.exports = router;
