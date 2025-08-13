// controllers/looksController.js
const pool = require('../database/db');

exports.createLook = async (req, res) => {
  const userId = req.user.id;
  const imageUrl = req.body.image_url || req.body.imageUrl;
  const itemsUsed = Array.isArray(req.body.items_used) ? req.body.items_used : [];
  const tags = req.body.tags || {}; // { season:[], occasion:[] }

  if (!imageUrl) return res.status(400).json({ message: 'image_url is required' });

  try {
    const q = `
      INSERT INTO looks (user_id, image_url, items_used, tags)
      VALUES ($1, $2, $3, $4)
      RETURNING *;
    `;
    const r = await pool.query(q, [userId, imageUrl, itemsUsed, tags]);
    res.status(201).json({ look: r.rows[0] });
  } catch (e) {
    console.error('createLook error:', e);
    res.status(500).json({ message: 'Failed to create look' });
  }
};

exports.listLooks = async (req, res) => {
  const userId = req.user.id;
  try {
    const r = await pool.query(
      `SELECT * FROM looks WHERE user_id = $1 ORDER BY created_at DESC, id DESC`,
      [userId]
    );
    res.json({ looks: r.rows });
  } catch (e) {
    console.error('listLooks error:', e);
    res.status(500).json({ message: 'Failed to fetch looks' });
  }
};

exports.deleteLook = async (req, res) => {
  const userId = req.user.id;
  const lookId = Number(req.params.id);
  try {
    const r = await pool.query(`SELECT user_id FROM looks WHERE id = $1`, [lookId]);
    if (r.rows.length === 0) return res.status(404).json({ message: 'Look not found' });
    if (r.rows[0].user_id !== userId) return res.status(403).json({ message: 'Not authorized' });
    await pool.query(`DELETE FROM looks WHERE id = $1`, [lookId]);
    res.json({ message: 'Deleted' });
  } catch (e) {
    console.error('deleteLook error:', e);
    res.status(500).json({ message: 'Failed to delete look' });
  }
};
