// index.js
const express = require("express");
const cors = require("cors");
// REMOVED: Direct import of admin, db, bucket here.
// They will be imported directly by controller/middleware files that need them.
require("dotenv").config(); // Loads environment variables from .env file

// --- Middleware Imports ---
// Import authenticate and checkRole directly from the middleware/auth.js file
const { authenticate, checkRole } = require("./middleware/auth"); 

const app = express();

// --- Core Express Middleware ---
app.use(cors()); // Enables Cross-Origin Resource Sharing
app.use(express.json()); // Parses incoming JSON request bodies
app.use(express.urlencoded({ extended: true })); // Parses URL-encoded request bodies


// --- REMOVED: Middleware to attach db, bucket, admin, authenticate, checkRole to req ---
// This pattern is less ideal for Vercel/serverless where modules are often hot-reloaded
// or instantiated per request. It's cleaner for controllers/middleware to import
// what they need directly.
/*
app.use((req, res, next) => {
  req.db = db;
  req.bucket = bucket;
  req.admin = admin;
  req.authenticate = authenticate; 
  req.checkRole = checkRole;       
  next();
});
*/
// --- END REMOVED ---


// --- Import Route Modules ---
// All route imports now point directly to the routes/ folder
const restaurantRoutes = require("./routes/restaurantRoutes");
const userRoutes = require("./routes/users");
const menuRoutes = require("./routes/menus");      
const tableRoutes = require("./routes/tables");    
const locationUtilityRoutes = require("./routes/locations"); 
const reviewRoutes = require("./routes/reviews");  
const orderRoutes = require("./routes/orders");    
const bookingRoutes = require("./routes/bookings"); 


// --- Register Routes with Middleware ---
// Routes are mounted at specific paths and can have middleware applied.

// General restaurant routes (customer-facing views, some might need auth for specific actions if modified)
// PUT/DELETE/POST for owner are handled within restaurantRoutes.js with checkRole applied there.
app.use("/api/restaurant", restaurantRoutes); 

// User profile and saved locations routes (requires authentication)
// 'authenticate' is imported directly and used here.
app.use("/api/users", authenticate, userRoutes); 

// Restaurant menu management routes (requires authentication AND restaurant_owner role)
// These are for the Dibbz_Business app.
app.use("/api/restaurants/:restaurantId/menu", authenticate, checkRole('restaurant_owner'), menuRoutes); 
// Restaurant table management routes (requires authentication AND restaurant_owner role)
// These are for the Dibbz_Business app.
app.use("/api/restaurants/:restaurantId/tables", authenticate, checkRole('restaurant_owner'), tableRoutes); 

// General location utility routes (e.g., Pincode lookup - public)
app.use("/api/locations", locationUtilityRoutes); 

// Review routes (GET reviews for a restaurant: Publicly accessible. POST review: Requires authentication)
// 'authenticate' is applied here for all review routes.
app.use("/api/restaurants/:restaurantId/reviews", authenticate, reviewRoutes); 


// Order and Booking routes (customer-facing, require authentication)
// 'authenticate' is applied here for all order/booking routes.
app.use("/api/orders", authenticate, orderRoutes);   
app.use("/api/bookings", authenticate, bookingRoutes); 


// Root endpoint for a basic health check
app.get("/", (req, res) => res.send("Dibbz Backend Running"));


// --- Error Handling Middleware (Optional but Recommended for robust apps) ---
app.use((err, req, res, next) => {
  console.error(err.stack); // Log the full error stack for debugging
  res.status(500).send('Something broke on the server! Please check logs.'); // Generic error message to client
});


// --- CRITICAL FOR VERCEL SERVERLESS ---
// Instead of app.listen, export the app instance.
// Vercel will pick up this exported app and wrap it into a serverless function.
module.exports = app;