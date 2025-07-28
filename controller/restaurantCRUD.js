// src/controller/restaurantCRUD.js
const { v4: uuidv4 } = require("uuid"); 
// MODIFIED: Import admin, db, and bucket directly from the firebase.js file
const { admin, db, bucket } = require("../firebase"); 

const restaurantSample = require("../data/restaurants/01/details.json"); 
const restaurantCollection = db.collection("restaurants");


// Helper function to check if the authenticated user owns the target restaurant
// MODIFIED: Uses directly imported 'db' and 'admin'
const checkRestaurantOwnership = async (req, res, restaurantId) => {
  const authenticatedUserId = req.user.uid;

  try {
    const userDoc = await db.collection('users').doc(authenticatedUserId).get(); // Use directly imported 'db'
    if (!userDoc.exists) {
      res.status(403).send('Forbidden: User profile not found.');
      return false;
    }
    const userRole = userDoc.data()?.role;
    const userOwnedRestaurantId = userDoc.data()?.ownedRestaurantId;

    if (userRole === 'admin') { 
        return true;
    }
    if (userRole === 'restaurant_owner' && userOwnedRestaurantId === restaurantId) {
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


// CREATE (Seeding function)
// MODIFIED: Uses directly imported 'db'
const createRestaurant = async (req, res) => {
  try {
    const data = require("../data/restaurants/01/details.json");
    const restaurants = data.restaurants;
    const batch = db.batch(); // Use directly imported 'db'

    restaurants.forEach((restaurant) => {
      const id = uuidv4();
      const docRef = restaurantCollection.doc(id);
      batch.set(docRef, { ...restaurant, id });
    });

    await batch.commit();
    res.status(201).send({ message: "Seeded restaurant data successfully." });
  } catch (error) {
    console.error("Seeding error:", error);
    res.status(500).send("Failed to seed restaurant data.");
  }
};


// READ (All Restaurants)
// MODIFIED: Uses directly imported 'db'
const getAllRestaurants = async (req, res) => {
  try {
    let query = restaurantCollection; // restaurantCollection uses 'db' from its declaration

    const { isPureVeg, foodCategory, lat, lng, radiusKm } = req.query;

    if (isPureVeg === 'true') {
      query = query.where("isPureVeg", "==", true);
    }

    if (foodCategory) {
      query = query.where("foodCategories", "array-contains", foodCategory);
    }

    let restaurants = [];
    if (lat && lng && radiusKm) {
        const latitude = parseFloat(lat);
        const longitude = parseFloat(lng);
        const radius = parseFloat(radiusKm);

        if (isNaN(latitude) || isNaN(longitude) || isNaN(radius)) {
            return res.status(400).send('Invalid latitude, longitude, or radius for nearby filter.');
        }
        const { minLat, maxLat, minLng, maxLng } = getBoundingBox(latitude, longitude, radius);

        const snapshot = await query.where("location.lat", ">=", minLat).where("location.lat", "<=", maxLat).get();

        snapshot.forEach((doc) => {
            const data = doc.data();
            if (data.location.lng >= minLng && data.location.lng <= maxLng) {
                restaurants.push({ id: doc.id, ...data });
            }
        });
        res.status(200).json(restaurants);
        return;
    }

    const snapshot = await query.get();
    restaurants = [];

    snapshot.forEach((doc) => {
      restaurants.push({ id: doc.id, ...doc.data() });
    });

    res.status(200).json(restaurants);
  } catch (error) {
    console.error("Read All Restaurants Error:", error);
    res.status(500).send("Failed to fetch restaurants");
  }
};


const getRestaurantById = async (req, res) => {
  try {
    const id = req.params.id;
    const doc = await restaurantCollection.doc(id).get(); // restaurantCollection uses 'db'

    if (!doc.exists) {
      return res.status(404).send("Restaurant not found");
    }

    res.status(200).json({ id: doc.id, ...doc.data() });
  } catch (error) {
    console.error("Fetch One Restaurant Error:", error);
    res.status(500).send("Failed to fetch restaurant");
  }
};


// UPDATE Restaurant (Protected)
// MODIFIED: Uses directly imported 'admin' and 'db'
const updateRestaurant = async (req, res) => {
  const id = req.params.id;
  if (!await checkRestaurantOwnership(req, res, id)) return;

  const data = req.body;

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return res.status(400).send("Invalid update data");
  }

  const allowedFields = [
    'name', 'location', 'cuisine', 'rating', 'priceLevel', 'openStatus',
    'tags', 'contactNumber', 'bannerImage', 'dineType', 'isPureVeg', 'foodCategories', 'images'
  ];
  const filteredData = {};
  for (const key of allowedFields) {
    if (data[key] !== undefined) {
      filteredData[key] = data[key];
    }
  }
  filteredData.updatedAt = admin.firestore.FieldValue.serverTimestamp(); // Use directly imported 'admin'

  if (Object.keys(filteredData).length <= 1 && filteredData.updatedAt) {
    return res.status(400).send('No relevant restaurant data provided for update.');
  }

  try {
    await restaurantCollection.doc(id).update(filteredData); // restaurantCollection uses 'db'
    res.status(200).send("Restaurant updated successfully.");
  } catch (error) {
    console.error("Update Restaurant Error:", error);
    res.status(500).send("Failed to update restaurant.");
  }
};


// DELETE Restaurant (Protected)
// MODIFIED: Uses directly imported 'db' and 'bucket'
const deleteRestaurant = async (req, res) => {
  const id = req.params.id;
  if (!await checkRestaurantOwnership(req, res, id)) return;

  try {
    // Delete all menu items and tables subcollections first
    const menuItemsSnapshot = await db.collection('restaurants').doc(id).collection('menuItems').get(); // Use directly imported 'db'
    const menuBatch = db.batch();
    menuItemsSnapshot.docs.forEach(doc => menuBatch.delete(doc.ref));
    await menuBatch.commit();

    const tablesSnapshot = await db.collection('restaurants').doc(id).collection('tables').get(); // Use directly imported 'db'
    const tableBatch = db.batch();
    tablesSnapshot.docs.forEach(doc => tableBatch.delete(doc.ref));
    await tableBatch.commit();

    // Delete associated images from Cloud Storage
    const imagePrefix = `restaurants/${id}/images/`;
    const [files] = await bucket.getFiles({ prefix: imagePrefix }); // Use directly imported 'bucket'
    if (files.length > 0) {
      await Promise.all(files.map(file => file.delete()));
      console.log(`Deleted ${files.length} images for restaurant ${id} from Cloud Storage.`);
    }

    await restaurantCollection.doc(id).delete(); // restaurantCollection uses 'db'
    res.status(200).send("Restaurant deleted successfully.");
  } catch (error) {
    console.error("Delete Restaurant Error:", error);
    res.status(500).send("Failed to delete restaurant.");
  }
};


// Helper for rough geographical bounding box calculation
function getBoundingBox(latitude, longitude, radiusKm) {
  const earthRadiusKm = 6371;

  const latDelta = radiusKm / earthRadiusKm * (180 / Math.PI);
  const lngDelta = radiusKm / (earthRadiusKm * Math.cos(latitude * Math.PI / 180)) * (180 / Math.PI);

  const minLat = latitude - latDelta;
  const maxLat = latitude + latDelta;
  const minLng = longitude - lngDelta;
  const maxLng = longitude + lngDelta;

  return { minLat, maxLat, minLng, maxLng };
}

// READ (Nearby Restaurants)
// MODIFIED: Uses directly imported 'db'
const getNearbyRestaurants = async (req, res) => {
  const { lat, lng, radiusKm = 10 } = req.query;

  if (lat == null || lng == null) {
    return res.status(400).send('Latitude and Longitude are required for nearby search.');
  }

  const latitude = parseFloat(lat);
  const longitude = parseFloat(lng);
  const radius = parseFloat(radiusKm);

  if (isNaN(latitude) || isNaN(longitude) || isNaN(radius)) {
    return res.status(400).send('Invalid latitude, longitude, or radius.');
  }

  try {
    const { minLat, maxLat, minLng, maxLng } = getBoundingBox(latitude, longitude, radius);

    const snapshot = await restaurantCollection // restaurantCollection uses 'db'
      .where("location.lat", ">=", minLat)
      .where("location.lat", "<=", maxLat)
      .get();

    const restaurants = [];
    snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.location.lng >= minLng && data.location.lng <= maxLng) {
            restaurants.push({ id: doc.id, ...data });
        }
    });

    res.status(200).json(restaurants);
  } catch (error) {
    console.error("Nearby Restaurants Error:", error);
    res.status(500).send("Failed to fetch nearby restaurants.");
  }
};


