// src/routes/orders.js
const express = require('express');
const router = express.Router();

const {
  createOrder,
  getUserOrders,
  getOrderDetail,
  updateOrderStatus, // For restaurant staff/admin
  cancelOrder, // For user
  confirmPayment, // For payment gateway webhook or client confirmation
} = require('../controller/orderController'); // This controller will be created next

// POST create a new order (can include pre-ordered food and link to booking)
router.post('/', createOrder);

// GET user's orders (past and upcoming)
router.get('/', getUserOrders);

// GET a specific order detail
router.get('/:orderId', getOrderDetail);

// PUT update order status (e.g., by restaurant owner/staff)
router.put('/:orderId/status', updateOrderStatus);

// PATCH cancel an order (by user)
router.patch('/:orderId/cancel', cancelOrder);

// POST endpoint for payment gateway to confirm payment (or frontend confirms successful payment)
// This might be a webhook from a payment gateway, so it might not need 'authenticate' middleware
// if the gateway sends its own auth token. If frontend-triggered, it would need 'authenticate'.
router.post('/:orderId/confirm-payment', confirmPayment);


module.exports = router;