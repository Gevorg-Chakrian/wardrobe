const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../database/db');

exports.registerUser = async (req, res) => {
  const { username, email, password } = req.body;

  try {
    // Check if email already exists
    const existing = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user into DB
    const result = await pool.query(
      'INSERT INTO users (username, email, password, is_verified) VALUES ($1, $2, $3, $4) RETURNING id, username, email, is_verified',
      [username, email, hashedPassword, false]
    );

    const user = result.rows[0];

    // Generate JWT
    const token = jwt.sign({ id: user.id, email }, process.env.JWT_SECRET, { expiresIn: '1d' });

    res.status(201).json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        is_verified: user.is_verified
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Registration failed', error: err.message });
  }
};

exports.loginUser = async (req, res) => {
  const { email, password } = req.body;

  try {
    // Look up user by email
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user = result.rows[0];

    // Compare password
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Generate JWT
    const token = jwt.sign({ id: user.id, email }, process.env.JWT_SECRET, { expiresIn: '1d' });

    res.status(200).json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        is_verified: user.is_verified
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Login failed', error: err.message });
  }
};
