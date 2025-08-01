// index.js

// --- ADDED LOG ---
console.log("INDEX.JS: Starting application initialization sequence..."); 
// --- END ADDED LOG ---

const express = require("express");
const cors = require("cors");

// CORRECTED PATH: Firebase initialization import
console.log("INDEX.JS: Attempting to import Firebase config.");
const { admin, db, bucket } = require("./firebase"); 
console.log("INDEX.JS: Firebase config imported. Admin defined:", !!admin, "DB defined:", !!db, "Bucket defined:", !!bucket);

require("dotenv").config(); 
console.log("INDEX.JS: Dotenv loaded.");

// --- Middleware Imports ---
console.log("INDEX.JS: Attempting to import auth middleware.");
const { authenticate, checkRole } = require("./middleware/auth"); 
console.log("INDEX.JS: Auth middleware imported. Authenticate defined:", typeof authenticate, "CheckRole defined:", typeof checkRole);


const app = express();
console.log("INDEX.JS: Express app created.");

// --- Core Express Middleware ---
app.use(cors()); 
console.log("INDEX.JS: CORS middleware applied.");
app.use(express.json()); 
console.log("INDEX.JS: JSON body parser middleware applied.");
app.use(express.urlencoded({ extended: true })); 
console.log("INDEX.JS: URL-encoded body parser middleware applied.");


// Middleware to attach db, bucket, and admin instances to the request object
// This is done before routes are registered.
app.use((req, res, next) => {
  req.db = db;
  req.bucket = bucket;
  req.admin = admin;
  req.authenticate = authenticate; 
  req.checkRole = checkRole;       
  next();
});
console.log("INDEX.JS: Custom context middleware (db, bucket, admin, auth helpers) applied.");


// --- Import Route Modules ---
console.log("INDEX.JS: Importing route modules...");
const restaurantRoutes = require("./routes/restaurantRoutes");
const userRoutes = require("./routes/users");
const menuRoutes = require("./routes/menus");      
const tableRoutes = require("./routes/tables");    
const locationUtilityRoutes = require("./routes/locations"); 
const reviewRoutes = require("./routes/reviews");  
const orderRoutes = require("./routes/orders");    
const bookingRoutes = require("./routes/bookings"); 
console.log("INDEX.JS: Route modules imported.");
const paymentRoutes = require("./routes/paymentRoutes");
app.use("/payment", paymentRoutes);
const cartRoutes = require("./routes/cartRouter");
app.use("/api/cart", cartRoutes);



// --- Register Routes with Middleware ---
console.log("INDEX.JS: Registering routes...");
app.use("/api/restaurant", restaurantRoutes); 
app.use("/api/users", authenticate, userRoutes); 
app.use("/api/restaurants/:restaurantId/menu", menuRoutes); 
app.use("/api/restaurants/:restaurantId/tables", authenticate, checkRole('restaurant_owner'), tableRoutes); 
app.use("/api/locations", locationUtilityRoutes); 
app.use("/api/restaurants/:restaurantId/reviews", reviewRoutes); 
app.use("/api/orders", authenticate, orderRoutes);   
app.use("/api/bookings", authenticate, bookingRoutes); 
console.log("INDEX.JS: All routes registered.");


// Root endpoint for a basic health check
app.get("/", (req, res) => res.send("Dibbz Backend Running"));
console.log("INDEX.JS: Root health check route '/' defined.");


// --- Error Handling Middleware ---
app.use((err, req, res, next) => {
  console.error("INDEX.JS: Uncaught error in middleware chain:", err.stack); // Log the full error stack
  res.status(500).send('Something broke on the server! Please check logs.');
});
console.log("INDEX.JS: Error handling middleware defined.");


// --- CRITICAL FOR VERCEL SERVERLESS ---
// Instead of app.listen, export the app instance for Vercel.
console.log("INDEX.JS: Exporting Express app for Vercel.");
module.exports = app;

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`✅ Server is running at http://localhost:${PORT}`);
  });
}
