/* eslint-disable consistent-return */
const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { body, validationResult } = require('express-validator');
const he = require('he');
const { DateTime } = require('luxon');

const router = express.Router();

// Load environment variables
require('dotenv').config();

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  database: process.env.DB_NAME || 'study1only_db'
};

// Input validation rules
const signupValidation = [
  body('username')
    .trim()
    .isLength({ min: 1, max: 10 })
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username must be 1-10 characters and contain only letters, numbers, and underscores'),
  body('password')
    .trim()
    .isLength({ min: 6, max: 20 })
    .withMessage('Password must be 6-20 characters'),
  body('address')
    .trim()
    .notEmpty()
    .withMessage('Address is required'),
  body('country')
    .trim()
    .notEmpty()
    .withMessage('Country is required'),
  body('confirmPassword')
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Passwords do not match');
      }
      return true;
    })
];

const loginValidation = [
  body('username')
    .trim()
    .notEmpty()
    .withMessage('Username is required'),
  body('password')
    .trim()
    .notEmpty()
    .withMessage('Password is required')
];

// Validation middleware
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Role-based access control middleware
const requireRole = (roles) => (req, res, next) => {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  if (!roles.includes(req.session.user.role)) {
    return res.status(403).json({ message: 'Insufficient permissions' });
  }
  next();
};

// Admin-only middleware
const requireAdmin = requireRole(['admin']);


const DEFAULT_PASSWORD = 'default123';

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/uploads/avatars');
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'avatar-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: function (req, file, cb) {
        // Accept only image files
        if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/)) {
            return cb(new Error('Only image files are allowed!'), false);
        }
        cb(null, true);
    }
});

// GET /api/users - Fetch all users (Admin only)
router.get('/', requireAdmin, async (req, res) => {
  try {
    const connection = await mysql.createConnection(dbConfig);
    const [rows] = await connection.execute('SELECT * FROM users');
    await connection.end();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch users" });
  }
});

// POST /api/users - Add new user (Admin only)
router.post('/', requireAdmin, async (req, res) => {
  const {
 username, address, total_study_time, role, region
} = req.body;

  if (!username || !address || !role) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  // Add username length validation (changed to 1-10 characters to match signup)
  if (username.length < 1 || username.length > 10) {
    return res.status(400).json({ message: "Username must be between 1 and 10 characters" });
  }

  const timeRegex = /^\d{2}:\d{2}:\d{2}$/;
  const validTime = timeRegex.test(total_study_time) ? total_study_time : '00:00:00';

  try {
    const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, 10);
    const connection = await mysql.createConnection(dbConfig);

    // Check if username already exists first
    const [existingUser] = await connection.execute(
      'SELECT username FROM users WHERE username = ?',
      [username]
    );

    if (existingUser.length > 0) {
      await connection.end();
      return res.status(409).json({
        message: "User name already exist"
      });
    }

    // Find the lowest available positive user_id
    const [idRows] = await connection.execute(
      `SELECT COALESCE(MIN(t1.user_id) + 1, 1) AS next_id
       FROM users t1
       LEFT JOIN users t2 ON t1.user_id + 1 = t2.user_id
       WHERE t2.user_id IS NULL AND t1.user_id > 0`
    );
    const nextUserId = idRows[0].next_id || 1;

    // Insert the new user with the chosen user_id
    // eslint-disable-next-line no-unused-vars
    const [result] = await connection.execute(
      `INSERT INTO users (user_id, username, password, address, total_study_time, role, region, avatar_link, created_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, DEFAULT, CURRENT_TIMESTAMP)`,
      [nextUserId, username, hashedPassword, address, validTime, role, region]
    );

    // Get the created user with the actual created_date and avatar_link
    const [newUser] = await connection.execute(
      'SELECT created_date, avatar_link FROM users WHERE user_id = ?',
      [nextUserId]
    );

    await connection.end();

    res.status(201).json({
      message: "User created",
      user_id: nextUserId,
      created_date: newUser[0].created_date,
      avatar_link: newUser[0].avatar_link
    });
  } catch (err) {

    // Handle MySQL duplicate entry error specifically
    if (err.code === 'ER_DUP_ENTRY') {
      res.status(409).json({
        message: "User name already exist"
      });
    } else {
      res.status(500).json({ message: "Failed to create user" });
    }
  }
});

