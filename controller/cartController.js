// src/controller/cartController.js
const { admin, db } = require('../firebase'); // Vercel-ready direct imports
const { createNotification } = require('../services/notificationService');

// Add item to cart
exports.addItemToCart = async (req, res) => {
  const { userId } = req.params;
  const { item, quantity } = req.body;
  const authenticatedUserId = req.user.uid;

  if (userId !== authenticatedUserId) {
    return res.status(403).json({ success: false, error: "Forbidden: You can only modify your own cart." });
  }

  if (!item?.id || quantity == null) {
    return res.status(400).json({ success: false, error: "Missing itemId or quantity." });
  }

  if (quantity <= 0) {
    return res.status(400).json({ success: false, error: "Quantity must be a positive number." });
  }

  try {
    const itemRef = db.collection("users").doc(userId).collection("cart").doc(item.id);
    await itemRef.set({
        ...item,
        quantity,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        createdAt: item.createdAt || admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true }); // Use merge to avoid overwriting other fields

    res.status(200).json({ success: true, message: "Item added to cart", itemId: item.id });

    // Send a notification to the user
    await createNotification(
      userId,
      'Item Added to Cart',
      `You have added ${item.name} to your cart.`
    );
  } catch (err) {
    console.error("Add to cart error:", err);
    res.status(500).json({ success: false, error: "Failed to add item to cart" });
  }
};

// Get all cart items
exports.getCart = async (req, res) => {
  const { userId } = req.params;
  const authenticatedUserId = req.user.uid;

  if (userId !== authenticatedUserId) {
    return res.status(403).json({ success: false, error: "Forbidden: You can only view your own cart." });
  }

  try {
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
  const { userId, itemId } = req.params;
  const authenticatedUserId = req.user.uid;

  if (userId !== authenticatedUserId) {
    return res.status(403).json({ success: false, error: "Forbidden: You can only modify your own cart." });
  }

  try {
    await db.collection("users").doc(userId).collection("cart").doc(itemId).delete();

    res.status(200).json({ success: true, message: "Item removed from cart" });
  } catch (err) {
    console.error("Remove item error:", err);
    res.status(500).json({ success: false, error: "Failed to remove item" });
  }
};

// Clear cart
exports.clearCart = async (req, res) => {
  const { userId } = req.params;
  const authenticatedUserId = req.user.uid;

  if (userId !== authenticatedUserId) {
    return res.status(403).json({ success: false, error: "Forbidden: You can only clear your own cart." });
  }

  try {
    const cartRef = db.collection("users").doc(userId).collection("cart");
    const snapshot = await cartRef.get();

    const batch = db.batch();
    snapshot.forEach(doc => batch.delete(doc.ref));
    await batch.commit();

    res.status(200).json({ success: true, message: "Cart cleared" });

    // Send a notification to the user
    await createNotification(
      userId,
      'Cart Cleared',
      'Your cart has been cleared.'
    );
  } catch (err) {
    console.error("Clear cart error:", err);
    res.status(500).json({ success: false, error: "Failed to clear cart" });
  }
};
