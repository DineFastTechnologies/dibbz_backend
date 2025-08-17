// src/routes/paymentRoutes.js
const express = require("express");
const router = express.Router();
const paymentController = require("../controller/paymentController");

router.post("/quote", paymentController.getQuote);
router.post("/create", paymentController.createPayment);
router.get("/user/:userId", paymentController.getPaymentsByUser);
router.get("/order/:razorpayOrderId", paymentController.getPaymentByOrderId);

module.exports = router;
