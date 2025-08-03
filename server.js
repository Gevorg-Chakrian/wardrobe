const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const authRoutes = require('./routes/authRoutes');
app.use('/api/auth', authRoutes); // ✅ Mount the routes

const path = require('path');
const uploadRoutes = require('./routes/uploadRoutes');

app.use('/api/upload', uploadRoutes);
app.use('/uploads', express.static(path.join(__dirname, 'uploads'))); // serve uploaded images

const extractRoutes = require('./routes/extractRoutes');
app.use('/api/extract', extractRoutes);

const wardrobeRoutes = require('./routes/wardrobeRoutes');
app.use('/api/wardrobe', wardrobeRoutes);

const outfitRoutes = require('./routes/outfitRoutes');
app.use('/api/outfit', outfitRoutes);

app.get('/', (req, res) => {
  res.send('Virtual Wardrobe Backend is running ✅');
});

const PORT = process.env.PORT || 5000;
app.listen(5000, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
