// src/routes/menus.js
const express = require('express');
const router = express.Router({ mergeParams: true });

const {
  getMenuItems,
  getMenuItemById,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
} = require('../controller/menuController'); // This controller will be created next

// GET all menu items for a specific restaurant (publicly accessible via /api/restaurants/:restaurantId/menu)
router.get('/', getMenuItems);

// GET a single menu item by ID (publicly accessible)
router.get('/:menuItemId', getMenuItemById);

// POST a new menu item for a specific restaurant (owner-only)
router.post('/', createMenuItem);

// PUT update a specific menu item (owner-only)
router.put('/:menuItemId', updateMenuItem);

// DELETE a specific menu item (owner-only)
router.delete('/:menuItemId', deleteMenuItem);

module.exports = router;
