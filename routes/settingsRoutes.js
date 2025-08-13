// routes/settingsRoutes.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const ctrl = require('../controllers/settingsController');

router.get('/settings', auth, ctrl.getSettings);
router.put('/settings/language', auth, ctrl.updateLanguage);
router.put('/settings/tutorial', auth, ctrl.updateTutorial);
router.put('/settings/password', auth, ctrl.changePassword);

module.exports = router;
