// routes/looksRoutes.js
const express = require('express');
const router = express.Router();

const auth = require('../middleware/authMiddleware');
const looksCtrl = require('../controllers/looksController');

// POST /looks -> create a look
router.post('/looks', auth, looksCtrl.createLook);

// GET /looks -> list current user's looks
router.get('/looks', auth, looksCtrl.listLooks);

// DELETE /looks/:id -> delete one look
router.delete('/looks/:id', auth, looksCtrl.deleteLook);

module.exports = router;
