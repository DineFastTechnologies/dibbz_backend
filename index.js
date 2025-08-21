// index.js

// --- ADDED LOG ---
console.log("INDEX.JS: Starting application initialization sequence..."); 
// --- END ADDED LOG ---

const express = require("express");
const cors = require("cors");
const listEndpoints = require("express-list-endpoints");
const axios = require("axios");

// CORRECTED PATH: Firebase initialization import
console.log("INDEX.JS: Attempting to import Firebase config.");
const { admin, db, bucket } = require("./firebase"); 
console.log("INDEX.JS: Firebase config imported. Admin defined:", !!admin, "DB defined:", !!db, "Bucket defined:", !!bucket);

require("dotenv").config(); 
console.log("INDEX.JS: Dotenv loaded.");

// --- Middleware Imports ---
console.log("INDEX.JS: Attempting to import auth middleware.");
const { authenticate, checkRole } = require("./middleware/auth"); 
const httpsRedirect = require("./middleware/https");
const sanitizer = require("./middleware/sanitizer");
const limit = require("./middleware/limit");
const hpp = require("hpp");
const helmet = require("helmet");
const mongoSanitize = require('express-mongo-sanitize');
const fileUpload = require('express-fileupload');
const xss = require('xss-clean');
const cookieParser = require('cookie-parser');
console.log("INDEX.JS: Auth middleware imported. Authenticate defined:", typeof authenticate, "CheckRole defined:", typeof checkRole);


const app = express();
app.use(xss());
app.use(fileUpload());
app.use(mongoSanitize());
app.use(helmet());
app.use(hpp());
app.use(limit);
app.use(sanitizer);
app.use(httpsRedirect);
console.log("INDEX.JS: Express app created.");

// --- Core Express Middleware ---
app.use(cors()); 
console.log("INDEX.JS: CORS middleware applied.");
app.use(express.json()); 
console.log("INDEX.JS: JSON body parser middleware applied.");
app.use(express.urlencoded({ extended: true })); 
console.log("INDEX.JS: URL-encoded body parser middleware applied.");
app.use(cookieParser());

// --- Import and Register Auth Routes BEFORE CSRF ---
// Auth routes use token-based verification and should be exempt from CSRF.
console.log("INDEX.JS: Importing auth routes...");
const authRoutes = require('./routes/authRoutes');
app.use('/api/auth', authRoutes);
console.log("INDEX.JS: Auth routes registered.");

// --- CSRF Protection for Other Routes ---
// app.use(csrf({ cookie: true }));
// console.log("INDEX.JS: CSRF protection middleware applied.");


// Middleware to attach db, bucket, and admin instances to the request object
// This is done before routes are registered.
app.use((req, res, next) => {
  req.db = db;
  req.bucket = bucket;
  req.admin = admin;
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
// const paymentRoutes = require("./routes/paymentRoutes");
const cartRoutes = require("./routes/cartRouter");
// Auth routes are now imported and registered before CSRF middleware
const discountRoutes = require("./routes/discountRoutes");
const interactionRoutes = require("./routes/interactions");
const categoryRoutes = require("./routes/categories");
const notificationRoutes = require("./routes/notificationRoutes");

// --- Register Routes with Middleware ---
console.log("INDEX.JS: Registering routes...");

// Add a logging middleware to trace requests
app.use((req, res, next) => {
  console.log(`[Request Logger] Path: ${req.path}, Method: ${req.method}`);
  next();
});

app.use("/api/restaurant", restaurantRoutes);
app.use("/api/users", authenticate, userRoutes);
app.use("/api/restaurants/:restaurantId/menu", menuRoutes);
app.use("/api/restaurants/:restaurantId/tables", authenticate, checkRole('restaurant_owner', 'admin'), tableRoutes);
app.use("/api/locations", authenticate, locationUtilityRoutes);
app.use("/api/restaurants/:restaurantId/reviews", authenticate, reviewRoutes);
app.use("/api/orders", authenticate, orderRoutes);
app.use("/api/bookings", authenticate, bookingRoutes);
// app.use("/api/payments", authenticate, paymentRoutes);
app.use("/api/cart", authenticate, cartRoutes);
// Auth routes are now registered before CSRF middleware
app.use("/api/discounts", authenticate, checkRole('admin'), discountRoutes);
app.use("/api/interactions", authenticate, interactionRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/notifications", authenticate, notificationRoutes);
console.log("INDEX.JS: All routes registered.");


// Root endpoint for a basic health check
app.get("/", (req, res) => {
    const endpoints = listEndpoints(app);
    const endpointDetails = endpoints.map(endpoint => {
        const middleware = Array.isArray(endpoint.middleware) 
            ? endpoint.middleware.map(m => m.name || 'anonymous')
            : [];

        return {
            path: endpoint.path,
            methods: endpoint.methods.join(', '),
            middleware: middleware.join(', ')
        };
    });

    let html = `
        <h1>Dibbz Backend Endpoints</h1>
        <style>
            body { font-family: Arial, sans-serif; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
            th { background-color: #f2f2f2; }
            tr:nth-child(even) { background-color: #f9f9f9; }
            tr:hover { background-color: #f1f1f1; }
        </style>
        <table>
            <thead>
                <tr>
                    <th>Path</th>
                    <th>Methods</th>
                    <th>Middleware</th>
                </tr>
            </thead>
            <tbody>
    `;

    endpointDetails.forEach(endpoint => {
        html += `
            <tr>
                <td>${endpoint.path}</td>
                <td>${endpoint.methods}</td>
                <td>${endpoint.middleware}</td>
            </tr>
        `;
    });

    html += `
            </tbody>
        </table>
    `;
    res.send(html);
});
console.log("INDEX.JS: Root health check route '/' defined.");


const globalErrorHandler = require('./middleware/errorHandler');
// --- Error Handling Middleware ---
app.use(globalErrorHandler);
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
