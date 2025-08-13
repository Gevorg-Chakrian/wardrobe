// routes/looksRoutes.js
const express = require('express');
const router = express.Router();

const auth = require('../middleware/authMiddleware');
const looksCtrl = require('../controllers/looksController');

router.post('/looks', auth, looksCtrl.createLook);
router.get('/looks', auth, looksCtrl.listLooks);
router.get('/looks/:id', auth, looksCtrl.getLook);
router.put('/looks/:id', auth, looksCtrl.updateLook);
router.delete('/looks/:id', auth, looksCtrl.deleteLook);

module.exports = router;