// Upload Restaurant Image (Protected)
// MODIFIED: Uses directly imported 'admin', 'db', and 'bucket'
const uploadRestaurantImage = async (req, res) => {
  const restaurantId = req.params.id;
  if (!await checkRestaurantOwnership(req, res, restaurantId)) return;

  if (!req.file) {
    return res.status(400).send('No image file provided.');
  }

  const fileBuffer = req.file.buffer;
  const originalName = req.file.originalname;
  const contentType = req.file.mimetype;
  const fileName = `restaurant_${restaurantId}_${Date.now()}_${originalName.replace(/\s/g, '_')}`;
  const destinationPath = `restaurants/${restaurantId}/images/${fileName}`;

  const file = bucket.file(destinationPath); // Use directly imported 'bucket'

  try {
    await file.save(fileBuffer, {
      metadata: { contentType: contentType },
      public: true
    });

    const imageUrl = `https://storage.googleapis.com/${bucket.name}/${destinationPath}`;

    await restaurantCollection.doc(restaurantId).update({ // restaurantCollection uses 'db'
      images: admin.firestore.FieldValue.arrayUnion(imageUrl), // Use directly imported 'admin'
      updatedAt: admin.firestore.FieldValue.serverTimestamp(), // Use directly imported 'admin'
    });

    res.status(200).json({
      message: 'Restaurant image uploaded successfully!',
      url: imageUrl,
    });
  } catch (error) {
    console.error(`Error uploading image for restaurant ${restaurantId}:`, error);
    res.status(500).send('Failed to upload restaurant image.');
  }
};


// EXPORTING ALL CONTROLLERS
module.exports = {
  createRestaurant,
  getAllRestaurants,
  getRestaurantById,
  updateRestaurant,
  deleteRestaurant,
  getNearbyRestaurants,
  uploadRestaurantImage,
};