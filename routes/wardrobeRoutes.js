const express = require('express');
const router = express.Router();
const {
  addClothingItem,
  getWardrobeByUser,
  deleteClothingItem
} = require('../controllers/wardrobeController');
const authMiddleware = require('../middleware/authMiddleware');

// @route POST /api/wardrobe
router.post('/', authMiddleware, addClothingItem);

// @route GET /api/wardrobe
router.get('/', authMiddleware, getWardrobeByUser);

// @route DELETE /api/wardrobe/:id
router.delete('/:id', authMiddleware, deleteClothingItem);

module.exports = router;
