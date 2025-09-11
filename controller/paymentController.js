// src/controller/paymentController.js
const Razorpay = require("razorpay");
const { admin, db } = require("../firebase");
const pricingService = require("../services/pricingService");

// Initialize Razorpay only if credentials are available
let razorpay = null;
if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_SECRET) {
  razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_SECRET,
  });
} else {
  console.warn('Razorpay credentials not found. Payment functionality will be limited.');
}

/**
 * STEP 1: Quote endpoint
 */
exports.getQuote = async (req, res) => {
  try {
    const { userId, restaurantId, items, promoCode, orderType, bookingTime } = req.body;

    if (!restaurantId || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: "Missing restaurantId or items" });
    }

    const quote = await pricingService.quote({
      userId,
      restaurantId,
      items,
      promoCode,
      orderType,
      bookingTime,
    });

    return res.status(200).json({ success: true, quote });
  } catch (error) {
    console.error("Quote error:", error);
    res.status(500).json({ success: false, error: "Failed to generate quote" });
  }
};

/**
 * STEP 2: Unified Payment Creation
 */
exports.createPayment = async (req, res) => {
  try {
    const { userId, restaurantId, items, promoCode, orderType, bookingTime, paymentType } = req.body;
    // paymentType = "preorder" | "remaining" | "full"

    if (!userId || !restaurantId || !paymentType) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    // Get quote
    const quote = await pricingService.quote({
      userId,
      restaurantId,
      items,
      promoCode,
      orderType,
      bookingTime,
    });

    // Decide payable amount
    let amountToPay = quote.pricing.totalPayable;
    if (paymentType === "preorder" && quote.split.enabled) {
      amountToPay = quote.split.now;
    } else if (paymentType === "remaining" && quote.split.enabled) {
      amountToPay = quote.split.later;
    } else if (paymentType === "full") {
      amountToPay = quote.pricing.totalPayable;
    }

    // Check if Razorpay is initialized
    if (!razorpay) {
      return res.status(503).json({ 
        success: false, 
        error: "Payment service not available. Razorpay credentials not configured." 
      });
    }

    // Razorpay order
    const order = await razorpay.orders.create({
      amount: Math.round(amountToPay * 100), // paise
      currency: quote.currency || "INR",
      receipt: `${paymentType}_${Date.now()}`,
      notes: { userId, restaurantId, type: paymentType },
    });

    // Save record
    await db.collection("data").doc("payments").collection("records").add({
      userId,
      restaurantId,
      paymentType,
      orderType,
      quote,
      paidAmount: amountToPay,
      status: "created",
      razorpayOrderId: order.id,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.status(200).json({ success: true, order, quote });
  } catch (error) {
    console.error("Create payment error:", error);
    res.status(500).json({ success: false, error: "Payment creation failed" });
  }
};

/**
 * STEP 3: Get all payments for a user
 */
exports.getPaymentsByUser = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) {
      return res.status(400).json({ success: false, error: "UserId is required" });
    }

    const snapshot = await db
      .collection("data")
      .doc("payments")
      .collection("records")
      .where("userId", "==", userId)
      .get();

    const payments = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    res.status(200).json({ success: true, payments });
  } catch (error) {
    console.error("Get payments error:", error);
    res.status(500).json({ success: false, error: "Failed to fetch payments" });
  }
};

/**
 * STEP 4: Get single payment by Razorpay orderId
 */
exports.getPaymentByOrderId = async (req, res) => {
  try {
    const { razorpayOrderId } = req.params;

    const snapshot = await db
      .collection("data")
      .doc("payments")
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
