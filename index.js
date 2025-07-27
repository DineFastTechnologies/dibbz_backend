// index.js
const express = require("express");
const cors = require("cors");
// MODIFIED: Ensure 'admin', 'db', and 'bucket' are imported from your firebase initialization file
const { admin, db, bucket } = require("./firebase"); 
require("dotenv").config(); // Loads environment variables from .env file

const app = express();

// --- Middleware ---
app.use(cors()); // Enables Cross-Origin Resource Sharing
app.use(express.json()); // Parses incoming JSON request bodies
app.use(express.urlencoded({ extended: true })); // Parses URL-encoded request bodies


// --- ADDED: Authentication Middleware ---
// This middleware verifies the Firebase ID token sent by the Flutter app.
const authenticate = async (req, res, next) => {
  const idToken = req.headers.authorization?.split('Bearer ')[1]; // Extract token from "Bearer <TOKEN>" header

  if (!idToken) {
    return res.status(401).send('Unauthorized: No authentication token provided.');
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken); // Verify the ID token using Firebase Admin SDK
    req.user = decodedToken; // Attach the decoded user object (containing uid, email, etc.) to the request
    next(); // Proceed to the next middleware or route handler
  } catch (error) {
    console.error('Error verifying ID token:', error);
    // Handle specific Firebase Auth errors for better client feedback
    if (error.code === 'auth/id-token-expired') {
        return res.status(401).send('Unauthorized: Authentication token expired. Please log in again.');
    }
    return res.status(403).send('Unauthorized: Invalid authentication token.');
  }
};
// --- END ADDED ---


// --- ADDED: Role-Checking Middleware ---
// This middleware checks if an authenticated user has a specific role required for certain actions (e.g., 'restaurant_owner').
const checkRole = (requiredRole) => {
  return async (req, res, next) => {
    // This middleware assumes 'authenticate' has already run and populated req.user
    if (!req.user || !req.user.uid) {
      return res.status(401).send('Unauthorized: User not authenticated.');
    }

    try {
      // Fetch user's role from their profile document in Firestore
      const userDoc = await db.collection('users').doc(req.user.uid).get();
      if (!userDoc.exists) {
        return res.status(403).send('Forbidden: User profile not found in database.');
      }

      const userRole = userDoc.data().role; // Get the 'role' field from the user's Firestore document
      
      // Allow 'admin' role to bypass most specific role checks (unless explicitly checking for 'customer' role)
      if (userRole === requiredRole || (userRole === 'admin' && requiredRole !== 'customer')) {
        next(); // User has the required role or is an admin, proceed
      } else {
        return res.status(403).send(`Forbidden: Requires '${requiredRole}' role.`);
      }
    } catch (error) {
      console.error('Error checking user role:', error);
      res.status(500).send('Server error during role verification.');
    }
  };
};
// --- END ADDED ---


// Middleware to attach db, bucket, and admin instances to the request object
// This makes them easily accessible in your route handlers and controllers without re-importing.
app.use((req, res, next) => {
  req.db = db; // Firestore database instance
  req.bucket = bucket; // Cloud Storage bucket instance
  req.admin = admin; // Firebase Admin SDK instance (useful for admin.auth(), admin.firestore.FieldValue, etc.)
  req.checkRole = checkRole; // Also attach the role check middleware itself if you need to use it conditionally within a route
  next();
});


// --- Import Route Modules ---
const restaurantRoutes = require("./routes/restaurantRoutes");
const userRoutes = require("./routes/users");
// const menuRoutes = require("./src/routes/menus");      // ADDED: Import menu routes
// const tableRoutes = require("./src/routes/tables");    // ADDED: Import table routes
const locationUtilityRoutes = require("./routes/location"); // ADDED: Import location utility routes


// --- Register Routes with Middleware ---
// Routes are mounted at specific paths and can have middleware applied (e.g., 'authenticate', 'checkRole').

// General restaurant routes (customer-facing views, some might need auth for specific actions if modified)
app.use("/restaurant", restaurantRoutes); 

// User profile and saved locations routes (requires authentication)
app.use("/api/users", authenticate, userRoutes); 

// Restaurant menu management routes (requires authentication AND restaurant_owner role)
// :restaurantId is a URL parameter that will be passed to menuRoutes and tableRoutes
// app.use("/api/restaurants/:restaurantId/menu", authenticate, checkRole('restaurant_owner'), menuRoutes); 
// // Restaurant table management routes (requires authentication AND restaurant_owner role)
// app.use("/api/restaurants/:restaurantId/tables", authenticate, checkRole('restaurant_owner'), tableRoutes); 

// General location utility routes (e.g., Pincode lookup - typically public, no auth needed here)
app.use("/api/locations", locationUtilityRoutes); 


// Root endpoint for a basic health check
app.get("/", (req, res) => res.send("Dibbz Backend Running"));


// --- Error Handling Middleware (Optional but Recommended for robust apps) ---
app.use((err, req, res, next) => {
  console.error(err.stack); // Log the full error stack for debugging
  res.status(500).send('Something broke on the server! Please check logs.'); // Generic error message to client
});


// --- Start the Server ---
const PORT = process.env.PORT || 3000; // Use port from environment variables or default to 3000
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));