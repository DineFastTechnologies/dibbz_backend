// src/controller/restaurantCRUD.js
const { v4: uuidv4 } = require("uuid"); // Ensure uuidv4 is imported if used elsewhere
const { admin, db } = require("../firebase"); // Ensure 'admin' is imported here as well for Firestore.FieldValue

const restaurantSample = require("../data/restaurants/01/details.json"); // This import might be removed later if createRestaurant is repurposed
const restaurantCollection = db.collection("restaurants");


// CREATE (Seeding function - will be refined later)
// Note: As discussed, this function (and its route /restaurant/seed) duplicates seeding logic.
// We will refine this later to be a proper API endpoint for creating a *single* restaurant
// or remove it if seedAll.js is the only intended seeding mechanism.
const createRestaurant = async (req, res) => {
  try {
    const data = require("../data/restaurants/01/details.json"); // This line re-reads the JSON
    const restaurants = data.restaurants; // Assuming data.restaurants exists in the JSON
    const batch = db.batch();

    restaurants.forEach((restaurant) => {
      const id = uuidv4(); // Generates a new ID, overriding the 'id' in the JSON if any
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


// READ (All)
const getAllRestaurants = async (req, res) => {
  try {
    const snapshot = await restaurantCollection.get();
    const restaurants = [];

    snapshot.forEach((doc) => {
      restaurants.push({ id: doc.id, ...doc.data() }); // Include doc.id in the response
    });

    res.status(200).json(restaurants);
  } catch (error) {
    console.error("Read Error:", error);
    res.status(500).send("Failed to fetch restaurants");
  }
};


const getRestaurantById = async (req, res) => {
  try {
    const id = req.params.id;
    const doc = await restaurantCollection.doc(id).get();

    if (!doc.exists) {
      return res.status(404).send("Restaurant not found");
    }

    res.status(200).json({ id: doc.id, ...doc.data() }); // Include doc.id in the response
  } catch (error) {
    console.error("Fetch One Error:", error);
    res.status(500).send("Failed to fetch restaurant");
  }
};


// UPDATE
const updateRestaurant = async (req, res) => {
  try {
    const id = req.params.id;
    const data = req.body;

    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return res.status(400).send("Invalid update data");
    }
    await restaurantCollection.doc(id).update(data);
    res.status(200).send("Restaurant updated");
  } catch (error) {
    console.error("Update Error:", error);
    res.status(500).send("Failed to update restaurant");
  }
};


// DELETE
const deleteRestaurant = async (req, res) => {
  try {
    const id = req.params.id;
    await restaurantCollection.doc(id).delete();
    res.status(200).send("Restaurant deleted");
  } catch (error) {
    console.error("Delete Error:", error);
    res.status(500).send("Failed to delete restaurant");
  }
};


// --- ADDED: Helper for rough geographical bounding box calculation ---
// This function calculates a square (bounding box) around a given point,
// which is used to perform range queries on latitude and longitude in Firestore.
// It's an approximation for 'nearby' and is not a true circular radius search.
function getBoundingBox(latitude, longitude, radiusKm) {
  const earthRadiusKm = 6371; // Radius of the Earth in kilometers

  // Calculate approximate degrees for a given radius
  const latDelta = radiusKm / earthRadiusKm * (180 / Math.PI); // Degrees of latitude per km
  // Longitude delta depends on latitude (gets larger near poles)
  const lngDelta = radiusKm / (earthRadiusKm * Math.cos(latitude * Math.PI / 180)) * (180 / Math.PI);

  const minLat = latitude - latDelta;
  const maxLat = latitude + latDelta;
  const minLng = longitude - lngDelta;
  const maxLng = longitude + lngDelta;

  return { minLat, maxLat, minLng, maxLng };
}

// --- ADDED: READ (Nearby Restaurants) ---
// Endpoint: GET /restaurant/nearby
// Purpose: Fetch restaurants within a geographical bounding box defined by lat/lng and radius.
// Query Params: lat (latitude of center), lng (longitude of center), radiusKm (radius in kilometers)
const getNearbyRestaurants = async (req, res) => {
  const { lat, lng, radiusKm = 10 } = req.query; // Default radius 10km if not provided

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

    // Firestore query for a rectangular bounding box
    // IMPORTANT LIMITATION: Firestore can only perform one range query (e.g., '>=' and '<=')
    // on a single field per query. This means you can't filter by both latitude and longitude
    // ranges efficiently in one Firestore query for a square.
    // For a simple square filter, we will query by latitude range first, then filter by longitude in memory.
    // For production-grade circular geospatial queries, consider GeoFirestore or a dedicated search service (e.g., Algolia).
    const snapshot = await restaurantCollection
      .where("location.lat", ">=", minLat)
      .where("location.lat", "<=", maxLat)
      .get();

    const restaurants = [];
    snapshot.forEach((doc) => {
        const data = doc.data();
        // Post-filter by longitude to complete the bounding box.
        // This is necessary because Firestore can't directly query two range fields in one query.
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


// EXPORTING ALL CONTROLLERS
module.exports = {
  createRestaurant,
  getAllRestaurants,
  getRestaurantById,
  updateRestaurant,
  deleteRestaurant,
  getNearbyRestaurants, // <-- MODIFIED: Add getNearbyRestaurants to the exports
};
