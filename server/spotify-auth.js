/* eslint-disable consistent-return */
/* eslint-disable no-unused-vars */
const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');
const { getSpotifyTokens, refreshSpotifyToken } = require('./spotify-service');
const { getDbConfig } = require('./db-config');

// Initialize database connection pool
const pool = mysql.createPool(getDbConfig());

// Helper function to get user's Spotify tokens
async function getUserSpotifyTokens(userId) {
    try {
        const [rows] = await pool.execute(
            'SELECT access_token, refresh_token, token_expiry, last_refresh FROM spotify_auth WHERE user_id = ?',
            [userId]
        );
        return rows[0];
    } catch (error) {
        throw new Error('Database error while getting Spotify tokens');
    }
}

// Helper function to update user's Spotify tokens
async function updateUserSpotifyTokens(userId, accessToken, refreshToken, expiresIn) {
    try {
        const tokenExpiry = new Date(Date.now() + expiresIn * 1000);
        await pool.execute(
            'UPDATE spotify_auth SET access_token = ?, refresh_token = ?, token_expiry = ?, last_refresh = CURRENT_TIMESTAMP WHERE user_id = ?',
            [accessToken, refreshToken, tokenExpiry, userId]
        );
    } catch (error) {
        throw new Error('Database error while updating Spotify tokens');
    }
}

// Helper function to check if token needs refresh
function needsRefresh(tokenExpiry) {
    const bufferTime = 5 * 60 * 1000; // 5 minutes in milliseconds
    return Date.now() + bufferTime >= new Date(tokenExpiry).getTime();
}

// Get Spotify tokens
router.get('/get_tokens', async (req, res) => {
    try {
        const { userId } = req.session;
        if (!userId) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const tokens = await getUserSpotifyTokens(userId);
        if (!tokens) {
            return res.status(404).json({ error: 'No Spotify tokens found' });
        }

        // Check if token needs refresh
        if (needsRefresh(tokens.token_expiry)) {
            const newTokens = await refreshSpotifyToken(tokens.refresh_token);
            await updateUserSpotifyTokens(
                userId,
                newTokens.access_token,
                newTokens.refresh_token,
                newTokens.expires_in
            );
            return res.json(newTokens);
        }

        res.json({
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            expires_in: Math.floor((new Date(tokens.token_expiry) - Date.now()) / 1000)
        });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Refresh Spotify token
router.post('/refresh_token', async (req, res) => {
    try {
        const { refresh_token } = req.body;
        if (!refresh_token) {
            return res.status(400).json({ error: 'Refresh token required' });
        }

        const newTokens = await refreshSpotifyToken(refresh_token);

        // Update tokens in database if user is logged in
        if (req.session.userId) {
            await updateUserSpotifyTokens(
                req.session.userId,
                newTokens.access_token,
                newTokens.refresh_token,
                newTokens.expires_in
            );
        }

        res.json(newTokens);
    } catch (error) {
        res.status(500).json({ error: 'Failed to refresh token' });
    }
});

// Store Spotify tokens
router.post('/store_tokens', async (req, res) => {
    try {
        const {
            access_token, refresh_token, expires_in, spotify_user_id
        } = req.body;
        const { userId } = req.session;

        if (!userId || !access_token || !refresh_token || !expires_in || !spotify_user_id) {
            return res.status(400).json({ error: 'Missing required parameters' });
        }

        const tokenExpiry = new Date(Date.now() + expires_in * 1000);

        await pool.execute(
            'INSERT INTO spotify_auth (user_id, spotify_user_id, access_token, refresh_token, token_expiry) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE access_token = ?, refresh_token = ?, token_expiry = ?, last_refresh = CURRENT_TIMESTAMP',
            [userId, spotify_user_id, access_token, refresh_token,
            tokenExpiry, access_token, refresh_token, tokenExpiry]
        );

        res.json({ message: 'Tokens stored successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to store tokens' });
    }
});

// Clear Spotify tokens
router.post('/clear_tokens', async (req, res) => {
    try {
        const { userId } = req.session;
        if (!userId) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        await pool.execute('DELETE FROM spotify_auth WHERE user_id = ?', [userId]);
        res.json({ message: 'Tokens cleared successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to clear tokens' });
    }
});

module.exports = router;
