// routes/interactions.js
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  likeRestaurant,
  shareRestaurant,
  likeMenuItem,
  shareMenuItem
} = require('../controller/interactionController');

router.post('/restaurant/:id/like', authenticate, likeRestaurant);
router.post('/restaurant/:id/share', authenticate, shareRestaurant);
router.post('/menu-item/:id/like', authenticate, likeMenuItem);
router.post('/menu-item/:id/share', authenticate, shareMenuItem);

module.exports = router;
