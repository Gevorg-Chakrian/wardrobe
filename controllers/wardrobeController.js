// controllers/wardrobeController.js
const pool = require('../database/db');

// Normalize tags into a plain JSON object
function normalizeTags(input) {
  if (!input) return {};
  try {
    const obj = typeof input === 'string' ? JSON.parse(input) : input;
    // strip any weird prototypes/cycles
    return JSON.parse(JSON.stringify(obj));
  } catch {
    return {};
  }
}

// Add clothing item
exports.addClothingItem = async (req, res) => {
  const imageUrl = req.body.image_url || req.body.imageUrl;
  const itemType = (req.body.item_type || req.body.itemType || '').toLowerCase();
  const tags     = normalizeTags(req.body.tags);
  const userId   = req.user.id;

  if (!imageUrl || !itemType) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO wardrobe (user_id, image_url, item_type, tags)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [userId, imageUrl, itemType, tags]
    );

    return res.status(201).json({ message: 'Clothing item added', item: result.rows[0] });
  } catch (err) {
    console.error('addClothingItem error:', err);
    return res.status(500).json({ message: 'Failed to add item' });
  }
};

// Get wardrobe for logged-in user (optional ?type=jeans)
exports.getWardrobeByUser = async (req, res) => {
  const userId = req.user.id;
  const type   = (req.query.type || '').trim().toLowerCase();

  try {
    let sql = 'SELECT * FROM wardrobe WHERE user_id = $1';
    const params = [userId];

    if (type && type !== 'all') {
      sql += ' AND item_type = $2';
      params.push(type);
    }
    sql += ' ORDER BY id DESC';

    const result = await pool.query(sql, params);
    return res.status(200).json(result.rows);
  } catch (err) {
    console.error('getWardrobeByUser error:', err);
    return res.status(500).json({ message: 'Failed to fetch wardrobe' });
  }
};

// Delete item only if it belongs to the user
exports.deleteClothingItem = async (req, res) => {
  const itemId = parseInt(req.params.id, 10);
  const userId = req.user.id;

  try {
    const result = await pool.query('SELECT * FROM wardrobe WHERE id = $1', [itemId]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'Item not found' });
    if (result.rows[0].user_id !== userId) return res.status(403).json({ message: 'Not authorized to delete this item' });

    await pool.query('DELETE FROM wardrobe WHERE id = $1', [itemId]);
    return res.status(200).json({ message: 'Item deleted' });
  } catch (err) {
    console.error('deleteClothingItem error:', err);
    return res.status(500).json({ message: 'Failed to delete item' });
  }
};
