const express = require('express');
const router = express.Router();
const pool = require('../database/db');
const bcrypt = require('bcryptjs');
const auth = require('../middleware/authMiddleware');

const { registerUser, loginUser } = require('../controllers/authController');

router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/change-password', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body || {};

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Missing fields' });
    }

    const { rows } = await pool.query(
      `SELECT password FROM users WHERE id = $1`,
      [userId]
    );
    if (!rows.length) return res.status(404).json({ message: 'User not found' });

    const ok = await bcrypt.compare(currentPassword, rows[0].password);
    if (!ok) return res.status(401).json({ message: 'Current password is incorrect' });

    const hash = await bcrypt.hash(newPassword, 10);
    await pool.query(`UPDATE users SET password = $1 WHERE id = $2`, [hash, userId]);

    res.json({ message: 'Password updated' });
  } catch (e) {
    console.error('change-password error:', e);
    res.status(500).json({ message: 'Failed to change password' });
  }
});

module.exports = router;
