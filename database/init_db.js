const pool = require('./db');

const initTables = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL
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

    console.log('✅ Tables created successfully');
    process.exit(0);
  } catch (err) {
    console.error('❌ Failed to create tables:', err);
    process.exit(1);
  }
};

initTables();
