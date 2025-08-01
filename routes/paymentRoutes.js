const express = require("express");
const router = express.Router();
const paymentController = require("../controller/paymentController");

router.post("/preorder", paymentController.createPreorderPayment);
router.post("/remaining", paymentController.createRemainingPayment);

module.exports = router;
