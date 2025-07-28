// src/routes/tables.js
const express = require('express');
const router = express.Router({ mergeParams: true });

const {
  getTables,
  createTable,
  updateTable,
  deleteTable,
} = require('../controller/tableController'); // This controller will be created next

// GET all tables for a specific restaurant (publicly accessible via /api/restaurants/:restaurantId/tables, but usually for owner/staff)
router.get('/', getTables);

// POST a new table for a specific restaurant (owner-only)
router.post('/', createTable);

// PUT update a specific table (owner-only)
router.put('/:tableId', updateTable);

// DELETE a specific table (owner-only)
router.delete('/:tableId', deleteTable);

module.exports = router;