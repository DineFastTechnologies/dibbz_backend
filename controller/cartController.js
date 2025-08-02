const admin = require("firebase-admin");
const db = admin.firestore();

// Add item to cart
exports.addItemToCart = async (req, res) => {
  try {
    const { userId, item } = req.body;

    if (!userId || !item?.id) {
      return res.status(400).json({ error: "Missing userId or item" });
    }

    await db.collection("users").doc(userId).collection("cart").doc(item.id).set(item);

    res.status(200).json({ success: true, message: "Item added to cart" });
  } catch (err) {
    console.error("Add to cart error:", err);
    res.status(500).json({ success: false, error: "Failed to add item to cart" });
  }
};

// Get all cart items
exports.getCart = async (req, res) => {
  try {
    const { userId } = req.params;

    const cartSnap = await db.collection("users").doc(userId).collection("cart").get();
    const cartItems = cartSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    res.status(200).json({ success: true, cart: cartItems });
  } catch (err) {
    console.error("Get cart error:", err);
    res.status(500).json({ success: false, error: "Failed to fetch cart" });
  }
};

// Remove item from cart
exports.removeItemFromCart = async (req, res) => {
  try {
    const { userId, itemId } = req.params;

    await db.collection("users").doc(userId).collection("cart").doc(itemId).delete();

    res.status(200).json({ success: true, message: "Item removed from cart" });
  } catch (err) {
    console.error("Remove item error:", err);
    res.status(500).json({ success: false, error: "Failed to remove item" });
  }
};

// Clear cart
exports.clearCart = async (req, res) => {
  try {
    const { userId } = req.params;

    const cartRef = db.collection("users").doc(userId).collection("cart");
    const snapshot = await cartRef.get();

    const batch = db.batch();
    snapshot.forEach(doc => batch.delete(doc.ref));
    await batch.commit();

    res.status(200).json({ success: true, message: "Cart cleared" });
  } catch (err) {
    console.error("Clear cart error:", err);
    res.status(500).json({ success: false, error: "Failed to clear cart" });
  }
};