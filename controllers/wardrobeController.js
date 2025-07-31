const pool = require('../database/db');

// Add clothing item
exports.addClothingItem = async (req, res) => {
  const { imageUrl, itemType } = req.body;
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

  try {
    const result = await pool.query(
      'SELECT * FROM wardrobe WHERE user_id = $1 ORDER BY id DESC',
      [userId]
    );

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
