// routes/uploadRoutes.js
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer storage to disk
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => cb(null, `${Date.now()}${path.extname(file.originalname || '.jpg')}`),
});

// Accept only images
const fileFilter = (req, file, cb) => {
  const ok = (file.mimetype || '').startsWith('image/');
  cb(ok ? null : new Error('Only image uploads are allowed'), ok);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

// POST /api/upload
router.post('/', authMiddleware, upload.single('image'), async (req, res) => {
  try {
    // Debug logs
    console.log('UPLOAD DEBUG -> file?', !!req.file, 'name:', req.file?.originalname, 'type:', req.file?.mimetype);
    console.log('UPLOAD DEBUG -> body:', req.body);

    if (!req.file) {
      return res.status(400).json({ message: 'Missing required fields: image' });
    }

    // Build public URL (works locally and on Render)
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const imageUrl = `${baseUrl}/uploads/${req.file.filename}`;

    // item_type is optional; default if client didn’t send it
    const itemType = req.body?.item_type || 'tshirt';

    return res.json({ image_url: imageUrl, item_type: itemType });
  } catch (err) {
    console.error('UPLOAD ERROR:', err.message);
    return res.status(500).json({ message: 'Upload failed', error: err.message });
  }
});

module.exports = router;
