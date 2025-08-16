// src/controller/paymentController.js
const Razorpay = require("razorpay");
const { admin, db } = require('../firebase'); // Vercel-ready direct imports

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_SECRET,
});


exports.createPreorderPayment = async (req, res) => {
  try {
    const { userId, totalAmount } = req.body;

    if (!userId || !totalAmount) {
      return res.status(400).json({ success: false, error: "Missing fields" });
    }

    const halfAmount = Math.round(totalAmount * 0.6); // Amount in smallest currency unit (e.g., paise)

    const order = await razorpay.orders.create({
      amount: halfAmount,
      currency: "INR",
      receipt: `preorder_${Date.now()}`,
      notes: { userId, type: "preorder" }
    });

    await db.collection("data").doc("payments")
      .collection("records").add({
        userId,
        type: "preorder",
        totalAmount,
        paidAmount: halfAmount,
        status: "created",
        razorpayOrderId: order.id,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

    res.status(200).json({ success: true, order });
  } catch (error) {
    console.error("Preorder error:", error);
    res.status(500).json({ success: false, error: "Preorder payment failed" });
  }
};


exports.createRemainingPayment = async (req, res) => {
  try {
    const { userId, totalAmount } = req.body;

    if (!userId || !totalAmount) {
      return res.status(400).json({ success: false, error: "Missing fields" });
    }

    const remainingAmount = Math.round(totalAmount * 0.4); // Amount in smallest currency unit

    const order = await razorpay.orders.create({
      amount: remainingAmount,
      currency: "INR",
      receipt: `remaining_${Date.now()}`,
      notes: { userId, type: "remaining" }
    });

    await db.collection("data").doc("payments")
      .collection("records").add({
        userId,
        type: "remaining",
        totalAmount,
        paidAmount: remainingAmount ,
        status: "created",
        razorpayOrderId: order.id,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

    res.status(200).json({ success: true, order });
  } catch (error) {
    console.error("Remaining payment error:", error);
    res.status(500).json({ success: false, error: "Remaining payment failed" });
  }
};

exports.createFullPayment = async (req, res) => {
  try {
    const { userId, totalAmount } = req.body;

    if (!userId || !totalAmount) {
      return res.status(400).json({ success: false, error: "Missing fields" });
    }

    const fullAmount = Math.round(totalAmount); // full amount in smallest currency unit

    const order = await razorpay.orders.create({
      amount: fullAmount,
      currency: "INR",
      receipt: `fullpayment_${Date.now()}`,
      notes: { userId, type: "full" }
    });

    await db.collection("data").doc("payments")
      .collection("records").add({
        userId,
        type: "full",
        totalAmount,
        paidAmount: fullAmount,
        status: "created",
        razorpayOrderId: order.id,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

    res.status(200).json({ success: true, order });
  } catch (error) {
    console.error("Full payment error:", error);
    res.status(500).json({ success: false, error: "Full payment failed" });
  }
};


exports.getPaymentsByUser = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) {
      return res.status(400).json({ success: false, error: "UserId is required" });
    }

    const snapshot = await db.collection("data").doc("payments")
      .collection("records")
      .where("userId", "==", userId)
      .get();

    const payments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    res.status(200).json({ success: true, payments });
  } catch (error) {
    console.error("Get payments error:", error);
    res.status(500).json({ success: false, error: "Failed to fetch payments" });
  }
};

exports.getPaymentByOrderId = async (req, res) => {
  try {
    const { razorpayOrderId } = req.params;

    const snapshot = await db.collection("data").doc("payments")
      .collection("records")
      .where("razorpayOrderId", "==", razorpayOrderId)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return res.status(404).json({ success: false, error: "Payment not found" });
    }

    const payment = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };

    res.status(200).json({ success: true, payment });
  } catch (error) {
    console.error("Get payment error:", error);
    res.status(500).json({ success: false, error: "Failed to fetch payment" });
  }
};
