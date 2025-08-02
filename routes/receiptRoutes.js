const express = require("express");
const router = express.Router();
const receiptController = require("../controller/receiptController");

router.post("/generate", receiptController.generateReceipt);
router.get("/:userId", receiptController.getReceiptsByUser);
router.get("/:receiptId", receiptController.getReceiptById);
router.delete("/:receiptId", receiptController.deleteReceiptById);
router.get("/user/:userId", receiptController.getReceiptsByUser);

module.exports = router;
