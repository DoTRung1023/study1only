const axios = require('axios');
const querystring = require('querystring');

const { SPOTIFY_CLIENT_ID } = process.env.SPOTIFY_CLIENT_ID;
const { SPOTIFY_CLIENT_SECRET } = process.env.SPOTIFY_CLIENT_SECRET;
const REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI;

// Get Spotify tokens using authorization code
async function getSpotifyTokens(code) {
    try {
        const response = await axios.post(
            'https://accounts.spotify.com/api/token',
            querystring.stringify({
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: REDIRECT_URI
            }),
            {
                headers: {
                    Authorization: 'Basic ' + Buffer.from(SPOTIFY_CLIENT_ID + ':' + SPOTIFY_CLIENT_SECRET).toString('base64'),
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }
        );
        return response.data;
    } catch (error) {
        const errorMessage = error.response && error.response.data
        && error.response.data.error_description
            ? error.response.data.error_description
            : error.message;
        throw new Error('Failed to get Spotify tokens: ' + errorMessage);
    }
}

// Refresh Spotify access token
async function refreshSpotifyToken(refreshToken) {
    try {
        const response = await axios.post(
            'https://accounts.spotify.com/api/token',
            querystring.stringify({
                grant_type: 'refresh_token',
                refresh_token: refreshToken
            }),
            {
                headers: {
                    Authorization: 'Basic ' + Buffer.from(SPOTIFY_CLIENT_ID + ':' + SPOTIFY_CLIENT_SECRET).toString('base64'),
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }
        );
        return response.data;
    } catch (error) {
        const errorMessage = error.response && error.response.data
        && error.response.data.error_description
            ? error.response.data.error_description
            : error.message;
        throw new Error('Failed to refresh Spotify token: ' + errorMessage);
    }
}

// Make Spotify API request with token refresh
async function makeSpotifyRequest(accessToken, refreshToken, method, endpoint, data = null) {
    try {
        const config = {
            method,
            url: `https://api.spotify.com/v1${endpoint}`,
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        };

        if (data) {
            config.data = data;
        }

        const response = await axios(config);
        return response.data;
    } catch (error) {
        if (error.response && error.response.status === 401) {
            // Token expired, try refreshing
            const newTokens = await refreshSpotifyToken(refreshToken);
            const newConfig = {
                method,
                url: `https://api.spotify.com/v1${endpoint}`,
                headers: {
                    Authorization: `Bearer ${newTokens.access_token}`,
                    'Content-Type': 'application/json'
                }
            };

            if (data) {
                newConfig.data = data;
            }

            const retryResponse = await axios(newConfig);
            return {
                data: retryResponse.data,
                newTokens
            };
        }
        const errorMessage = error.response && error.response.data
        && error.response.data.error && error.response.data.error.message
            ? error.response.data.error.message
            : error.message;
        throw new Error('Spotify API request failed: ' + errorMessage);
    }
}

// Get user profile
async function getUserProfile(accessToken, refreshToken) {
    return makeSpotifyRequest(accessToken, refreshToken, 'GET', '/me');
}

// Search tracks
async function searchTracks(accessToken, refreshToken, query, limit = 50) {
    return makeSpotifyRequest(accessToken, refreshToken, 'GET', `/search?q=${encodeURIComponent(query)}&type=track&limit=${limit}`);
}

// Get user's playlists
async function getUserPlaylists(accessToken, refreshToken, limit = 50) {
    return makeSpotifyRequest(accessToken, refreshToken, 'GET', `/me/playlists?limit=${limit}`);
}

// Get playlist tracks
async function getPlaylistTracks(accessToken, refreshToken, playlistId, limit = 50) {
    return makeSpotifyRequest(accessToken, refreshToken, 'GET', `/playlists/${playlistId}/tracks?limit=${limit}`);
}

// Get user's liked songs
async function getLikedSongs(accessToken, refreshToken, limit = 50) {
    return makeSpotifyRequest(accessToken, refreshToken, 'GET', `/me/tracks?limit=${limit}`);
}

// Play a track
async function playTrack(accessToken, refreshToken, uri, deviceId) {
    return makeSpotifyRequest(accessToken, refreshToken, 'PUT', `/me/player/play?device_id=${deviceId}`, {
        uris: [uri]
    });
}

// Play a playlist
async function playPlaylist(accessToken, refreshToken, playlistId, deviceId) {
    return makeSpotifyRequest(accessToken, refreshToken, 'PUT', `/me/player/play?device_id=${deviceId}`, {
        context_uri: `spotify:playlist:${playlistId}`
    });
}

// Control playback
async function controlPlayback(accessToken, refreshToken, action, deviceId = null) {
    const endpoint = deviceId ? `/me/player/${action}?device_id=${deviceId}` : `/me/player/${action}`;
    return makeSpotifyRequest(accessToken, refreshToken, 'PUT', endpoint);
}

// Get current playback state
async function getPlaybackState(accessToken, refreshToken) {
    return makeSpotifyRequest(accessToken, refreshToken, 'GET', '/me/player');
}

module.exports = {
    getSpotifyTokens,
    refreshSpotifyToken,
    getUserProfile,
    searchTracks,
    getUserPlaylists,
    getPlaylistTracks,
    getLikedSongs,
    playTrack,
    playPlaylist,
    controlPlayback,
    getPlaybackState
};
