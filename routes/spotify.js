/* eslint-disable consistent-return */
const express = require('express');
const router = express.Router();
const request = require('request');
const querystring = require('querystring');
const mysql = require('mysql2/promise');
const axios = require('axios');
require('dotenv').config();

const client_id = process.env.SPOTIFY_CLIENT_ID;
const client_secret = process.env.SPOTIFY_CLIENT_SECRET;

// Database configuration
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    database: process.env.DB_NAME || 'study1only_db'
};

// Make sure this port matches your Express port (e.g., 38861)
const redirect_uri = 'http://127.0.0.1:8080/spotify/callback';

// Define scopes for different features
const BASE_SCOPE = 'user-read-private user-read-email user-read-recently-played';
const PLAYLIST_SCOPE = 'playlist-read-private playlist-read-collaborative playlist-modify-private playlist-modify-public';
const LIBRARY_SCOPE = 'user-library-read user-library-modify user-follow-read user-follow-modify user-top-read user-read-currently-playing';
const PLAYBACK_SCOPE = 'streaming user-read-playback-state user-modify-playback-state';

function generateRandomString(length) {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

router.get('/authorise', (req, res) => {
    const state = generateRandomString(16);
    // Request all scopes - Spotify will automatically limit based on user's account type
    res.redirect('https://accounts.spotify.com/authorize?'
        + querystring.stringify({
            client_id: client_id,
            response_type: 'code',
            redirect_uri: redirect_uri,
            scope: `${BASE_SCOPE} ${PLAYLIST_SCOPE} ${LIBRARY_SCOPE} ${PLAYBACK_SCOPE}`,
            state: state,
            show_dialog: true // Force showing the auth dialog to ensure proper scope acceptance
        }));
});

router.get('/callback', async (req, res) => {
    const code = req.query.code || null;
    const state = req.query.state || null;

    if (state === null) {
        return res.redirect('/home.html?error=state_mismatch');
    }

    const authOptions = {
        url: 'https://accounts.spotify.com/api/token',
        form: {
            code: code,
            redirect_uri: redirect_uri,
            grant_type: 'authorization_code'
        },
        headers: {
            Authorization: 'Basic ' + Buffer.from(client_id + ':' + client_secret).toString('base64'),
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        json: true
    };

    try {
        const tokenResponse = await new Promise((resolve, reject) => {
            request.post(authOptions, (error, response, body) => {
                if (error) reject(error);
                else resolve({ response, body });
            });
        });

        if (tokenResponse.response.statusCode !== 200) {
            return res.redirect('/home.html?error=invalid_token');
        }

        const { access_token, refresh_token } = tokenResponse.body;

        // Get user info to check subscription status
        const userInfoResponse = await new Promise((resolve, reject) => {
            request.get({
                url: 'https://api.spotify.com/v1/me',
                headers: {
                    Authorization: 'Bearer ' + access_token,
                    'Content-Type': 'application/json'
                },
                json: true
            }, (err, resp, body) => {
                if (err) reject(err);
                else resolve({ resp, body });
            });
        });

        if (userInfoResponse.resp.statusCode !== 200) {
            // If we can't get user info, it's likely the account is not added to the dev dashboard
            return res.redirect('/home.html?error=account_not_added');
        }

        const userInfo = userInfoResponse.body;
        const isPremium = userInfo.product === 'premium';

        // Get user from database based on Spotify ID
        const connection = await mysql.createConnection(dbConfig);
        try {
            // First try to find user by Spotify ID
            const [usersBySpotify] = await connection.execute(
                'SELECT * FROM users WHERE spotify_id = ?',
                [userInfo.id]
            );

            let userId;
            if (usersBySpotify.length > 0
                && (!req.session.user || usersBySpotify[0].user_id !== req.session.user.id)) {
                // Spotify account is already linked to another user
                await connection.end();
                return res.redirect('/home.html?error=spotify_already_linked');
            }
            if (usersBySpotify.length > 0) {
                userId = usersBySpotify[0].user_id;
            } else if (req.session && req.session.user) {
                userId = req.session.user.id;
                // Update user's Spotify ID
                await connection.execute(
                    'UPDATE users SET spotify_id = ? WHERE user_id = ?',
                    [userInfo.id, userId]
                );
            } else {
                await connection.end();
                return res.redirect('/login.html?error=session_expired');
            }

            // Store Spotify auth data in spotify_auth table
            const [spotifyAuth] = await connection.execute(
                'SELECT * FROM spotify_auth WHERE user_id = ?',
                [userId]
            );

            if (spotifyAuth.length > 0) {
                // Update existing Spotify auth
                await connection.execute(
                    'UPDATE spotify_auth SET access_token = ?, refresh_token = ?, is_premium = ?, spotify_user_id = ?, token_expiry = DATE_ADD(NOW(), INTERVAL ? SECOND) WHERE user_id = ?',
                    [access_token, refresh_token, isPremium,
                        userInfo.id, tokenResponse.body.expires_in, userId]
                );
            } else {
                // Insert new Spotify auth
                await connection.execute(
                    'INSERT INTO spotify_auth (user_id, spotify_user_id, access_token, refresh_token, is_premium, token_expiry) VALUES (?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? SECOND))',
                    [userId, userInfo.id, access_token,
                        refresh_token, isPremium, tokenResponse.body.expires_in]
                );
            }

            // Update session with Spotify connection status if session exists
            if (req.session) {
                req.session.user = req.session.user || {};
                req.session.user.spotifyConnected = true;
                req.session.user.spotifyIsPremium = isPremium;
                req.session.user.spotifyId = userInfo.id;
                req.session.lastActivity = Date.now();
                // Save session before redirect
                req.session.save((err) => {
                    if (err) { /* empty */ }
                    res.redirect('/home.html?' + querystring.stringify({
                        access_token: access_token,
                        refresh_token: refresh_token,
                        isPremium: isPremium
                    }));
                });
            } else {
                res.redirect('/home.html?error=session_expired');
            }
        } catch (error) {
            await connection.end();
            res.redirect('/home.html?error=spotify_connection_failed');
        }
    } catch (error) {
        res.redirect('/home.html?error=server_error');
    }
});

router.get('/refresh_token', ({ query: { refresh_token } }, res) => {
    const authOptions = {
        url: 'https://accounts.spotify.com/api/token',
        headers: {
            Authorization: 'Basic ' + Buffer.from(client_id + ':' + client_secret).toString('base64'),
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        form: {
            grant_type: 'refresh_token',
            refresh_token: refresh_token
        },
        json: true
    };

    request.post(authOptions, (error, response, body) => {
        if (!error && response.statusCode === 200) {
            res.send({
                access_token: body.access_token
            });
        } else {
            res.status(400).send('Error refreshing token');
        }
    });
});

// Helper: Get valid Spotify access token for a user
// eslint-disable-next-line no-unused-vars
async function getValidSpotifyAccessToken(userId, connection) {
    // Get user and their Spotify tokens
    const [[user]] = await connection.execute('SELECT spotify_id FROM users WHERE user_id = ?', [userId]);
    if (!user || !user.spotify_id) {
        throw new Error('User not connected to Spotify');
    }
    const [rows] = await connection.execute(
        'SELECT access_token, refresh_token, token_expiry FROM spotify_auth WHERE user_id = ?',
        [userId]
    );
    if (!rows.length) throw new Error('No Spotify tokens found');
    let { access_token, refresh_token, token_expiry } = rows[0];
    // Refresh token if expired
    if (new Date(token_expiry) < new Date()) {
        const response = await axios.post(
'https://accounts.spotify.com/api/token',
            querystring.stringify({
                grant_type: 'refresh_token',
                refresh_token: refresh_token
            }),
{
                headers: {
                    Authorization: 'Basic ' + Buffer.from(process.env.SPOTIFY_CLIENT_ID + ':' + process.env.SPOTIFY_CLIENT_SECRET).toString('base64'),
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }
        );
        access_token = response.data.access_token;
        const newExpiry = new Date(Date.now() + response.data.expires_in * 1000);
        await connection.execute(
            'UPDATE spotify_auth SET access_token = ?, token_expiry = ? WHERE user_id = ?',
            [access_token, newExpiry, userId]
        );
    }
    return access_token;
}

// Unlink Spotify account from user
router.post('/unlink', async (req, res) => {
    if (!req.session || !req.session.user) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    const userId = req.session.user.id;
    const connection = await mysql.createConnection(dbConfig);
    try {
        // Remove spotify_id from users table
        await connection.execute('UPDATE users SET spotify_id = NULL WHERE user_id = ?', [userId]);
        // Remove from spotify_auth table
        await connection.execute('DELETE FROM spotify_auth WHERE user_id = ?', [userId]);
        await connection.end();
        // Also update session
        req.session.user.spotifyConnected = false;
        req.session.user.spotifyIsPremium = false;
        return res.json({ message: 'Spotify account unlinked successfully' });
    } catch (error) {
        await connection.end();
        return res.status(500).json({ error: 'Failed to unlink Spotify account' });
    }
});

// Get current user's Spotify tokens if connected
router.get('/my-tokens', async (req, res) => {
    if (!req.session || !req.session.user) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    const userId = req.session.user.id;
    const connection = await mysql.createConnection(dbConfig);
    // Check if user is connected to Spotify
    const [[user]] = await connection.execute('SELECT spotify_id FROM users WHERE user_id = ?', [userId]);
    if (!user || !user.spotify_id) {
        await connection.end();
        return res.status(404).json({ error: 'Not connected to Spotify' });
    }
    const [rows] = await connection.execute(
        'SELECT access_token, refresh_token, token_expiry FROM spotify_auth WHERE user_id = ?',
        [userId]
    );
    await connection.end();
    if (!rows.length) return res.status(404).json({ error: 'No Spotify tokens found' });
    res.json(rows[0]);
});

module.exports = router;
