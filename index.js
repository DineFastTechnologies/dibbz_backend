// index.js
const express = require("express");
const cors = require("cors");
const { admin, db } = require("./firebase"); // <-- MODIFIED: Ensure 'admin' is imported here
const bucket = admin.storage().bucket();
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());

// --- ADDED: Authentication Middleware ---
// This middleware will run for every request that uses it,
// verifying the Firebase ID token sent from the Flutter app.
const authenticate = async (req, res, next) => {
  const idToken = req.headers.authorization?.split('Bearer ')[1]; // Extract token from "Bearer <TOKEN>"

  if (!idToken) {
    return res.status(401).send('Unauthorized: No token provided.');
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    req.user = decodedToken; // Attach decoded user object (contains uid, email, etc.) to the request
    next(); // Proceed to the next middleware or route handler
  } catch (error) {
    console.error('Error verifying ID token:', error);
    // Handle specific Firebase Auth errors, e.g., token expiration
    if (error.code === 'auth/id-token-expired') {
        return res.status(401).send('Unauthorized: Token expired. Please re-authenticate.');
    }
    return res.status(403).send('Unauthorized: Invalid token.');
  }
};
// --- END ADDED ---

// Middleware to attach db, bucket, and admin instances to the request object
// This makes them easily accessible in your route handlers and controllers.
app.use((req, res, next) => {
  req.db = db;
  req.bucket = bucket;
  req.admin = admin; // <-- ADDED: Make 'admin' also available on the request
  next();
});

const restaurantRoutes = require("./routes/restaurantRoutes");
const userRoutes = require("./routes/users"); // <-- ADDED: Import the new user routes

app.use("/restaurant", restaurantRoutes); // Existing route for restaurant operations
// --- ADDED: Register user routes and apply the authentication middleware ---
app.use("/api/users", authenticate, userRoutes); // All user profile operations require authentication
// --- END ADDED ---

app.get("/", (req, res) => res.send("Dibbz Backend Running"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
