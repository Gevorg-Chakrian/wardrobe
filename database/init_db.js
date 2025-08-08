// database/init_db.js
const pool = require('./db');

const initTables = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        is_verified BOOLEAN NOT NULL DEFAULT false
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS wardrobe (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        image_url TEXT NOT NULL,
        item_type TEXT NOT NULL
      );
    `);

    console.log('✅ Tables are ready');
  } catch (err) {
    console.error('❌ Failed to create tables:', err);
    throw err;
  }
};

module.exports = initTables;
