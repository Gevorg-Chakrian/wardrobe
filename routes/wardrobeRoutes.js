const express = require('express');
const router = express.Router();
const {
  addClothingItem,
  getWardrobeByUser,
  deleteClothingItem,
  updateClothingItem,
} = require('../controllers/wardrobeController');
const authMiddleware = require('../middleware/authMiddleware');

router.post('/', authMiddleware, addClothingItem);
router.get('/', authMiddleware, getWardrobeByUser);
router.put('/:id', authMiddleware, updateClothingItem);   // <—
router.delete('/:id', authMiddleware, deleteClothingItem);

module.exports = router;
