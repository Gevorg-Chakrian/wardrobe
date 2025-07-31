const express = require('express');
const router = express.Router();
const { generateOutfitPreview } = require('../controllers/outfitController');

// @route POST /api/outfit/preview
router.post('/preview', generateOutfitPreview);

module.exports = router;
