// Simple version of index.js for Vercel deployment
const express = require("express");
const cors = require("cors");

const app = express();

// In-memory storage for demo purposes
const createdRestaurants = new Map();
const userRestaurants = new Map();

// File-based storage for persistence
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'data.json');

// Helper function to load data from file
const loadFromFile = () => {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      
      if (data.restaurants) {
        Object.entries(data.restaurants).forEach(([key, value]) => {
          createdRestaurants.set(key, value);
        });
        console.log('📦 Loaded restaurants from file:', createdRestaurants.size);
      }
      
      if (data.userRestaurants) {
        Object.entries(data.userRestaurants).forEach(([key, value]) => {
          userRestaurants.set(key, value);
        });
        console.log('📦 Loaded user-restaurant mappings from file:', userRestaurants.size);
      }
    } else {
      console.log('📦 No data file found, starting fresh');
    }
  } catch (error) {
    console.log('⚠️ Could not load from file:', error.message);
  }
};

// Helper function to save data to file
const saveToFile = () => {
  try {
    const data = {
      restaurants: Object.fromEntries(createdRestaurants),
      userRestaurants: Object.fromEntries(userRestaurants),
      lastUpdated: new Date().toISOString()
    };
    
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    console.log('💾 Saved data to file');
  } catch (error) {
    console.log('⚠️ Could not save to file:', error.message);
  }
};

// Load data on startup
loadFromFile();

// Basic middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`📡 ${req.method} ${req.path} - ${new Date().toISOString()}`);
  console.log('📡 Headers:', req.headers);
  next();
});

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

// Mock restaurant creation endpoint
app.post("/api/restaurant", (req, res) => {
  console.log('🏪 POST /api/restaurant - Request received');
  console.log('🏪 Request headers:', req.headers);
  console.log('🏪 Request body:', req.body);
  
  const restaurantData = req.body;
  const restaurantId = 'mock_restaurant_' + Date.now();
  
  // Extract user ID from the request body or use a default
  const userId = restaurantData.userId || 'demo_user_' + Date.now();
  console.log('🏪 Using userId for restaurant creation:', userId);
  
  const mockRestaurant = {
    id: restaurantId,
    name: restaurantData.name || 'Mock Restaurant',
    cuisine: restaurantData.cuisine || 'Mock Cuisine',
    description: restaurantData.description || 'A mock restaurant for testing',
    address: restaurantData.address || '123 Mock Street',
    city: restaurantData.city || 'Mock City',
    state: restaurantData.state || 'Mock State',
    zipCode: restaurantData.zipCode || '12345',
    phoneNumber: restaurantData.phoneNumber || '+1234567890',
    email: restaurantData.email || 'info@mockrestaurant.com',
    openingTime: restaurantData.openingTime || '09:00',
    closingTime: restaurantData.closingTime || '22:00',
    capacity: restaurantData.capacity || 50,
    priceRange: restaurantData.priceRange || 'mid-range',
    isPureVeg: restaurantData.isPureVeg || false,
    isActive: true,
    rating: 0,
    totalReviews: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    location: { lat: 0, lng: 0 },
    images: [],
    foodCategories: [restaurantData.cuisine || 'Mock Cuisine'],
    ownerId: userId
  };
  
  // Store the restaurant in memory
  createdRestaurants.set(restaurantId, mockRestaurant);
  
  // Associate restaurant with user
  userRestaurants.set(userId, restaurantId);
  console.log('🏪 Associated restaurant', restaurantId, 'with user', userId);
  
  // Save to file for persistence
  saveToFile();
  
  res.status(201).json({
    message: "Restaurant created successfully",
    restaurantId: restaurantId,
    restaurant: mockRestaurant
  });
});

// Mock restaurant setup check endpoint
app.get("/api/restaurant/check-setup/:userId", (req, res) => {
  const { userId } = req.params;
  console.log('🔍 Restaurant setup check for userId:', userId);
  
  // Also check for user ID from Authorization header
  const authHeader = req.headers.authorization;
  let checkUserId = userId;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    checkUserId = 'user_' + token.substring(0, 10);
    console.log('🔍 Extracted checkUserId from token:', checkUserId);
  }
  
  console.log('🔍 Checking restaurants for userId:', checkUserId);
  console.log('🔍 Available user-restaurant mappings:', Array.from(userRestaurants.entries()));
  console.log('🔍 Available restaurants:', Array.from(createdRestaurants.keys()));
  
  // Check if user has a restaurant
  const restaurantId = userRestaurants.get(checkUserId) || userRestaurants.get(userId);
  console.log('🔍 Found restaurantId:', restaurantId);
  
  if (restaurantId && createdRestaurants.has(restaurantId)) {
    console.log('✅ User has restaurant:', restaurantId);
    res.json({ 
      hasRestaurant: true, 
      restaurantId: restaurantId 
    });
  } else {
    console.log('❌ User has no restaurant');
    res.json({ hasRestaurant: false });
  }
});

// Mock menu setup check endpoint
app.get("/api/restaurants/:restaurantId/menu/check-setup", (req, res) => {
  const { restaurantId } = req.params;
  
  // For demo purposes, always return that restaurant has no menu
  res.json({ hasMenu: false });
});

// Mock menu endpoints
app.get("/api/restaurants/:restaurantId/menu", (req, res) => {
  res.json([]);
});

app.post("/api/restaurants/:restaurantId/menu", (req, res) => {
  res.json({ message: "Menu item created successfully" });
});

app.post("/api/restaurants/:restaurantId/menu/batch", (req, res) => {
  res.json({ 
    message: "Menu items created successfully",
    menuItems: req.body.menuItems || []
  });
});

app.put("/api/restaurants/:restaurantId/menu/:itemId", (req, res) => {
  res.json({ message: "Menu item updated successfully" });
});

app.delete("/api/restaurants/:restaurantId/menu/:itemId", (req, res) => {
  res.json({ message: "Menu item deleted successfully" });
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
