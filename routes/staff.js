const express = require('express');
const router = express.Router();
const { 
  addStaffMember, 
  getStaffMembers, 
  updateStaffMember, 
  deleteStaffMember,
  getStaffMemberById 
} = require('../controller/staffController');

// POST /api/restaurants/:restaurantId/staff - Add new staff member
router.post('/:restaurantId/staff', addStaffMember);

// GET /api/restaurants/:restaurantId/staff - Get all staff members for a restaurant
router.get('/:restaurantId/staff', getStaffMembers);

// GET /api/restaurants/:restaurantId/staff/:staffId - Get specific staff member
router.get('/:restaurantId/staff/:staffId', getStaffMemberById);

// PUT /api/restaurants/:restaurantId/staff/:staffId - Update staff member
router.put('/:restaurantId/staff/:staffId', updateStaffMember);

// DELETE /api/restaurants/:restaurantId/staff/:staffId - Delete staff member
router.delete('/:restaurantId/staff/:staffId', deleteStaffMember);

module.exports = router;
