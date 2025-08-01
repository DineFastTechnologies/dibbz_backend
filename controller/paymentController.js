const Razorpay = require("razorpay");
const admin = require("firebase-admin");

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_SECRET,
});

const db = admin.firestore();


exports.createPreorderPayment = async (req, res) => {
  try {
    const { userId, totalAmount } = req.body;

    if (!userId || !totalAmount) {
      return res.status(400).json({ success: false, error: "Missing fields" });
    }

    const halfAmount = Math.round(totalAmount * 0.6); 

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

    const remainingAmount = Math.round(totalAmount * 0.4); 

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
