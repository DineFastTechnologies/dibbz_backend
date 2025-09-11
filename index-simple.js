// Simple version of index.js for Vercel deployment
const express = require("express");
const cors = require("cors");

const app = express();

// Basic middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
    vercel: !!process.env.VERCEL
  });
});

// Mock restaurant endpoint
app.get("/api/restaurant", (req, res) => {
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
});

// Mock auth endpoints
app.post("/api/auth/verify-token", (req, res) => {
  const { idToken, role } = req.body;
  
  res.json({
    message: "Authentication successful",
    verified: true,
    user: {
      uid: 'mock_user_' + Date.now(),
      email: 'user@example.com',
      name: 'Test User',
      role: role || 'restaurant_owner',
      photoURL: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isActive: true
    },
    token: idToken || 'mock_token'
  });
});

app.post("/api/auth/google-signin", (req, res) => {
  const { idToken, role } = req.body;
  
  res.json({
    message: "Google sign-in successful",
    verified: true,
    user: {
      uid: 'mock_user_' + Date.now(),
      email: 'user@example.com',
      name: 'Test User',
      role: role || 'restaurant_owner',
      photoURL: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isActive: true
    },
    token: idToken || 'mock_token'
  });
});

app.post("/api/auth/email-signin", (req, res) => {
  const { idToken, role } = req.body;
  
  res.json({
    message: "Email sign-in successful",
    verified: true,
    user: {
      uid: 'mock_user_' + Date.now(),
      email: 'user@example.com',
      name: 'Test User',
      role: role || 'restaurant_owner',
      photoURL: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isActive: true
    },
    token: idToken || 'mock_token'
  });
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
