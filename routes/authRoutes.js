const express = require('express');
const router = express.Router();
const authController = require('../controller/authController');

// Avoid caching OTP endpoints on edge/CDN
router.post('/send-otp', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  return authController.sendOtp(req, res, next);
});

router.post('/verify-otp', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  return authController.verifyOtp(req, res, next);
});

module.exports = router;
