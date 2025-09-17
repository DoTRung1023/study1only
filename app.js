/* eslint-disable consistent-return */
/* eslint-disable no-unused-vars */
require('dotenv').config();
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
const { body, validationResult } = require('express-validator');
const session = require('express-session');
const mysql = require('mysql2/promise');
const helmet = require('helmet');
const xss = require('xss');

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var spotifyRouter = require('./routes/spotify');
var timerRouter = require('./routes/timer');
var albumsRouter = require('./routes/albums');

const app = express();

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  database: process.env.DB_NAME || 'study1only_db'
};

// Authentication middleware
const requireAuth = (req, res, next) => {
    if (!req.session || !req.session.user) {
        return res.status(401).json({ message: 'Authentication required' });
    }
    next();
};

// Session configuration - MUST be before routes
app.use(session({
    secret: process.env.SESSION_SECRET || 'temporary-insecure-secret-key',
    resave: true,
    saveUninitialized: true,
    cookie: {
        secure: false, // Set to false for development
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
        sameSite: 'lax' // Add sameSite attribute
    }
}));

// Middleware to parse JSON and cookies - MUST be before routes
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());



// Session activity tracking middleware
app.use((req, res, next) => {
    if (req.session && req.session.lastActivity) {
        const inactiveTime = Date.now() - req.session.lastActivity;
        if (inactiveTime > 24 * 60 * 60 * 1000) { // 24 hours
            req.session.destroy();
            return res.status(401).json({ message: 'Session expired' });
        }
    }
    if (req.session) {
        req.session.lastActivity = Date.now();
    }
    next();
});

// Rate limiting middleware
const rateLimit = require('express-rate-limit');

// Create rate limiter
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5000, // Increased from 100 to 500 requests per windowMs
    message: 'Too many requests from this IP, please try again later.'
});

// Apply rate limiting to all routes
app.use(limiter);

// Input validation middleware
const validateInput = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Enhanced XSS Protection middleware (replaces old sanitization)
app.use((req, res, next) => {
  if (req.body) {
    Object.keys(req.body).forEach((key) => {
      if (typeof req.body[key] === 'string') {
        // Sanitize using the xss library with strict settings
        req.body[key] = xss(req.body[key], {
          whiteList: {}, // No HTML tags allowed
          stripIgnoreTag: true,
          stripIgnoreTagBody: ['script']
        });
      }
    });
  }

  // Also sanitize query parameters
  if (req.query) {
    Object.keys(req.query).forEach((key) => {
      if (typeof req.query[key] === 'string') {
        req.query[key] = xss(req.query[key], {
          whiteList: {},
          stripIgnoreTag: true,
          stripIgnoreTagBody: ['script']
        });
      }
    });
  }

  next();
});

// Security headers middleware
app.use((req, res, next) => {
  // Set security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  // Enhanced Content Security Policy for better XSS protection
  res.setHeader(
'Content-Security-Policy',
    "default-src 'self' http://127.0.0.1:*; "
    + "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://code.jquery.com https://cdnjs.cloudflare.com https://sdk.scdn.co http://127.0.0.1:*; "
    + "frame-src 'self' https://sdk.scdn.co http://127.0.0.1:*; "
    + "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com http://127.0.0.1:*; "
    + "font-src 'self' https://fonts.gstatic.com; "
    + "img-src 'self' data: https: http://127.0.0.1:* blob:; "
    + "connect-src 'self' https://api.spotify.com https://accounts.spotify.com https://restcountries.com https://api.pexels.com http://127.0.0.1:*; "
    + "object-src 'none'; "
    + "base-uri 'self'; "
    + "form-action 'self'; "
    + "frame-ancestors 'none';"
  );
  next();
});

// Block direct access to home.html before static middleware, but allow if authenticated
app.use((req, res, next) => {
  if (req.path === '/home.html') {
    if (!req.session || !req.session.user) {
      return res.redirect('/login.html?error=auth_required');
    }
  }
  if (req.path === '/update.html') {
    if (!req.session || !req.session.user) {
      return res.redirect('/login.html?error=auth_required');
    }
  }
  next();
});

// Middleware to ensure 127.0.0.1 is used consistently
app.use((req, res, next) => {
    // Replace any localhost references with 127.0.0.1
    if (req.headers.host && req.headers.host.includes('localhost')) {
        return res.redirect(`http://127.0.0.1:${process.env.PORT || 8080}${req.url}`);
  }
  next();
});

