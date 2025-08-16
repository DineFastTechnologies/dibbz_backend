// src/routes/paymentRoutes.js
const express = require("express");
const router = express.Router();
const paymentController = require("../controller/paymentController");
// ----- POST Endpoints (create payments) -----
router.post("/preorder", paymentController.createPreorderPayment);
router.post("/remaining", paymentController.createRemainingPayment);
router.post("/full", paymentController.createFullPayment);
router.get("/user/:userId", paymentController.getPaymentsByUser);
router.get("/:razorpayOrderId", paymentController.getPaymentByOrderId);

module.exports = router;
