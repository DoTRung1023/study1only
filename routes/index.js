/* eslint-disable consistent-return */
const express = require('express');
const router = express.Router();

// Authentication middleware
const requireAuth = (req, res, next) => {
    // Strict check for session and user
    if (!req.session) {
        return res.redirect('/login.html');
    }

    if (!req.session.user) {
        return res.redirect('/login.html');
    }

    if (!req.session.user.id || !req.session.user.username) {
        return res.redirect('/login.html');
    }

    next();
};

// Protected route - home page
router.get('/home.html', requireAuth, (req, res) => {
    res.sendFile('home.html', { root: './public' });
});

// Public routes
router.get('/login.html', (req, res) => {
    // If user is already logged in, redirect to home
    if (req.session && req.session.user) {
        return res.redirect('/home.html');
    }
    res.sendFile('login.html', { root: './public' });
});

router.get('/signup.html', (req, res) => {
    // If user is already logged in, redirect to home
    if (req.session && req.session.user) {
        return res.redirect('/home.html');
    }
    res.sendFile('signup.html', { root: './public' });
});

router.get('/', (req, res) => {
    res.redirect('/login.html');
});

/* GET Pexels API key */
router.get('/api/pexels-key', function(req, res) {
  if (!process.env.PEXELS_API_KEY) {
    return res.status(500).json({ error: 'Pexels API key not configured' });
  }
  res.json({ key: process.env.PEXELS_API_KEY });
});

module.exports = router;
