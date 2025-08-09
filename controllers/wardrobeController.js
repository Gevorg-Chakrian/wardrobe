const pool = require('../database/db');

// Add clothing item
// Add clothing item
exports.addClothingItem = async (req, res) => {
  // accept both camelCase and snake_case
  const imageUrl = req.body.imageUrl || req.body.image_url;
  const itemType = req.body.itemType || req.body.item_type;
  const userId = req.user.id;

  if (!imageUrl || !itemType) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO wardrobe (user_id, image_url, item_type) VALUES ($1, $2, $3) RETURNING *',
      [userId, imageUrl, itemType]
    );
    res.status(201).json({ message: 'Clothing item added', item: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to add item', error: err.message });
  }
};


// Get wardrobe for logged-in user
exports.getWardrobeByUser = async (req, res) => {
  const userId = req.user.id;
  const type = (req.query.type || '').trim();

  try {
    let sql = 'SELECT * FROM wardrobe WHERE user_id = $1';
    const params = [userId];

    if (type && type.toLowerCase() !== 'all') {
      sql += ' AND item_type = $2';
      params.push(type);
    }
    sql += ' ORDER BY id DESC';

    const result = await pool.query(sql, params);
    res.status(200).json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch wardrobe', error: err.message });
  }
};


// Delete item only if it belongs to the user
exports.deleteClothingItem = async (req, res) => {
  const itemId = parseInt(req.params.id);
  const userId = req.user.id;

  try {
    const result = await pool.query('SELECT * FROM wardrobe WHERE id = $1', [itemId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Item not found' });
    }

    if (result.rows[0].user_id !== userId) {
      return res.status(403).json({ message: 'Not authorized to delete this item' });
    }

    await pool.query('DELETE FROM wardrobe WHERE id = $1', [itemId]);
    res.status(200).json({ message: 'Item deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to delete item', error: err.message });
  }
};
