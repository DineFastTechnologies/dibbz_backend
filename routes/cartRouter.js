// src/routes/cart.js
const express = require('express');
const router = express.Router({ mergeParams: true });
const cartController = require('../controller/cartController'); // Import the cart controller

// Add item to cart
router.post('/:userId/items', cartController.addItemToCart);

// Get all cart items
router.get('/:userId/items', cartController.getCart);

// Remove item from cart
router.delete('/:userId/items/:itemId', cartController.removeItemFromCart);

// Clear cart
router.delete('/:userId/items', cartController.clearCart);

module.exports = router;