// Routes
app.use('/', indexRouter);
app.use('/spotify', spotifyRouter);
app.use('/users', usersRouter);
app.use('/timer', timerRouter);
app.use('/api/albums', albumsRouter);

// -------------------------
// Achievement endpoint - integrated directly into app.js
// -------------------------
app.get('/api/achievements/check', requireAuth, async (req, res) => {
    const userId = req.session.user.id;

    try {
        const connection = await mysql.createConnection(dbConfig);

        // Get user's current stats
        const [userStats] = await connection.execute(
            'SELECT total_study_time, current_streak, longest_streak FROM users WHERE user_id = ?',
            [userId]
        );

        if (userStats.length === 0) {
            await connection.end();
            return res.status(404).json({ message: 'User not found' });
        }

        const user = userStats[0];

        // Check for 90 minutes in a single day (Timeless Seeker)
        const [dailySessions] = await connection.execute(
            `SELECT
                DATE(start_time) as study_date,
                SUM(duration) as daily_total
             FROM sessions
             WHERE user_id = ? AND end_time IS NOT NULL
             GROUP BY DATE(start_time)
             ORDER BY daily_total DESC
             LIMIT 1`,
            [userId]
        );

        // Use consistent rounding for daily minutes -
        //  Math.floor to avoid over-crediting partial minutes
        const maxDailyMinutes = dailySessions[0]
        && dailySessions[0].daily_total ? Math.floor(dailySessions[0].daily_total / 60) : 0;

        // Convert total_study_time to minutes using the same logic
        const timeParts = user.total_study_time.split(':');
        const totalSeconds = parseInt(timeParts[0], 10) * 3600 + parseInt(timeParts[1], 10) * 60
         + parseInt(timeParts[2], 10);
        const totalMinutes = Math.floor(totalSeconds / 60); // Use Math.floor for consistency

        // Define achievements with their conditions
        const achievements = [
            {
                id: 'timeless-seeker',
                title: 'TIMELESS SEEKER',
                description: 'Study for a total of 90 minutes in a single day with Study1Only!',
                lockedDescription: 'Study for a total of 90 minutes in a single day to unlock this achievement.',
                progress: Math.min(maxDailyMinutes, 90),
                total: 90,
                icon: 'images/timeless-seeker.png',
                achieved: maxDailyMinutes >= 90,
                condition: 'daily_total'
            },
            {
                id: 'rising-flame',
                title: 'RISING FLAME',
                description: 'Use Study1Only continuously for 3 days!',
                lockedDescription: 'Study for 3 consecutive days to unlock this achievement.',
                progress: Math.min(user.longest_streak, 3),
                total: 3,
                icon: 'images/rising-flame.png',
                achieved: user.longest_streak >= 3,
                condition: 'streak'
            },
            {
                id: 'endurance-scholar',
                title: 'ENDURANCE SCHOLAR',
                description: 'Accumulate a total of 300 minutes of study time!',
                lockedDescription: 'Study for a total of 300 minutes to unlock this achievement.',
                progress: Math.min(totalMinutes, 300),
                total: 300,
                icon: 'images/endurance-scholar.png',
                achieved: totalMinutes >= 300,
                condition: 'total_time'
            }
        ];

        await connection.end();

        // Calculate total achieved
        const totalAchieved = achievements.filter((a) => a.achieved).length;
        const totalPossible = achievements.length;

        res.json({
            achievements,
            summary: {
                achieved: totalAchieved,
                total: totalPossible
            }
        });

    } catch (error) {
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Serve static files from the public directory (move this after routes)
app.use(express.static(path.join(__dirname, 'public'), { index: false }));

// Ensure uploads directory exists
const fs = require('fs');
const uploadDir = path.join(__dirname, 'public', 'uploads', 'avatars');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}



// Admin role middleware
const requireAdmin = (req, res, next) => {
    if (!req.session || !req.session.user) {
        return res.redirect('/login.html');
    }
    if (req.session.user.role !== 'admin') {
        return res.redirect('/login.html?error=access_denied');
    }
    next();
};

// Apply authentication middleware to protected routes
app.use('/home.html', requireAuth);
app.use('/admin.html', requireAdmin);

// Export the app
module.exports = app;
