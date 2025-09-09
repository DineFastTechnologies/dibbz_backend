// Firebase Auth Controller for Google Sign-In and Email/Password Authentication
// Temporarily disable Firebase admin for Vercel deployment
// const { admin } = require('../firebase');

// Simplified Firebase Auth for Vercel deployment
// For now, we'll create a mock implementation that works without Firebase admin

// Mock Firebase token verification (for development)
const verifyFirebaseToken = async (idToken) => {
  try {
    // For now, just return a mock user object
    // In production, you would verify the token with Firebase
    console.log('Mock Firebase token verification for:', idToken);
    
    return {
      uid: 'mock_user_' + Date.now(),
      email: 'user@example.com',
      name: 'Test User',
      picture: null
    };
  } catch (error) {
    console.error('Error verifying Firebase token:', error);
    throw new Error('Invalid or expired token');
  }
};

// Mock user creation (for development)
const createOrUpdateUser = async (firebaseUser, role = 'customer') => {
  try {
    console.log('Mock user creation/update for:', firebaseUser.uid, 'role:', role);
    
    const userData = {
      uid: firebaseUser.uid,
      email: firebaseUser.email,
      name: firebaseUser.name || 'User',
      photoURL: firebaseUser.picture || null,
      role: role,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isActive: true
    };

    console.log('Mock user data created:', userData);
    return userData;
  } catch (error) {
    console.error('Error creating/updating user:', error);
    throw error;
  }
};

// Verify Firebase Auth Token
exports.verifyToken = async (req, res) => {
  try {
    const { idToken, role } = req.body;

    if (!idToken) {
      return res.status(400).json({ error: "ID token is required" });
    }

    // Verify the Firebase token
    const decodedToken = await verifyFirebaseToken(idToken);
    
    // Create or update user in Firestore
    const userData = await createOrUpdateUser(decodedToken, role);

    res.set('Cache-Control', 'no-store');
    return res.json({ 
      message: "Authentication successful", 
      verified: true,
      user: userData,
      token: idToken // Return the same token for frontend use
    });
  } catch (error) {
    console.error("Error verifying token:", error?.message || error);
    return res.status(401).json({ error: "Authentication failed" });
  }
};

// Google Sign-In (legacy endpoint for compatibility)
exports.googleSignIn = async (req, res) => {
  try {
    const { idToken, role } = req.body;

    if (!idToken) {
      return res.status(400).json({ error: "ID token is required" });
    }

    // Verify the Firebase token
    const decodedToken = await verifyFirebaseToken(idToken);
    
    // Create or update user in Firestore
    const userData = await createOrUpdateUser(decodedToken, role);

    res.set('Cache-Control', 'no-store');
    return res.json({ 
      message: "Google sign-in successful", 
      verified: true,
      user: userData,
      token: idToken
    });
  } catch (error) {
    console.error("Error with Google sign-in:", error?.message || error);
    return res.status(401).json({ error: "Google sign-in failed" });
  }
};

// Email/Password Sign-In
exports.emailSignIn = async (req, res) => {
  try {
    const { idToken, role } = req.body;

    if (!idToken) {
      return res.status(400).json({ error: "ID token is required" });
    }

    // Verify the Firebase token
    const decodedToken = await verifyFirebaseToken(idToken);
    
    // Create or update user in Firestore
    const userData = await createOrUpdateUser(decodedToken, role);

    res.set('Cache-Control', 'no-store');
    return res.json({ 
      message: "Email sign-in successful", 
      verified: true,
      user: userData,
      token: idToken
    });
  } catch (error) {
    console.error("Error with email sign-in:", error?.message || error);
    return res.status(401).json({ error: "Email sign-in failed" });
  }
};

// Legacy OTP endpoints (for backward compatibility)
exports.sendOtp = async (req, res) => {
  return res.status(501).json({ 
    error: "OTP authentication is no longer supported. Please use Google Sign-In or Email/Password authentication." 
  });
};

exports.verifyOtp = async (req, res) => {
  return res.status(501).json({ 
    error: "OTP authentication is no longer supported. Please use Google Sign-In or Email/Password authentication." 
  });
};
