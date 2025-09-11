// Firebase Auth Controller for Google Sign-In and Email/Password Authentication
const { admin, db } = require('../firebase');

// Firebase token verification
const verifyFirebaseToken = async (idToken) => {
  try {
    console.log('Verifying Firebase token with Admin SDK');
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    return {
      uid: decodedToken.uid,
      email: decodedToken.email,
      name: decodedToken.name || 'User',
      picture: decodedToken.picture || null
    };
  } catch (error) {
    console.error('Error verifying Firebase token:', error);
    throw new Error('Invalid or expired token');
  }
};

// User creation with Firestore
const createOrUpdateUser = async (firebaseUser, role = 'customer') => {
  try {
    console.log('Creating/updating user for:', firebaseUser.uid, 'role:', role);
    
    const userData = {
      uid: firebaseUser.uid,
      email: firebaseUser.email,
      name: firebaseUser.name || 'User',
      photoURL: firebaseUser.picture || null,
      role: role,
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now(),
      isActive: true
    };

    // Save to Firestore
    await db.collection('users').doc(firebaseUser.uid).set(userData, { merge: true });
    console.log('User data saved to Firestore');

    console.log('User data created:', userData);
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
