// routes/categories.js
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  getCategories,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory
} = require('../controller/categoryController');

router.get('/', getCategories);
router.get('/:id', getCategory);
router.post('/', authenticate, createCategory);
router.put('/:id', authenticate, updateCategory);
router.delete('/:id', authenticate, deleteCategory);

module.exports = router;
