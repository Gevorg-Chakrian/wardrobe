const express = require('express');
const router = express.Router();
const { extractClothingItem } = require('../controllers/extractController');

// @route POST /api/extract
router.post('/', extractClothingItem);

module.exports = router;
