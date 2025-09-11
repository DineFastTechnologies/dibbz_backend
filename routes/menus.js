// src/routes/menus.js
const express = require('express');
const router = express.Router({ mergeParams: true });

const {
  getMenuItems,
  createMenuItem,
  createMenuItems,
  updateMenuItem,
  deleteMenuItem,
  checkMenuSetup,
  debugMenuCheck,
} = require('../controller/menuController'); // This controller will be created next

// GET all menu items for a specific restaurant (publicly accessible via /api/restaurants/:restaurantId/menu)
router.get('/', getMenuItems);

// GET check if restaurant has menu setup
router.get('/check-setup', checkMenuSetup);

// DEBUG: Test menu detection
router.get('/debug', debugMenuCheck);

// POST a new menu item for a specific restaurant (owner-only)
router.post('/', createMenuItem);

// POST batch create multiple menu items for a specific restaurant (owner-only)
router.post('/batch', createMenuItems);

// PUT update a specific menu item (owner-only)
router.put('/:menuItemId', updateMenuItem);

// DELETE a specific menu item (owner-only)
router.delete('/:menuItemId', deleteMenuItem);

module.exports = router;