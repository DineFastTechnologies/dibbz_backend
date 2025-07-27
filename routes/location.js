// src/routes/locations.js
const express = require('express');
const router = express.Router();

const {
  lookupPincode,
} = require('../controller/locationController'); // Imports the controller function for Pincode lookup

// GET endpoint to lookup city/state/coords by pincode
// Endpoint: GET /api/locations/lookup-pincode?pincode=<YOUR_PINCODE>
// This endpoint is generally public as it's a utility for address autofill.
router.get('/lookup-pincode', lookupPincode);

module.exports = router;