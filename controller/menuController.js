// src/controller/menuController.js

// MODIFIED: Import admin and db directly from the firebase.js file
const { admin, db } = require('../firebase'); 

// Helper function to check if the authenticated user owns the target restaurant.
// MODIFIED: Uses directly imported 'db' and 'admin'
const checkRestaurantOwnership = async (req, res) => {
  const restaurantId = req.params.restaurantId;
  const authenticatedUserId = req.user.uid;

  try {
    const userDoc = await db.collection('users').doc(authenticatedUserId).get(); // Use directly imported 'db'
    if (!userDoc.exists) {
      res.status(403).send('Forbidden: User profile not found.');
      return false;
    }
    const userRole = userDoc.data()?.role;
    const ownedRestaurantId = userDoc.data()?.ownedRestaurantId;

    if (userRole === 'admin') {
      return true;
    }
    if (userRole === 'restaurant_owner' && ownedRestaurantId === restaurantId) {
      return true;
    }

    res.status(403).send('Forbidden: You do not own this restaurant or lack permissions.');
    return false;
  } catch (error) {
    console.error('Error checking restaurant ownership:', error);
    res.status(500).send('Server error during ownership check.');
    return false;
  }
};


// GET all menu items for a specific restaurant
// MODIFIED: Uses directly imported 'db' and 'admin'
const getMenuItems = async (req, res) => {
  const restaurantId = req.params.restaurantId;

  console.log(`[menuController] getMenuItems: Received request for restaurantId: "${restaurantId}"`);
  console.log(`[menuController] Checking database for restaurant: "restaurants/${restaurantId}"`);

  try {
    // Verify the main restaurant document exists first
    const restaurantDocRef = db.collection('restaurants').doc(restaurantId); // Use directly imported 'db'
    const restaurantDocSnapshot = await restaurantDocRef.get();

    if (!restaurantDocSnapshot.exists) {
      console.log(`[menuController] ERROR: Restaurant document "${restaurantId}" DOES NOT EXIST in Firestore.`);
      return res.status(404).send('Restaurant not found.');
    }
    console.log(`[menuController] INFO: Restaurant document "${restaurantId}" EXISTS.`);

    // Now, query the subcollection
    const menuItemsCollectionRef = restaurantDocRef.collection('menuItems');
    console.log(`[menuController] Querying subcollection: "restaurants/${restaurantId}/menuItems"`);

    const menuItemsSnapshot = await menuItemsCollectionRef
      .orderBy('category', 'asc')
      .orderBy('name', 'asc')
      .get();

    console.log(`[menuController] getMenuItems: Firestore snapshot received. Empty: ${menuItemsSnapshot.empty}, Size: ${menuItemsSnapshot.size}`);

    const menuItems = menuItemsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    console.log(`[menuController] getMenuItems: Found ${menuItems.length} menu items after mapping.`);
    if (menuItems.length === 0) {
      console.log(`[menuController] getMenuItems: Menu items list is EMPTY. This means either no documents exist or the query filter is too restrictive.`);
    } else {
      console.log(`[menuController] getMenuItems: First item example:`, JSON.stringify(menuItems[0], null, 2));
    }

    res.status(200).json(menuItems);
  } catch (error) {
    console.error(`Error fetching menu items for restaurant ${restaurantId}:`, error);
    res.status(500).send('Failed to fetch menu items.');
  }
};

