// src/controller/restaurantCRUD.js
const { v4: uuidv4 } = require("uuid");
const { admin, db, bucket } = require("../firebase");

const restaurantCollection = db.collection("restaurants");

// ✅ CREATE restaurant from request body
const createRestaurant = async (req, res) => {
  try {
    const data = req.body;

    // Required fields validation
    const requiredFields = [
      "name",
      "location.lat",
      "location.lng",
      "location.address",
      "cuisine",
      "rating",
      "priceLevel",
      "openStatus",
      "tags",
      "contactNumber",
      "bannerImage",
      "dineType",
      "isPureVeg",
      "foodCategories",
      "images"
    ];

    for (const field of requiredFields) {
      const keys = field.split(".");
      let value = data;
      for (const key of keys) {
        value = value?.[key];
      }
      if (value === undefined || value === null) {
        return res.status(400).send(`Missing required field: ${field}`);
      }
    }

    const id = uuidv4();
    const restaurantData = {
      ...data,
      id,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await restaurantCollection.doc(id).set(restaurantData);

    res.status(201).json({
      message: "Restaurant created successfully.",
      restaurant: restaurantData,
    });
  } catch (error) {
    console.error("Create Restaurant Error:", error);
    res.status(500).send("Failed to create restaurant.");
  }
};

// ✅ READ all restaurants
const getAllRestaurants = async (req, res) => {
  try {
    let query = restaurantCollection;

    const { isPureVeg, foodCategory, lat, lng, radiusKm } = req.query;

    if (isPureVeg === "true") {
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
        return res.status(400).send("Invalid latitude, longitude, or radius for nearby filter.");
      }

      const { minLat, maxLat, minLng, maxLng } = getBoundingBox(latitude, longitude, radius);
      const snapshot = await query
        .where("location.lat", ">=", minLat)
        .where("location.lat", "<=", maxLat)
        .get();

      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.location.lng >= minLng && data.location.lng <= maxLng) {
          restaurants.push({ id: doc.id, ...data });
        }
      });
      return res.status(200).json(restaurants);
    }

    const snapshot = await query.get();
    snapshot.forEach((doc) => {
      restaurants.push({ id: doc.id, ...doc.data() });
    });

    res.status(200).json(restaurants);
  } catch (error) {
    console.error("Read All Restaurants Error:", error);
    res.status(500).send("Failed to fetch restaurants");
  }
};

// ✅ READ one by ID
const getRestaurantById = async (req, res) => {
  try {
    const id = req.params.id;
    const doc = await restaurantCollection.doc(id).get();

    if (!doc.exists) {
      return res.status(404).send("Restaurant not found");
    }

    res.status(200).json({ id: doc.id, ...doc.data() });
  } catch (error) {
    console.error("Fetch One Restaurant Error:", error);
    res.status(500).send("Failed to fetch restaurant");
  }
};

// ✅ UPDATE
const updateRestaurant = async (req, res) => {
  const id = req.params.id;
  const data = req.body;

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return res.status(400).send("Invalid update data");
  }

  const allowedFields = [
    "name",
    "location",
    "cuisine",
    "rating",
    "priceLevel",
    "openStatus",
    "tags",
    "contactNumber",
    "bannerImage",
    "dineType",
    "isPureVeg",
    "foodCategories",
    "images",
  ];

  const filteredData = {};
  for (const key of allowedFields) {
    if (data[key] !== undefined) {
      filteredData[key] = data[key];
    }
  }
  filteredData.updatedAt = admin.firestore.FieldValue.serverTimestamp();

  if (Object.keys(filteredData).length <= 1 && filteredData.updatedAt) {
    return res.status(400).send("No relevant restaurant data provided for update.");
  }

  try {
    await restaurantCollection.doc(id).update(filteredData);
    res.status(200).send("Restaurant updated successfully.");
  } catch (error) {
    console.error("Update Restaurant Error:", error);
    res.status(500).send("Failed to update restaurant.");
  }
};

