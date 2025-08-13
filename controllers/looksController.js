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

exports.getLook = async (req, res) => {
  try {
    const userId = req.user.id;
    const lookId = Number(req.params.id);
    if (!Number.isFinite(lookId)) {
      return res.status(400).json({ message: 'Invalid look id' });
    }

    // 1) fetch base look
    const base = await pool.query(
      `SELECT id, user_id, image_url, items_used, tags, created_at
       FROM looks
       WHERE id = $1 AND user_id = $2`,
      [lookId, userId]
    );
    if (base.rows.length === 0) {
      return res.status(404).json({ message: 'Look not found' });
    }
    const row = base.rows[0];

    // 2) sanitize items_used -> number[]
    let ids = [];
    if (Array.isArray(row.items_used)) {
      ids = row.items_used
        .map(x => Number(x))
        .filter(n => Number.isFinite(n) && n > 0);
    }

    // 3) expand components from wardrobe
    let components = [];
    if (ids.length > 0) {
      // placeholders start at $2 because $1 is user_id
      const placeholders = ids.map((_, i) => `$${i + 2}`).join(',');
      const q = `
        SELECT id, image_url, item_type
        FROM wardrobe
        WHERE user_id = $1 AND id IN (${placeholders})
      `;
      const params = [userId, ...ids];
      const r2 = await pool.query(q, params);
      components = r2.rows;
    }

    // 4) unpack tags
    const tags = row.tags || {};
    const season   = Array.isArray(tags.season)   ? tags.season   : [];
    const occasion = Array.isArray(tags.occasion) ? tags.occasion : [];

    return res.json({
      look: {
        id: row.id,
        image_url: row.image_url,
        season,
        occasion,
        components,
        created_at: row.created_at,
      },
    });
  } catch (e) {
    console.error('getLook error:', e);
    return res.status(500).json({ message: 'Failed to fetch look' });
  }
};

// 🔧 FIXED: update only tags.season / tags.occasion inside tags jsonb
exports.updateLook = async (req, res) => {
  try {
    const userId = req.user.id;
    const lookId = Number(req.params.id);
    const { season = [], occasion = [] } = req.body;

    // read current tags
    const cur = await pool.query(
      `SELECT tags FROM looks WHERE id = $1 AND user_id = $2`,
      [lookId, userId]
    );
    if (!cur.rows.length) return res.status(404).json({ message: 'Look not found' });

    const tags = cur.rows[0].tags || {};
    tags.season = Array.isArray(season) ? season : [];
    tags.occasion = Array.isArray(occasion) ? occasion : [];

    const upd = await pool.query(
      `UPDATE looks
       SET tags = $1::jsonb
       WHERE id = $2 AND user_id = $3
       RETURNING id, image_url, tags`,
      [JSON.stringify(tags), lookId, userId]
    );

    res.json({
      look: {
        id: upd.rows[0].id,
        image_url: upd.rows[0].image_url,
        season: upd.rows[0].tags?.season || [],
        occasion: upd.rows[0].tags?.occasion || [],
      },
    });
  } catch (e) {
    console.error('updateLook error', e);
    res.status(500).json({ message: 'Failed to update look' });
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
