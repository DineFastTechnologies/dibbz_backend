const express = require('express');
const router = express.Router();
const authController = require('../controller/authController');

// Test endpoint to verify deployment
router.get('/test', (req, res) => {
  res.json({ message: 'Auth routes are working!', timestamp: new Date().toISOString() });
});

// Firebase Auth endpoints
router.post('/verify-token', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  return authController.verifyToken(req, res, next);
});

router.post('/google-signin', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  return authController.googleSignIn(req, res, next);
});

router.post('/email-signin', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  return authController.emailSignIn(req, res, next);
});

// Legacy OTP endpoints (deprecated)
router.post('/send-otp', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  return authController.sendOtp(req, res, next);
});

router.post('/verify-otp', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  return authController.verifyOtp(req, res, next);
});

module.exports = router;
