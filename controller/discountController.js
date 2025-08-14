// controllers/discountController.js
const admin = require("firebase-admin");
const db = admin.firestore();

/**
 * Create a new discount (Admin)
 */
exports.createDiscount = async (req, res) => {
  try {
    const { type, timeSlot, discountPercent, couponCode, appliesTo, validFrom, validUntil, isActive } = req.body;

    if (!type || !discountPercent) {
      return res.status(400).json({ success: false, error: "type and discountPercent are required" });
    }

    const newDiscountRef = db.collection("discounts").doc();
    await newDiscountRef.set({
      type, // "time_slot" | "coupon" | "general"
      timeSlot: timeSlot || null, // { start: "18:00", end: "19:00" }
      discountPercent,
      couponCode: couponCode || null,
      appliesTo: appliesTo || ["booking", "preorder", "finalBill"],
      validFrom: validFrom ? new Date(validFrom) : null,
      validUntil: validUntil ? new Date(validUntil) : null,
      isActive: isActive ?? true,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.status(201).json({ success: true, message: "Discount created", id: newDiscountRef.id });
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
    const snapshot = await db.collection("discounts").get();
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
