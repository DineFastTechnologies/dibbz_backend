const admin = require("firebase-admin");
const db = admin.firestore();

exports.generateReceipt = async (req, res) => {
  try {
    const { userId, restaurantId, orderId } = req.body;

    // 1. Fetch cart data
    const cartRef = db.collection("users").doc(userId).collection("cart");
    const cartSnapshot = await cartRef.get();

    if (cartSnapshot.empty) {
      return res.status(400).json({ success: false, message: "Cart is empty." });
    }

    const cartItems = [];
    let subtotal = 0;

    cartSnapshot.forEach(doc => {
      const item = doc.data();
      subtotal += item.price * item.quantity;
      cartItems.push(item);
    });

    // 2. Calculate GST
    const gstRate = 0.05;
    const gstAmount = parseFloat((subtotal * gstRate).toFixed(2));
    const totalAmount = parseFloat((subtotal + gstAmount).toFixed(2));

    // 3. Create receipt data
    const receiptData = {
      receiptId: doc.id,  
  ...doc.data(),
      userId,
      restaurantId,
      orderId,
      items: cartItems,
      subtotal,
      gstRate: 5,
      gstAmount,
      totalAmount,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };

    // 4. Save under user's receipt
    const receiptRef = db.collection("users").doc(userId).collection("receipts").doc();
    await receiptRef.set(receiptData);

    // (Optional) Save under restaurant as well
    await db.collection("restaurants").doc(restaurantId).collection("receipts").doc(receiptRef.id).set(receiptData);

    res.status(200).json({ success: true, receiptId: receiptRef.id, receipt: receiptData });

  } catch (error) {
    console.error("Receipt generation error:", error);
    res.status(500).json({ success: false, message: "Failed to generate receipt" });
  }
};

exports.getReceiptsByUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const receiptsRef = db.collection("users").doc(userId).collection("receipts");
    const snapshot = await receiptsRef.orderBy("createdAt", "desc").get();

    if (snapshot.empty) {
      return res.status(200).json({ success: true, receipts: [] });
    }

    const receipts = snapshot.docs.map(doc => doc.data());

    res.status(200).json({
      success: true,
      receipts
    });
  } catch (error) {
    console.error("Error fetching user receipts:", error);
    res.status(500).json({ success: false, error: "Failed to fetch receipts" });
  }
};

exports.getReceiptById = async (req, res) => {
  try {
    const { receiptId } = req.params;

    // Search all users' receipts (or scope to user if needed)
    const usersSnapshot = await db.collection("users").get();
    let foundReceipt = null;

    for (const userDoc of usersSnapshot.docs) {
      const receiptRef = db
        .collection("users")
        .doc(userDoc.id)
        .collection("receipts")
        .doc(receiptId);
      const receiptDoc = await receiptRef.get();

      if (receiptDoc.exists) {
        foundReceipt = receiptDoc.data();
        break;
      }
    }

    if (!foundReceipt) {
      return res.status(404).json({ success: false, error: "Receipt not found" });
    }

    res.status(200).json({
      success: true,
      receipt: foundReceipt
    });
  } catch (error) {
    console.error("Error fetching receipt by ID:", error);
    res.status(500).json({ success: false, error: "Failed to retrieve receipt" });
  }
};

exports.deleteReceiptById = async (req, res) => {
  try {
    const { receiptId } = req.params;

    // Optional: add admin check here later if needed

    const usersSnapshot = await db.collection("users").get();
    let deleted = false;

    for (const userDoc of usersSnapshot.docs) {
      const receiptRef = db
        .collection("users")
        .doc(userDoc.id)
        .collection("receipts")
        .doc(receiptId);

      const receiptDoc = await receiptRef.get();

      if (receiptDoc.exists) {
        await receiptRef.delete();
        deleted = true;
        break;
      }
    }

    if (!deleted) {
      return res.status(404).json({ success: false, error: "Receipt not found" });
    }

    res.status(200).json({ success: true, message: "Receipt deleted successfully" });
  } catch (error) {
    console.error("Error deleting receipt:", error);
    res.status(500).json({ success: false, error: "Failed to delete receipt" });
  }
};
exports.getReceiptsByUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const receiptsRef = db
      .collection("users")
      .doc(userId)
      .collection("receipts");

    const snapshot = await receiptsRef.orderBy("createdAt", "desc").get();

    const receipts = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    res.status(200).json({ success: true, receipts });
  } catch (error) {
    console.error("Error fetching user receipts:", error);
    res.status(500).json({ success: false, error: "Failed to fetch receipts" });
  }
};
