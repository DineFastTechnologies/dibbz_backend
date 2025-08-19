// src/routes/locations.js
const express = require('express');
const router = express.Router();

const {
  lookupPincode,
  getUserLocations,
  addLocation,
  updateLocation,
  deleteLocation,
  setPrimaryLocation,
} = require('../controller/locationController');

// GET endpoint to lookup city/state/coords by pincode
router.get('/lookup-pincode', lookupPincode);

// GET All User Saved Locations
router.get('/:userId/locations', getUserLocations);

// POST Add a New Custom Location for User
router.post('/:userId/locations', addLocation);

// PUT Update a User Saved Location
router.put('/:userId/locations/:locationId', updateLocation);

// DELETE a User Saved Location
router.delete('/:userId/locations/:locationId', deleteLocation);

// PATCH Set a Location as Primary
router.patch('/:userId/locations/:locationId/set-primary', setPrimaryLocation);

module.exports = router;
