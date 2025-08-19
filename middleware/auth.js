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
    const userDoc = await db.collection('users').doc(decodedToken.uid).get();
    if (userDoc.exists) {
      decodedToken.role = userDoc.data().role;
    } else {
      decodedToken.role = 'user';
    }
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

const { checkRole } = require('./roles');

module.exports = {
  authenticate,
  checkRole,
};
