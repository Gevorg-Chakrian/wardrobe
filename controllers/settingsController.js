// controllers/settingsController.js
const pool = require('../database/db');
const bcrypt = require('bcryptjs');

// GET /api/settings
exports.getSettings = async (req, res) => {
  const userId = req.user.id;
  try {
    const r = await pool.query(
      `SELECT language, tutorial_enabled FROM user_prefs WHERE user_id = $1`,
      [userId]
    );
    if (!r.rows.length) {
      // seed defaults on first read
      const ins = await pool.query(
        `INSERT INTO user_prefs (user_id)
         VALUES ($1)
         ON CONFLICT (user_id) DO NOTHING
         RETURNING language, tutorial_enabled`,
        [userId]
      );
      const row = ins.rows[0] || { language: 'en', tutorial_enabled: true };
      return res.json({ settings: row });
    }
    res.json({ settings: r.rows[0] });
  } catch (e) {
    console.error('getSettings error', e);
    res.status(500).json({ message: 'Failed to load settings' });
  }
};

// PUT /api/settings/language  { language }
exports.updateLanguage = async (req, res) => {
  const userId = req.user.id;
  const { language } = req.body || {};
  if (!language) return res.status(400).json({ message: 'language is required' });

  try {
    const r = await pool.query(
      `INSERT INTO user_prefs (user_id, language)
       VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE
         SET language = EXCLUDED.language,
             updated_at = NOW()
       RETURNING language, tutorial_enabled`,
      [userId, String(language)]
    );
    res.json({ settings: r.rows[0] });
  } catch (e) {
    console.error('updateLanguage error', e);
    res.status(500).json({ message: 'Failed to update language' });
  }
};

// PUT /api/settings/tutorial  { enabled: boolean }
exports.updateTutorial = async (req, res) => {
  const userId = req.user.id;
  const enabled = !!req.body.enabled;

  try {
    const r = await pool.query(
      `INSERT INTO user_prefs (user_id, tutorial_enabled)
       VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE
         SET tutorial_enabled = EXCLUDED.tutorial_enabled,
             updated_at = NOW()
       RETURNING language, tutorial_enabled`,
      [userId, enabled]
    );
    res.json({ settings: r.rows[0] });
  } catch (e) {
    console.error('updateTutorial error', e);
    res.status(500).json({ message: 'Failed to update tutorial setting' });
  }
};

// PUT /api/settings/password  { newPassword }
exports.changePassword = async (req, res) => {
  const userId = req.user.id;
  const { newPassword } = req.body || {};
  if (!newPassword || String(newPassword).length < 6) {
    return res.status(400).json({ message: 'New password must be at least 6 characters.' });
  }
  try {
    const hash = await bcrypt.hash(String(newPassword), 10);
    await pool.query(`UPDATE users SET password = $1 WHERE id = $2`, [hash, userId]);
    res.json({ message: 'Password updated' });
  } catch (e) {
    console.error('changePassword error', e);
    res.status(500).json({ message: 'Failed to change password' });
  }
};