// CREATE a new menu item
// MODIFIED: Uses directly imported 'db' and 'admin'
const createMenuItem = async (req, res) => {
  if (!await checkRestaurantOwnership(req, res)) return;

  const restaurantId = req.params.restaurantId;
  const { name, description, price, category, imageUrl, isAvailable = true } = req.body;

  if (!name || !price || !category) {
    return res.status(400).send('Missing required fields: name, price, category.');
  }
  if (typeof price !== 'number' || price <= 0) {
    return res.status(400).send('Price must be a positive number.');
  }

  try {
    const newMenuItemRef = await db.collection('restaurants').doc(restaurantId).collection('menuItems').add({ // Use directly imported 'db'
      name,
      description: description || '',
      price: parseFloat(price),
      category,
      imageUrl: imageUrl || '',
      isAvailable,
      createdAt: admin.firestore.FieldValue.serverTimestamp(), // Use directly imported 'admin'
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    res.status(201).json({ id: newMenuItemRef.id, message: 'Menu item created successfully!' });
  } catch (error) {
    console.error(`Error creating menu item for restaurant ${restaurantId}:`, error);
    res.status(500).send('Failed to create menu item.');
  }
};

// UPDATE a specific menu item
// MODIFIED: Uses directly imported 'db' and 'admin'
const updateMenuItem = async (req, res) => {
  if (!await checkRestaurantOwnership(req, res)) return;

  const restaurantId = req.params.restaurantId;
  const menuItemId = req.params.menuItemId;
  const { name, description, price, category, imageUrl, isAvailable } = req.body;

  const updateData = {};
  if (name !== undefined) updateData.name = name;
  if (description !== undefined) updateData.description = description;
  if (price !== undefined) {
    const parsedPrice = parseFloat(price);
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      return res.status(400).send('Invalid price provided.');
    }
    updateData.price = parsedPrice;
  }
  if (category !== undefined) updateData.category = category;
  if (imageUrl !== undefined) updateData.imageUrl = imageUrl;
  if (isAvailable !== undefined) updateData.isAvailable = isAvailable;
  updateData.updatedAt = admin.firestore.FieldValue.serverTimestamp(); // Use directly imported 'admin'

  if (Object.keys(updateData).length <= 1 && updateData.updatedAt) {
    return res.status(400).send('No relevant menu item data provided for update.');
  }

  try {
    const menuItemRef = db.collection('restaurants').doc(restaurantId).collection('menuItems').doc(menuItemId); // Use directly imported 'db'
    const doc = await menuItemRef.get();
    if (!doc.exists) {
      return res.status(404).send('Menu item not found.');
    }

    await menuItemRef.update(updateData);
    res.status(200).send('Menu item updated successfully!');
  } catch (error) {
    console.error(`Error updating menu item ${menuItemId} for restaurant ${restaurantId}:`, error);
    res.status(500).send('Failed to update menu item.');
  }
};

// DELETE a specific menu item
// MODIFIED: Uses directly imported 'db'
const deleteMenuItem = async (req, res) => {
  if (!await checkRestaurantOwnership(req, res)) return;

  const restaurantId = req.params.restaurantId;
  const menuItemId = req.params.menuItemId;

  try {
    const menuItemRef = db.collection('restaurants').doc(restaurantId).collection('menuItems').doc(menuItemId); // Use directly imported 'db'
    const doc = await menuItemRef.get();
    if (!doc.exists) {
      return res.status(404).send('Menu item not found.');
    }

    await menuItemRef.delete();
    res.status(200).send('Menu item deleted successfully!');
  } catch (error) {
    console.error(`Error deleting menu item ${menuItemId} for restaurant ${restaurantId}:`, error);
    res.status(500).send('Failed to delete menu item.');
  }
};

const getMenuItemById = async (req, res) => {
  const { restaurantId, menuItemId } = req.params;

  try {
    const menuItemDoc = await db.collection('restaurants').doc(restaurantId).collection('menuItems').doc(menuItemId).get();

    if (!menuItemDoc.exists) {
      return res.status(404).send('Menu item not found.');
    }

    res.status(200).json({ id: menuItemDoc.id, ...menuItemDoc.data() });
  } catch (error) {
    console.error(`Error fetching menu item ${menuItemId} for restaurant ${restaurantId}:`, error);
    res.status(500).send('Failed to fetch menu item.');
  }
};

module.exports = {
  getMenuItems,
  getMenuItemById,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
};
