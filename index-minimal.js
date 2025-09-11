// Minimal version of index.js for testing Firebase authentication
const express = require("express");
const cors = require("cors");

const app = express();

// Basic middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Import Firebase
const { admin, db } = require("./firebase");

// Root endpoint
app.get("/", (req, res) => {
  res.json({ message: "Dibbz Backend Running", timestamp: new Date().toISOString() });
});

// Test endpoint
app.get("/api/test", (req, res) => {
  res.json({ 
    message: "Backend is working!", 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    vercel: !!process.env.VERCEL,
    firebase: !!admin
  });
});

// Mock restaurant endpoint
app.get("/api/restaurant", async (req, res) => {
  try {
    // Try to get real restaurants from Firestore
    const snapshot = await db.collection("restaurants").limit(5).get();
    const restaurants = [];
    snapshot.forEach((doc) => {
      restaurants.push({ id: doc.id, ...doc.data() });
    });
    
    if (restaurants.length > 0) {
      res.json(restaurants);
    } else {
      // Return mock data if no restaurants found
      res.json([
        {
          id: "mock_restaurant_1",
          name: "Sample Restaurant",
          cuisine: "Italian",
          description: "A sample restaurant for testing",
          address: "123 Main St",
          city: "Sample City",
          state: "Sample State",
          zipCode: "12345",
          phoneNumber: "+1234567890",
          email: "info@samplerestaurant.com",
          openingTime: "09:00",
          closingTime: "22:00",
          capacity: 50,
          priceRange: "mid-range",
          isPureVeg: false,
          isActive: true,
          rating: 4.5,
          totalReviews: 100,
          location: { lat: 40.7128, lng: -74.0060 },
          images: [],
          foodCategories: ["Italian", "Pizza", "Pasta"]
        }
      ]);
    }
  } catch (error) {
    console.error("Error fetching restaurants:", error);
    res.status(500).json({ error: "Failed to fetch restaurants" });
  }
});

// Real Firebase auth endpoints
app.post("/api/auth/verify-token", async (req, res) => {
  try {
    const { idToken, role } = req.body;
    
    if (!idToken) {
      return res.status(400).json({ error: "ID token is required" });
    }

    // Verify the Firebase token
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    
    // Create or update user in Firestore
    const userData = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      name: decodedToken.name || 'User',
      photoURL: decodedToken.picture || null,
      role: role || 'customer',
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now(),
      isActive: true
    };

    await db.collection('users').doc(decodedToken.uid).set(userData, { merge: true });
    
    res.json({
      message: "Authentication successful",
      verified: true,
      user: userData,
      token: idToken
    });
  } catch (error) {
    console.error("Error verifying token:", error);
    res.status(401).json({ error: "Authentication failed" });
  }
});

app.post("/api/auth/google-signin", async (req, res) => {
  try {
    const { idToken, role } = req.body;
    
    if (!idToken) {
      return res.status(400).json({ error: "ID token is required" });
    }

    // Verify the Firebase token
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    
    // Create or update user in Firestore
    const userData = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      name: decodedToken.name || 'User',
      photoURL: decodedToken.picture || null,
      role: role || 'customer',
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now(),
      isActive: true
    };

    await db.collection('users').doc(decodedToken.uid).set(userData, { merge: true });
    
    res.json({
      message: "Google sign-in successful",
      verified: true,
      user: userData,
      token: idToken
    });
  } catch (error) {
    console.error("Error with Google sign-in:", error);
    res.status(401).json({ error: "Google sign-in failed" });
  }
});

app.post("/api/auth/email-signin", async (req, res) => {
  try {
    const { idToken, role } = req.body;
    
    if (!idToken) {
      return res.status(400).json({ error: "ID token is required" });
    }

    // Verify the Firebase token
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    
    // Create or update user in Firestore
    const userData = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      name: decodedToken.name || 'User',
      photoURL: decodedToken.picture || null,
      role: role || 'customer',
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now(),
      isActive: true
    };

    await db.collection('users').doc(decodedToken.uid).set(userData, { merge: true });
    
    res.json({
      message: "Email sign-in successful",
      verified: true,
      user: userData,
      token: idToken
    });
  } catch (error) {
    console.error("Error with email sign-in:", error);
    res.status(401).json({ error: "Email sign-in failed" });
  }
});

// Error handling
app.use((err, req, res, next) => {
  console.error("Error:", err);
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: err.message,
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Route not found',
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString()
  });
});

// Start server if running directly
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`✅ Server is running at http://localhost:${PORT}`);
  });
}

module.exports = app;
