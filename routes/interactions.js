const express = require('express');
const router = express.Router();
const interactionController = require('../controller/interactionController');

router.post('/restaurant/:id/like', interactionController.likeRestaurant);
router.post('/restaurant/:id/share', interactionController.shareRestaurant);
router.post('/menu-item/:id/like', interactionController.likeMenuItem);
router.post('/menu-item/:id/share', interactionController.shareMenuItem);

module.exports = router;
