// Token management utilities

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


class SpotifyTokenManager {
    constructor() {
        this.tokenCheckInterval = null;
        this.refreshBuffer = 5 * 60 * 1000; // 5 minutes in milliseconds
    }

    // Start periodic token check
    startTokenRefreshCheck() {
        // Check token every minute
        this.tokenCheckInterval = setInterval(() => this.checkAndRefreshToken(), 60000);
    }

    // Check if user has spotify_id before redirecting
    static async shouldRedirectToAuth() {
        try {
            const response = await fetch('/users/me');
            if (response.ok) {
                const user = await response.json();
                return !!user.spotify_id && this.tokenCheckInterval !== null;
            }
            return false;
        } catch (error) {
            return false;
        }
    }

    // Check if token needs refresh and refresh if needed
    async checkAndRefreshToken() {
        try {
            const expiryTime = localStorage.getItem('spotify_token_expiry');
            if (!expiryTime) return;

            const timeUntilExpiry = new Date(expiryTime).getTime() - Date.now();
            if (timeUntilExpiry <= this.refreshBuffer) {
                await this.refreshToken();
            }
        } catch (error) {
            showToast('Error checking token status. Please try logging in again.', true);
            this.clearTokens();
            if (await this.shouldRedirectToAuth()) {
                window.location.href = '/spotify-login';
            }
        }
    }

    // Refresh the access token
    async refreshToken() {
        try {
            const refreshToken = localStorage.getItem('spotify_refresh_token');
            if (!refreshToken) {
                showToast('No refresh token found. Please log in again.', true);
                this.clearTokens();
                if (await this.shouldRedirectToAuth()) {
                    window.location.href = '/spotify-login';
                }
                return;
            }

            const response = await fetch('/spotify/refresh_token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ refresh_token: refreshToken })
            });

            if (!response.ok) {
                throw new Error('Failed to refresh token');
            }

            const data = await response.json();
            localStorage.setItem('spotify_access_token', data.access_token);
            if (data.refresh_token) {
                localStorage.setItem('spotify_refresh_token', data.refresh_token);
            }
            localStorage.setItem('spotify_token_expiry', new Date(Date.now() + data.expires_in * 1000).toISOString());
        } catch (error) {
            showToast('Failed to refresh token. Please log in again.', true);
            this.clearTokens();
            if (await this.shouldRedirectToAuth()) {
                window.location.href = '/spotify-login';
            }
        }
    }

    // Clear all Spotify-related tokens from localStorage
    static clearTokens() {
        localStorage.removeItem('spotify_access_token');
        localStorage.removeItem('spotify_refresh_token');
        localStorage.removeItem('spotify_token_expiry');
        localStorage.removeItem('isPremium');
    }

    // Get current access token, refreshing if needed
    async getAccessToken() {
        try {
            const token = localStorage.getItem('spotify_access_token');
            if (!token) {
                showToast('No access token found. Please log in again.', true);
                this.clearTokens();
                if (await this.shouldRedirectToAuth()) {
                    window.location.href = '/spotify-login';
                }
                return null;
            }

            const expiryTime = localStorage.getItem('spotify_token_expiry');
            if (!expiryTime) {
                showToast('Token expiry not found. Please log in again.', true);
                this.clearTokens();
                if (await this.shouldRedirectToAuth()) {
                    window.location.href = '/spotify-login';
                }
                return null;
            }

            if (new Date(expiryTime).getTime() - Date.now() <= this.refreshBuffer) {
                await this.refreshToken();
                return localStorage.getItem('spotify_access_token');
            }

            return token;
        } catch (error) {
            showToast('Error getting access token. Please log in again.', true);
            this.clearTokens();
            if (await this.shouldRedirectToAuth()) {
                window.location.href = '/spotify-login';
            }
            return null;
        }
    }
}

// Create and export a singleton instance
const tokenManager = new SpotifyTokenManager();
export default tokenManager;
