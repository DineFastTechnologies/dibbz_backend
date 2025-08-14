// middleware/auth.js

const { admin, db } = require('../firebase');

const parseBearerToken = (authorizationHeader) => {
  if (!authorizationHeader) return null;
  const parts = authorizationHeader.split(' ');
  if (parts.length !== 2) return null;
  const [scheme, token] = parts;
  if (!/^Bearer$/i.test(scheme) || !token) return null;
  return token;
};

const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const idToken = parseBearerToken(authHeader);

  if (!idToken) {
    return res.status(401).send('Unauthorized: No authentication token provided.');
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    req.user = decodedToken;
    return next();
  } catch (error) {
    if (error.code === 'auth/id-token-expired') {
      return res.status(401).send('Unauthorized: Authentication token expired. Please log in again.');
    }
    if (typeof error.message === 'string' && error.message.toLowerCase().includes('non-empty string')) {
      return res.status(400).send('Bad Request: Authentication token format invalid.');
    }
    return res.status(403).send('Unauthorized: Invalid authentication token.');
  }
};

const checkRole = (requiredRole) => {
  return async (req, res, next) => {
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
        return next();
      }
      return res.status(403).send(`Forbidden: Requires '${requiredRole}' role.`);
    } catch (error) {
      return res.status(500).send('Server error during role verification.');
    }
  };
};

module.exports = {
  authenticate,
  checkRole,
};