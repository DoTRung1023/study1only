import tokenManager from './spotify-token-manager.js';

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.style.display = "block";
  toast.classList.add("show");

  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => {
      toast.style.display = "none";
    }, 500);
  }, 3000);
}


class SpotifyApiClient {
    constructor() {
        this.baseUrl = 'https://api.spotify.com/v1';
        this.cache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
        this.rateLimitDelay = 100; // 100ms between requests
        this.lastRequestTime = 0;
    }

    // Clear expired cache entries
    clearExpiredCache() {
        const now = Date.now();
        for (const [key, value] of this.cache.entries()) {
            if (now - value.timestamp > this.cacheTimeout) {
                this.cache.delete(key);
            }
        }
    }

    // Get cached response if available
    getCachedResponse(endpoint) {
        this.clearExpiredCache();
        const cached = this.cache.get(endpoint);
        if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
            return cached.data;
        }
        return null;
    }

    // Set cache entry
    setCachedResponse(endpoint, data) {
        this.cache.set(endpoint, {
            data,
            timestamp: Date.now()
        });
    }

    // Rate limiting
    async waitForRateLimit() {
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;
        if (timeSinceLastRequest < this.rateLimitDelay) {
            await new Promise((resolve) => {
            setTimeout(() => {
                resolve();
            }, this.rateLimitDelay - timeSinceLastRequest);
        });
        }
        this.lastRequestTime = Date.now();
    }


    // Make API request with caching and rate limiting
    async request(endpoint, method = 'GET', body = null) {
        try {
            // Check cache for GET requests
            if (method === 'GET') {
                const cached = this.getCachedResponse(endpoint);
                if (cached) return cached;
            }

            // Wait for rate limit
            await this.waitForRateLimit();

            // Get fresh token
            const token = await tokenManager.getAccessToken();
            if (!token) {
                showToast('Unable to get access token. Please try logging in again.', true);
                return null;
            }

            const options = {
                method,
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            };

            if (body && (method === 'PUT' || method === 'POST')) {
                options.body = JSON.stringify(body);
            }

            const response = await fetch(`${this.baseUrl}${endpoint}`, options);

            // Handle 401 Unauthorized
            if (response.status === 401) {
                // Token might be expired, try refreshing
                const newToken = await tokenManager.refreshToken();
                if (!newToken) {
                    showToast('Session expired. Please log in again.', true);
                    return null;
                }
                options.headers.Authorization = `Bearer ${newToken}`;
                const retryResponse = await fetch(`${this.baseUrl}${endpoint}`, options);

                if (!retryResponse.ok) {
                    showToast(`Request failed: ${retryResponse.statusText}`, true);
                    return null;
                }

                const data = await retryResponse.json();
                if (method === 'GET') {
                    this.setCachedResponse(endpoint, data);
                }
                return data;
            }

            // Handle other errors
            if (!response.ok) {
                showToast(`Request failed: ${response.statusText}`, true);
                return null;
            }

            // Return empty object for 204 No Content
            if (response.status === 204) {
                return {};
            }

            // Parse and cache response
            const data = await response.json();
            if (method === 'GET') {
                this.setCachedResponse(endpoint, data);
            }
            return data;
        } catch (error) {
            showToast('An error occurred while making the request. Please try again.', true);
            return null;
        }
    }

    // Search tracks
    async searchTracks(query, limit = 50) {
        return this.request(`/search?q=${encodeURIComponent(query)}&type=track&limit=${limit}`);
    }

    // Get user's playlists
    async getUserPlaylists(limit = 50) {
        return this.request(`/me/playlists?limit=${limit}`);
    }

    // Get playlist tracks
    async getPlaylistTracks(playlistId, limit = 50) {
        return this.request(`/playlists/${playlistId}/tracks?limit=${limit}`);
    }

    // Get user's liked songs
    async getLikedSongs(limit = 50) {
        return this.request(`/me/tracks?limit=${limit}`);
    }

    // Play a track
    async playTrack(uri, deviceId) {
        return this.request(`/me/player/play?device_id=${deviceId}`, 'PUT', { uris: [uri] });
    }

    // Play a playlist
    async playPlaylist(playlistId, deviceId) {
        return this.request(`/me/player/play?device_id=${deviceId}`, 'PUT', {
            context_uri: `spotify:playlist:${playlistId}`
        });
    }

    // Control playback
    async controlPlayback(action, deviceId = null) {
        const endpoint = deviceId ? `/me/player/${action}?device_id=${deviceId}` : `/me/player/${action}`;
        return this.request(endpoint, 'PUT');
    }

    // Get current playback state
    async getPlaybackState() {
        return this.request('/me/player');
    }
}

// Create and export a singleton instance
const apiClient = new SpotifyApiClient();
export default apiClient;
