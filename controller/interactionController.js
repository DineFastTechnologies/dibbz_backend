ryrh // controller/interactionController.js
const { admin, db } = require('../firebase');

exports.likeRestaurant = async (req, res) => {
  const { id } = req.params;
  const { uid } = req.user;

  try {
    const restaurantRef = db.collection('restaurants').doc(id);
    const userRef = db.collection('users').doc(uid);

    const restaurantDoc = await restaurantRef.get();
    if (!restaurantDoc.exists) {
      return res.status(404).json({ success: false, error: 'Restaurant not found' });
    }

    await restaurantRef.update({
      likes: admin.firestore.FieldValue.increment(1)
    });

    await userRef.update({
      likedRestaurants: admin.firestore.FieldValue.arrayUnion(id)
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.shareRestaurant = async (req, res) => {
  const { id } = req.params;

  try {
    const restaurantRef = db.collection('restaurants').doc(id);
    const restaurantDoc = await restaurantRef.get();
    if (!restaurantDoc.exists) {
      return res.status(404).json({ success: false, error: 'Restaurant not found' });
    }

    await restaurantRef.update({
      shares: admin.firestore.FieldValue.increment(1)
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.likeMenuItem = async (req, res) => {
  const { id } = req.params;
  const { uid } = req.user;

  try {
    const menuItemRef = db.collection('menuItems').doc(id);
    const userRef = db.collection('users').doc(uid);

    const menuItemDoc = await menuItemRef.get();
    if (!menuItemDoc.exists) {
      return res.status(404).json({ success: false, error: 'Menu item not found' });
    }

    await menuItemRef.update({
      likes: admin.firestore.FieldValue.increment(1)
    });

    await userRef.update({
      likedMenuItems: admin.firestore.FieldValue.arrayUnion(id)
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.shareMenuItem = async (req, res) => {
  const { id } = req.params;

  try {
    const menuItemRef = db.collection('menuItems').doc(id);
    const menuItemDoc = await menuItemRef.get();
    if (!menuItemDoc.exists) {
      return res.status(404).json({ success: false, error: 'Menu item not found' });
    }

    await menuItemRef.update({
      shares: admin.firestore.FieldValue.increment(1)
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
