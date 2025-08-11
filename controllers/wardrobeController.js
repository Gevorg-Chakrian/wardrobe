// controllers/wardrobeController.js
const pool = require('../database/db');

function normalizeTags(input) {
  if (!input) return {};
  try {
    const obj = typeof input === 'string' ? JSON.parse(input) : input;
    return JSON.parse(JSON.stringify(obj));
  } catch {
    return {};
  }
}

// Add
exports.addClothingItem = async (req, res) => {
  const imageUrl = req.body.image_url || req.body.imageUrl;
  const itemType = (req.body.item_type || req.body.itemType || '').toLowerCase();
  const tags     = normalizeTags(req.body.tags);
  const userId   = req.user.id;

  if (!imageUrl || !itemType) return res.status(400).json({ message: 'Missing required fields' });

  try {
    const result = await pool.query(
      `INSERT INTO wardrobe (user_id, image_url, item_type, tags)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [userId, imageUrl, itemType, tags]
    );
    res.status(201).json({ message: 'Clothing item added', item: result.rows[0] });
  } catch (err) {
    console.error('addClothingItem error:', err);
    res.status(500).json({ message: 'Failed to add item' });
  }
};

// Update (edit tags/type)
exports.updateClothingItem = async (req, res) => {
  const itemId  = parseInt(req.params.id, 10);
  const userId  = req.user.id;
  const itemType = req.body.item_type || req.body.itemType;
  const tagsIn   = (req.body.tags !== undefined) ? normalizeTags(req.body.tags) : undefined;

  try {
    const found = await pool.query('SELECT user_id FROM wardrobe WHERE id = $1', [itemId]);
    if (found.rows.length === 0) return res.status(404).json({ message: 'Item not found' });
    if (found.rows[0].user_id !== userId) return res.status(403).json({ message: 'Not authorized' });

    const set = [];
    const params = [itemId];

    if (itemType) { set.push(`item_type = $${params.push(itemType)}`); }
    if (tagsIn !== undefined) { set.push(`tags = $${params.push(tagsIn)}`); }

    if (!set.length) return res.status(400).json({ message: 'Nothing to update' });

    const updated = await pool.query(
      `UPDATE wardrobe SET ${set.join(', ')} WHERE id = $1 RETURNING *`,
      params
    );
    res.json({ message: 'Updated', item: updated.rows[0] });
  } catch (err) {
    console.error('updateClothingItem error:', err);
    res.status(500).json({ message: 'Failed to update item' });
  }
};

// List
exports.getWardrobeByUser = async (req, res) => {
  const userId = req.user.id;
  const type   = (req.query.type || '').trim().toLowerCase();
  try {
    let sql = 'SELECT * FROM wardrobe WHERE user_id = $1';
    const params = [userId];
    if (type && type !== 'all') { sql += ' AND item_type = $2'; params.push(type); }
    sql += ' ORDER BY id DESC';
    const result = await pool.query(sql, params);
    res.status(200).json(result.rows);
  } catch (err) {
    console.error('getWardrobeByUser error:', err);
    res.status(500).json({ message: 'Failed to fetch wardrobe' });
  }
};

// Delete
exports.deleteClothingItem = async (req, res) => {
  const itemId = parseInt(req.params.id, 10);
  const userId = req.user.id;
  try {
    const result = await pool.query('SELECT * FROM wardrobe WHERE id = $1', [itemId]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'Item not found' });
    if (result.rows[0].user_id !== userId) return res.status(403).json({ message: 'Not authorized to delete this item' });
    await pool.query('DELETE FROM wardrobe WHERE id = $1', [itemId]);
    res.status(200).json({ message: 'Item deleted' });
  } catch (err) {
    console.error('deleteClothingItem error:', err);
    res.status(500).json({ message: 'Failed to delete item' });
  }
};
