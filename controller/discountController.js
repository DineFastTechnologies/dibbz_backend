// controllers/discountController.js
const admin = require("firebase-admin");
const db = admin.firestore();
const { createNotification } = require('../services/notificationService');

/**
 * Create a new discount (Admin)
 */
exports.createDiscount = async (req, res) => {
  try {
    const {
      type,               // "time_slot" | "coupon" | "general"
      discountMode,       // "percentage" | "flat"
      amount,             // number
      timeSlot,           // { start: "18:00", end: "20:00" }
      couponCode,
      appliesTo,
      validFrom,
      validUntil,
      isActive,
      maxUses
    } = req.body;

    // Restaurant context
    const restaurantId = req.user?.restaurantId || req.body.restaurantId;
    if (!restaurantId) {
      return res.status(400).json({ success: false, error: "restaurantId is required" });
    }

    if (!type || !discountMode || !amount) {
      return res.status(400).json({ success: false, error: "type, discountMode and amount are required" });
    }

    // Validate dates
    const fromDate = validFrom ? new Date(validFrom) : null;
    const untilDate = validUntil ? new Date(validUntil) : null;
    if (fromDate && untilDate && fromDate >= untilDate) {
      return res.status(400).json({ success: false, error: "validFrom must be before validUntil" });
    }

    // Validate timeSlot if provided
    if (timeSlot && timeSlot.start >= timeSlot.end) {
      return res.status(400).json({ success: false, error: "timeSlot start must be before end" });
    }

    const newDiscountRef = db.collection("discounts").doc();
    await newDiscountRef.set({
      restaurantId,
      type,
      discountMode,
      amount,
      timeSlot: timeSlot || null,
      couponCode: couponCode || null,
      appliesTo: appliesTo || ["booking", "preorder", "finalBill", "dineInPayment"],
      validFrom: fromDate,
      validUntil: untilDate,
      isActive: isActive ?? true,
      maxUses: maxUses || null,
      usedCount: 0,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.status(201).json({ success: true, message: "Discount created", id: newDiscountRef.id });

    // Send a notification to all users
    const usersSnapshot = await db.collection('users').get();
    usersSnapshot.forEach(userDoc => {
      createNotification(
        userDoc.id,
        'New Discount Available!',
        `A new ${discountMode} discount of ${amount} is available.`
      );
    });
  } catch (error) {
    console.error("Error creating discount:", error);
    res.status(500).json({ success: false, error: "Failed to create discount" });
  }
};


/**
 * Get all discounts (Admin)
 */
exports.getAllDiscounts = async (req, res) => {
  try {
    let query = db.collection("discounts");

    if (req.user?.role === "restaurantAdmin") {
      query = query.where("restaurantId", "==", req.user.restaurantId);
    }

    const snapshot = await query.get();
    const discounts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.status(200).json({ success: true, discounts });
  } catch (error) {
    console.error("Error fetching discounts:", error);
    res.status(500).json({ success: false, error: "Failed to fetch discounts" });
  }
};


/**
 * Get single discount by ID
 */
exports.getDiscountById = async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await db.collection("discounts").doc(id).get();
    if (!doc.exists) {
      return res.status(404).json({ success: false, error: "Discount not found" });
    }
    res.status(200).json({ success: true, discount: { id: doc.id, ...doc.data() } });
  } catch (error) {
    console.error("Error fetching discount:", error);
    res.status(500).json({ success: false, error: "Failed to fetch discount" });
  }
};

/**
 * Update a discount
 */
exports.updateDiscount = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    await db.collection("discounts").doc(id).update({
      ...updates,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.status(200).json({ success: true, message: "Discount updated" });
  } catch (error) {
    console.error("Error updating discount:", error);
    res.status(500).json({ success: false, error: "Failed to update discount" });
  }
};

/**
 * Delete a discount
 */
exports.deleteDiscount = async (req, res) => {
  try {
    const { id } = req.params;
    await db.collection("discounts").doc(id).delete();
    res.status(200).json({ success: true, message: "Discount deleted" });
  } catch (error) {
    console.error("Error deleting discount:", error);
    res.status(500).json({ success: false, error: "Failed to delete discount" });
  }
};