// PUT /api/users/:id - Update user (Admin only)
router.put('/:id', requireAdmin, async (req, res) => {
  const {
 username, address, total_study_time, role, region
} = req.body;
  const userId = req.params.id;

  if (!username || !address || !role) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  // Add username length validation for updates too (1-10 characters)
  if (username.length < 1 || username.length > 10) {
    return res.status(400).json({ message: "Username must be between 1 and 10 characters" });
  }

  const timeRegex = /^\d{2}:\d{2}:\d{2}$/;
  const validTime = timeRegex.test(total_study_time) ? total_study_time : '00:00:00';

  try {
    const connection = await mysql.createConnection(dbConfig);

    // Check if username exists for other users (not this user)
    const [existingUser] = await connection.execute(
      'SELECT username FROM users WHERE username = ? AND user_id != ?',
      [username, userId]
    );

    if (existingUser.length > 0) {
      await connection.end();
      return res.status(409).json({
        message: "User name already exist"
      });
    }

    // Update the user
    const [result] = await connection.execute(
      `UPDATE users SET username = ?, address = ?, total_study_time = ?, role = ?, region = ?
       WHERE user_id = ?`,
      [username, address, validTime, role, region, userId]
    );

    await connection.end();

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({ message: "User updated successfully" });
  } catch (err) {

    if (err.code === 'ER_DUP_ENTRY') {
      res.status(409).json({
        message: "User name already exist"
      });
    } else {
      res.status(500).json({ message: "Failed to update user" });
    }
  }
});

// DELETE /api/users/:id - Delete user (Admin only)
router.delete('/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    const connection = await mysql.createConnection(dbConfig);
    const [result] = await connection.execute(`DELETE FROM users WHERE user_id = ?`, [id]);
    await connection.end();

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({ message: "User deleted" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete user" });
  }
});

// POST /api/users/reset-password - Reset to default (Admin only)
router.post('/reset-password', requireAdmin, async (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ message: "Missing username" });

  try {
    const hashed = await bcrypt.hash(DEFAULT_PASSWORD, 10);
    const connection = await mysql.createConnection(dbConfig);
    const [result] = await connection.execute(
      `UPDATE users SET password = ? WHERE username = ?`,
      [hashed, username]
    );
    await connection.end();

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({ message: "Password reset successfully" });
  } catch (err) {
    res.status(500).json({ message: "Failed to reset password" });
  }
});

