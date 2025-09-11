// src/controller/menuController.js

const { admin, db } = require('../firebase'); 

/**
 * GET all menu items for a specific restaurant
 */
const getMenuItems = async (req, res) => {
  const restaurantId = req.params.restaurantId;

  try {
    // Ensure restaurant exists
    const restaurantDocRef = db.collection('restaurants').doc(restaurantId);
    const restaurantDoc = await restaurantDocRef.get();

    if (!restaurantDoc.exists) {
      return res.status(404).json({ error: 'Restaurant not found.' });
    }

    // Fetch menu items
    const menuItemsSnapshot = await restaurantDocRef
      .collection('menuItems')
      .orderBy('category', 'asc')
      .orderBy('name', 'asc')
      .get();

    const menuItems = menuItemsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    return res.status(200).json(menuItems);
  } catch (error) {
    console.error(`[menuController] Error fetching menu items:`, error);
    return res.status(500).json({ error: 'Failed to fetch menu items.' });
  }
};

/**
 * CREATE a new menu item
 */
const createMenuItem = async (req, res) => {
  const restaurantId = req.params.restaurantId;
  const { name, description, price, category, imageUrl, isAvailable = true } = req.body;

  if (!name || !price || !category) {
    return res.status(400).json({ error: 'Missing required fields: name, price, category.' });
  }
  if (typeof price !== 'number' || price <= 0) {
    return res.status(400).json({ error: 'Price must be a positive number.' });
  }

  try {
    const newMenuItemRef = await db
      .collection('restaurants')
      .doc(restaurantId)
      .collection('menuItems')
      .add({
        name,
        description: description || '',
        price: parseFloat(price),
        category,
        imageUrl: imageUrl || '',
        isAvailable,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

    return res.status(201).json({
      id: newMenuItemRef.id,
      message: 'Menu item created successfully!',
    });
  } catch (error) {
    console.error(`[menuController] Error creating menu item:`, error);
    return res.status(500).json({ error: 'Failed to create menu item.' });
  }
};

/**
 * UPDATE a specific menu item
 */
const updateMenuItem = async (req, res) => {
  const restaurantId = req.params.restaurantId;
  const menuItemId = req.params.menuItemId;
  const { name, description, price, category, imageUrl, isAvailable } = req.body;

  const updateData = {};
  if (name !== undefined) updateData.name = name;
  if (description !== undefined) updateData.description = description;
  if (price !== undefined) {
    const parsedPrice = parseFloat(price);
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      return res.status(400).json({ error: 'Invalid price provided.' });
    }
    updateData.price = parsedPrice;
  }
  if (category !== undefined) updateData.category = category;
  if (imageUrl !== undefined) updateData.imageUrl = imageUrl;
  if (isAvailable !== undefined) updateData.isAvailable = isAvailable;
  updateData.updatedAt = admin.firestore.FieldValue.serverTimestamp();

  if (Object.keys(updateData).length === 1 && updateData.updatedAt) {
    return res.status(400).json({ error: 'No valid fields provided for update.' });
  }

  try {
    const menuItemRef = db
      .collection('restaurants')
      .doc(restaurantId)
      .collection('menuItems')
      .doc(menuItemId);

    const doc = await menuItemRef.get();
    if (!doc.exists) {
      return res.status(404).json({ error: 'Menu item not found.' });
    }

    await menuItemRef.update(updateData);
    return res.status(200).json({ message: 'Menu item updated successfully!' });
  } catch (error) {
    console.error(`[menuController] Error updating menu item:`, error);
    return res.status(500).json({ error: 'Failed to update menu item.' });
  }
};

/**
 * DELETE a specific menu item
 */
const deleteMenuItem = async (req, res) => {
  const restaurantId = req.params.restaurantId;
  const menuItemId = req.params.menuItemId;

  try {
    const menuItemRef = db
      .collection('restaurants')
      .doc(restaurantId)
      .collection('menuItems')
      .doc(menuItemId);

    const doc = await menuItemRef.get();
    if (!doc.exists) {
      return res.status(404).json({ error: 'Menu item not found.' });
    }

    await menuItemRef.delete();
    return res.status(200).json({ message: 'Menu item deleted successfully!' });
  } catch (error) {
    console.error(`[menuController] Error deleting menu item:`, error);
    return res.status(500).json({ error: 'Failed to delete menu item.' });
  }
};

// CREATE multiple menu items at once (batch)
// MODIFIED: Uses directly imported 'db' and 'admin'
const createMenuItems = async (req, res) => {
  const restaurantId = req.params.restaurantId;
  const { menuItems } = req.body;

  console.log(`[menuController] createMenuItems: Batch creating ${menuItems?.length || 0} items for restaurant: "${restaurantId}"`);

  if (!menuItems || !Array.isArray(menuItems) || menuItems.length === 0) {
    return res.status(400).json({ error: 'menuItems array is required and must not be empty' });
  }

  // Check ownership (if user is authenticated)
  if (req.user && !await checkRestaurantOwnership(req, res)) {
    return; // checkRestaurantOwnership handles the response
  }

  try {
    // Verify restaurant exists
    const restaurantDocRef = db.collection('restaurants').doc(restaurantId);
    const restaurantDocSnapshot = await restaurantDocRef.get();

    if (!restaurantDocSnapshot.exists) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    const batch = db.batch();
    const menuItemsCollection = restaurantDocRef.collection('menuItems');
    const createdItems = [];

    for (const item of menuItems) {
      const { name, description, price, category, isVeg, isAvailable, imageUrl } = item;

      // Validate required fields
      if (!name || !description || price === undefined) {
        return res.status(400).json({ 
          error: 'Each menu item must have name, description, and price' 
        });
      }

      const menuItemId = db.collection('temp').doc().id; // Generate unique ID
      const menuItemRef = menuItemsCollection.doc(menuItemId);

      const menuItemData = {
        id: menuItemId,
        name,
        description,
        price: parseFloat(price),
        category: category || 'Main Course',
        isVeg: isVeg !== undefined ? isVeg : true,
        isAvailable: isAvailable !== undefined ? isAvailable : true,
        imageUrl: imageUrl || null,
        restaurantId,
        createdAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now()
      };

      batch.set(menuItemRef, menuItemData);
      createdItems.push(menuItemData);
    }

    await batch.commit();

    console.log(`[menuController] Successfully created ${createdItems.length} menu items for restaurant: "${restaurantId}"`);
    res.status(201).json({ 
      message: `Successfully created ${createdItems.length} menu items`, 
      menuItems: createdItems 
    });
  } catch (error) {
    console.error(`[menuController] Error batch creating menu items for restaurant "${restaurantId}":`, error);
    res.status(500).json({ error: 'Failed to create menu items' });
  }
};

/**
 * GET check if restaurant has menu setup
 */
const checkMenuSetup = async (req, res) => {
  const restaurantId = req.params.restaurantId;
  
  console.log(`[menuController] Received restaurant ID: "${restaurantId}"`);
  console.log(`[menuController] Restaurant ID type: ${typeof restaurantId}`);
  console.log(`[menuController] Restaurant ID length: ${restaurantId?.length}`);

  try {
    // Check if restaurant exists
    const restaurantDocRef = db.collection('restaurants').doc(restaurantId);
    const restaurantDoc = await restaurantDocRef.get();

    if (!restaurantDoc.exists) {
      console.log(`[menuController] Restaurant document "${restaurantId}" does not exist`);
      return res.status(404).json({ hasMenu: false, error: 'Restaurant not found.' });
    }

    console.log(`[menuController] Restaurant document "${restaurantId}" exists, checking for menu collections...`);

    // Check if restaurant has any menu items in either 'menuItems' or 'menu' collection
    console.log(`[menuController] Checking menuItems collection for restaurant "${restaurantId}"`);
    let menuItemsSnapshot;
    try {
      menuItemsSnapshot = await restaurantDocRef
        .collection('menuItems')
        .limit(1)
        .get();
      console.log(`[menuController] menuItems query successful: empty = ${menuItemsSnapshot.empty}, size = ${menuItemsSnapshot.size}`);
    } catch (error) {
      console.error(`[menuController] Error querying menuItems collection:`, error);
      menuItemsSnapshot = { empty: true, size: 0 };
    }

    let hasMenu = !menuItemsSnapshot.empty;
    console.log(`[menuController] menuItems collection check: empty = ${menuItemsSnapshot.empty}, hasMenu = ${hasMenu}`);
    
    // If no items in 'menuItems', check 'menu' collection for backward compatibility
    if (!hasMenu) {
      console.log(`[menuController] Checking menu collection for restaurant "${restaurantId}"`);
      let menuSnapshot;
      try {
        menuSnapshot = await restaurantDocRef
          .collection('menu')
          .limit(1)
          .get();
        console.log(`[menuController] menu query successful: empty = ${menuSnapshot.empty}, size = ${menuSnapshot.size}`);
      } catch (error) {
        console.error(`[menuController] Error querying menu collection:`, error);
        menuSnapshot = { empty: true, size: 0 };
      }
      hasMenu = !menuSnapshot.empty;
      console.log(`[menuController] menu collection check: empty = ${menuSnapshot.empty}, hasMenu = ${hasMenu}`);
    }
    
    console.log(`[menuController] Final menu setup check for restaurant "${restaurantId}": hasMenu = ${hasMenu}`);
    
    res.json({ hasMenu });
  } catch (error) {
    console.error(`[menuController] Error checking menu setup for restaurant "${restaurantId}":`, error);
    res.status(500).json({ hasMenu: false, error: 'Failed to check menu setup' });
  }
};

// Debug function to test menu detection
const debugMenuCheck = async (req, res) => {
  const restaurantId = req.params.restaurantId;
  
  try {
    console.log(`[DEBUG] Testing menu check for restaurant: ${restaurantId}`);
    
    // Check if restaurant exists
    const restaurantDocRef = db.collection('restaurants').doc(restaurantId);
    const restaurantDoc = await restaurantDocRef.get();
    
    if (!restaurantDoc.exists) {
      console.log(`[DEBUG] Restaurant document does not exist`);
      return res.json({ 
        restaurantExists: false, 
        message: 'Restaurant not found',
        restaurantId 
      });
    }
    
    console.log(`[DEBUG] Restaurant exists, checking collections...`);
    console.log(`[DEBUG] Restaurant data:`, restaurantDoc.data());
    
    // Check menuItems collection
    console.log(`[DEBUG] Checking menuItems collection...`);
    const menuItemsSnapshot = await restaurantDocRef
      .collection('menuItems')
      .limit(5)
      .get();
    
    console.log(`[DEBUG] menuItems collection: empty=${menuItemsSnapshot.empty}, size=${menuItemsSnapshot.size}`);
    
    // Check menu collection
    console.log(`[DEBUG] Checking menu collection...`);
    const menuSnapshot = await restaurantDocRef
      .collection('menu')
      .limit(5)
      .get();
    
    console.log(`[DEBUG] menu collection: empty=${menuSnapshot.empty}, size=${menuSnapshot.size}`);
    
    const result = {
      restaurantExists: true,
      restaurantId,
      restaurantData: restaurantDoc.data(),
      menuItemsCollection: {
        exists: !menuItemsSnapshot.empty,
        count: menuItemsSnapshot.size,
        items: menuItemsSnapshot.docs.map(doc => ({ id: doc.id, data: doc.data() }))
      },
      menuCollection: {
        exists: !menuSnapshot.empty,
        count: menuSnapshot.size,
        items: menuSnapshot.docs.map(doc => ({ id: doc.id, data: doc.data() }))
      },
      hasMenu: !menuItemsSnapshot.empty || !menuSnapshot.empty
    };
    
    console.log(`[DEBUG] Final result:`, JSON.stringify(result, null, 2));
    res.json(result);
    
  } catch (error) {
    console.error(`[DEBUG] Error:`, error);
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getMenuItems,
  createMenuItem,
  createMenuItems,
  updateMenuItem,
  deleteMenuItem,
  checkMenuSetup,
  debugMenuCheck,
};