// ✅ DELETE
const deleteRestaurant = async (req, res) => {
  const id = req.params.id;

  try {
    // Delete menuItems subcollection
    const menuItemsSnapshot = await db.collection("restaurants").doc(id).collection("menuItems").get();
    const menuBatch = db.batch();
    menuItemsSnapshot.docs.forEach((doc) => menuBatch.delete(doc.ref));
    await menuBatch.commit();

    // Delete tables subcollection
    const tablesSnapshot = await db.collection("restaurants").doc(id).collection("tables").get();
    const tableBatch = db.batch();
    tablesSnapshot.docs.forEach((doc) => tableBatch.delete(doc.ref));
    await tableBatch.commit();

    // Delete images from Cloud Storage
    const imagePrefix = `restaurants/${id}/images/`;
    const [files] = await bucket.getFiles({ prefix: imagePrefix });
    if (files.length > 0) {
      await Promise.all(files.map((file) => file.delete()));
      console.log(`Deleted ${files.length} images for restaurant ${id} from Cloud Storage.`);
    }

    await restaurantCollection.doc(id).delete();
    res.status(200).send("Restaurant deleted successfully.");
  } catch (error) {
    console.error("Delete Restaurant Error:", error);
    res.status(500).send("Failed to delete restaurant.");
  }
};

// ✅ Nearby search helper
function getBoundingBox(latitude, longitude, radiusKm) {
  const earthRadiusKm = 6371;
  const latDelta = (radiusKm / earthRadiusKm) * (180 / Math.PI);
  const lngDelta =
    (radiusKm / (earthRadiusKm * Math.cos((latitude * Math.PI) / 180))) * (180 / Math.PI);

  return {
    minLat: latitude - latDelta,
    maxLat: latitude + latDelta,
    minLng: longitude - lngDelta,
    maxLng: longitude + lngDelta,
  };
}

// ✅ GET nearby restaurants
const getNearbyRestaurants = async (req, res) => {
  const { lat, lng, radiusKm = 10 } = req.query;

  if (lat == null || lng == null) {
    return res.status(400).send("Latitude and Longitude are required for nearby search.");
  }

  const latitude = parseFloat(lat);
  const longitude = parseFloat(lng);
  const radius = parseFloat(radiusKm);

  if (isNaN(latitude) || isNaN(longitude) || isNaN(radius)) {
    return res.status(400).send("Invalid latitude, longitude, or radius.");
  }

  try {
    const { minLat, maxLat, minLng, maxLng } = getBoundingBox(latitude, longitude, radius);
    const snapshot = await restaurantCollection
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

// ✅ Upload restaurant image (no auth)
const uploadRestaurantImage = async (req, res) => {
  const restaurantId = req.params.id;

  if (!req.file) {
    return res.status(400).send("No image file provided.");
  }

  const fileBuffer = req.file.buffer;
  const originalName = req.file.originalname;
  const contentType = req.file.mimetype;
  const fileName = `restaurant_${restaurantId}_${Date.now()}_${originalName.replace(/\s/g, "_")}`;
  const destinationPath = `restaurants/${restaurantId}/images/${fileName}`;
  const file = bucket.file(destinationPath);

  try {
    await file.save(fileBuffer, {
      metadata: { contentType: contentType },
      public: true,
    });

    const imageUrl = `https://storage.googleapis.com/${bucket.name}/${destinationPath}`;
    await restaurantCollection.doc(restaurantId).update({
      images: admin.firestore.FieldValue.arrayUnion(imageUrl),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.status(200).json({
      message: "Restaurant image uploaded successfully!",
      url: imageUrl,
    });
  } catch (error) {
    console.error(`Error uploading image for restaurant ${restaurantId}:`, error);
    res.status(500).send("Failed to upload restaurant image.");
  }
};

module.exports = {
  createRestaurant,
  getAllRestaurants,
  getRestaurantById,
  updateRestaurant,
  deleteRestaurant,
  getNearbyRestaurants,
  uploadRestaurantImage,
};
