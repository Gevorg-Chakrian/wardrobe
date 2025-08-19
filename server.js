const express = require('express');
const cors = require('cors');
require('dotenv').config();

const initTables = require('./database/init_db');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// routes…
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/upload', require('./routes/uploadRoutes'));
app.use('/uploads', require('express').static(require('path').join(__dirname, 'uploads')));
app.use('/api/extract', require('./routes/extractRoutes'));
app.use('/api/wardrobe', require('./routes/wardrobeRoutes'));
app.use('/api/outfit', require('./routes/outfitRoutes'));
app.use('/api', require('./routes/looksRoutes'));
app.use('/api', require('./routes/settingsRoutes'));

app.get('/', (_req, res) => res.send('Virtual Wardrobe Backend is running ✅'));

const PORT = process.env.PORT || 5000;

(async () => {
  try {
    await initTables(); // ⬅️ ensure tables on boot
    app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
  } catch (e) {
    console.error('Failed to init DB', e);
    process.exit(1);
  }
})();
