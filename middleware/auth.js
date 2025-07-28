// middleware/auth.js

const { admin, db } = require('../firebase'); 

const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization; // Capture the full Authorization header
  const idToken = authHeader?.split('Bearer ')[1]; // Extract the token after 'Bearer '

  // --- ADDED DIAGNOSTIC LOGS ---
  console.log("auth.js: authenticate middleware starting.");
  console.log("auth.js: Raw Authorization Header:", authHeader);
  console.log("auth.js: Extracted idToken (before check):", idToken);
  console.log("auth.js: 'idToken' is defined?", typeof idToken !== 'undefined'); // Check if the variable itself is defined
  console.log("auth.js: 'idToken' is truthy (passes !idToken check)?", !!idToken); // Check if it's truthy
  // --- END ADDED DIAGNOSTIC LOGS ---

  if (!idToken) {
    console.warn("auth.js: No token provided or malformed header. Denying access."); // Log warning
    return res.status(401).send('Unauthorized: No authentication token provided.');
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken); 
    req.user = decodedToken;
    next();
  } catch (error) {
    // This catch block means verifyIdToken was called, but failed.
    console.error("auth.js: Error verifying Firebase ID token:", error.message);
    if (error.code === 'auth/id-token-expired') {
        return res.status(401).send('Unauthorized: Authentication token expired. Please log in again.');
    }
    // Specific check for "Argument must be a non-empty string" if verifyIdToken is throwing it
    if (error.message.includes('argument must be a non-empty string')) {
        return res.status(400).send('Bad Request: Authentication token format invalid.');
    }
    return res.status(403).send('Unauthorized: Invalid authentication token.');
  }
};

const checkRole = (requiredRole) => {
  return async (req, res, next) => {
    console.log("auth.js: checkRole middleware starting."); // ADDED LOG
    if (!req.user || !req.user.uid) {
      return res.status(401).send('Unauthorized: User not authenticated (role check).');
    }

    try {
      const userDoc = await db.collection('users').doc(req.user.uid).get();
      if (!userDoc.exists) {
        return res.status(403).send('Forbidden: User profile not found in database for role check.');
      }

      const userRole = userDoc.data().role;
      if (userRole === requiredRole || (userRole === 'admin' && requiredRole !== 'customer')) {
        next();
      } else {
        return res.status(403).send(`Forbidden: Requires '${requiredRole}' role.`);
      }
    } catch (error) {
      console.error('Error checking user role:', error); // ADDED LOG
      res.status(500).send('Server error during role verification.');
    }
  };
};

module.exports = {
  authenticate,
  checkRole,
};