// POST /users/login - User login (Step 1: Validate credentials only)
router.post('/login', loginValidation, validate, async (req, res) => {
  const { username, password } = req.body;

  try {
    const connection = await mysql.createConnection(dbConfig);
    const [users] = await connection.execute(
      'SELECT * FROM users WHERE username = ?',
      [username]
    );

    if (users.length === 0) {
      await connection.end();
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    const user = users[0];

    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) {
      await connection.end();
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    await connection.end();

    // Return user data without creating session
    res.json({
      message: 'Credentials valid',
      user: {
        id: user.user_id,
        user_id: user.user_id,
        username: user.username,
        address: user.address,
        role: user.role,
        region: user.region,
        background: user.background || '/images/default-background.png',
        avatar_link: user.avatar_link || '/images/default-avatar.png',
        total_study_time: user.total_study_time,
        current_streak: user.current_streak,
        longest_streak: user.longest_streak
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /users/complete-login - Complete login after CAPTCHA (Step 2: Create session)
router.post('/complete-login', async (req, res) => {
  const { username, timeZone, clientDateTime } = req.body;

  try {
    const connection = await mysql.createConnection(dbConfig);
    const [users] = await connection.execute(
      'SELECT * FROM users WHERE username = ?',
      [username]
    );

    if (users.length === 0) {
      await connection.end();
      return res.status(401).json({ message: 'User not found' });
    }

    const user = users[0];

    // --- LOGIN STREAK LOGIC ---
    let currentStreak = user.current_streak || 0;
    let longestStreak = user.longest_streak || 0;
    let lastLogin = user.last_login;
    let now = DateTime.now().setZone(timeZone || 'UTC');
    let updateStreak = false;

    if (lastLogin) {
      // Convert last_login from DB (assumed UTC) to user's time zone
      const lastLoginLocal = DateTime.fromJSDate(new Date(lastLogin), { zone: 'UTC' }).setZone(timeZone || 'UTC');
      const lastLoginDate = lastLoginLocal.startOf('day');
      const nowDate = now.startOf('day');
      const diffDays = nowDate.diff(lastLoginDate, 'days').days;
      if (diffDays === 1) {
        currentStreak += 1;
        updateStreak = true;
      } else if (diffDays === 0) {
        // same day, do not change streak
        updateStreak = false;
      } else {
        currentStreak = 1;
        updateStreak = true;
      }
    } else {
      // First login
      currentStreak = 1;
      updateStreak = true;
    }
    if (currentStreak > longestStreak) {
      longestStreak = currentStreak;
      // eslint-disable-next-line no-unused-vars
      updateStreak = true;
    }

    // Use client datetime directly for last_login
    // The client datetime is already in MySQL format (yyyy-MM-dd HH:mm:ss)
    await connection.execute(
      'UPDATE users SET last_login = ?, current_streak = ?, longest_streak = ? WHERE user_id = ?',
      [clientDateTime, currentStreak, longestStreak, user.user_id]
    );

    // Get Spotify connection status
    const [spotifyAuth] = await connection.execute(
      'SELECT * FROM spotify_auth WHERE user_id = ?',
      [user.user_id]
    );

    await connection.end();

    // Ensure req.session exists before setting properties
    if (!req.session) {
      return res.status(500).json({ message: 'Session not initialized' });
    }

    // Set session data
    req.session.user = {
      id: user.user_id,
      user_id: user.user_id,
      username: user.username,
      address: user.address,
      role: user.role,
      background: user.background || '/images/default-background.png',
      avatar_link: user.avatar_link || '/images/default-avatar.png',
      current_streak: currentStreak,
      longest_streak: longestStreak
    };
    req.session.lastActivity = Date.now();

    // Save session before sending response
    req.session.save((err) => {
      if (err) {
        return res.status(500).json({ message: 'Login failed - session error' });
      }

      // Set cookie options explicitly
      res.cookie('connect.sid', req.session.id, {
        httpOnly: true,
        secure: false, // Set to false for development
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
      });

      res.json({
        message: 'Login completed successfully',
        user: {
          id: user.user_id,
          user_id: user.user_id,
          username: user.username,
          address: user.address,
          role: user.role,
          region: user.region,
          background: user.background || '/images/default-background.png',
          avatar_link: user.avatar_link || '/images/default-avatar.png',
          current_streak: currentStreak,
          longest_streak: longestStreak,
          total_study_time: user.total_study_time,
          spotifyConnected: spotifyAuth.length > 0,
          spotifyIsPremium: spotifyAuth.length > 0 ? spotifyAuth[0].is_premium : false
        }
      });
    });
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/users/signup - Register new user
router.post('/signup', signupValidation, validate, async (req, res) => {
  const {
 username, address, password, country
} = req.body;

  try {
    const connection = await mysql.createConnection(dbConfig);

    // Use parameterized query to prevent SQL injection
    const [existingUser] = await connection.execute(
      'SELECT * FROM users WHERE username = ?',
      [username]
    );

    if (existingUser.length > 0) {
      await connection.end();
      return res.status(409).json({ message: 'Username already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const defaultAvatar = '/images/default-avatar.png';

    // Use parameterized query for insert
    await connection.execute(
      'INSERT INTO users (username, password, address, region, avatar_link, role, total_study_time, current_streak, longest_streak, created_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
      [username, hashedPassword, address, country, defaultAvatar, 'user', '00:00:00', 0, 0]
    );

    await connection.end();
    res.status(201).json({ message: 'User registered successfully!' });
  } catch (error) {
    res.status(500).json({ message: 'Internal server error.' });
  }
});

// POST /api/users/check-username - Check availability
router.post('/check-username', async (req, res) => {
  const { username } = req.body;

  if (!username || typeof username !== 'string') {
    return res.status(400).json({ message: 'Invalid username.' });
  }

  try {
    const connection = await mysql.createConnection(dbConfig);
    const [rows] = await connection.execute(
      'SELECT * FROM users WHERE username = ?',
      [username]
    );
    await connection.end();

    if (rows.length > 0) {
      return res.status(409).json({ message: 'Username already exists.' });
    }

    res.status(200).json({ message: 'Username is available.' });
  } catch (error) {
    res.status(500).json({ message: 'An error occurred. Please try again later.' });
  }
});

// POST /api/users/update - Update profile (used by user dashboard)
router.post('/update', async (req, res) => {
  const {
 user_id, username, address, password, region
} = req.body;

  if (!user_id) {
    return res.status(400).json({ message: 'User ID is required.' });
  }

  try {
    const connection = await mysql.createConnection(dbConfig);

    // Get current user data
    const [currentUser] = await connection.execute(
      'SELECT * FROM users WHERE user_id = ?',
      [user_id]
    );

    if (currentUser.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }

    // Ensure default avatar is set if none exists
    if (!currentUser[0].avatar_link) {
      await connection.execute(
        'UPDATE users SET avatar_link = ? WHERE user_id = ?',
        ['/images/default-avatar.png', user_id]
      );
    }

    // Username update
    if (username) {
      if (username.length < 1 || username.length > 10 || /\s/.test(username)) {
        return res.status(400).json({ message: 'Invalid username format.' });
      }

      const [conflict] = await connection.execute(
        'SELECT * FROM users WHERE username = ? AND user_id != ?',
        [username, user_id]
      );

      if (conflict.length > 0) {
        return res.status(409).json({ message: 'Username is already taken.' });
      }

      await connection.execute('UPDATE users SET username = ? WHERE user_id = ?', [username, user_id]);
    }

    // Address update
    if (address) {
      await connection.execute('UPDATE users SET address = ? WHERE user_id = ?', [address, user_id]);
    }

    // Region update
    if (region) {
      await connection.execute('UPDATE users SET region = ? WHERE user_id = ?', [region, user_id]);
    }

    // Password update
    if (password) {
      if (password.length < 6 || password.length > 20) {
        return res.status(400).json({ message: 'Password must be 6–20 characters.' });
      }

      const hashed = await bcrypt.hash(password, 10);
      await connection.execute('UPDATE users SET password = ? WHERE user_id = ?', [hashed, user_id]);
    }

    const [updated] = await connection.execute('SELECT * FROM users WHERE user_id = ?', [user_id]);
    await connection.end();

    // Ensure avatar_link is set in response
    const user = updated[0];
    user.avatar_link = user.avatar_link || '/images/default-avatar.png';

    res.status(200).json({ message: 'User updated successfully!', user });
  } catch (error) {
    res.status(500).json({ message: 'Internal server error.' });
  }
});

// POST /api/users/update-photo - Update user photo
router.post('/update-photo', upload.single('photo'), async (req, res) => {
    const { userId } = req.body;
    const { file: photoFile } = req;

    if (!userId) {
        return res.status(400).json({ message: 'User ID is required' });
    }

    if (!photoFile) {
        return res.status(400).json({ message: 'No photo file uploaded' });
    }

    try {
        const connection = await mysql.createConnection(dbConfig);

        // Get the current avatar path from the database
        const [userRows] = await connection.execute(
            'SELECT avatar_link FROM users WHERE user_id = ?',
            [userId]
        );

        if (userRows.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Delete the old avatar file if it exists and is not the default avatar
        const oldAvatarPath = userRows[0].avatar_link;
        if (oldAvatarPath && !oldAvatarPath.includes('default-avatar.png')) {
            const fullOldPath = path.join(__dirname, '..', 'public', oldAvatarPath.substring(1));
            try {
                if (fs.existsSync(fullOldPath)) {
                    fs.unlinkSync(fullOldPath);
                }
            } catch (deleteError) {
                // Continue with the update even if deletion fails
            }
        }

        // Get the file path where the new photo was saved
        const photoPath = photoFile.path.replace(/\\/g, '/'); // Convert Windows paths to URL format
        const photoUrl = '/' + photoPath.split('public/').pop(); // Get the relative path from public folder

        // Update the user's photo in the database
        const [result] = await connection.execute(
            'UPDATE users SET avatar_link = ? WHERE user_id = ?',
            [photoUrl, userId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        await connection.end();
        res.json({
            message: 'Photo updated successfully',
            photoUrl: photoUrl
        });

    } catch (error) {
        res.status(500).json({ message: 'Error updating photo' });
    }
});

// POST /api/users/reset-photo - Reset avatar to default
router.post('/reset-photo', async (req, res) => {
    const { userId } = req.body;
    if (!userId) {
        return res.status(400).json({ message: 'User ID is required' });
    }
    const defaultAvatar = '/images/default-avatar.png';

    try {
        const connection = await mysql.createConnection(dbConfig);

        // Optionally, delete the old avatar file if it's not the default
        const [userRows] = await connection.execute(
            'SELECT avatar_link FROM users WHERE user_id = ?',
            [userId]
        );
        if (userRows.length > 0) {
            const oldAvatar = userRows[0].avatar_link;
            if (oldAvatar && !oldAvatar.includes('default-avatar.png')) {
                const fullOldPath = path.join(__dirname, '..', 'public', oldAvatar.startsWith('/') ? oldAvatar.substring(1) : oldAvatar);
                try {
                    if (fs.existsSync(fullOldPath)) {
                        fs.unlinkSync(fullOldPath);
                    }
                } catch (deleteError) {
                    // Continue with the update even if deletion fails
                }
            }
        }

        // Update avatar_link to default
        const [result] = await connection.execute(
            'UPDATE users SET avatar_link = ? WHERE user_id = ?',
            [defaultAvatar, userId]
        );
        await connection.end();

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json({ message: 'Avatar reset to default', photoUrl: defaultAvatar });
    } catch (error) {
        res.status(500).json({ message: 'Error resetting avatar' });
    }
  });

// POST /users/logout - User logout
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ message: 'Logout failed' });
    }
    res.clearCookie('connect.sid');
    res.json({ message: 'Logout successful' });
  });
});

// POST /users/update-background - Update user background
router.post('/update-background', async (req, res) => {
  const { user_id, background } = req.body;

  if (!user_id || !background) {
    return res.status(400).json({ message: 'User ID and background are required.' });
  }

  // Decode HTML entities in the background URL for robustness
  const decodedBackground = he.decode(background);

  try {
    const connection = await mysql.createConnection(dbConfig);
    const sql = 'UPDATE users SET background = ? WHERE user_id = ?';
    const [result] = await connection.execute(sql, [decodedBackground, user_id]);
    await connection.end();

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'User not found or background not updated.' });
    }

    res.json({ message: 'Background updated successfully!' });
  } catch (error) {
    res.status(500).json({ message: 'Internal server error.', error: error.message });
  }
});

// GET /users/me - Get current user data
router.get('/me', async (req, res) => {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ message: 'Not authenticated' });
  }

  try {
    const connection = await mysql.createConnection(dbConfig);

    // Get user data including spotify_id, address, region, and avatar_link
    const [users] = await connection.execute(
      'SELECT user_id, username, role, background, spotify_id, address, region, avatar_link FROM users WHERE user_id = ?',
      [req.session.user.id]
    );

    if (users.length === 0) {
      await connection.end();
      // Clear invalid session
      req.session.destroy();
      return res.status(401).json({ message: 'User not found' });
    }

    // Get Spotify connection status
    const [spotifyAuth] = await connection.execute(
      'SELECT * FROM spotify_auth WHERE user_id = ?',
      [req.session.user.id]
    );

    await connection.end();

    // Update session last activity
    req.session.lastActivity = Date.now();
    req.session.save((err) => {
      if (err) {
        return res.status(500).json({ message: 'Session error' });
      }

      const user = users[0];
      res.json({
        id: user.user_id,
        username: user.username,
        role: user.role,
        background: user.background || '/images/default-background.png',
        avatar_link: user.avatar_link || '/images/default-avatar.png',
        spotify_id: user.spotify_id,
        address: user.address,
        region: user.region,
        spotifyConnected: spotifyAuth.length > 0,
        spotifyIsPremium: spotifyAuth.length > 0 ? spotifyAuth[0].is_premium : false
      });
    });
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /users/study-stats - Get study statistics
router.get('/study-stats', async (req, res) => {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  const userId = req.session.user.id;

  try {
    const connection = await mysql.createConnection(dbConfig);

    // Get current time for calculations
    const now = new Date();

    // Calculate week start (Monday 00:00:00)
    const weekStart = new Date(now);
    const day = weekStart.getDay();
    const diff = weekStart.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
    weekStart.setDate(diff);
    weekStart.setHours(0, 0, 0, 0);

    // Calculate month start (1st day of current month)
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    monthStart.setHours(0, 0, 0, 0);

    // Helper function to format seconds into HH:MM:SS
    const formatTime = (seconds) => {
      const hours = Math.floor(seconds / 3600).toString().padStart(2, '0');
      const minutes = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
      const secs = (seconds % 60).toString().padStart(2, '0');
      return `${hours}:${minutes}:${secs}`;
    };

    // Query for this week's study time
    const [weekResult] = await connection.execute(
      `SELECT COALESCE(SUM(duration), 0) as total_seconds
       FROM sessions
       WHERE user_id = ?
       AND start_time >= ?
       AND end_time IS NOT NULL`,
      [userId, weekStart]
    );

    // Query for this month's study time
    const [monthResult] = await connection.execute(
      `SELECT COALESCE(SUM(duration), 0) as total_seconds
       FROM sessions
       WHERE user_id = ?
       AND start_time >= ?
       AND end_time IS NOT NULL`,
      [userId, monthStart]
    );

    // Query for all time study time
    const [allTimeResult] = await connection.execute(
      `SELECT COALESCE(SUM(duration), 0) as total_seconds
       FROM sessions
       WHERE user_id = ?
       AND end_time IS NOT NULL`,
      [userId]
    );

    await connection.end();

    res.json({
      thisWeek: formatTime(weekResult[0].total_seconds),
      thisMonth: formatTime(monthResult[0].total_seconds),
      allTime: formatTime(allTimeResult[0].total_seconds)
    });

  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch study statistics' });
  }
});

module.exports = router;
