/* eslint-disable consistent-return */
/* eslint-disable brace-style */
/* eslint-disable no-unused-vars */
/* eslint-disable no-unused-expressions */
/* eslint-disable no-undef */
/* eslint-disable no-shadow */
/* eslint-disable no-inner-declarations */
/* eslint-disable no-lonely-if */
/* eslint-disable default-case */
/* eslint-disable no-use-before-define */
/* global Spotify */
/* global callSpotifyApi */
/* eslint-disable no-redeclare */

// Global variables
let isPlaying = false;
let player = null;
let isMuted = false;
let previousVolume = 50;
// Add flag to prevent volume slider events when mute is changing volume programmatically
let isMuteChangingVolume = false;
// Store all playlists globally for sorting
let allPlaylists = [];
let searchTimeout = null;
let isLikedSongsOnly = false;
let sortByPopularityAsc = false;
let currentTracks = [];
let lastSearchQuery = '';
let wasLikedSongsOnly = false;

// Add global variables for liked songs queue
let currentLikedSongsQueue = [];
let currentTrackIndexInQueue = -1;
let isPlayingFromLikedSongs = false;

// Add global variable for tracking playback position
let currentPlaybackPosition = 0;

// Add global variable to track if playback is available
let isPlaybackAvailable = false;

// Add debounce timer variable
let volumeChangeTimeout = null;
let lastVolumeSyncTime = 0;
const MIN_VOLUME_SYNC_INTERVAL = 100; // Minimum time between API calls in ms

// Add debounce variable for next track
let nextTrackTimeout = null;
const NEXT_TRACK_DEBOUNCE = 1000; // Increase to 1 second

// Add global variable for repeat-1 lock
let isRepeatOneProcessing = false;

// Add global variables at the top with other variables
let prevTrackTimeout = null;
const PREV_TRACK_DEBOUNCE = 1000; // Increase to 1 second

// Add global variables at the top with other variables
let playlistHistory = [];
let currentPlaylistIndex = -1;

// --- Improved Playback State Persistence ---
const PLAYBACK_STATE_KEY = 'spotify_playback_state';
const PLAYBACK_STATE_EXPIRY = 15 * 60 * 1000; // 15 minutes in ms

// --- App State Persistence ---
const APP_STATE_KEY = 'app_state';
const APP_STATE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours in ms

// --- User-Specific Spotify State Persistence ---
const SPOTIFY_STATE_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 7 days in ms

// --- Enhanced Playback State Persistence ---
const PLAYER_STATE_KEY = 'player_state_v2';

// --- Visual indicator for external playback ---
let isExternalPlayback = false;
function showExternalPlaybackIndicator(deviceName) {
    let indicator = document.getElementById('external-playback-indicator');
    if (!indicator) {
        indicator = document.createElement('div');
        indicator.id = 'external-playback-indicator';
        indicator.style.position = 'absolute';
        indicator.style.top = '10px';
        indicator.style.left = '10px'; // Move to left
        indicator.style.background = 'rgba(30,215,96,0.9)';
        indicator.style.color = '#fff';
        indicator.style.padding = '8px 16px';
        indicator.style.borderRadius = '20px';
        indicator.style.fontWeight = 'bold';
        indicator.style.zIndex = '1000';
        indicator.style.display = 'flex';
        indicator.style.alignItems = 'center';
        indicator.style.gap = '8px';
        indicator.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
        indicator.style.cursor = 'pointer';
        indicator.innerHTML = `<span id="external-indicator-msg"></span><span id="external-indicator-toggle" style="margin-left:8px;font-size:16px;">✖️</span>`;
        document.body.appendChild(indicator);
        // Toggle/hide on click
        indicator.querySelector('#external-indicator-toggle').onclick = () => {
            indicator.style.display = 'none';
        };
    }
    indicator.querySelector('#external-indicator-msg').textContent = `Spotify playing on: ${deviceName || 'another device'}`;
    indicator.style.display = 'flex';
}
function hideExternalPlaybackIndicator() {
    const indicator = document.getElementById('external-playback-indicator');
    if (indicator) indicator.style.display = 'none';
}

// --- Poll for external playback and update UI ---
let externalPlaybackInterval = null;
let lastExternalTrackId = null;

function removePlayPauseOverlay() {
    const overlay = document.getElementById('external-play-overlay');
    if (overlay) overlay.remove();
}
function setPlayPauseOverlay(isPlayingOtherDevice) {
    removePlayPauseOverlay(); // Just ensure any old overlay is gone
}

function startExternalPlaybackPolling() {
    if (externalPlaybackInterval) clearInterval(externalPlaybackInterval);
    externalPlaybackInterval = setInterval(async () => {
        try {
            const playback = await callSpotifyApi('/me/player');
            const deviceId = localStorage.getItem('spotify_device_id');
            const playBtn = document.getElementById('play-button');
            if (
                playback
                && playback.device
                && playback.device.id !== deviceId
                && playback.item
            ) {
                isExternalPlayback = true;
                // Only update if the track changed
                if (!lastExternalTrackId || lastExternalTrackId !== playback.item.id) {
                    lastExternalTrackId = playback.item.id;
                    updateSongInfo({
                        image: (playback.item.album.images && playback.item.album.images[0] && playback.item.album.images[0].url) || 'images/spotify/default-song.png',
                        name: playback.item.name,
                        artists: playback.item.artists.map((a) => a.name).join(', ')
                    });
                }
                // Update play/pause button to match actual playback state
                if (playBtn) {
                    if (playback.is_playing) {
                        playBtn.src = 'images/spotify/play.png';
                        // No overlay
                        playBtn.onclick = async () => {
                            await callSpotifyApi('/me/player/pause', 'PUT');
                        };
                    } else {
                        playBtn.src = 'images/spotify/pause.png';
                        // No overlay
                        playBtn.onclick = async () => {
                            await callSpotifyApi('/me/player/play', 'PUT');
                        };
                    }
                    playBtn.style.opacity = '1';
                    playBtn.style.cursor = 'pointer';
                }
                showExternalPlaybackIndicator(playback.device.name);
            } else {
                isExternalPlayback = false;
                lastExternalTrackId = null;
                hideExternalPlaybackIndicator();
                removePlayPauseOverlay();
            }
        } catch (e) {
            // Optionally handle errors
        }
    }, 5000); // Poll every 5 seconds
}

window.addEventListener('DOMContentLoaded', () => {
    startExternalPlaybackPolling();
});

// Function to set repeat button dimensions
function setRepeatButtonDimensions(button, imageType) {
    const btn = button;
    switch (imageType) {
        case 'inactive':
            btn.style.width = '21px';
            btn.style.height = '20.5px';
            break;
        case 'active':
            btn.style.width = '21px';
            btn.style.height = '25px';
            break;
        case 'repeat-1':
            btn.style.width = '21px';
            btn.style.height = '26px';
            break;
        default:
            btn.style.width = '21px';
            btn.style.height = '20.5px';
            break;
    }
}

// Function to set shuffle button dimensions
function setShuffleButtonDimensions(button, imageType) {
    const btn = button;
    switch (imageType) {
        case 'inactive':
            btn.style.width = '19px';
            btn.style.height = '20px';
            break;
        case 'active':
            btn.style.width = '22px';
            btn.style.height = '28px';
            break;
        default:
            btn.style.width = '19px';
            btn.style.height = '20px';
            break;
    }
}

// Function to update control buttons state
function updateControlButtonsState(hasPlayback) {
    // Update global playback state
    isPlaybackAvailable = hasPlayback;

    const controlButtons = [
        'shuffle-button',
        'repeat-button',
        'volume-button',
        'share-button'
    ];

    // Update play button state separately
    updatePlayButtonState();

    // Update previous and next button states separately
    updatePrevButtonState();
    updateNextButtonState();

    controlButtons.forEach((buttonId) => {
        const button = document.getElementById(buttonId);
        if (button) {
            button.style.opacity = hasPlayback ? '1' : '0.5';
            button.style.cursor = hasPlayback ? 'pointer' : 'not-allowed';

            // Special handling for volume button
            if (buttonId === 'volume-button') {
                // Also disable the volume slider
                const volumeSlider = document.getElementById('volume-slider');
                if (volumeSlider) {
                    volumeSlider.disabled = !hasPlayback;
                }
                // Prevent volume button click when disabled
                if (!hasPlayback) {
                    button.onclick = (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                    };
                } else {
                    button.onclick = toggleMute;
                }
            }
            // Special handling for shuffle button
            else if (buttonId === 'shuffle-button') {
                if (!hasPlayback) {
                    button.onclick = (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        showToast('No playback available to shuffle.', true);
                    };
                } else {
                    button.onclick = toggleShuffle;
                }
            }
            // Special handling for repeat button
            else if (buttonId === 'repeat-button') {
                if (!hasPlayback) {
                    button.src = 'images/spotify/repeat-inactive.png';
                    setRepeatButtonDimensions(button, 'inactive');
                    button.onclick = (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        showToast('No playback available to repeat.', true);
                    };
                } else {
                    button.onclick = toggleRepeat;
                }
            }
            // Special handling for share button
            else if (buttonId === 'share-button') {
                if (!hasPlayback) {
                    button.onclick = (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        showToast('No song available to share.', true);
                    };
                } else {
                    button.onclick = async (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        try {
                            const state = await callSpotifyApi('/me/player');
                            if (state && state.item) {
                                const songUrl = state.item.external_urls.spotify;
                                await navigator.clipboard.writeText(songUrl);
                                showToast('Song link copied to clipboard!');
                            } else {
                                showToast('No song available to share.', true);
                            }
                        } catch (error) {
                            showToast('Failed to copy song link.', true);
                        }
                    };
                }
            }
        }
    });
}

// Function to save user-specific Spotify state
function saveUserSpotifyState(userId) {
    if (!userId) return;

    try {
        // Get current song info
        const songTitle = document.querySelector('.song-title') ? document.querySelector('.song-title').textContent : '';
        const artistName = document.querySelector('.artist-name') ? document.querySelector('.artist-name').textContent : '';
        const albumArt = document.querySelector('.album-art') ? document.querySelector('.album-art').src : '';

        // Get background image
        const bgImage = document.body.style.backgroundImage || '';

        // Get playback state if available
        let playbackState = null;
        if (window.player && typeof window.player.getCurrentState === 'function') {
            playbackState = window.player.getCurrentState();
        }

        const spotifyState = {
            songTitle,
            artistName,
            albumArt,
            bgImage,
            playbackState,
            timestamp: Date.now()
        };

        // Store in user-specific cookie
        const cookieName = `spotify_state_${userId}`;
        setCookie(
cookieName,
JSON.stringify(spotifyState),
        Math.floor(SPOTIFY_STATE_EXPIRY / (60 * 1000))
); // Convert to minutes
    } catch (e) {
        // Ignore save errors
    }
}

// Function to restore user-specific Spotify state
function restoreUserSpotifyState(userId) {
    if (!userId) return false;

    const cookieName = `spotify_state_${userId}`;
    const stateStr = getCookie(cookieName);
    if (!stateStr) return false;

    try {
        const state = JSON.parse(stateStr);
        if (!state.timestamp || (Date.now() - state.timestamp) > SPOTIFY_STATE_EXPIRY) {
            deleteCookie(cookieName);
            return false;
        }

        // Restore song info (only if not default values)
        if (state.songTitle && state.songTitle !== 'Welcome to Spotify') {
            const songTitleElem = document.querySelector('.song-title');
            if (songTitleElem) songTitleElem.textContent = state.songTitle;
        }

        if (state.artistName && state.artistName !== 'Select a song to start playing') {
            const artistNameElem = document.querySelector('.artist-name');
            if (artistNameElem) artistNameElem.textContent = state.artistName;
        }

        if (state.albumArt && !state.albumArt.includes('default-song.png')) {
            const albumArtElem = document.querySelector('.album-art');
            if (albumArtElem) albumArtElem.src = state.albumArt;
        }

        // Restore background image
        if (state.bgImage) {
            document.body.style.backgroundImage = state.bgImage;
        }

        // Restore playback state (if available and player is ready)
        if (state.playbackState && state.playbackState.then) {
            state.playbackState.then(async (ps) => {
                if (ps && ps.track_window && ps.track_window.current_track) {
                    const deviceId = localStorage.getItem('spotify_device_id');
                    if (deviceId) {
                        try {
                            await callSpotifyApi(`/me/player/play?device_id=${deviceId}`, 'PUT', {
                                uris: [ps.track_window.current_track.uri],
                                position_ms: ps.position || 0
                            });
                        } catch (e) {
                            // Ignore playback restore errors
                        }
                    }
                }
            });
        }

        return true;
    } catch (e) {
        deleteCookie(cookieName);
        return false;
    }
}

// Function to clear only Spotify-related state (preserves
// timer state and user-specific Spotify state)
function clearSpotifyState() {
    // Clear Spotify tokens
    clearSpotifyTokens();

    // Clear app state (but we'll preserve user-specific Spotify state cookies)
    deleteCookie(APP_STATE_KEY);

    // Clear playback state
    localStorage.removeItem(PLAYBACK_STATE_KEY);
    localStorage.removeItem(PLAYER_STATE_KEY);

    // Clear any other non-timer user-related localStorage items
    localStorage.removeItem('captchaLockout');

    // Reset song info to default but don't touch user-specific state cookies
    const albumArt = document.querySelector('.album-art');
    if (albumArt) {
        albumArt.src = 'images/spotify/default-song.png';
    }

    const songTitle = document.querySelector('.song-title');
    if (songTitle) {
        songTitle.textContent = 'Welcome to Spotify';
    }

    const artistName = document.querySelector('.artist-name');
    if (artistName) {
        artistName.textContent = 'Select a song to start playing';
    }
}

// Function to logout from Spotify
async function logoutSpotify() {
    try {
        // Save current Spotify state before logout
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        if (user.id) {
            saveUserSpotifyState(user.id);
        }

        // Use the correct endpoint URL
        const response = await fetch('/spotify/unlink', { method: 'POST' });
        if (!response.ok) {
            throw new Error('Failed to unlink Spotify account');
        }

        // Clear only Spotify-related data
        // (preserve timer state and user-specific Spotify state for same user)
        clearSpotifyState();

        // Reset global variables
        isPlaying = false;
        player = null;
        allPlaylists = [];
        currentTracks = [];
        lastSearchQuery = '';
        isLikedSongsOnly = false;
        sortByPopularityAsc = false;
        wasLikedSongsOnly = false;

        // Disconnect the player if it exists
        if (player) {
            player.disconnect();
            player = null;
        }

        // Show success message
        showToast('Successfully logged out from Spotify');

        // Redirect to home.html to refresh the page in logged out state
        window.location.href = '/home.html';
    } catch (e) {
        showToast('Failed to unlink Spotify account', true);

    }
}

// Function to handle popularity button state
window.updatePopularityButtonState = function(hasContent) {
    const popularityButton = document.querySelector('.sort-button.popularity');
    if (popularityButton) {
        if (!hasContent) {
            // Disable button and reset arrow when no content
            popularityButton.style.opacity = '0.5';
            popularityButton.style.cursor = 'not-allowed';
            popularityButton.classList.remove('active');
            const img = popularityButton.querySelector('img');
            if (img) {
                img.src = 'images/spotify/search/arrow-down.png';
                img.style.opacity = '0.5';
            }
            // Remove click handler when disabled
            popularityButton.onclick = (e) => {
                e.stopPropagation();
                return false;
            };
            // Reset sort state
            sortByPopularityAsc = false;
        } else {
            // Enable button when content exists
            popularityButton.style.opacity = '1';
            popularityButton.style.cursor = 'pointer';
            const img = popularityButton.querySelector('img');
            if (img) {
                img.style.opacity = '1';
            }
            // Restore click handler when enabled
            popularityButton.onclick = togglePopularitySort;
        }
    }
};

// Function to display current tracks
window.displayCurrentTracks = function() {
    const searchContent = document.getElementById('search-content');
    if (!currentTracks || currentTracks.length === 0) {
        searchContent.innerHTML = '<div class="no-results-spotify">No songs found</div>';
        window.updatePopularityButtonState(false);
        return;
    }

    window.updatePopularityButtonState(true);

    const tracksHTML = currentTracks.map((track) => `
        <div class="track-item" onclick="window.playSong('${track.uri}', ${isLikedSongsOnly}, this)">
            <div class="track-image-container">
                <img src="${(track.album.images && track.album.images[0] && track.album.images[0].url) || 'images/spotify/default-song.png'}"
                     alt="${track.name}"
                     class="track-image"
                     onerror="this.src='images/spotify/default-song.png'"/>
                <div class="play-now-overlay">
                    <img src="images/spotify/search/play-now.png" alt="Play Now"/>
                </div>
            </div>
            <div class="track-info">
                <div class="track-name">${track.name}</div>
                <div class="track-artist">${track.artists.map((artist) => artist.name).join(', ')}</div>
            </div>
        </div>
    `).join('');

    searchContent.innerHTML = tracksHTML;
};

// Add click outside handler to close dropdown
document.addEventListener('click', function(event) {
    const dropdown = document.getElementById('sort-dropdown');
    const button = document.getElementById('sort-playlist-button');

    if (dropdown && button) {
        // If click is outside both dropdown and button, close the dropdown
        if (!dropdown.contains(event.target) && !button.contains(event.target)) {
                if (window.setSortOption) {
        window.toggleSortDropdown();
                updateSortDropdown();
            }
        }
    }
});

// Function to handle track click with loading state
window.handleTrackClick = async function(uri, trackElement) {
    const hasSpotifyPremium = getSpotifyPremiumStatus();

    if (!hasSpotifyPremium) {
        showToast('Spotify Premium is required to play music. Please upgrade your account to enjoy playback features.', true);
        return;
    }

    // Find or create loading overlay container
    let loadingContainer = document.getElementById('loading-overlay-container');
    if (!loadingContainer) {
        loadingContainer = document.createElement('div');
        loadingContainer.id = 'loading-overlay-container';
        document.body.appendChild(loadingContainer);
    }

    // Show loading state
    const rect = trackElement.getBoundingClientRect();
    loadingContainer.style.cssText = `
        position: fixed;
        top: ${rect.top}px;
        left: ${rect.left}px;
        width: ${rect.width}px;
        height: ${rect.height}px;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
        pointer-events: none;
    `;

    try {
        await playSong(uri);
        // Update song info in the player
        const trackName = trackElement.querySelector('.track-name').textContent;
        const artistName = trackElement.querySelector('.track-artist').textContent;
        const imageUrl = trackElement.querySelector('.track-image').src;

        updateSongInfo({
            image: imageUrl,
            name: trackName,
            artists: artistName
        });
    } catch (error) {
        // Only show error if it's not a Premium required error (which is already handled)
        if (!error.message.includes('403: Premium required')) {
            showToast('Unable to play track. Please try again.', true);
        }
    } finally {
        // Hide loading state
        if (loadingContainer && loadingContainer.parentNode) {
            loadingContainer.parentNode.removeChild(loadingContainer);
        }
    }
};

// Function to get total number of liked songs
async function getTotalLikedSongs() {
    try {
        const response = await callSpotifyApi('/me/tracks?limit=1');
        return response.total || 0;
    } catch (error) {
        return 0;
    }
}

// Update the performSearch function to search all liked songs
async function performSearch(query, shouldRefetch = true) {
    try {
        // Check if user has developer access by trying to get liked songs
        try {
            await callSpotifyApi('/me/tracks?limit=1');
        } catch (error) {
            if (error.message.includes('403')) {
                // Only show error if liked songs is checked or there's a search query
                if (isLikedSongsOnly || (query && query.trim().length > 0)) {
                    document.getElementById('search-content').innerHTML = '<div class="no-results-spotify">Account Not Added to Developer Dashboard. Please contact the administrator to add this account</div>';
                } else {
                    // Show nothing if no user interaction (no search and no liked songs)
                    document.getElementById('search-content').innerHTML = '';
                }
                updatePopularityButtonState(false);
                return;
            }
        }

        // Only fetch new tracks if shouldRefetch is true and we either have no current tracks
        // or we're changing the search/filter mode
        const shouldRefetchTracks = currentTracks.length === 0
            || query !== lastSearchQuery
            || isLikedSongsOnly !== wasLikedSongsOnly;

        if (shouldRefetch && shouldRefetchTracks) {
            if (isLikedSongsOnly) {
                // Get total number of liked songs first
                const totalLikedSongs = await getTotalLikedSongs();

                if (totalLikedSongs === 0) {
                    document.getElementById('search-content').innerHTML = '<div class="no-results-spotify">Account Not Added to Developer Dashboard. Please contact the administrator to add this account</div>';
                    updatePopularityButtonState(false);
                    return;
                }

                if (query && query.trim().length > 0) {
                    // If searching, get all liked songs
                    let allLikedSongs = [];
                    // Create array of promises for parallel fetching
                    const batchCount = Math.ceil(totalLikedSongs / 50);
                    const promises = Array.from(
                        { length: batchCount },
                        (_, i) => callSpotifyApi(`/me/tracks?limit=50&offset=${i * 50}`)
                    );

                    // Fetch all data in parallel
                    const results = await Promise.all(promises);
                    // eslint-disable-next-line max-len
                    allLikedSongs = results.flatMap((data) => (data.items ? data.items.map((item) => item.track) : []));
                    currentTracks = allLikedSongs;
                } else {
                    // If not searching, use random offset for 50 songs
                    let offset = 0;
                    if (totalLikedSongs > 50) {
                        offset = Math.floor(Math.random() * (totalLikedSongs - 50));
                    }
                    const data = await callSpotifyApi(`/me/tracks?limit=50&offset=${offset}`);
                    if (!data || !data.items || data.items.length === 0) {
                        document.getElementById('search-content').innerHTML = '<div class="no-results-spotify">No liked songs. Please like some songs to see them here.</div>';
                        updatePopularityButtonState(false);
                        return;
                    }
                    currentTracks = data.items.map((item) => item.track);
                }

                // Filter tracks if searching
                if (query && query.trim().length > 0) {
                    const searchTerms = query.toLowerCase().split(' ');
                    currentTracks = currentTracks.filter((track) => {
                        const trackName = track.name.toLowerCase();
                        const artistNames = track.artists.map((artist) => artist.name.toLowerCase()).join(' ');
                        const albumName = track.album.name.toLowerCase();
                        const searchText = `${trackName} ${artistNames} ${albumName}`;

                        // Match all search terms
                        return searchTerms.every((term) => searchText.includes(term));
                    });

                    if (currentTracks.length === 0) {
                        document.getElementById('search-content').innerHTML = '<div class="no-results-spotify">No matching songs found in your liked songs</div>';
                        updatePopularityButtonState(false);
                        return;
                    }
                }

                // Sort by popularity (descending) first, then alphabetically for same popularity
                currentTracks.sort((a, b) => {
                    const popularityDiff = b.popularity - a.popularity; // Default to descending
                    if (popularityDiff === 0) {
                        return a.name.localeCompare(b.name); // Alphabetical for same popularity
                    }
                    return popularityDiff;
                });
            } else if (query && query.trim().length > 0) {
                const response = await callSpotifyApi(`/search?q=${encodeURIComponent(query)}&type=track&limit=50`);
                if (!response || !response.tracks || !response.tracks.items) {
                    document.getElementById('search-content').innerHTML = '<div class="no-results-spotify">Account Not Added to Developer Dashboard. Please contact the administrator to add this account</div>';
                    updatePopularityButtonState(false);
                    return;
                }
                currentTracks = response.tracks.items;
            } else {
                // Show nothing if no user interaction (no search and no liked songs)
                document.getElementById('search-content').innerHTML = '';
                currentTracks = [];
                return;
            }
            // Store the current search state
            lastSearchQuery = query;
            wasLikedSongsOnly = isLikedSongsOnly;
        }

        displayCurrentTracks();
    } catch (error) {
        // Only show error if liked songs is checked or there's a search query
        if (isLikedSongsOnly || (query && query.trim().length > 0)) {
            document.getElementById('search-content').innerHTML = '<div class="no-results-spotify">Account Not Added to Developer Dashboard. Please contact the administrator to add this account</div>';
        } else {
            // Show nothing if no user interaction (no search and no liked songs)
            document.getElementById('search-content').innerHTML = '';
        }
        updatePopularityButtonState(false);
    }
}

// Add this function to fetch liked songs
async function fetchLikedSongs() {
    try {
        if (isLikedSongsOnly) {
            await performSearch('');
        }
    } catch (error) { /* empty */ }
}

// Update the toggleLikedSongs function
async function toggleLikedSongs() {
    const button = document.querySelector('.sort-button.liked-songs');
    isLikedSongsOnly = !isLikedSongsOnly;
    button.classList.toggle('active');
    const img = button.querySelector('img');
    img.style.opacity = isLikedSongsOnly ? '1' : '0';

    // Reset popularity sort to descending when toggling liked songs
    sortByPopularityAsc = false;
    const popularityButton = document.querySelector('.sort-button.popularity');
    if (popularityButton) {
        const popularityImg = popularityButton.querySelector('img');
        if (popularityImg) {
            popularityImg.src = 'images/spotify/search/arrow-down.png';
            popularityImg.style.opacity = '1';
        }
    }

    // Clear current tracks
    currentTracks = [];

    // Get current search query
    const searchInput = document.querySelector('.search-input');
    const currentQuery = searchInput ? searchInput.value.trim() : '';

    // If turning off liked songs and no search query, clear the content
    if (!isLikedSongsOnly && !currentQuery) {
        document.getElementById('search-content').innerHTML = '';
        updatePopularityButtonState(false);
        return;
    }

    // Check if user has developer access
    try {
        await callSpotifyApi('/me/tracks?limit=1');
    } catch (error) {
        if (error.message.includes('403')) {
            const searchContent = document.getElementById('search-content');
            if (searchContent) {
                searchContent.innerHTML = '<div class="no-results-spotify">Account Not Added to Developer Dashboard. Please contact the administrator to add this account</div>';
                updatePopularityButtonState(false);
            }
            return;
        }
    }

    // Show loading state
    const searchContent = document.getElementById('search-content');
    if (searchContent && isLikedSongsOnly) {
        searchContent.innerHTML = '<div class="no-results-spotify">Loading liked songs...</div>';
    }

    // Perform search with current query
    await performSearch(currentQuery, true);
}

// Function to update play button state
function updatePlayButtonState() {
    const playBtn = document.getElementById('play-button');
    if (!playBtn) return;

    if (!isPlaybackAvailable) {
        // No song available - show pause icon and disable
        playBtn.src = 'images/spotify/pause.png';
        playBtn.style.opacity = '0.5';
        playBtn.style.cursor = 'not-allowed';
        playBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            showToast('No song available to play. Select a song first.', true);
        };
        return;
    }

    // Song available - show correct icon and enable
    playBtn.src = isPlaying ? 'images/spotify/play.png' : 'images/spotify/pause.png';
    playBtn.style.opacity = '1';
    playBtn.style.cursor = 'pointer';
    playBtn.onclick = togglePlayback;
}

// Function to toggle mute/unmute
async function toggleMute() {
    const volumeButton = document.getElementById('volume-button');
    const volumeSlider = document.getElementById('volume-slider');
    if (!volumeButton || !volumeSlider) return;

    // Set flag to prevent volume slider events from interfering
    isMuteChangingVolume = true;

    if (isMuted) {
        // Unmute: Restore previous volume
        isMuted = false;
        const restoreVolume = previousVolume || 50;
        // Update UI first for immediate feedback
        volumeButton.src = 'images/spotify/volumn.png';
        volumeButton.alt = 'volume';
        volumeButton.style.width = '20px';
        volumeButton.style.marginLeft = '0px';
        volumeButton.style.marginRight = '0px';
        volumeSlider.value = restoreVolume.toString();
        volumeSlider.style.setProperty('--progress', `${restoreVolume}%`);
        // Then update SDK volume
        if (window.player && typeof window.player.setVolume === 'function') {
            try {
                await window.player.setVolume(restoreVolume / 100);
            } catch (error) { /* empty */ }
        }
        // Also update via API for consistency
        try {
            const deviceId = localStorage.getItem('spotify_device_id');
            if (deviceId) {
                await callSpotifyApi(`/me/player/volume?volume_percent=${restoreVolume}&device_id=${deviceId}`, 'PUT');
            }
        } catch (error) { /* empty */ }
    } else {
        // Mute: Save current volume and set to 0
        previousVolume = parseInt(volumeSlider.value, 10);
        isMuted = true;
        // Update UI first for immediate feedback
        volumeButton.src = 'images/spotify/mute.png';
        volumeButton.alt = 'unmute';
        volumeButton.style.width = '15px';
        volumeButton.style.marginLeft = '2.5px';
        volumeButton.style.marginRight = '2.5px';
        volumeSlider.value = '0';
        volumeSlider.style.setProperty('--progress', '0%');
        // Then update SDK volume
        if (window.player && typeof window.player.setVolume === 'function') {
            try {
                await window.player.setVolume(0);
            } catch (error) { /* empty */ }
        }
        // Also update via API for consistency
        try {
            const deviceId = localStorage.getItem('spotify_device_id');
            if (deviceId) {
                await callSpotifyApi(`/me/player/volume?volume_percent=0&device_id=${deviceId}`, 'PUT');
            }
        } catch (error) { /* empty */ }
    }

    // Clear flag after a short delay to allow DOM updates
    setTimeout(() => {
        isMuteChangingVolume = false;
    }, 100);
}

// --- Enhanced Token Management with Cookies ---
const SPOTIFY_ACCESS_TOKEN_KEY = 'spotify_access_token';
const SPOTIFY_REFRESH_TOKEN_KEY = 'spotify_refresh_token';
const SPOTIFY_PREMIUM_KEY = 'spotify_is_premium';
const TOKEN_COOKIE_EXPIRY_DAYS = 30; // 30 days for refresh token
const ACCESS_TOKEN_COOKIE_EXPIRY_HOURS = 1; // 1 hour for access token

// Cookie helper functions
function setCookie(name, value, expiryMinutes) {
    const date = new Date();
    date.setTime(date.getTime() + (expiryMinutes * 60 * 1000));
    const expires = "expires=" + date.toUTCString();
    document.cookie = `${name}=${value}; ${expires}; path=/; SameSite=Strict; Secure=${window.location.protocol === 'https:'}`;
}

function setCookieDays(name, value, expiryDays) {
    const date = new Date();
    date.setTime(date.getTime() + (expiryDays * 24 * 60 * 60 * 1000));
    const expires = "expires=" + date.toUTCString();
    document.cookie = `${name}=${value}; ${expires}; path=/; SameSite=Strict; Secure=${window.location.protocol === 'https:'}`;
}

function getCookie(name) {
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) === ' ') c = c.substring(1, c.length);
        if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
    }
    return null;
}

function deleteCookie(name) {
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
}

// Enhanced token storage functions
function storeSpotifyTokens(accessToken, refreshToken, isPremium) {
    // Store access token with 1 hour expiry
    setCookie(SPOTIFY_ACCESS_TOKEN_KEY, accessToken, 60);
    // Store refresh token with 30 days expiry
    setCookieDays(SPOTIFY_REFRESH_TOKEN_KEY, refreshToken, TOKEN_COOKIE_EXPIRY_DAYS);
    // Store premium status
    setCookieDays(SPOTIFY_PREMIUM_KEY, isPremium ? 'true' : 'false', TOKEN_COOKIE_EXPIRY_DAYS);

    // Also keep in localStorage for backward compatibility during transition
    localStorage.setItem('spotify_access_token', accessToken);
    localStorage.setItem('spotify_refresh_token', refreshToken);
    localStorage.setItem('isPremium', isPremium ? 'true' : 'false');
}

function getSpotifyAccessToken() {
    return getCookie(SPOTIFY_ACCESS_TOKEN_KEY) || localStorage.getItem('spotify_access_token');
}

function getSpotifyRefreshToken() {
    return getCookie(SPOTIFY_REFRESH_TOKEN_KEY) || localStorage.getItem('spotify_refresh_token');
}

function getSpotifyPremiumStatus() {
    const cookieValue = getCookie(SPOTIFY_PREMIUM_KEY);
    const localStorageValue = localStorage.getItem('isPremium');
    return cookieValue === 'true' || localStorageValue === 'true';
}

function clearSpotifyTokens() {
    // Clear cookies
    deleteCookie(SPOTIFY_ACCESS_TOKEN_KEY);
    deleteCookie(SPOTIFY_REFRESH_TOKEN_KEY);
    deleteCookie(SPOTIFY_PREMIUM_KEY);

    // Clear localStorage
    localStorage.removeItem('spotify_access_token');
    localStorage.removeItem('spotify_refresh_token');
    localStorage.removeItem('isPremium');
    localStorage.removeItem('spotify_device_id');
}


// Function to toggle shuffle state
async function toggleShuffle() {
    const hasSpotifyPremium = localStorage.getItem('isPremium') === 'true';
    if (!hasSpotifyPremium) {
        showToast('Spotify Premium is required to use this feature.', true);
        const shuffleButton = document.getElementById('shuffle-button');
        if (shuffleButton) {
            shuffleButton.src = 'images/spotify/shuffle-inactive.png';
            setShuffleButtonDimensions(shuffleButton, 'inactive');
            shuffleButton.style.cursor = 'not-allowed';
            shuffleButton.style.opacity = '0.5';
        }
        return;
    }

    const shuffleButton = document.getElementById('shuffle-button');
    const repeatButton = document.getElementById('repeat-button');
    if (!shuffleButton || !repeatButton) return;

    if (!isPlaybackAvailable) {
        shuffleButton.src = 'images/spotify/shuffle-inactive.png';
        setShuffleButtonDimensions(shuffleButton, 'inactive');
        shuffleButton.style.cursor = 'not-allowed';
        shuffleButton.style.opacity = '0.5';
        showToast('No playback available to shuffle.', true);
        return;
    }

    try {
        // Get current state first
        const state = await callSpotifyApi('/me/player');
        if (!state || !state.item) {
            shuffleButton.src = 'images/spotify/shuffle-inactive.png';
            setShuffleButtonDimensions(shuffleButton, 'inactive');
            shuffleButton.style.cursor = 'not-allowed';
            shuffleButton.style.opacity = '0.5';
            showToast('No song is currently playing.', true);
            return;
        }

        const isShuffleOn = state.shuffle_state;

        // Check repeat state before enabling shuffle
        if (!isShuffleOn && state.repeat_state !== 'off') {
            showToast('Please turn off repeat mode before enabling shuffle.', true);
            shuffleButton.style.cursor = 'not-allowed';
            shuffleButton.style.opacity = '0.5';
            return;
        }

        // Update shuffle state through API first
        await callSpotifyApi('/me/player/shuffle?state=' + (!isShuffleOn), 'PUT');

        // Only update UI after successful API call
        if (!isShuffleOn) {
            shuffleButton.src = 'images/spotify/shuffle-active.png';
            setShuffleButtonDimensions(shuffleButton, 'active');
            // Disable repeat button when shuffle is on
            repeatButton.src = 'images/spotify/repeat-inactive.png';
            setRepeatButtonDimensions(repeatButton, 'inactive');
            repeatButton.style.opacity = '0.5';
            repeatButton.style.cursor = 'not-allowed';
            await callSpotifyApi('/me/player/repeat?state=off', 'PUT');
        } else {
            shuffleButton.src = 'images/spotify/shuffle-inactive.png';
            setShuffleButtonDimensions(shuffleButton, 'inactive');
            // Re-enable repeat button when shuffle is off
            repeatButton.style.opacity = '1';
            repeatButton.style.cursor = 'pointer';
        }
        shuffleButton.style.opacity = '1';
        shuffleButton.style.cursor = 'pointer';

        // Show feedback to user
        showToast(!isShuffleOn ? 'Shuffle is on' : 'Shuffle is off');

    } catch (error) {
        if (!error.message.includes('404')) {
            showToast('Unable to change shuffle mode. Please try again.', true);
            // Reset to inactive state on error
            shuffleButton.src = 'images/spotify/shuffle-inactive.png';
            setShuffleButtonDimensions(shuffleButton, 'inactive');
            shuffleButton.style.cursor = 'not-allowed';
            shuffleButton.style.opacity = '0.5';
        }
    }
}

// Function to toggle repeat state
// async function toggleRepeat() {
//     const hasSpotifyPremium = localStorage.getItem('isPremium') === 'true';
//     if (!hasSpotifyPremium) {
//         showToast('Spotify Premium is required to use this feature.', true);
//         const repeatButton = document.getElementById('repeat-button');
//         if (repeatButton) {
//             repeatButton.src = 'images/spotify/repeat-inactive.png';
//             setRepeatButtonDimensions(repeatButton, 'inactive');
//             repeatButton.style.cursor = 'not-allowed';
//             repeatButton.style.opacity = '0.5';
//         }
//         return;
//     }

//     const repeatButton = document.getElementById('repeat-button');
//     const shuffleButton = document.getElementById('shuffle-button');
//     if (!repeatButton || !shuffleButton) return;

//     if (!isPlaybackAvailable) {
//         repeatButton.src = 'images/spotify/repeat-inactive.png';
//         setRepeatButtonDimensions(repeatButton, 'inactive');
//         repeatButton.style.cursor = 'not-allowed';
//         repeatButton.style.opacity = '0.5';
//         showToast('No playback available to repeat.', true);
//         return;
//     }

//     try {
//         // Get current state first
//         const state = await callSpotifyApi('/me/player');
//         if (!state || !state.item) {
//             repeatButton.src = 'images/spotify/repeat-inactive.png';
//             setRepeatButtonDimensions(repeatButton, 'inactive');
//             repeatButton.style.cursor = 'not-allowed';
//             repeatButton.style.opacity = '0.5';
//             showToast('No song is currently playing.', true);
//             return;
//         }

//         // Check if shuffle is on before enabling repeat
//         if (state.repeat_state === 'off' && state.shuffle_state) {
//             showToast('Please turn off shuffle mode before enabling repeat.', true);
//             repeatButton.style.cursor = 'not-allowed';
//             return;
//         }

//         let nextState;
//         // Current states: 'off', 'context' (playlist/album), 'track' (single track)
//         switch (state.repeat_state) {
//             case 'off':
//                 nextState = 'context';
//                 break;
//             case 'context':
//                 nextState = 'track';
//                 break;
//             case 'track':
//                 nextState = 'off';
//                 break;
//             default:
//                 nextState = 'off';
//         }

//         // Update repeat state through API first
//         await callSpotifyApi('/me/player/repeat?state=' + nextState, 'PUT');

//         // Only update UI after successful API call
//         switch (nextState) {
//             case 'off':
//                 repeatButton.src = 'images/spotify/repeat-inactive.png';
//                 setRepeatButtonDimensions(repeatButton, 'inactive');
//                 // Re-enable shuffle button when repeat is off
//                 shuffleButton.style.opacity = '1';
//                 shuffleButton.style.cursor = 'pointer';
//                 break;
//             case 'context':
//                 repeatButton.src = 'images/spotify/repeat-active.png';
//                 setRepeatButtonDimensions(repeatButton, 'active');
//                 // Disable shuffle button when repeat is on
//                 shuffleButton.src = 'images/spotify/shuffle-inactive.png';
//                 setShuffleButtonDimensions(shuffleButton, 'inactive');
//                 shuffleButton.style.opacity = '0.5';
//                 shuffleButton.style.cursor = 'not-allowed';
//                 await callSpotifyApi('/me/player/shuffle?state=false', 'PUT');
//                 break;
//             case 'track':
//                 repeatButton.src = 'images/spotify/repeat-1.png';
//                 setRepeatButtonDimensions(repeatButton, 'repeat-1');
//                 // Disable shuffle button when repeat is on
//                 shuffleButton.src = 'images/spotify/shuffle-inactive.png';
//                 setShuffleButtonDimensions(shuffleButton, 'inactive');
//                 shuffleButton.style.opacity = '0.5';
//                 shuffleButton.style.cursor = 'not-allowed';
//                 await callSpotifyApi('/me/player/shuffle?state=false', 'PUT');
//                 break;
//         }

//         // Update button appearance
//         repeatButton.style.cursor = 'pointer';
//         repeatButton.style.opacity = '1';

//         // Show feedback to user
//         const stateMessages = {
//             off: 'Repeat is off',
//             context: 'Repeating playlist/album',
//             track: 'Repeating current track'
//         };
//         showToast(stateMessages[nextState]);

//     } catch (error) {
//         if (!error.message.includes('404')) {
//             showToast('Unable to change repeat mode. Please try again.', true);
//             // Reset to inactive state on error
//             repeatButton.src = 'images/spotify/repeat-inactive.png';
//             setRepeatButtonDimensions(repeatButton, 'inactive');
//             repeatButton.style.cursor = 'not-allowed';
//             repeatButton.style.opacity = '0.5';
//         }
//     }
// }

// Function to toggle popularity sort
function togglePopularitySort() {
    // If no tracks or button is disabled, do nothing
    if (!currentTracks || currentTracks.length === 0) {
        return;
    }

    const button = document.querySelector('.sort-button.popularity');
    if (!button || button.style.cursor === 'not-allowed') {
        return;
    }

    // Toggle between ascending and descending
    sortByPopularityAsc = !sortByPopularityAsc;

    // Update button state
    button.classList.add('active');
    const img = button.querySelector('img');
    if (img) {
        img.src = sortByPopularityAsc ? 'images/spotify/search/arrow-up.png' : 'images/spotify/search/arrow-down.png';
        img.style.opacity = '1';
    }

    // Sort tracks by popularity
    currentTracks.sort((a, b) => {
        const popularityDiff = sortByPopularityAsc
            ? a.popularity - b.popularity
            : b.popularity - a.popularity;

        // If popularity is the same, sort alphabetically
        if (popularityDiff === 0) {
            return a.name.localeCompare(b.name);
        }
        return popularityDiff;
    });

    // Redisplay tracks
    displayCurrentTracks();
}

// Function to skip to previous track
// async function playPreviousTrack() {
//     // Prevent rapid consecutive clicks
//     if (prevTrackTimeout) {
//         showToast('Please wait a moment before changing tracks.', true);
//         return;
//     }

//     const hasSpotifyPremium = localStorage.getItem('isPremium') === 'true';
//     if (!hasSpotifyPremium) {
//         showToast('Spotify Premium is required to use this feature.', true);
//         return;
//     }

//     try {
//         // Set cooldown immediately
//         prevTrackTimeout = setTimeout(() => {
//             prevTrackTimeout = null;
//         }, PREV_TRACK_DEBOUNCE);

//         // Get current playback state
//         const state = await callSpotifyApi('/me/player');
//         if (!state) {
//             showToast('Unable to get playback state.', true);
//             return;
//         }

//         // Handle liked songs navigation
//         if (isPlayingFromLikedSongs && currentLikedSongsQueue.length > 0) {
//             if (currentTrackIndexInQueue > 0) {
//                 if (state.progress_ms > 3000) {
//                     // If more than 3 seconds in, restart current track
//                     await callSpotifyApi('/me/player/seek?position_ms=0', 'PUT');
//                     // Clear the timeout to allow immediate next click
//                     if (prevTrackTimeout) {
//                         clearTimeout(prevTrackTimeout);
//                         prevTrackTimeout = null;
//                     }
//                     // Show message that they can click again immediately
//                     showToast('Track restarted - you can click again to go to previous track');
//                 } else {
//                     currentTrackIndexInQueue--;
//                     const prevTrack = currentLikedSongsQueue[currentTrackIndexInQueue];
//                     // Update UI before API call for better responsiveness
//                     updateSongInfo({
//                         image: (prevTrack.album.images && prevTrack.album.images[0]
//  && prevTrack.album.images[0].url)
// || 'images/spotify/default-song.png',
//                         name: prevTrack.name,
//                         artists: prevTrack.artists.map((artist) => artist.name).join(', ')
//                     });
//                     await playSong(prevTrack.uri, true);
//                 }
//             } else {
//                 showToast('This is the first song in your liked songs.', true);
//                 return;
//             }
//         } else if (state.context && state.context.type === 'playlist') {
//             // For playlist playback
//             if (state.progress_ms > 3000) {
//                 // If more than 3 seconds in, restart current track
//                 await callSpotifyApi('/me/player/seek?position_ms=0', 'PUT');
//                 // Clear the timeout to allow immediate next click
//                 if (prevTrackTimeout) {
//                     clearTimeout(prevTrackTimeout);
//                     prevTrackTimeout = null;
//                 }
//                 // Show message that they can click again immediately
//                 showToast('Track restarted - you can click again to go to previous track');
//             } else {
//                 // Update UI immediately with current track info for better responsiveness
//                 if (state.item) {
//                     updateSongInfo({
//                         image: (state.item.album.images
// && state.item.album.images[0] && state.item.album.images[0].url)
//  || 'images/spotify/default-song.png',
//                         name: state.item.name,
//                         artists: state.item.artists.map((artist) => artist.name).join(', ')
//                     });
//                 }

//                 // Go to previous track
//                 await callSpotifyApi('/me/player/previous', 'POST');

//                 // Get updated state immediately after track change
//                 const newState = await callSpotifyApi('/me/player');
//                 if (newState && newState.item) {
//                     updateSongInfo({
//                         image: (newState.item.album.images && newState.item.album.images[0]
// && newState.item.album.images[0].url) || 'images/spotify/default-song.png',
//                         name: newState.item.name,
//                         artists: newState.item.artists.map((artist) => artist.name).join(', ')
//                     });
//                 }
//             }
//         } else {
//             // For single tracks
//             if (state.progress_ms > 3000) {
//                 await callSpotifyApi('/me/player/seek?position_ms=0', 'PUT');
//                 showToast('Restarted current track. Click again to go to previous track.');
//             } else {
//                 showToast('Previous track is not available for single tracks.', true);
//                 return;
//             }
//         }

//         // Update play button state
//         isPlaying = true;
//         updatePlayButtonState();

//         // Update control buttons state immediately
//         updateControlButtonsState(true);

//         // Sync playback state in the background
//         syncPlaybackState().catch(() => {
//             // Silently handle sync errors to prevent UI disruption
//         });
//     } catch (error) {
//         if (!error.message.includes('404')) {
//             showToast('Unable to play previous track. Please try again.', true);
//         }
//     }
// }

// Function to skip to next track
// async function playNextTrack() {
//     // Prevent rapid consecutive clicks
//     if (nextTrackTimeout) {
//         showToast('Please wait a moment before changing tracks.', true);
//         return;
//     }

//     // Set cooldown immediately
//     nextTrackTimeout = setTimeout(() => {
//         nextTrackTimeout = null;
//         isRepeatOneProcessing = false; // Reset the lock when cooldown expires
//     }, NEXT_TRACK_DEBOUNCE);

//     const hasSpotifyPremium = localStorage.getItem('isPremium') === 'true';
//     if (!hasSpotifyPremium) {
//         showToast('Spotify Premium is required to use this feature.', true);
//         return;
//     }

//     try {
//         // Get current playback state to check repeat and shuffle modes
//         const currentState = await callSpotifyApi('/me/player');
//         if (!currentState) {
//             showToast('Unable to get playback state.', true);
//             return;
//         }

//         // Store current repeat and shuffle states
//         const currentRepeatState = currentState.repeat_state;
//         const currentShuffleState = currentState.shuffle_state;

//         // If repeat-1 (track) mode is on, replay the current track
//         if (currentRepeatState === 'track') {
//             // Check if we're already processing a repeat-1 action
//             if (isRepeatOneProcessing) {
//                 return;
//             }

//             // Set the processing lock
//             isRepeatOneProcessing = true;

//             try {
//                 if (isPlayingFromLikedSongs && currentLikedSongsQueue.length > 0) {
//                     const currentTrack = currentLikedSongsQueue[currentTrackIndexInQueue];
//                     await playSong(currentTrack.uri, true);
//                     updateSongInfo({
//                         image: (currentTrack.album.images && currentTrack.album.images[0]
// && currentTrack.album.images[0].url)
// || 'images/spotify/default-song.png',
//                         name: currentTrack.name,
//                         artists: currentTrack.artists.map((artist) => artist.name).join(', ')
//                     });
//                 } else {
//                     // For non-liked songs, seek to start
//                     await callSpotifyApi(`/me/player/seek?position_ms=0`, 'PUT');
//                 }

//                 // Ensure repeat state is maintained
//                 await callSpotifyApi('/me/player/repeat?state=track', 'PUT');
//                 const repeatButton = document.getElementById('repeat-button');
//                 if (repeatButton) {
//                     repeatButton.src = 'images/spotify/repeat-1.png';
//                     setRepeatButtonDimensions(repeatButton, 'repeat-1');
//                 }
//                 return;
//             } catch (error) {
//                 // Reset the processing lock on error
//                 isRepeatOneProcessing = false;
//                 throw error;
//             }
//         }

//         if (isPlayingFromLikedSongs && currentLikedSongsQueue.length > 0) {
//             // Get next track index based on shuffle state
//             currentTrackIndexInQueue =
// await getNextTrackIndex(currentTrackIndexInQueue, currentLikedSongsQueue.length);
//             const nextTrack = currentLikedSongsQueue[currentTrackIndexInQueue];
//             await playSong(nextTrack.uri, true);
//             updateSongInfo({
//                 image: (nextTrack.album.images && nextTrack.album.images[0]
// && nextTrack.album.images[0].url)
// || 'images/spotify/default-song.png',
//                 name: nextTrack.name,
//                 artists: nextTrack.artists.map((artist) => artist.name).join(', ')
//             });
//         } else if (currentState.context && currentState.context.type === 'playlist') {
//             // Get playlist details to check if we're at the last track
//             const playlistId = currentState.context.uri.split(':')[2];
//             const playlist = await callSpotifyApi(`/playlists/${playlistId}`);
//             const currentTrackNumber = currentState.item.track_number;
//             const totalTracks = playlist.tracks.total;

//             // If at last track and not shuffling or repeating
//             if (currentTrackNumber === totalTracks
// && !currentShuffleState && currentRepeatState === 'off') {
//                 // Restart playlist from beginning
//                 const deviceId = localStorage.getItem('spotify_device_id');
//                 await callSpotifyApi(`/me/player/play?device_id=${deviceId}`, 'PUT', {
//                     context_uri: currentState.context.uri,
//                     offset: { position: 0 }
//                 });
//                 showToast('Restarting playlist from beginning');
//             } else {
//                 // Use Spotify's default next behavior
//                 await callSpotifyApi('/me/player/next', 'POST');
//             }

//             // Get the new track info after skipping
//             const newState = await callSpotifyApi('/me/player');
//             if (newState && newState.item) {
//                 updateSongInfo({
//                     image: (newState.item.album.images && newState.item.album.images[0]
// && newState.item.album.images[0].url) || 'images/spotify/default-song.png',
//                     name: newState.item.name,
//                     artists: newState.item.artists.map((artist) => artist.name).join(', ')
//                 });
//             }
//         } else {
//             showToast('Next track is not available for single tracks.', true);
//             return;
//         }

//         // Update play button state after successful track change
//         isPlaying = true;
//         updatePlayButtonState();

//         // Restore repeat and shuffle states
//         if (currentRepeatState) {
//             await callSpotifyApi(`/me/player/repeat?state=${currentRepeatState}`, 'PUT');
//             const repeatButton = document.getElementById('repeat-button');
//             if (repeatButton) {
//                 switch (currentRepeatState) {
//                     case 'off':
//                         repeatButton.src = 'images/spotify/repeat-inactive.png';
//                         setRepeatButtonDimensions(repeatButton, 'inactive');
//                         break;
//                     case 'context':
//                         repeatButton.src = 'images/spotify/repeat-active.png';
//                         setRepeatButtonDimensions(repeatButton, 'active');
//                         break;
//                     case 'track':
//                         repeatButton.src = 'images/spotify/repeat-1.png';
//                         setRepeatButtonDimensions(repeatButton, 'repeat-1');
//                         break;
//                     default:
//                         repeatButton.src = 'images/spotify/repeat-inactive.png';
//                         setRepeatButtonDimensions(repeatButton, 'inactive');
//                         break;
//                 }
//             }
//         }

//         if (currentShuffleState !== undefined) {
//             await callSpotifyApi(`/me/player/shuffle?state=${currentShuffleState}`, 'PUT');
//         const shuffleButton = document.getElementById('shuffle-button');
//         if (shuffleButton) {
//                 shuffleButton.src = currentShuffleState
// ? 'images/spotify/shuffle-active.png' : 'images/spotify/shuffle-inactive.png';
//                 setShuffleButtonDimensions(shuffleButton, currentShuffleState
// ? 'active' : 'inactive');
//             }
//         }

//         // Update control buttons state and sync with Spotify
//         await syncPlaybackState();
//     } catch (error) {
//         if (!error.message.includes('404')) {
//             showToast('Unable to play next track. Please try again.', true);
//         }
//     }
// }

// Function to update previous button state
// async function updatePrevButtonState() {
//     const prevButton = document.getElementById('prev-button');
//     if (!prevButton) return;

//     try {
//         if (!isPlaybackAvailable) {
//             prevButton.style.opacity = '0.5';
//             prevButton.style.cursor = 'not-allowed';
//             prevButton.onclick = (e) => {
//                 e.preventDefault();
//                 e.stopPropagation();
//                 showToast('No song available to go back to.', true);
//             };
//             return;
//         }

//         // Get current playback state
//         const playbackState = await callSpotifyApi('/me/player');
//         if (!playbackState) {
//             prevButton.style.opacity = '0.5';
//             prevButton.style.cursor = 'not-allowed';
//             return;
//         }

//         // If in repeat-1 mode, disable prev button
//         if (playbackState.repeat_state === 'track') {
//             prevButton.style.opacity = '0.5';
//             prevButton.style.cursor = 'not-allowed';
//             prevButton.onclick = (e) => {
//                 e.preventDefault();
//                 e.stopPropagation();
//                 showToast('Previous track disabled in repeat one mode.', true);
//             };
//             return;
//         }

//         // Handle different playback contexts
//         if (isPlayingFromLikedSongs) {
//             // Enable if we have previous tracks in liked songs queue
//             const hasPrevious = currentTrackIndexInQueue > 0;
//             prevButton.style.opacity = hasPrevious ? '1' : '0.5';
//             prevButton.style.cursor = hasPrevious ? 'pointer' : 'not-allowed';
//             prevButton.onclick = hasPrevious ? playPreviousTrack : (e) => {
//                 e.preventDefault();
//                 e.stopPropagation();
//                 showToast('This is the first song in your liked songs.', true);
//             };
//         } else if (playbackState.context && playbackState.context.type === 'playlist') {
//             // For playlists, always enable the button
//             prevButton.style.opacity = '1';
//             prevButton.style.cursor = 'pointer';
//             prevButton.onclick = playPreviousTrack;
//         } else {
//             // For single tracks, only enable if we can restart
//             const hasPrevious = playbackState.progress_ms > 3000;
//             prevButton.style.opacity = hasPrevious ? '1' : '0.5';
//             prevButton.style.cursor = hasPrevious ? 'pointer' : 'not-allowed';
//             prevButton.onclick = hasPrevious ? playPreviousTrack : (e) => {
//                 e.preventDefault();
//                 e.stopPropagation();
//                 showToast('Previous track is not available for single tracks.', true);
//             };
//         }
//     } catch (error) {
//         // If there's an error, disable the button
//         prevButton.style.opacity = '0.5';
//         prevButton.style.cursor = 'not-allowed';
//         prevButton.onclick = (e) => {
//             e.preventDefault();
//             e.stopPropagation();
//             showToast('Unable to check previous track availability.', true);
//         };
//     }
// }

// Function to update next button state
// async function updateNextButtonState() {
//     const nextButton = document.getElementById('next-button');
//     if (!nextButton) return;

//     try {
//         if (!isPlaybackAvailable) {
//             nextButton.style.opacity = '0.5';
//             nextButton.style.cursor = 'not-allowed';
//             nextButton.onclick = (e) => {
//                 e.preventDefault();
//                 e.stopPropagation();
//                 showToast('No song available to skip to.', true);
//             };
//             return;
//         }

//         // Get current playback state
//         const state = await callSpotifyApi('/me/player');
//         if (!state || !state.item) {
//             nextButton.style.opacity = '0.5';
//             nextButton.style.cursor = 'not-allowed';
//             nextButton.onclick = (e) => {
//                 e.preventDefault();
//                 e.stopPropagation();
//                 showToast('No next song available.', true);
//             };
//             return;
//         }

//         // If in repeat-1 mode, disable next button
//         if (state.repeat_state === 'track') {
//             nextButton.style.opacity = '0.5';
//             nextButton.style.cursor = 'not-allowed';
//             nextButton.onclick = (e) => {
//                 e.preventDefault();
//                 e.stopPropagation();
//                 showToast('Next track disabled in repeat one mode.', true);
//             };
//             return;
//         }

//         // If playing from a playlist, always enable next button
//         if (state.context && state.context.type === 'playlist') {
//             nextButton.style.opacity = '1';
//             nextButton.style.cursor = 'pointer';
//             nextButton.onclick = playNextTrack;
//             return;
//         }

//         // If playing from liked songs, check if we're at the last track
//         if (isPlayingFromLikedSongs) {
//             const hasNext = currentTrackIndexInQueue < currentLikedSongsQueue.length - 1;
//             nextButton.style.opacity = hasNext ? '1' : '0.5';
//             nextButton.style.cursor = hasNext ? 'pointer' : 'not-allowed';
//             nextButton.onclick = hasNext ? playNextTrack : (e) => {
//                 e.preventDefault();
//                 e.stopPropagation();
//                 showToast('This is the last song in your liked songs.', true);
//             };
//             return;
//         }

//         // For single tracks, disable next button
//         nextButton.style.opacity = '0.5';
//         nextButton.style.cursor = 'not-allowed';
//         nextButton.onclick = (e) => {
//             e.preventDefault();
//             e.stopPropagation();
//             showToast('Next track is not available for single tracks.', true);
//         };
//     } catch (error) {
//         // If there's an error, disable the button
//         nextButton.style.opacity = '0.5';
//         nextButton.style.cursor = 'not-allowed';
//         nextButton.onclick = (e) => {
//             e.preventDefault();
//             e.stopPropagation();
//             showToast('No next song available.', true);
//         };
//     }
// }

function saveAppState() {
  try {
    // DO NOT save timer state to shared APP_STATE_KEY cookie - this causes cross-user contamination
    // Timer state should only be saved to user-specific
    // cookies by the timer's saveTimerState() method
    // Saving timer state here would cause User A's timer to show for User B when they log in


    // If we had other non-timer app state to save, we would save it here
    // For now, just ensure the shared cookie is clean
    deleteCookie(APP_STATE_KEY);
  } catch (e) { /* ignore */ }
}

// Helper function to show user-friendly messages
function showToast(message, isError = false) {
    // Find or create toast element
    let toast = document.getElementById("toast");
    if (!toast) {
        toast = document.createElement("div");
        toast.id = "toast";
        toast.className = "toast";
        document.body.appendChild(toast);
    }

    // Reset toast state
    toast.classList.remove("show");

    // Set message and error state
    toast.textContent = message;
    toast.className = `toast${isError ? ' error' : ''}`;

    // Show toast in next frame
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            toast.classList.add("show");
        });
    });

    // Hide the toast after delay
    setTimeout(() => {
        toast.classList.remove("show");
    }, 6000);
}

// Function to clear user-specific state (timer, app state, playback state, etc.)
function clearUserState(specificUserId = null) {
    // Clear Spotify tokens
    clearSpotifyTokens();

    // Clear app state (to prevent cross-user contamination)
    deleteCookie(APP_STATE_KEY);

    // Clear playback state
    localStorage.removeItem(PLAYBACK_STATE_KEY);
    localStorage.removeItem(PLAYER_STATE_KEY);

    // Clear user-specific state cookies only for the specific user
    if (specificUserId) {
        // Clear Spotify state for specific user (but preserve timer state)
        deleteCookie(`spotify_state_${specificUserId}`);
        // Do NOT clear timer state - let user resume when they log back in
        // deleteCookie(`timer_state_${specificUserId}`);
    } else {
        // If no specific user ID provided, try to get it from stored user data
        try {
            const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
            if (storedUser.id) {
                // Clear Spotify state but preserve timer state
                deleteCookie(`spotify_state_${storedUser.id}`);
                // Do NOT clear timer state - let user resume when they log back in
                // deleteCookie(`timer_state_${storedUser.id}`);
            }
        } catch (e) {
            // If we can't determine the user, don't clear any user-specific states
            // This preserves other users' states
        }
    }

    // Clear general user-related localStorage items
    localStorage.removeItem('user');
    localStorage.removeItem('captchaLockout');

    // Save timer state before clearing so it can be restored on next login
    if (window.personalTimer && typeof window.personalTimer.saveTimerState === 'function') {
        window.personalTimer.saveTimerState();
    } else {
        // console.warn('personalTimer or saveTimerState not available during logout');
    }

    // DO NOT reset timer-related global variables - preserve timer state for logout/login cycle
    // The timer state is saved in cookies and will be restored when user logs back in
    // Only reset the UI elements that need to be cleared for logout
    if (window.personalTimer) {
        // Reset timer display to default (will be restored from cookies on login)
        const timerDisplay = document.getElementById('timer-display');
        if (timerDisplay) {
            timerDisplay.textContent = '00:00';
        }

        // Reset timer button to play state (will be restored from cookies on login)
        const toggleButtonImage = document.querySelector('#toggle-button img');
        if (toggleButtonImage) {
            toggleButtonImage.src = 'images/timer-play.png';
            toggleButtonImage.alt = 'Play';
        }
    }

    // Reset song info to default
    const albumArt = document.querySelector('.album-art');
    if (albumArt) {
        albumArt.src = 'images/spotify/default-song.png';
    }

    const songTitle = document.querySelector('.song-title');
    if (songTitle) {
        songTitle.textContent = 'Welcome to Spotify';
    }

    const artistName = document.querySelector('.artist-name');
    if (artistName) {
        artistName.textContent = 'Select a song to start playing';
    }
}

// Extract tokens from URL parameters and store them
const urlParams = new URLSearchParams(window.location.search);
const accessToken = urlParams.get('access_token');
const refreshToken = urlParams.get('refresh_token');
const userIsPremium = urlParams.get('isPremium');

if (accessToken) {
    // Store tokens using enhanced cookie storage
    storeSpotifyTokens(accessToken, refreshToken, userIsPremium === 'true');

    // Remove the tokens from the URL
    window.history.replaceState({}, document.title, '/home.html');
}

// Function to update sort dropdown visibility
window.updateSortDropdown = function() {
    const dropdown = document.getElementById('sort-dropdown');
    if (dropdown && window.vueinst) {
        dropdown.style.display = window.vueinst.sortDropdownVisible ? 'block' : 'none';

        // Update selected states
        const titleItem = dropdown.querySelector('.dropdown-item:nth-child(1)');
        const trackItem = dropdown.querySelector('.dropdown-item:nth-child(2)');
        const ascItem = dropdown.querySelector('.dropdown-section:nth-child(3) .dropdown-item:nth-child(1)');
        const descItem = dropdown.querySelector('.dropdown-section:nth-child(3) .dropdown-item:nth-child(2)');

        if (titleItem) {
            titleItem.className = `dropdown-item ${window.vueinst.sortField === 'Title' ? 'selected' : ''}`;
            titleItem.innerHTML = `${window.vueinst.sortField === 'Title' ? '<img src="images/spotify/playlist/check.png" alt="check" style="width: 14px; height: 14px; margin-right: 5px"/>' : '<img src="images/spotify/playlist/check.png" alt="check" style="width: 14px; height: 14px; margin-right: 5px; opacity: 0"/>'}Title`;
        }
        if (trackItem) {
            trackItem.className = `dropdown-item ${window.vueinst.sortField === 'Track Number' ? 'selected' : ''}`;
            trackItem.innerHTML = `${window.vueinst.sortField === 'Track Number' ? '<img src="images/spotify/playlist/check.png" alt="check" style="width: 14px; height: 14px; margin-right: 5px"/>' : '<img src="images/spotify/playlist/check.png" alt="check" style="width: 14px; height: 14px; margin-right: 5px; opacity: 0"/>'}Track Number`;
        }
        if (ascItem) {
            ascItem.className = `dropdown-item ${window.vueinst.sortOrder === 'Ascending' ? 'selected' : ''}`;
            ascItem.innerHTML = `${window.vueinst.sortOrder === 'Ascending' ? '<img src="images/spotify/playlist/check.png" alt="check" style="width: 14px; height: 14px; margin-right: 5px"/>' : '<img src="images/spotify/playlist/check.png" alt="check" style="width: 14px; height: 14px; margin-right: 5px; opacity: 0"/>'}Ascending`;
        }
        if (descItem) {
            descItem.className = `dropdown-item ${window.vueinst.sortOrder === 'Descending' ? 'selected' : ''}`;
            descItem.innerHTML = `${window.vueinst.sortOrder === 'Descending' ? '<img src="images/spotify/playlist/check.png" alt="check" style="width: 14px; height: 14px; margin-right: 5px"/>' : '<img src="images/spotify/playlist/check.png" alt="check" style="width: 14px; height: 14px; margin-right: 5px; opacity: 0"/>'}Descending`;
        }
    }
};

// Function to check text overflow
function checkTextOverflow() {
    const songTitle = document.querySelector('.song-title');
    const artistName = document.querySelector('.artist-name');
    const songDetails = document.querySelector('.song-details');

    if (songTitle && songDetails) {
        // Get the actual text width
        const titleWidth = songTitle.scrollWidth;
        const containerWidth = songDetails.offsetWidth;

        if (titleWidth > containerWidth) {
            // Calculate scroll distance and duration
            const scrollDistance = titleWidth - containerWidth;
            const paddedDistance = scrollDistance + 50; // Add 50px padding at the end
            const duration = Math.max(paddedDistance / 15, 8);
            // slower speed (15px/s) and minimum 8 seconds

            // Set the CSS custom properties
            songTitle.style.setProperty('--scroll-distance', `${paddedDistance}px`);
            songTitle.style.setProperty('--scroll-duration', `${duration}s`);
            songTitle.classList.add('overflow');
        } else {
            songTitle.classList.remove('overflow');
            songTitle.style.removeProperty('--scroll-distance');
            songTitle.style.removeProperty('--scroll-duration');
        }
    }

    if (artistName && songDetails) {
        // Get the actual text width
        const artistWidth = artistName.scrollWidth;
        const containerWidth = songDetails.offsetWidth;

        if (artistWidth > containerWidth) {
            // Calculate scroll distance and duration
            const scrollDistance = artistWidth - containerWidth;
            const paddedDistance = scrollDistance + 50; // Add 50px padding at the end
            const duration = Math.max(paddedDistance / 15, 8);
            // slower speed (15px/s) and minimum 8 seconds

            // Set the CSS custom properties
            artistName.style.setProperty('--scroll-distance', `${paddedDistance}px`);
            artistName.style.setProperty('--scroll-duration', `${duration}s`);
            artistName.classList.add('overflow');
        } else {
            artistName.classList.remove('overflow');
            artistName.style.removeProperty('--scroll-distance');
            artistName.style.removeProperty('--scroll-duration');
        }
    }
}

// Function to update song info
window.updateSongInfo = function({ image, name, artists }) {
    // Update album art
    const albumArt = document.querySelector('.album-art');
    if (albumArt) {
        albumArt.src = image || 'images/spotify/default-song.png';
    }

    // Update song title
    const songTitle = document.querySelector('.song-title');
    if (songTitle) {
        songTitle.textContent = name || '';
    }

    // Update artist name(s)
    const artistName = document.querySelector('.artist-name');
    if (artistName) {
        artistName.textContent = artists || '';
    }

    // Save Spotify state when song info changes
    try {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        if (user.id) {
            // Save with a small delay to ensure DOM is updated
            setTimeout(() => {
                saveUserSpotifyState(user.id);
            }, 100);
        }
    } catch (e) {
        // Ignore save errors
    }

    // Add a small delay to ensure the DOM has updated before checking overflow
    setTimeout(checkTextOverflow, 50);
    // Check again after a longer delay to ensure all fonts are loaded
    setTimeout(checkTextOverflow, 500);
};

// Function to create sort dropdown HTML dynamically
function createSortDropdownHTML() {
    if (!window.vueinst) return '';

    const vue = window.vueinst;
    const titleSelected = vue.sortField === 'Title';
    const trackSelected = vue.sortField === 'Track Number';
    const ascSelected = vue.sortOrder === 'Ascending';
    const descSelected = vue.sortOrder === 'Descending';

    return `
        <div id="sort-dropdown" style="display: ${vue.sortDropdownVisible ? 'block' : 'none'};">
            <div class="dropdown-section">
                <div class="dropdown-item ${titleSelected ? 'selected' : ''}" onclick="selectSortField('Title')">
                    ${titleSelected ? '<img src="images/spotify/playlist/check.png" alt="check" style="width: 14px; height: 14px; margin-right: 5px"/>' : '<img src="images/spotify/playlist/check.png" alt="check" style="width: 14px; height: 14px; margin-right: 5px; opacity: 0"/>'}Title
                </div>
                <div class="dropdown-item ${trackSelected ? 'selected' : ''}" onclick="selectSortField('Track Number')">
                    ${trackSelected ? '<img src="images/spotify/playlist/check.png" alt="check" style="width: 14px; height: 14px; margin-right: 5px"/>' : '<img src="images/spotify/playlist/check.png" alt="check" style="width: 14px; height: 14px; margin-right: 5px; opacity: 0"/>'}Track Number
                </div>
            </div>
            <hr class="dropdown-divider">
            <div class="dropdown-section">
                <div class="dropdown-item ${ascSelected ? 'selected' : ''}" onclick="selectSortOrder('Ascending')">
                    ${ascSelected ? '<img src="images/spotify/playlist/check.png" alt="check" style="width: 14px; height: 14px; margin-right: 5px"/>' : '<img src="images/spotify/playlist/check.png" alt="check" style="width: 14px; height: 14px; margin-right: 5px; opacity: 0"/>'}Ascending
                </div>
                <div class="dropdown-item ${descSelected ? 'selected' : ''}" onclick="selectSortOrder('Descending')">
                    ${descSelected ? '<img src="images/spotify/playlist/check.png" alt="check" style="width: 14px; height: 14px; margin-right: 5px"/>' : '<img src="images/spotify/playlist/check.png" alt="check" style="width: 14px; height: 14px; margin-right: 5px; opacity: 0"/>'}Descending
                </div>
            </div>
        </div>
    `;
}

// Function to sync playback controls state
async function syncPlaybackState() {
    try {
        const response = await callSpotifyApi('/me/player');
        if (response) {
            // Update playback availability based on whether there's an active device and track
            const hasPlayback = response.device && response.item;
            isPlaybackAvailable = hasPlayback;

            // Update shuffle state
            const shuffleButton = document.getElementById('shuffle-button');
            if (shuffleButton && response.shuffle_state !== undefined) {
                if (!hasPlayback) {
                    shuffleButton.src = 'images/spotify/shuffle-inactive.png';
                    shuffleButton.style.cursor = 'not-allowed';
                    shuffleButton.style.opacity = '0.5';
                } else {
                    shuffleButton.src = response.shuffle_state ? 'images/spotify/shuffle-active.png' : 'images/spotify/shuffle-inactive.png';
                    setShuffleButtonDimensions(shuffleButton, response.shuffle_state ? 'active' : 'inactive');
                    shuffleButton.style.cursor = 'pointer';
                    shuffleButton.style.opacity = '1';
                }
            }

            // Update repeat state
            const repeatButton = document.getElementById('repeat-button');
            if (repeatButton && response.repeat_state) {
                if (!hasPlayback) {
                    repeatButton.src = 'images/spotify/repeat-inactive.png';
                    setRepeatButtonDimensions(repeatButton, 'inactive');
                    repeatButton.style.cursor = 'not-allowed';
                    repeatButton.style.opacity = '0.5';
                } else {
                    switch (response.repeat_state) {
                        case 'off':
                            repeatButton.src = 'images/spotify/repeat-inactive.png';
                            setRepeatButtonDimensions(repeatButton, 'inactive');
                            break;
                        case 'context':
                            repeatButton.src = 'images/spotify/repeat-active.png';
                            setRepeatButtonDimensions(repeatButton, 'active');
                            break;
                        case 'track':
                            repeatButton.src = 'images/spotify/repeat-1.png';
                            setRepeatButtonDimensions(repeatButton, 'repeat-1');
                            break;
                    }
                    repeatButton.style.cursor = 'pointer';
                    repeatButton.style.opacity = '1';
                }
            }

            // Update play/pause state
            if (response.is_playing !== undefined) {
                isPlaying = response.is_playing;
                updatePlayButtonState();
            }

            // Update navigation buttons based on context
            if (response.context && response.context.type === 'playlist') {
                // In playlist context, update based on track position
                const isFirstTrack = response.item && response.item.track_number === 1;
                const hasPreviousProgress = response.progress_ms > 3000;

                // Update previous button - enable if not at start of first track
                const prevButton = document.getElementById('prev-button');
                if (prevButton) {
                    if (!isFirstTrack || hasPreviousProgress) {
                        prevButton.style.opacity = '1';
                        prevButton.style.cursor = 'pointer';
                        prevButton.onclick = playPreviousTrack;
                    } else {
                        prevButton.style.opacity = '0.5';
                        prevButton.style.cursor = 'not-allowed';
                    }
                }

                // Update next button - always enabled in playlist context
                const nextButton = document.getElementById('next-button');
                if (nextButton) {
                    nextButton.style.opacity = '1';
                    nextButton.style.cursor = 'pointer';
                    nextButton.onclick = playNextTrack;
                }
            } else {
                // Not in playlist context, update based on liked songs or single track
                updatePrevButtonState();
                updateNextButtonState();
            }

            // Update all control buttons state
            updateControlButtonsState(hasPlayback);
        } else {
            // No response means no active playback
            updateControlButtonsState(false);
        }
    } catch (error) {
        // Silently handle sync errors
        // Disable controls on error
        updateControlButtonsState(false);
    }
}

// Function to initialize the Spotify Web Playback SDK
function initializeSpotifyPlayer(token) {
    // Override Spotify's metadata
    document.title = 'Home';

    // Remove any Spotify-related meta tags
    document.querySelectorAll('meta').forEach((meta) => {
        const property = meta.getAttribute('property');
        const name = meta.getAttribute('name');
        if ((property && property.includes('spotify'))
            || (name && name.includes('spotify'))) {
            meta.remove();
        }
    });

    // Add specific error handler for item_before_load errors
    const originalFetch = window.fetch;
    window.fetch = function(url, options) {
        // Keep title as "Home"
        if (document.title !== 'Home') {
            document.title = 'Home';
        }

        // Prevent favicon changes
        const existingFavicon = document.querySelector('link[rel="icon"]');
        const existingShortcut = document.querySelector('link[rel="shortcut icon"]');
        if (existingFavicon && existingFavicon.href !== '/images/web-icon.png') {
            existingFavicon.href = '/images/web-icon.png';
        }
        if (existingShortcut && existingShortcut.href !== '/images/web-icon.png') {
            existingShortcut.href = '/images/web-icon.png';
        }

        if (url.includes('cpapi.spotify.com') && url.includes('item_before_load')) {
            // Return empty success response for these specific requests
            return Promise.resolve(new Response(JSON.stringify({}), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            }));
        }
        return originalFetch(url, options);
    };

    // Set up the callback for when SDK is ready
    window.onSpotifyWebPlaybackSDKReady = () => {
        if (typeof Spotify === 'undefined' || !Spotify.Player) {
            showToast('Spotify SDK not properly loaded. Please refresh the page.', true);
            return;
        }

        try {
            // Validate token before creating player
                    if (!token || token.trim() === '') {
                showToast('Invalid access token. Please try logging in again.', true);
                window.location.href = '/spotify/authorise';
                        return;
                    }

            // Create the Spotify player instance with error handling
            const playerConfig = {
                name: 'My Spotify Web App',
                getOAuthToken: (cb) => cb(token),
                volume: 0.5,
                enableMediaSession: true
            };

            // Add global error handler for uncaught promise rejections
            window.addEventListener('unhandledrejection', function(event) {
                // Handle CloudPlaybackClientError and item_before_load errors
                if (event.reason
                    && (event.reason.toString().includes('CloudPlaybackClientError')
                     || event.reason.toString().includes('item_before_load'))) {
                    event.preventDefault();
                    event.stopPropagation();
                    return false;
                }
            }, true);

            // Add specific error handler for CloudPlaybackClientError
            window.onerror = function(message, source, lineno, colno, error) {
                if (error && error.name === 'CloudPlaybackClientError') {
                    // Prevent the error from showing in console
                    return true;
                }
                return false;
            };

            player = new Spotify.Player(playerConfig);

            // Error handling with more specific actions
            player.addListener('initialization_error', ({ message }) => {
                // Don't show errors for known SDK issues
                if (!message.includes('item_before_load')
                    && !message.includes('CloudPlaybackClientError')) {
                    showToast(`Failed to initialize Spotify player: ${message}`, true);
                }
            });

            player.addListener('authentication_error', ({ message }) => {
                localStorage.removeItem('spotify_access_token');
                localStorage.removeItem('spotify_device_id');
                showToast('Authentication failed. Please log in again.', true);
                window.location.href = '/spotify/authorise';
            });

            player.addListener('account_error', ({ message }) => {
                if (message.includes('premium')) {
                    showToast('This feature requires Spotify Premium. Please upgrade your account.', true);
                } else {
                    showToast('Spotify account error. Please check your Premium subscription.', true);
                }
            });

            player.addListener('playback_error', ({ message }) => {
                // Only show errors that aren't related to the SDK's internal checks
                if (!message.includes('item_before_load')
                    && !message.includes('CloudPlaybackClientError')
                    && !message.includes('404')) {
                    showToast('Unable to play track. Please try again.', true);
                }
            });

            // Playback status updates with error handling
            player.addListener('player_state_changed', (state) => {
                if (state) {
                    try {
                    isPlaying = !state.paused;
                    updatePlayButtonState();

                        // Update current position
                        if (state.position !== undefined) {
                            currentPlaybackPosition = state.position;
                        }

                        if (state.track_window && state.track_window.current_track) {
                        const track = state.track_window.current_track;
                        updateSongInfo({
                            image: (track.album.images && track.album.images[0] && track.album.images[0].url) || 'images/spotify/default-song.png',
                            name: track.name,
                            artists: track.artists.map((a) => a.name).join(', ')
                        });

                            // Update previous button state based on current track position
                            const prevButton = document.getElementById('prev-button');
                            if (prevButton) {
                                if (isPlayingFromLikedSongs) {
                                    // If playing from liked songs check if we're at the first track
                                    const hasPrevious = currentTrackIndexInQueue > 0;
                                    prevButton.style.opacity = hasPrevious ? '1' : '0.5';
                                    prevButton.style.cursor = hasPrevious ? 'pointer' : 'not-allowed';
                                } else {
                                    // Enable button if we're more than 3 seconds into the track
                                    const hasPrevious = state.position > 3000;
                                    prevButton.style.opacity = hasPrevious ? '1' : '0.5';
                                    prevButton.style.cursor = hasPrevious ? 'pointer' : 'not-allowed';
                                }
                            }

                            // Update next button state
                            const nextButton = document.getElementById('next-button');
                            if (nextButton) {
                                if (isPlayingFromLikedSongs) {
                                    // If playing from liked songs, check if we're at the last track
                                    // eslint-disable-next-line max-len
                                    const hasNext = currentTrackIndexInQueue < currentLikedSongsQueue.length - 1;
                                    nextButton.style.opacity = hasNext ? '1' : '0.5';
                                    nextButton.style.cursor = hasNext ? 'pointer' : 'not-allowed';
                                } else {
                                    // Enable next button if we have a track playing
                                    nextButton.style.opacity = '1';
                                    nextButton.style.cursor = 'pointer';
                                }
                            }

                            // Enable all control buttons since we have a track
                            updateControlButtonsState(true);
                        } else {
                            // No track playing, disable all control buttons
                            updateControlButtonsState(false);
                        }
                    } catch (error) {
                        // Silently handle state update errors
                        // Disable controls on error
                        updateControlButtonsState(false);
                    }
                } else {
                    // No state, disable all control buttons
                    updateControlButtonsState(false);
                }
            });

            // Ready
            player.addListener('ready', async ({ device_id }) => {
                localStorage.setItem('spotify_device_id', device_id);
                showToast('Ready to play music!');

                // Sync playback controls state
                syncPlaybackState();

                // Try to transfer playback to this device
                try {
                    const hasSpotifyPremium = localStorage.getItem('isPremium') === 'true';
                    if (hasSpotifyPremium) {
                        await callSpotifyApi(`/me/player`, 'PUT', {
                            device_ids: [device_id],
                            play: false
                        });
                    } else {
                        showToast('Spotify Premium is required for playback.', true);
                    }
                } catch (err) {
                    if (err.message && err.message.includes('404')) {
                        showToast('No active device found. Please start playback from your Spotify app, then return here.', true);
                    } else if (err.message && err.message.includes('403')) {
                        showToast('Spotify Premium is required for playback.', true);
                    } else {
                        showToast('Unable to transfer playback. Please try again.', true);
                    }
                }

                // Get initial volume from Spotify
                player.getVolume().then((volume) => {
                    const volumeSlider = document.getElementById('volume-slider');
                    const volumeContainer = document.getElementById('volume-container');
                    if (volumeSlider && volumeContainer) {
                        const volumePercent = Math.round(volume * 100);
                        volumeSlider.value = volumePercent.toString();
                        volumeContainer.style.setProperty('--progress', `${volumePercent}%`);

                        // Update volume button appearance based on volume
                        const volumeButton = document.getElementById('volume-button');
                        if (volumeButton) {
                            if (volumePercent === 0) {
                                volumeButton.src = 'images/spotify/mute.png';
                                volumeButton.style.width = '15px';
                                volumeButton.style.marginLeft = '2.5px';
                                volumeButton.style.marginRight = '2.5px';
                            } else {
                                volumeButton.src = 'images/spotify/volumn.png';
                                volumeButton.style.width = '20px';
                                volumeButton.style.marginLeft = '0px';
                                volumeButton.style.marginRight = '0px';
                            }
                        }
                    }
                });
            });

            // Not ready
            player.addListener('not_ready', ({ device_id }) => {
                localStorage.removeItem('spotify_device_id');
                showToast('Device disconnected. Trying to reconnect...', true);
            });

            // Connect to the player with error handling and retries
            let retryCount = 0;
            const maxRetries = 3;

            const attemptConnect = () => {
            player.connect().then((success) => {
                if (success) {
                        showToast('Connected to Spotify!');
                    } else if (retryCount < maxRetries) {
                        retryCount++;
                        setTimeout(attemptConnect, 1000 * retryCount); // Exponential backoff
                } else {
                        showToast('Failed to connect to Spotify after multiple attempts. Please refresh the page.', true);
                }
            }).catch((error) => {
                    if (retryCount < maxRetries) {
                        retryCount++;
                        setTimeout(attemptConnect, 1000 * retryCount);
                    } else {
                        showToast('Connection error. Please check your internet connection and refresh.', true);
                    }
                });
            };

            attemptConnect();

        } catch (error) {
            showToast('Failed to create Spotify player. Please refresh the page.', true);
        }
    };

    // If SDK is already ready, call it immediately
    if (window.Spotify && window.Spotify.Player) {
        window.onSpotifyWebPlaybackSDKReady();
    }
}

function loadSpotifyScript(token, retryCount = 0) {
    // Define the global callback BEFORE loading the script
    window.onSpotifyWebPlaybackSDKReady = () => {
        initializeSpotifyPlayer(token);
    };

    const script = document.createElement('script');
    script.src = 'https://sdk.scdn.co/spotify-player.js';
    script.async = true;
    script.defer = true;

    script.onerror = (error) => {

        // Remove the failed script element
        if (script.parentNode) {
            script.parentNode.removeChild(script);
        }

        // Retry up to 3 times with increasing delays
        if (retryCount < 3) {
            const delay = (2 ** retryCount) * 1000; // Exponential backoff
            setTimeout(() => {
                loadSpotifyScript(token, retryCount + 1);
            }, delay);
        } else {
            // You might want to show an error message to the user here
            showToast('Unable to load Spotify player. Please check your internet connection and try again.', true);
        }
    };

    document.head.appendChild(script);
}

// Function to initialize the Spotify Web Playback SDK
function initializePlayer(token) {
    const hasSpotifyPremium = localStorage.getItem('isPremium') === 'true';

    // For premium users, initialize the player SDK
    if (hasSpotifyPremium) {
        // Check if script is already loaded
        if (window.Spotify && window.Spotify.Player) {
            initializeSpotifyPlayer(token);
            return;
        }

        // Check if script is already being loaded
        const existingScript = document.querySelector('script[src="https://sdk.scdn.co/spotify-player.js"]');
        if (existingScript) {
            // Wait for existing script to load
            existingScript.addEventListener('load', () => {
                initializeSpotifyPlayer(token);
            });
            existingScript.addEventListener('error', () => {
            });
            return;
        }

        loadSpotifyScript(token);

    }
    // For non-premium users, skip SDK initialization but
    // allow the rest of the app to work (fetch playlists, liked songs, etc.)
    // No return here! The rest of the app will enable basic features for non-premium users.
}

// Function to get user's recent track or a featured track
function getUserRecentOrFeaturedTracks() {
    // First try to get recently played
    return callSpotifyApi('/me/player/recently-played?limit=1')
        .then((data) => {
            if (data.items && data.items.length > 0) {
                return data.items[0].track.uri;
            }
            return null; // Return null when no tracks are found
        });
}

// Function to toggle playback
async function togglePlayback() {
    const hasSpotifyPremium = localStorage.getItem('isPremium') === 'true';

    if (!hasSpotifyPremium) {
        showToast('Spotify Premium is required to play music. Please upgrade your account to enjoy playback features.', true);
        return;
    }

    if (!localStorage.getItem('spotify_access_token')) {
        window.location.href = '/spotify/authorise';
        return;
    }

    if (!isPlaybackAvailable) {
        showToast('No song available to play. Select a song first.', true);
        return;
    }

    const deviceId = localStorage.getItem('spotify_device_id');
    if (isPlaying) {
        try {
            // Get current playback state before pausing
            const currentState = await callSpotifyApi('/me/player');
            if (currentState && currentState.progress_ms) {
                currentPlaybackPosition = currentState.progress_ms;
            }

        // Pause music
            await callSpotifyApi('/me/player/pause', 'PUT');
            // Update state immediately as the pause was successful
                isPlaying = false;
                updatePlayButtonState();
        } catch (error) {
            // For pause action, 404 usually means the track was already paused
            // or the SDK is doing its internal checks
            if (error.message.includes('404')
                || error.message.includes('CloudPlaybackClientError')
                || error.message.includes('item_before_load')) {
                // Still update state as the pause was likely successful
                isPlaying = false;
                updatePlayButtonState();
            } else {
                // Only show error for real failures
                showToast('Unable to pause playback. Please try again.', true);
            }
        }
    } else if (deviceId) {
        try {
            // Get current track info
            const currentState = await callSpotifyApi('/me/player');

            if (currentState && currentState.item) {
                // Resume playback at saved position
                await callSpotifyApi(`/me/player/play?device_id=${deviceId}`, 'PUT', {
                    uris: [currentState.item.uri],
                    position_ms: currentPlaybackPosition
                });
                isPlaying = true;
                updatePlayButtonState();
            } else {
                // Start playback of recent/featured track if no current track
                const recentTrack = await getUserRecentOrFeaturedTracks();
                if (!recentTrack) {
                    showToast('No tracks available to play');
                    isPlaybackAvailable = false;
                    updateControlButtonsState(false);
                    return;
                }
                await callSpotifyApi(`/me/player/play?device_id=${deviceId}`, 'PUT', {
                    uris: [recentTrack]
                });
                        isPlaying = true;
                        updatePlayButtonState();
            }
        } catch (error) {
            // Handle play errors
            if (!error.message.includes('404')
                && !error.message.includes('CloudPlaybackClientError')
                && !error.message.includes('item_before_load')) {
                showToast('Unable to start playback. Please try again.', true);
            }
        }
    } else {
        showToast('Playback device not ready. Please try again in a moment.', true);
    }
}

// Function to update shuffle button state based on current playback
async function updateShuffleButtonState() {
    const shuffleButton = document.getElementById('shuffle-button');
    if (!shuffleButton) return;

    if (!isPlaybackAvailable) {
        shuffleButton.src = 'images/spotify/shuffle-inactive.png';
        setShuffleButtonDimensions(shuffleButton, 'inactive');
        shuffleButton.style.cursor = 'not-allowed';
        shuffleButton.style.opacity = '0.5';
        return;
    }

    try {
        const state = await callSpotifyApi('/me/player');
        if (!state || !state.item) {
            shuffleButton.src = 'images/spotify/shuffle-inactive.png';
            setShuffleButtonDimensions(shuffleButton, 'inactive');
            shuffleButton.style.cursor = 'not-allowed';
            shuffleButton.style.opacity = '0.5';
            return;
        }

        shuffleButton.style.cursor = 'pointer';
        shuffleButton.style.opacity = '1';
        if (state.shuffle_state) {
            shuffleButton.src = 'images/spotify/shuffle-active.png';
            setShuffleButtonDimensions(shuffleButton, 'active');
        } else {
            shuffleButton.src = 'images/spotify/shuffle-inactive.png';
            setShuffleButtonDimensions(shuffleButton, 'inactive');
        }
    } catch (error) {
        if (!error.message.includes('404')) {
            shuffleButton.src = 'images/spotify/shuffle-inactive.png';
            setShuffleButtonDimensions(shuffleButton, 'inactive');
            shuffleButton.style.cursor = 'not-allowed';
            shuffleButton.style.opacity = '0.5';
        }
    }
}

// Function to skip to previous track
async function playPreviousTrack() {
    // Prevent rapid consecutive clicks
    if (prevTrackTimeout) {
        showToast('Please wait a moment before changing tracks.', true);
        return;
    }

    const hasSpotifyPremium = localStorage.getItem('isPremium') === 'true';
    if (!hasSpotifyPremium) {
        showToast('Spotify Premium is required to use this feature.', true);
        return;
    }

    try {
        // Set cooldown immediately
        prevTrackTimeout = setTimeout(() => {
            prevTrackTimeout = null;
        }, PREV_TRACK_DEBOUNCE);

        // Get current playback state
        const state = await callSpotifyApi('/me/player');
        if (!state) {
            showToast('Unable to get playback state.', true);
            return;
        }

        // Handle liked songs navigation
        if (isPlayingFromLikedSongs && currentLikedSongsQueue.length > 0) {
            if (currentTrackIndexInQueue > 0) {
                if (state.progress_ms > 3000) {
                    // If more than 3 seconds in, restart current track
                    await callSpotifyApi('/me/player/seek?position_ms=0', 'PUT');
                    // Clear the timeout to allow immediate next click
                    if (prevTrackTimeout) {
                        clearTimeout(prevTrackTimeout);
                        prevTrackTimeout = null;
                    }
                    // Show message that they can click again immediately
                    showToast('Track restarted - you can click again to go to previous track');
                } else {
                    currentTrackIndexInQueue--;
                    const prevTrack = currentLikedSongsQueue[currentTrackIndexInQueue];
                    // Update UI before API call for better responsiveness
                    updateSongInfo({
                        image: (prevTrack.album.images && prevTrack.album.images[0] && prevTrack.album.images[0].url) || 'images/spotify/default-song.png',
                        name: prevTrack.name,
                        artists: prevTrack.artists.map((artist) => artist.name).join(', ')
                    });
                    await playSong(prevTrack.uri, true);
                }
            } else {
                showToast('This is the first song in your liked songs.', true);
                return;
            }
        } else if (state.context && state.context.type === 'playlist') {
            // For playlist playback
            if (state.progress_ms > 3000) {
                // If more than 3 seconds in, restart current track
                await callSpotifyApi('/me/player/seek?position_ms=0', 'PUT');
                // Clear the timeout to allow immediate next click
                if (prevTrackTimeout) {
                    clearTimeout(prevTrackTimeout);
                    prevTrackTimeout = null;
                }
                // Show message that they can click again immediately
                showToast('Track restarted - you can click again to go to previous track');
            } else {
                // Update UI immediately with current track info for better responsiveness
                if (state.item) {
                    updateSongInfo({
                        image: (state.item.album.images && state.item.album.images[0] && state.item.album.images[0].url) || 'images/spotify/default-song.png',
                        name: state.item.name,
                        artists: state.item.artists.map((artist) => artist.name).join(', ')
                    });
                }

                // Go to previous track
                await callSpotifyApi('/me/player/previous', 'POST');

                // Get updated state immediately after track change
                const newState = await callSpotifyApi('/me/player');
                if (newState && newState.item) {
                    updateSongInfo({
                        image: (newState.item.album.images && newState.item.album.images[0] && newState.item.album.images[0].url) || 'images/spotify/default-song.png',
                        name: newState.item.name,
                        artists: newState.item.artists.map((artist) => artist.name).join(', ')
                    });
                }
            }
    } else {
            // For single tracks
            if (state.progress_ms > 3000) {
                await callSpotifyApi('/me/player/seek?position_ms=0', 'PUT');
                showToast('Restarted current track. Click again to go to previous track.');
            } else {
                showToast('Previous track is not available for single tracks.', true);
                return;
            }
        }

        // Update play button state
        isPlaying = true;
        updatePlayButtonState();

        // Update control buttons state immediately
        updateControlButtonsState(true);

        // Sync playback state in the background
        syncPlaybackState().catch(() => {
            // Silently handle sync errors to prevent UI disruption
        });
    } catch (error) {
        if (!error.message.includes('404')) {
            showToast('Unable to play previous track. Please try again.', true);
        }
    }
}

// Function to get next track index based on shuffle state
async function getNextTrackIndex(currentIndex, totalTracks) {
    try {
        const state = await callSpotifyApi('/me/player');
        const isShuffleOn = state && state.shuffle_state;

        if (isShuffleOn) {
            // Get a random index that's not the current one
            let nextIndex;
            do {
                nextIndex = Math.floor(Math.random() * totalTracks);
            } while (nextIndex === currentIndex && totalTracks > 1);
            return nextIndex;
        }
            // Sequential playback
            return (currentIndex + 1) % totalTracks;

    } catch (error) {
        // If we can't get shuffle state, default to sequential
        return (currentIndex + 1) % totalTracks;
    }
}

// Function to skip to next track
async function playNextTrack() {
    // Prevent rapid consecutive clicks
    if (nextTrackTimeout) {
        showToast('Please wait a moment before changing tracks.', true);
        return;
    }

    // Set cooldown immediately
    nextTrackTimeout = setTimeout(() => {
        nextTrackTimeout = null;
        isRepeatOneProcessing = false; // Reset the lock when cooldown expires
    }, NEXT_TRACK_DEBOUNCE);

    const hasSpotifyPremium = localStorage.getItem('isPremium') === 'true';
    if (!hasSpotifyPremium) {
        showToast('Spotify Premium is required to use this feature.', true);
        return;
    }

    try {
        // Get current playback state to check repeat and shuffle modes
        const currentState = await callSpotifyApi('/me/player');
        if (!currentState) {
            showToast('Unable to get playback state.', true);
            return;
        }

        // Store current repeat and shuffle states
        const currentRepeatState = currentState.repeat_state;
        const currentShuffleState = currentState.shuffle_state;

        // If repeat-1 (track) mode is on, replay the current track
        if (currentRepeatState === 'track') {
            // Check if we're already processing a repeat-1 action
            if (isRepeatOneProcessing) {
                return;
            }

            // Set the processing lock
            isRepeatOneProcessing = true;

            try {
                if (isPlayingFromLikedSongs && currentLikedSongsQueue.length > 0) {
                    const currentTrack = currentLikedSongsQueue[currentTrackIndexInQueue];
                    await playSong(currentTrack.uri, true);
                    updateSongInfo({
                        image: (currentTrack.album.images && currentTrack.album.images[0] && currentTrack.album.images[0].url) || 'images/spotify/default-song.png',
                        name: currentTrack.name,
                        artists: currentTrack.artists.map((artist) => artist.name).join(', ')
                    });
                } else {
                    // For non-liked songs, seek to start
                    await callSpotifyApi(`/me/player/seek?position_ms=0`, 'PUT');
                }

                // Ensure repeat state is maintained
                await callSpotifyApi('/me/player/repeat?state=track', 'PUT');
                const repeatButton = document.getElementById('repeat-button');
                if (repeatButton) {
                    repeatButton.src = 'images/spotify/repeat-1.png';
                    setRepeatButtonDimensions(repeatButton, 'repeat-1');
                }
                return;
            } catch (error) {
                // Reset the processing lock on error
                isRepeatOneProcessing = false;
                throw error;
            }
        }

        if (isPlayingFromLikedSongs && currentLikedSongsQueue.length > 0) {
            // Get next track index based on shuffle state
            // eslint-disable-next-line max-len
            currentTrackIndexInQueue = await getNextTrackIndex(currentTrackIndexInQueue, currentLikedSongsQueue.length);
            const nextTrack = currentLikedSongsQueue[currentTrackIndexInQueue];
            await playSong(nextTrack.uri, true);
            updateSongInfo({
                image: (nextTrack.album.images && nextTrack.album.images[0] && nextTrack.album.images[0].url) || 'images/spotify/default-song.png',
                name: nextTrack.name,
                artists: nextTrack.artists.map((artist) => artist.name).join(', ')
            });
        } else if (currentState.context && currentState.context.type === 'playlist') {
            // Get playlist details to check if we're at the last track
            const playlistId = currentState.context.uri.split(':')[2];
            const playlist = await callSpotifyApi(`/playlists/${playlistId}`);
            const currentTrackNumber = currentState.item.track_number;
            const totalTracks = playlist.tracks.total;

            // If at last track and not shuffling or repeating
            if (currentTrackNumber === totalTracks && !currentShuffleState && currentRepeatState === 'off') {
                // Restart playlist from beginning
                const deviceId = localStorage.getItem('spotify_device_id');
                await callSpotifyApi(`/me/player/play?device_id=${deviceId}`, 'PUT', {
                    context_uri: currentState.context.uri,
                    offset: { position: 0 }
                });
                showToast('Restarting playlist from beginning');
            } else {
                // Use Spotify's default next behavior
                await callSpotifyApi('/me/player/next', 'POST');
            }

            // Get the new track info after skipping
            const newState = await callSpotifyApi('/me/player');
            if (newState && newState.item) {
                updateSongInfo({
                    image: (newState.item.album.images && newState.item.album.images[0] && newState.item.album.images[0].url) || 'images/spotify/default-song.png',
                    name: newState.item.name,
                    artists: newState.item.artists.map((artist) => artist.name).join(', ')
                });
            }
        } else {
            showToast('Next track is not available for single tracks.', true);
            return;
        }

        // Update play button state after successful track change
        isPlaying = true;
        updatePlayButtonState();

        // Restore repeat and shuffle states
        if (currentRepeatState) {
            await callSpotifyApi(`/me/player/repeat?state=${currentRepeatState}`, 'PUT');
            const repeatButton = document.getElementById('repeat-button');
            if (repeatButton) {
                switch (currentRepeatState) {
                    case 'off':
                        repeatButton.src = 'images/spotify/repeat-inactive.png';
                        setRepeatButtonDimensions(repeatButton, 'inactive');
                        break;
                    case 'context':
                        repeatButton.src = 'images/spotify/repeat-active.png';
                        setRepeatButtonDimensions(repeatButton, 'active');
                        break;
                    case 'track':
                        repeatButton.src = 'images/spotify/repeat-1.png';
                        setRepeatButtonDimensions(repeatButton, 'repeat-1');
                        break;
                }
            }
        }

        if (currentShuffleState !== undefined) {
            await callSpotifyApi(`/me/player/shuffle?state=${currentShuffleState}`, 'PUT');
        const shuffleButton = document.getElementById('shuffle-button');
        if (shuffleButton) {
                shuffleButton.src = currentShuffleState ? 'images/spotify/shuffle-active.png' : 'images/spotify/shuffle-inactive.png';
                setShuffleButtonDimensions(shuffleButton, currentShuffleState ? 'active' : 'inactive');
            }
        }

        // Update control buttons state and sync with Spotify
        await syncPlaybackState();
    } catch (error) {
        if (!error.message.includes('404')) {
            showToast('Unable to play next track. Please try again.', true);
        }
    }
}

// Function to toggle repeat state
async function toggleRepeat() {
    const hasSpotifyPremium = localStorage.getItem('isPremium') === 'true';
    if (!hasSpotifyPremium) {
        showToast('Spotify Premium is required to use this feature.', true);
        const repeatButton = document.getElementById('repeat-button');
        if (repeatButton) {
            repeatButton.src = 'images/spotify/repeat-inactive.png';
            setRepeatButtonDimensions(repeatButton, 'inactive');
            repeatButton.style.cursor = 'not-allowed';
            repeatButton.style.opacity = '0.5';
        }
        return;
    }

    const repeatButton = document.getElementById('repeat-button');
    const shuffleButton = document.getElementById('shuffle-button');
    if (!repeatButton || !shuffleButton) return;

    if (!isPlaybackAvailable) {
        repeatButton.src = 'images/spotify/repeat-inactive.png';
        setRepeatButtonDimensions(repeatButton, 'inactive');
        repeatButton.style.cursor = 'not-allowed';
        repeatButton.style.opacity = '0.5';
        showToast('No playback available to repeat.', true);
        return;
    }

    try {
        // Get current state first
        const state = await callSpotifyApi('/me/player');
        if (!state || !state.item) {
            repeatButton.src = 'images/spotify/repeat-inactive.png';
            setRepeatButtonDimensions(repeatButton, 'inactive');
            repeatButton.style.cursor = 'not-allowed';
            repeatButton.style.opacity = '0.5';
            showToast('No song is currently playing.', true);
            return;
        }

        // Check if shuffle is on before enabling repeat
        if (state.repeat_state === 'off' && state.shuffle_state) {
            showToast('Please turn off shuffle mode before enabling repeat.', true);
            repeatButton.style.cursor = 'not-allowed';
            return;
        }

        let nextState;
        // Current states: 'off', 'context' (playlist/album), 'track' (single track)
        switch (state.repeat_state) {
            case 'off':
                nextState = 'context';
                break;
            case 'context':
                nextState = 'track';
                break;
            case 'track':
                nextState = 'off';
                break;
            default:
                nextState = 'off';
        }

        // Update repeat state through API first
        await callSpotifyApi('/me/player/repeat?state=' + nextState, 'PUT');

        // Only update UI after successful API call
        switch (nextState) {
            case 'off':
                repeatButton.src = 'images/spotify/repeat-inactive.png';
                setRepeatButtonDimensions(repeatButton, 'inactive');
                // Re-enable shuffle button when repeat is off
                shuffleButton.style.opacity = '1';
                shuffleButton.style.cursor = 'pointer';
                break;
            case 'context':
                repeatButton.src = 'images/spotify/repeat-active.png';
                setRepeatButtonDimensions(repeatButton, 'active');
                // Disable shuffle button when repeat is on
                shuffleButton.src = 'images/spotify/shuffle-inactive.png';
                setShuffleButtonDimensions(shuffleButton, 'inactive');
                shuffleButton.style.opacity = '0.5';
                shuffleButton.style.cursor = 'not-allowed';
                await callSpotifyApi('/me/player/shuffle?state=false', 'PUT');
                break;
            case 'track':
                repeatButton.src = 'images/spotify/repeat-1.png';
                setRepeatButtonDimensions(repeatButton, 'repeat-1');
                // Disable shuffle button when repeat is on
                shuffleButton.src = 'images/spotify/shuffle-inactive.png';
                setShuffleButtonDimensions(shuffleButton, 'inactive');
                shuffleButton.style.opacity = '0.5';
                shuffleButton.style.cursor = 'not-allowed';
                await callSpotifyApi('/me/player/shuffle?state=false', 'PUT');
                break;
        }

        // Update button appearance
        repeatButton.style.cursor = 'pointer';
        repeatButton.style.opacity = '1';

        // Show feedback to user
        const stateMessages = {
            off: 'Repeat is off',
            context: 'Repeating playlist/album',
            track: 'Repeating current track'
        };
        showToast(stateMessages[nextState]);

    } catch (error) {
        if (!error.message.includes('404')) {
            showToast('Unable to change repeat mode. Please try again.', true);
            // Reset to inactive state on error
            repeatButton.src = 'images/spotify/repeat-inactive.png';
            setRepeatButtonDimensions(repeatButton, 'inactive');
            repeatButton.style.cursor = 'not-allowed';
            repeatButton.style.opacity = '0.5';
        }
    }
}

// Function to update repeat button state based on current playback
async function updateRepeatButtonState() {
    const repeatButton = document.getElementById('repeat-button');
    if (!repeatButton) return;

    if (!isPlaybackAvailable) {
        repeatButton.src = 'images/spotify/repeat-inactive.png';
        setRepeatButtonDimensions(repeatButton, 'inactive');
        repeatButton.style.cursor = 'not-allowed';
        repeatButton.style.opacity = '0.5';
        return;
    }

    try {
        const state = await callSpotifyApi('/me/player');
        if (!state || !state.item) {
            repeatButton.src = 'images/spotify/repeat-inactive.png';
            setRepeatButtonDimensions(repeatButton, 'inactive');
            repeatButton.style.cursor = 'not-allowed';
            repeatButton.style.opacity = '0.5';
            return;
        }

        repeatButton.style.cursor = 'pointer';
        repeatButton.style.opacity = '1';

        // Update button image based on current state
        switch (state.repeat_state) {
            case 'off':
                repeatButton.src = 'images/spotify/repeat-inactive.png';
                setRepeatButtonDimensions(repeatButton, 'inactive');
                break;
            case 'context':
                repeatButton.src = 'images/spotify/repeat-active.png';
                setRepeatButtonDimensions(repeatButton, 'active');
                break;
            case 'track':
                repeatButton.src = 'images/spotify/repeat-1.png';
                setRepeatButtonDimensions(repeatButton, 'repeat-1');
                break;
            default:
                repeatButton.src = 'images/spotify/repeat-inactive.png';
                setRepeatButtonDimensions(repeatButton, 'inactive');
        }
    } catch (error) {
        if (!error.message.includes('404')) {
            repeatButton.src = 'images/spotify/repeat-inactive.png';
            setRepeatButtonDimensions(repeatButton, 'inactive');
            repeatButton.style.cursor = 'not-allowed';
            repeatButton.style.opacity = '0.5';
        }
    }
}

// Initialize Spotify button based on authentication status
function initializeSpotifyButton() {
    const spotifyButton = document.getElementById('spotify-container');
    const storedAccessToken = getSpotifyAccessToken();

    if (storedAccessToken) {
        spotifyButton.innerHTML = `
        <div id="spotify-control">
            <div class="spotify-header">
                <img class="logout-button" src="images/spotify/log-out.png" alt="Logout" onclick="logoutSpotify()" title="Logout from Spotify"/>
                <div class="spotify-logo">
                    <img src="images/spotify/spotify-logo.png" alt="spotify-logo"/>
                    <span class="spotify-text">Spotify</span>
                </div>
                <img class="minimize-button" src="images/spotify/minimize.png" alt="Minimize" onclick="toggleSpotifyVisibility()" title="Minimize Spotify"/>
            </div>

            <div class="search-section">
                <div class="search-button" onclick="show_search()" title="Search Songs">
                    <img class="search-icon" src="images/spotify/search/search.png" alt="search-icon"/>
                    <span class="search-text">Search Songs</span>
                </div>
                <div class="playlist-button" onclick="show_library()" title="View Playlists">
                    <img class="playlist-icon" src="images/spotify/playlist/playlist.png" alt="playlist-icon"/>
                    <span class="playlist-text">My Playlists</span>
                </div>
            </div>
            <div id="search-container">
                <div class="search-box">
                    <img class="search-song-icon" src="images/spotify/search/search.png" alt="search-icon" title="Search"/>
                    <input
                        type="text"
                        class="search-input"
                        placeholder="What do you want to listen to?"
                        onkeydown="handleSearchKeydown(event)"
                        oninput="handleSearchInput(event)"
                        title="Search songs"
                    />
                    <img class="search-x-icon" src="images/spotify/search/x.png" alt="search-x-icon" title="Clear search"/>
                </div>
                <div id="sort-song-container">
                    <button class="sort-button liked-songs" onclick="toggleLikedSongs()" title="Show Liked Songs">
                        <img src="images/spotify/search/check.png" alt="Liked Songs" style="opacity: 0;"/>
                        Liked Songs
                    </button>
                    <button class="sort-button popularity" onclick="togglePopularitySort()" title="Sort by Popularity">
                        <img src="images/spotify/search/arrow-down.png" alt="Sort by Popularity"/>
                        Popularity
                    </button>
                </div>
                <div id="search-content">
                </div>
            </div>
            <div class="song-container">
                <div class="song-info">
                    <img class="album-art" src="images/spotify/default-song.png" alt="default-song"/>
                    <div class="song-details">
                        <div class="song-title">Welcome to Spotify</div>
                        <div class="artist-name">Select a song to start playing</div>
                    </div>
                </div>
                <div class="controls" style="position: relative;">
                    <div id="volume-container" style="display: inline-block; position: relative;">
                        <img class="control-button" id="volume-button" src="images/spotify/volumn.png" alt="volume" onclick="toggleMute()" title="Mute/Unmute"/>
                        <input type="range" id="volume-slider" class="custom-volume-slider" min="0" max="100" value="50" style="position: absolute; left: 50%; top: -98px; transform: translateX(-50%) rotate(180deg); z-index: 10;" title="Adjust Volume">
                    </div>
                    <img class="control-button" id="shuffle-button" src="images/spotify/shuffle-inactive.png" alt="shuffle" onclick="toggleShuffle()" title="Toggle Shuffle"/>
                    <img class="control-button" id="prev-button" src="images/spotify/prev.png" alt="prev-song" onclick="playPreviousTrack()" title="Previous Track"/>
                    <img class="control-button main-button" id="play-button" src="images/spotify/pause.png" alt="pause/play" onclick="togglePlayback()" title="Play/Pause"/>
                    <img class="control-button" id="next-button" src="images/spotify/next.png" alt="next-song" onclick="playNextTrack()" title="Next Track"/>
                    <img class="control-button" id="repeat-button" src="images/spotify/repeat-inactive.png" alt="repeat" onclick="toggleRepeat()" title="Toggle Repeat"/>
                    <img class="control-button share-button" id="share-button" src="images/spotify/share.png" alt="share" title="Share Song"/>
                </div>
            </div>
            <div id="playlist-container">
                <button id="sort-playlist-button" onclick="toggleSortDropdown(event)" style="display: flex; align-items: center; gap: 2px; margin-top: 5px; margin-bottom: 1px;" title="Sort Playlists">
                    <img src="images/spotify/playlist/sort-1.png" alt="sort-1" style="width: 15px; height: 10px;"/>
                    <img src="images/spotify/playlist/sort-2.png" alt="sort-2" style="width: 16px; height: 16px;"/>
                </button>
                ${createSortDropdownHTML()}
                <div id="playlist-content">
                </div>
            </div>
        </div>
        `;

        // Initialize the Spotify Web Playback SDK
        initializePlayer(storedAccessToken);

        // Add click event for playing music only to the play button
        const playBtn = document.getElementById('play-button');
        if (playBtn) {
            playBtn.onclick = togglePlayback;
        }
    } else {
        spotifyButton.innerHTML = `<button id="spotify-button" title="Connect to Spotify">Click To Connect To Spotify</button>`;

        // Add click event for authorization
        const button = document.getElementById('spotify-button');
        if (button) {
            button.onclick = () => {
                window.location.href = "/spotify/authorise";
            };
        }
    }
}

// Function to refresh the access token when it expires
async function refreshAccessToken() {
    const storedRefreshToken = getSpotifyRefreshToken();
    if (!storedRefreshToken) {
        throw new Error('No refresh token available');
    }

    try {
        const response = await fetch(`/spotify/refresh_token?refresh_token=${storedRefreshToken}`);
        if (!response.ok) {
            throw new Error('Failed to refresh token');
        }
        const data = await response.json();

        // Store the new access token using cookie storage
        setCookie(SPOTIFY_ACCESS_TOKEN_KEY, data.access_token, 60); // 1 hour
        localStorage.setItem('spotify_access_token', data.access_token); // Backward compatibility

        return data.access_token;
    } catch (error) {
        // Clear tokens and redirect to auth
        clearSpotifyTokens();
        window.location.href = '/spotify/authorise';
        throw error;
    }
}

// Function to make authenticated requests to Spotify API
window.callSpotifyApi = async function (endpoint, method = 'GET', body = null) {
    let token = getSpotifyAccessToken();
    if (!token) {
        throw new Error('No access token available');
    }

    const options = {
        method: method,
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    };

    if (body && (method === 'PUT' || method === 'POST')) {
        options.body = JSON.stringify(body);
    }

    try {
        let response = await fetch(`https://api.spotify.com/v1${endpoint}`, options);

        // If token expired, try refreshing it once
        if (response.status === 401) {
            try {
                token = await refreshAccessToken();
                options.headers.Authorization = `Bearer ${token}`;
                response = await fetch(`https://api.spotify.com/v1${endpoint}`, options);
                // If still unauthorized after refresh, clear tokens and redirect
                if (response.status === 401) {
                    localStorage.removeItem('spotify_access_token');
                    localStorage.removeItem('spotify_refresh_token');
                    window.location.href = '/spotify/authorise';
                    return null;
                }
            } catch (refreshError) {
                localStorage.removeItem('spotify_access_token');
                localStorage.removeItem('spotify_refresh_token');
                window.location.href = '/spotify/authorise';
                return null;
            }
        }

        // Handle 403 Forbidden (usually premium-only features)
        if (response.status === 403) {
            if (endpoint.includes('/me/player/play')) {
                throw new Error('403: Premium required for playback');
            }
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        // Return empty object for 204 No Content responses
        if (response.status === 204) {
            return {};
        }

        // Only try to parse JSON if there's content
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
        const data = await response.json();
        return data;
        }

        // Return empty object for non-JSON responses
        return {};
    } catch (error) {
        if (error.message.includes('401')) {
            window.location.href = '/spotify/authorise';
        }
        throw error;
    }
};

function renderPlaylists() {
    const playlistContainer = document.getElementById('playlist-content');
    if (!playlistContainer) return;

    // Get sort options from Vue
    const vue = window.vueinst;
    let sorted = [...allPlaylists];

    // Sort by field
    if (vue && vue.sortField === 'Title') {
        sorted.sort((a, b) => a.name.localeCompare(b.name));
    } else if (vue && vue.sortField === 'Track Number') {
        sorted.sort((a, b) => (a.tracks.total || 0) - (b.tracks.total || 0));
    }

    // Sort order
    if (vue && vue.sortOrder === 'Descending') {
        sorted.reverse();
    }

    // Render
    const playlistsHTML = sorted.map((playlist) => `
        <div class="playlist-item" onclick="playPlaylist('${playlist.id}')">
            <div class="playlist-cover-container">
                <img src="${(playlist.images && playlist.images[0] && playlist.images[0].url) || 'images/spotify/default-playlist.png'}"
                     alt="${playlist.name}"
                     class="playlist-cover">
                <div class="play-now-overlay">
                    <img src="images/spotify/playlist/play-now.png" alt="Play Now"/>
                </div>
            </div>
            <div class="playlist-info">
                <h3>${playlist.name}</h3>
                <p>${playlist.tracks.total} tracks</p>
            </div>
        </div>
    `).join('');

    playlistContainer.innerHTML = playlistsHTML;
}

async function displayPlaylists() {
    const playlistContent = document.getElementById('playlist-content');
    const sortButton = document.getElementById('sort-playlist-button');
    if (!playlistContent) return;

    try {
        // Check if user has developer access first
        try {
            await callSpotifyApi('/me/playlists?limit=1');
        } catch (error) {
            if (error.message.includes('403')) {
                // Always show error message for playlists for non-developer users
                playlistContent.innerHTML = '<div class="error-message">This account is not added to Spotify Developer Dashboard. Please contact the administrator.</div>';
                // Disable sort button on error
                if (sortButton) {
                    sortButton.style.opacity = '0.5';
                    sortButton.style.cursor = 'not-allowed';
                    sortButton.onclick = (e) => {
                        e.stopPropagation();
                        return false;
                    };
                }
                return;
            }
        }

        const playlists = await callSpotifyApi('/me/playlists?limit=50');
        if (playlists && playlists.items) {
            allPlaylists = playlists.items;
            if (allPlaylists.length === 0) {
                playlistContent.innerHTML = '<div class="error-message">No playlists found. Create a playlist to see it here!</div>';
                // Disable sort button when no playlists
                if (sortButton) {
                    sortButton.style.opacity = '0.5';
                    sortButton.style.cursor = 'not-allowed';
                    sortButton.onclick = (e) => {
                        e.stopPropagation();
                        return false;
                    };
                }
                return;
            }
            // Enable sort button when playlists exist
            if (sortButton) {
                sortButton.style.opacity = '1';
                sortButton.style.cursor = 'pointer';
                sortButton.onclick = toggleSortDropdown;
            }
            renderPlaylists();
        } else {
            throw new Error('Invalid playlist data received');
        }
    } catch (error) {
        // Always show error message for playlists
        playlistContent.innerHTML = '<div class="error-message">Failed to load songs</div>';
        // Disable sort button on error
        if (sortButton) {
            sortButton.style.opacity = '0.5';
            sortButton.style.cursor = 'not-allowed';
            sortButton.onclick = (e) => {
                e.stopPropagation();
                return false;
            };
        }
    }
}

// Add observer to monitor song info changes
const songObserver = new MutationObserver(checkTextOverflow);
const songInfo = document.querySelector('.song-info');
if (songInfo) {
    songObserver.observe(songInfo, {
        childList: true,
        subtree: true,
        characterData: true
    });
}

// Function to initialize basic features for non-premium users
async function initializeBasicFeatures() {
    const hasSpotifyPremium = localStorage.getItem('isPremium') === 'true';
    const searchButton = document.getElementsByClassName('search-button')[0];
    const playlistButton = document.getElementsByClassName('playlist-button')[0];

    // Initially disable both buttons until we verify access
    if (searchButton) {
        searchButton.style.opacity = '0.5';
        searchButton.style.cursor = 'not-allowed';
        searchButton.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
        };
    }
    if (playlistButton) {
        playlistButton.style.opacity = '0.5';
        playlistButton.style.cursor = 'not-allowed';
        playlistButton.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
        };
    }

    // Show the default view for non-premium users
    const songContainer = document.querySelector('.song-container');
    if (songContainer) {
        songContainer.style.display = 'block';
    }

    // Initially set isPlaying to false and update button state
    isPlaying = false;
    updatePlayButtonState();

    // Check if user has developer access first
    try {
        await callSpotifyApi('/me/tracks?limit=1');
        // If we get here, user has dev access
        if (!hasSpotifyPremium) {
            // Show premium required message for dev users without premium
            updateSongInfo({
                image: 'images/spotify/default-song.png',
                name: 'Premium Required',
                artists: 'Upgrade to Spotify Premium to play music'
            });
            // Disable all control buttons for non-premium users
            updateControlButtonsState(false);
            // Show toast and enable buttons after delay
            showToast('Spotify Premium is required to play music. Please upgrade your account to enjoy playback features.', true);
            setTimeout(() => {
                if (searchButton) {
                    searchButton.style.opacity = '1';
                    searchButton.style.cursor = 'pointer';
                    searchButton.onclick = show_search;
                }
                if (playlistButton) {
                    playlistButton.style.opacity = '1';
                    playlistButton.style.cursor = 'pointer';
                    playlistButton.onclick = show_library;
                }
            }, 1000);
        } else {
            // Premium user with dev access
            updateSongInfo({
                image: 'images/spotify/default-song.png',
                name: 'Ready to Play',
                artists: 'Select a song to start playing'
            });
            // Initially disable controls until a song is selected
            updateControlButtonsState(false);
            // Show toast and enable buttons after delay
            showToast('Ready to play music!');
            setTimeout(() => {
                if (searchButton) {
                    searchButton.style.opacity = '1';
                    searchButton.style.cursor = 'pointer';
                    searchButton.onclick = show_search;
                }
                if (playlistButton) {
                    playlistButton.style.opacity = '1';
                    playlistButton.style.cursor = 'pointer';
                    playlistButton.onclick = show_library;
                }
            }, 1000);
        }
    } catch (error) {
        if (error.message.includes('403')) {
            // Not added to Spotify dev
            updateSongInfo({
                image: 'images/spotify/default-song.png',
                name: 'Account Not Added to Developer Dashboard',
                artists: 'Please contact the administrator to add this account'
            });
            // Disable controls for non-dev users
            updateControlButtonsState(false);
            // Show toast and keep buttons disabled
            showToast('Account Not Added to Developer Dashboard. Please contact the administrator to add this account', true);
            // Keep search and playlist buttons disabled and show message on click
            if (searchButton) {
                searchButton.style.opacity = '0.5';
                searchButton.style.cursor = 'not-allowed';
                searchButton.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    showToast('Account Not Added to Developer Dashboard. Please contact the administrator.', true);
                };
            }
            if (playlistButton) {
                playlistButton.style.opacity = '0.5';
                playlistButton.style.cursor = 'not-allowed';
                playlistButton.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    showToast('Account Not Added to Developer Dashboard. Please contact the administrator.', true);
                };
            }
        }
    }
}

// Make Spotify-related methods globally available
function makeSpotifyMethodsGlobal() {
    // Always make methods global (no longer depends on Vue)
        window.show_library = function () {
            const library = document.getElementsByClassName('playlist-button')[0];
            const mainPlaylistContainer = document.getElementById('playlist-container');
            const searchButton = document.getElementsByClassName('search-button')[0];
            const mainSearchContainer = document.getElementById('search-container');
            const songContainer = document.querySelector('.song-container');

            if (library.classList.contains("active")) {
                // Hide playlist, show song container
                library.classList.remove("active");
                if (mainPlaylistContainer) {
                    mainPlaylistContainer.style.display = 'none';
                }
                if (songContainer) {
                    songContainer.style.display = 'block';
                }
            } else {
                // Show playlist, hide song container
                library.classList.add("active");
                if (mainPlaylistContainer) {
                    mainPlaylistContainer.style.display = 'block';
                }
                if (songContainer) {
                    songContainer.style.display = 'none';
                }
                // Always hide search and remove its active state
                searchButton.classList.remove("active");
                if (mainSearchContainer) {
                    mainSearchContainer.style.display = 'none';
                }
                // Call displayPlaylists when showing the playlist container
                displayPlaylists();
            }
        };

        window.show_search = function() {
            const searchButton = document.getElementsByClassName('search-button')[0];
            const mainSearchContainer = document.getElementById('search-container');
            const playlistButton = document.getElementsByClassName('playlist-button')[0];
            const mainPlaylistContainer = document.getElementById('playlist-container');
            const songContainer = document.querySelector('.song-container');

            if (searchButton.classList.contains("active")) {
                // Hide search, show song container
                searchButton.classList.remove("active");
                if (mainSearchContainer) {
                    mainSearchContainer.style.display = 'none';
                }
                if (songContainer) {
                    songContainer.style.display = 'block';
                }
            } else {
                // Show search, hide playlist and song container
                searchButton.classList.add("active");
                if (mainSearchContainer) {
                    mainSearchContainer.style.display = 'block';
                    // Clear any existing search results
                    const searchContent = document.getElementById('search-content');
                    if (searchContent) {
                        searchContent.innerHTML = '';
                    }
                    // Reset search input
                    const searchInput = document.querySelector('.search-input');
                    if (searchInput) {
                        searchInput.value = '';
                    }
                    // Hide X icon
                    const xIcon = document.querySelector('.search-x-icon');
                    if (xIcon) {
                        xIcon.style.display = 'none';
                    }
                    // Reset liked songs button
                    isLikedSongsOnly = false;
                    const likedSongsButton = document.querySelector('.sort-button.liked-songs');
                    if (likedSongsButton) {
                        likedSongsButton.classList.remove('active');
                        const likedSongsImg = likedSongsButton.querySelector('img');
                        if (likedSongsImg) {
                            likedSongsImg.style.opacity = '0';
                        }
                    }
                    // Initialize popularity button as unavailable
                    currentTracks = [];
                    updatePopularityButtonState(false);
                }
                if (songContainer) {
                    songContainer.style.display = 'none';
                }
                // Always hide playlist and remove its active state
                playlistButton.classList.remove("active");
                if (mainPlaylistContainer) {
                    mainPlaylistContainer.style.display = 'none';
                }
            }
        };

                        window.selectSortField = function(field) {
            if (window.vueinst) {
                window.vueinst.sortField = field;
                if (window.renderPlaylists) window.renderPlaylists();
                updateSortDropdown();
            }
        };

        window.selectSortOrder = function(order) {
            if (window.vueinst) {
                window.vueinst.sortOrder = order;
                if (window.renderPlaylists) window.renderPlaylists();
                updateSortDropdown();
            }
        };

        window.toggleSortDropdown = function(event) {
            event.stopPropagation(); // Prevent click from bubbling to document
            if (window.vueinst) {
                window.vueinst.sortDropdownVisible = !window.vueinst.sortDropdownVisible;
                setTimeout(updateSortDropdown, 0);
            }
        };

        // Close dropdown when clicking outside
        document.addEventListener('click', function(event) {
            if (window.vueinst && window.vueinst.sortDropdownVisible) {
                const dropdown = document.getElementById('sort-dropdown');
                const sortButton = document.getElementById('sort-playlist-button');

                if (dropdown && sortButton
                    && !dropdown.contains(event.target)
                    && event.target !== sortButton
                    && !sortButton.contains(event.target)) {
                    window.vueinst.sortDropdownVisible = false;
                    updateSortDropdown();
                }
            }
        });
}

/* global Vue */
// Initialize Vue instance when DOM is ready
let vueinst = null;

// Create Vue instance for Spotify functionality
function initializeVue() {
    if (typeof Vue !== 'undefined' && document.querySelector('#spotify-container')) {
        vueinst = new Vue({
            el: '#spotify-container',
            data: {
                activeSource: 'pexels',
                profilePopupVisible: false,
                showPlaylist: false,
                sortDropdownVisible: false,
                sortField: 'Title',
                sortOrder: 'Ascending'
            },
            methods: {
                toggleProfilePopup(event) {
                    if (event) {
                        event.preventDefault();
                        event.stopPropagation();
                    }
                    this.profilePopupVisible = !this.profilePopupVisible;
                }
            }
        });

        // Make Vue instance globally available
        window.vueinst = vueinst;
        return true;
    }
    return false;
}

// Try to initialize Vue immediately
if (!initializeVue()) {
    // If it fails, wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeVue);
    } else {
        // DOM is already loaded, try again in next tick
        setTimeout(initializeVue, 0);
    }
}

// Initial check
window.addEventListener('DOMContentLoaded', async () => {
    try {
        const response = await fetch('/users/me');
        if (response.ok) {
            const user = await response.json();

            // Check if this is a different user than the previously stored one
            const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
            if (storedUser.id && user.id && storedUser.id !== user.id) {
                // Different user detected - clear only the previous user's state
                // eslint-disable-next-line no-console
                console.log('Different user detected, clearing previous user state for user:', storedUser.id);
                clearUserState(storedUser.id);
                // Store the new user data
                localStorage.setItem('user', JSON.stringify(user));
            } else if (!storedUser.id) {
                // No previous user stored, store current user
                localStorage.setItem('user', JSON.stringify(user));
            }

            // Try to restore user's Spotify state if they have Spotify connected
            if (user.spotify_id && user.id) {
                // Restore Spotify state after a short delay to ensure DOM is ready
                setTimeout(() => {
                    restoreUserSpotifyState(user.id);
                }, 500);
            }

            if (!user.spotify_id) {
                clearSpotifyTokens();
            } else {
                if (user.spotifyIsPremium !== undefined) {
                    // Update both cookie and localStorage for premium status
                    setCookieDays(SPOTIFY_PREMIUM_KEY, user.spotifyIsPremium ? 'true' : 'false', TOKEN_COOKIE_EXPIRY_DAYS);
                    localStorage.setItem('isPremium', user.spotifyIsPremium ? 'true' : 'false');
                }
                // Automatically fetch token if missing
                if (!getSpotifyAccessToken()) {
                    try {
                        const tokenRes = await fetch('/spotify/my-tokens');
                        if (tokenRes.ok) {
                            const tokens = await tokenRes.json();
                            storeSpotifyTokens(
                                tokens.access_token,
                                tokens.refresh_token,
                                user.spotifyIsPremium
);
                            // Optionally reload to trigger the rest of your logic
                            window.location.reload();
                            return; // Prevent double init
                        }
                    } catch (err) {
                        // Optionally handle error (e.g., show a message)
                    }
                }
                // End auto-fetch block
            }
        }
    } catch (e) {
        // Not authenticated or error, clear tokens
        clearSpotifyTokens();
    }
    // Now call your original logic
    initializeSpotifyButton();
    makeSpotifyMethodsGlobal();
    setTimeout(async () => {
        checkTextOverflow();
        // Initialize basic features for all users
        try {
            await initializeBasicFeatures();
        } catch (error) {
            if (error.message.includes('401')) {
                // Only redirect for auth errors if user has spotify_id and explicitly needs reauth
                showToast('Spotify authentication may be needed. Please try connecting to Spotify if needed.', true);
            } else {
                showToast('Some features may be unavailable. Please try again later.', true);
            }
        }
    }, 100);
});

function handleSearchKeydown(event) {
    const searchInput = event.target;
    if (event.key === 'Enter') {
        // Trigger immediate search on Enter
        clearTimeout(searchTimeout);
        performSearch(searchInput.value);
    } else if (event.key === 'Escape') {
        // Clear search on Escape
        searchInput.value = '';
        document.getElementById('search-content').innerHTML = '';
        // Hide the X icon when clearing
        const xIcon = document.querySelector('.search-x-icon');
        if (xIcon) {
            xIcon.style.display = 'none';
        }

        // Reset Liked Songs button
        isLikedSongsOnly = false;
        const likedSongsButton = document.querySelector('.sort-button.liked-songs');
        if (likedSongsButton) {
            likedSongsButton.classList.remove('active');
            const likedSongsImg = likedSongsButton.querySelector('img');
            if (likedSongsImg) {
                likedSongsImg.style.opacity = '0';
            }
        }

        // Reset Popularity button
        sortByPopularityAsc = false;
        const popularityButton = document.querySelector('.sort-button.popularity');
        if (popularityButton) {
            popularityButton.classList.remove('active');
            const popularityImg = popularityButton.querySelector('img');
            if (popularityImg) {
                popularityImg.src = 'images/spotify/search/arrow-down.png';
                popularityImg.style.opacity = '1';
            }
        }
    }
}

function handleSearchInput(event) {
    const searchInput = event.target;
    // Show/hide X icon based on input
    const xIcon = document.querySelector('.search-x-icon');
    if (xIcon) {
        xIcon.style.display = searchInput.value ? 'block' : 'none';
        xIcon.onclick = () => {
            searchInput.value = '';
            lastSearchQuery = '';

            if (isLikedSongsOnly) {
                // If liked songs is active, fetch liked songs
                performSearch('', true);
            } else {
                // Otherwise clear the content
                currentTracks = [];
                document.getElementById('search-content').innerHTML = '';
                updatePopularityButtonState(false);

                // Reset Popularity button
                sortByPopularityAsc = false;
                const popularityButton = document.querySelector('.sort-button.popularity');
                if (popularityButton) {
                    popularityButton.classList.remove('active');
                    const popularityImg = popularityButton.querySelector('img');
                    if (popularityImg) {
                        popularityImg.src = 'images/spotify/search/arrow-down.png';
                        popularityImg.style.opacity = '0.5';
                    }
                }
            }
            xIcon.style.display = 'none';
        };
    }

    // Clear previous timeout
    if (searchTimeout) {
        clearTimeout(searchTimeout);
    }

    // If the search input is empty
    if (!searchInput.value.trim()) {
        if (isLikedSongsOnly) {
            // If liked songs is active, fetch liked songs
            performSearch('', true);
        } else {
            // Otherwise clear the content
            currentTracks = [];
            document.getElementById('search-content').innerHTML = '';
            updatePopularityButtonState(false);
        }
        return;
    }

    // Debounce the search - wait 500ms after user stops typing
    searchTimeout = setTimeout(() => {
        performSearch(searchInput.value);
    }, 500);
}

// Function to play a song
window.playSong = async function(uri, fromLikedSongs = false, trackElement = null) {
    const hasSpotifyPremium = localStorage.getItem('isPremium') === 'true';

    if (!hasSpotifyPremium) {
        showToast('Spotify Premium is required to play music. Please upgrade your account to enjoy playback features.', true);
        return;
    }

    const deviceId = localStorage.getItem('spotify_device_id');
    if (!deviceId) {
        showToast('Playback device not ready. Please try again in a moment.', true);
        return;
    }

    try {
        // Update queue state if playing from liked songs
        if (fromLikedSongs) {
            isPlayingFromLikedSongs = true;
            currentLikedSongsQueue = [...currentTracks];
            // eslint-disable-next-line max-len
            currentTrackIndexInQueue = currentLikedSongsQueue.findIndex((track) => track.uri === uri);
        } else {
            isPlayingFromLikedSongs = false;
            currentLikedSongsQueue = [];
            currentTrackIndexInQueue = -1;
        }

        await callSpotifyApi(`/me/player/play?device_id=${deviceId}`, 'PUT', {
            uris: [uri]
        });

        isPlaying = true;

        // Only update song info if playback succeeded and trackElement is provided
        if (trackElement) {
            const trackName = trackElement.querySelector('.track-name').textContent;
            const artistName = trackElement.querySelector('.track-artist').textContent;
            const imageUrl = trackElement.querySelector('.track-image').src;
            updateSongInfo({
                image: imageUrl,
                name: trackName,
                artists: artistName
            });
        }

        // eslint-disable-next-line max-len
        // When playing from search (not liked songs), disable all playback control buttons except play/pause, volume, share, and repeat
        if (!fromLikedSongs) {
            // Disable shuffle button
            const shuffleButton = document.getElementById('shuffle-button');
            if (shuffleButton) {
                shuffleButton.src = 'images/spotify/shuffle-inactive.png';
                setShuffleButtonDimensions(shuffleButton, 'inactive');
                shuffleButton.style.opacity = '0.5';
                shuffleButton.style.cursor = 'not-allowed';
                shuffleButton.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    showToast('Shuffle is not available for single tracks.', true);
                };
            }

            // Keep repeat button enabled for single track repeat
            const repeatButton = document.getElementById('repeat-button');
            if (repeatButton) {
                repeatButton.style.opacity = '1';
                repeatButton.style.cursor = 'pointer';
                repeatButton.onclick = toggleRepeat;
            }

            // Disable previous button
            const prevButton = document.getElementById('prev-button');
            if (prevButton) {
                prevButton.style.opacity = '0.5';
                prevButton.style.cursor = 'not-allowed';
                prevButton.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    showToast('Previous track is not available for single tracks.', true);
                };
            }

            // Disable next button
            const nextButton = document.getElementById('next-button');
            if (nextButton) {
                nextButton.style.opacity = '0.5';
                nextButton.style.cursor = 'not-allowed';
                nextButton.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    showToast('Next track is not available for single tracks.', true);
                };
            }

            // Enable play/pause button
            const playBtn = document.getElementById('play-button');
            if (playBtn) {
                playBtn.src = 'images/spotify/play.png';
                playBtn.style.opacity = '1';
                playBtn.style.cursor = 'pointer';
                playBtn.onclick = togglePlayback;
            }

            // Enable volume button
            const volumeButton = document.getElementById('volume-button');
            if (volumeButton) {
                volumeButton.style.opacity = '1';
                volumeButton.style.cursor = 'pointer';
                volumeButton.onclick = toggleMute;
            }

            // Enable share button
            const shareButton = document.getElementById('share-button');
            if (shareButton) {
                shareButton.style.opacity = '1';
                shareButton.style.cursor = 'pointer';
            }
        } else {
            // If playing from liked songs, update all control buttons normally
            updateControlButtonsState(true);
        }

        // Add a small delay to ensure the song info is updated before checking overflow
        setTimeout(checkTextOverflow, 100);
    } catch (error) {
        if (!error.message.includes('403: Premium required')) {
            showToast('Unable to play track. Please try again.', true);
        }
        throw error;
    }
};

// Function to toggle Spotify container visibility
function toggleSpotifyVisibility() {
    const spotifyControl = document.getElementById('spotify-control');
    const spotifyContainer = document.getElementById('spotify-container');

    if (!spotifyControl) return;

    if (spotifyControl.style.display === 'none') {
        // Show the container
        spotifyControl.style.display = 'flex';
        const existingButton = document.getElementById('spotify-button');
        if (existingButton) {
            existingButton.remove();
        }
    } else {
        // Hide the container and create a minimized button
        spotifyControl.style.display = 'none';

            // Create a restore button if it doesn't exist
        const existingButton = document.getElementById('spotify-button');
        if (!existingButton && spotifyContainer) {
                const restoreButton = document.createElement('button');
                restoreButton.id = 'spotify-button';
                restoreButton.innerHTML = `
                    <img src="images/spotify/spotify-logo.png" alt="spotify-logo" style="height: 20px; width: 20px; margin-right: 8px; vertical-align: middle;"/>
                    <span style="vertical-align: middle; line-height: 20px; font-size: 20px; font-weight: 500;">Spotify</span>
                `;
                restoreButton.style.cssText = `
                    box-sizing: border-box;
                    position: absolute;
                    top: 300px;
                    left: 10px;
                    padding: 8px 15px;
                    background: rgba(0, 0, 0, 0.8);
                    color: white;
                    font-family: 'Fredoka', sans-serif;
                    font-weight: 500;
                    font-size: 16px;
                    border: none;
                    border-radius: 12px;
                    cursor: pointer;
                    text-align: center;
                    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
                    transition: all 0.3s ease;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: auto;
                    height: 50px;
                    flex-direction: row;
                `;
                restoreButton.onclick = toggleSpotifyVisibility;
                spotifyContainer.appendChild(restoreButton);
            }
        }
}

// Handle volume change
async function handleVolumeChange(event) {
    // Skip if mute function is currently changing volume
    if (isMuteChangingVolume) {
        return;
    }

    const value = parseInt(event.target.value, 10);
    const percent = value;

    // Update volume button appearance immediately
    const volumeButton = document.getElementById('volume-button');
    if (volumeButton) {
        if (value === 0) {
            volumeButton.src = 'images/spotify/mute.png';
            volumeButton.alt = 'unmute';
            volumeButton.style.width = '15px';
            volumeButton.style.marginLeft = '2.5px';
            volumeButton.style.marginRight = '2.5px';
            isMuted = true;
        } else {
            volumeButton.src = 'images/spotify/volumn.png';
            volumeButton.alt = 'volume';
            volumeButton.style.width = '20px';
            volumeButton.style.marginLeft = '0px';
            volumeButton.style.marginRight = '0px';
            isMuted = false;
            previousVolume = value;
        }
    }

    // Immediately update SDK volume
    if (window.player && typeof window.player.setVolume === 'function') {
        try {
            await window.player.setVolume(value / 100);
        } catch (error) { /* empty */ }
    }

    // Clear any pending timeout
    if (volumeChangeTimeout) {
        clearTimeout(volumeChangeTimeout);
    }

    // Check if we should sync with API now or wait
    const now = Date.now();
    const timeSinceLastSync = now - lastVolumeSyncTime;

    // If we haven't synced recently, sync immediately
    if (timeSinceLastSync >= MIN_VOLUME_SYNC_INTERVAL) {
        try {
            const deviceId = localStorage.getItem('spotify_device_id');
            if (deviceId) {
                lastVolumeSyncTime = now;
                await callSpotifyApi(`/me/player/volume?volume_percent=${value}&device_id=${deviceId}`, 'PUT');
            }
        } catch (error) {
            if (!error.message.includes('404') && !error.message.includes('429')) { /* empty */ }
        }
    } else {
        // Otherwise, debounce the API call
        volumeChangeTimeout = setTimeout(async () => {
            try {
                const deviceId = localStorage.getItem('spotify_device_id');
                if (deviceId) {
                    lastVolumeSyncTime = Date.now();
                    await callSpotifyApi(`/me/player/volume?volume_percent=${value}&device_id=${deviceId}`, 'PUT');
                }
            } catch (error) {
                if (!error.message.includes('404') && !error.message.includes('429')) { /* empty */ }
            }
        }, MIN_VOLUME_SYNC_INTERVAL - timeSinceLastSync);
    }
}

// Show/hide volume slider on hover
window.addEventListener('DOMContentLoaded', () => {
    const volumeContainer = document.getElementById('volume-container');
    const volumeSlider = document.getElementById('volume-slider');
    if (volumeSlider) {
        // Set initial volume state
        const initialVolume = 50; // Default volume
        volumeSlider.value = initialVolume.toString();
        volumeSlider.style.setProperty('--progress', `${initialVolume}%`);

        // Unified handler for all slider events
        function updateSliderAndVolume(event) {
            // Skip if mute function is currently changing volume
            if (isMuteChangingVolume) {
                return;
            }

            const value = parseInt(event.target.value, 10);
            volumeSlider.style.setProperty('--progress', `${value}%`);
            handleVolumeChange(event);
            // Update volume button image based on slider value
            const volumeButton = document.getElementById('volume-button');
            if (volumeButton) {
                if (value === 0) {
                    volumeButton.src = 'images/spotify/mute.png';
                    volumeButton.alt = 'unmute';
                    volumeButton.style.width = '15px';
                    volumeButton.style.marginLeft = '2.5px';
                    volumeButton.style.marginRight = '2.5px';
                } else {
                    volumeButton.src = 'images/spotify/volumn.png';
                    volumeButton.alt = 'volume';
                    volumeButton.style.width = '20px';
                    volumeButton.style.marginLeft = '0px';
                    volumeButton.style.marginRight = '0px';
                }
            }
        }

        ['input', 'change', 'mouseup', 'touchend', 'click'].forEach((evt) => volumeSlider.addEventListener(evt, updateSliderAndVolume));

        // Add mousedown and touchstart for immediate feedback (no volume change)
        volumeSlider.addEventListener('mousedown', (event) => {
            const value = parseInt(event.target.value, 10);
            volumeSlider.style.setProperty('--progress', `${value}%`);
        });
        volumeSlider.addEventListener('touchstart', (event) => {
            const value = parseInt(event.target.value, 10);
            volumeSlider.style.setProperty('--progress', `${value}%`);
        });
    }

    // Sync volume on window focus
    window.addEventListener('focus', async () => {
        // Skip sync if mute function is currently changing volume
        if (isMuteChangingVolume) {
            return;
        }

        const volumeSlider = document.getElementById('volume-slider');
        if (isPlaybackAvailable && window.player && volumeSlider) {
            try {
                const volume = await window.player.getVolume();
                const volumePercent = Math.round(volume * 100);
                volumeSlider.value = volumePercent.toString();
                volumeSlider.style.setProperty('--progress', `${volumePercent}%`);

                // Update volume button appearance
                const volumeButton = document.getElementById('volume-button');
                if (volumeButton) {
                    if (volumePercent === 0) {
                        volumeButton.src = 'images/spotify/mute.png';
                        volumeButton.alt = 'unmute';
                        volumeButton.style.width = '15px';
                        volumeButton.style.marginLeft = '2.5px';
                        volumeButton.style.marginRight = '2.5px';
                        isMuted = true;
                    } else {
                        volumeButton.src = 'images/spotify/volumn.png';
                        volumeButton.alt = 'volume';
                        volumeButton.style.width = '20px';
                        volumeButton.style.marginLeft = '0px';
                        volumeButton.style.marginRight = '0px';
                        isMuted = false;
                        previousVolume = volumePercent;
                    }
                }
            } catch (error) { /* empty */ }
        }
    });
});

// Function to update previous button state
async function updatePrevButtonState() {
    const prevButton = document.getElementById('prev-button');
    if (!prevButton) return;

    try {
        if (!isPlaybackAvailable) {
            prevButton.style.opacity = '0.5';
            prevButton.style.cursor = 'not-allowed';
            prevButton.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                showToast('No song available to go back to.', true);
            };
            return;
        }

        // Get current playback state
        const playbackState = await callSpotifyApi('/me/player');
        if (!playbackState) {
            prevButton.style.opacity = '0.5';
            prevButton.style.cursor = 'not-allowed';
            return;
        }

        // If in repeat-1 mode, disable prev button
        if (playbackState.repeat_state === 'track') {
            prevButton.style.opacity = '0.5';
            prevButton.style.cursor = 'not-allowed';
            prevButton.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                showToast('Previous track disabled in repeat one mode.', true);
            };
            return;
        }

        // Handle different playback contexts
        if (isPlayingFromLikedSongs) {
            // Enable if we have previous tracks in liked songs queue
            const hasPrevious = currentTrackIndexInQueue > 0;
            prevButton.style.opacity = hasPrevious ? '1' : '0.5';
            prevButton.style.cursor = hasPrevious ? 'pointer' : 'not-allowed';
            prevButton.onclick = hasPrevious ? playPreviousTrack : (e) => {
                e.preventDefault();
                e.stopPropagation();
                showToast('This is the first song in your liked songs.', true);
            };
        } else if (playbackState.context && playbackState.context.type === 'playlist') {
            // For playlists, always enable the button
            prevButton.style.opacity = '1';
            prevButton.style.cursor = 'pointer';
            prevButton.onclick = playPreviousTrack;
        } else {
            // For single tracks, only enable if we can restart
            const hasPrevious = playbackState.progress_ms > 3000;
            prevButton.style.opacity = hasPrevious ? '1' : '0.5';
            prevButton.style.cursor = hasPrevious ? 'pointer' : 'not-allowed';
            prevButton.onclick = hasPrevious ? playPreviousTrack : (e) => {
                e.preventDefault();
                e.stopPropagation();
                showToast('Previous track is not available for single tracks.', true);
            };
        }
    } catch (error) {
        // If there's an error, disable the button
        prevButton.style.opacity = '0.5';
        prevButton.style.cursor = 'not-allowed';
        prevButton.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            showToast('Unable to check previous track availability.', true);
        };
    }
}

// Function to update next button state
async function updateNextButtonState() {
    const nextButton = document.getElementById('next-button');
    if (!nextButton) return;

    try {
        if (!isPlaybackAvailable) {
            nextButton.style.opacity = '0.5';
            nextButton.style.cursor = 'not-allowed';
            nextButton.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                showToast('No song available to skip to.', true);
            };
            return;
        }

        // Get current playback state
        const state = await callSpotifyApi('/me/player');
        if (!state || !state.item) {
            nextButton.style.opacity = '0.5';
            nextButton.style.cursor = 'not-allowed';
            nextButton.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                showToast('No next song available.', true);
            };
            return;
        }

        // If in repeat-1 mode, disable next button
        if (state.repeat_state === 'track') {
            nextButton.style.opacity = '0.5';
            nextButton.style.cursor = 'not-allowed';
            nextButton.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                showToast('Next track disabled in repeat one mode.', true);
            };
            return;
        }

        // If playing from a playlist, always enable next button
        if (state.context && state.context.type === 'playlist') {
            nextButton.style.opacity = '1';
            nextButton.style.cursor = 'pointer';
            nextButton.onclick = playNextTrack;
            return;
        }

        // If playing from liked songs, check if we're at the last track
        if (isPlayingFromLikedSongs) {
            const hasNext = currentTrackIndexInQueue < currentLikedSongsQueue.length - 1;
            nextButton.style.opacity = hasNext ? '1' : '0.5';
            nextButton.style.cursor = hasNext ? 'pointer' : 'not-allowed';
            nextButton.onclick = hasNext ? playNextTrack : (e) => {
                e.preventDefault();
                e.stopPropagation();
                showToast('This is the last song in your liked songs.', true);
            };
            return;
        }

        // For single tracks, disable next button
        nextButton.style.opacity = '0.5';
        nextButton.style.cursor = 'not-allowed';
        nextButton.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            showToast('Next track is not available for single tracks.', true);
        };
    } catch (error) {
        // If there's an error, disable the button
        nextButton.style.opacity = '0.5';
        nextButton.style.cursor = 'not-allowed';
        nextButton.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            showToast('No next song available.', true);
        };
    }
}

// Function to play a playlist
async function playPlaylist(playlistId) {
    const hasSpotifyPremium = localStorage.getItem('isPremium') === 'true';
    if (!hasSpotifyPremium) {
        showToast('Spotify Premium is required to play music. Please upgrade your account to enjoy playback features.', true);
        return;
    }

    try {
        // Get device ID
        const deviceId = localStorage.getItem('spotify_device_id');
        if (!deviceId) {
            showToast('Playback device not ready. Please try again in a moment.', true);
            return;
        }

        // Get playlist details
        const playlist = await callSpotifyApi(`/playlists/${playlistId}`);
        if (!playlist) {
            showToast('Unable to load playlist. Please try again.', true);
            return;
        }

        // Check if playlist is empty
        if (!playlist.tracks || !playlist.tracks.items || playlist.tracks.items.length === 0) {
            showToast('This playlist is empty. Add some songs to play it.', true);
            return;
        }

        // Start playing the playlist from the beginning with shuffle and repeat off
        await callSpotifyApi(`/me/player/play?device_id=${deviceId}`, 'PUT', {
            context_uri: `spotify:playlist:${playlistId}`,
            offset: { position: 0 } // Explicitly start from first track
        });

        // Ensure shuffle is off
        await callSpotifyApi('/me/player/shuffle?state=false', 'PUT');
        const shuffleButton = document.getElementById('shuffle-button');
        if (shuffleButton) {
            shuffleButton.src = 'images/spotify/shuffle-inactive.png';
            setShuffleButtonDimensions(shuffleButton, 'inactive');
            shuffleButton.style.opacity = '1'; // Keep enabled
            shuffleButton.style.cursor = 'pointer';
        }

        // Ensure repeat is off
        await callSpotifyApi('/me/player/repeat?state=off', 'PUT');
        const repeatButton = document.getElementById('repeat-button');
        if (repeatButton) {
            repeatButton.src = 'images/spotify/repeat-inactive.png';
            setRepeatButtonDimensions(repeatButton, 'inactive');
            repeatButton.style.opacity = '1'; // Keep enabled
            repeatButton.style.cursor = 'pointer';
        }

        // Update UI state
        isPlaying = true;
        isPlayingFromLikedSongs = false;
        currentLikedSongsQueue = [];
        currentTrackIndexInQueue = -1;

        // Update play button state
        const playBtn = document.getElementById('play-button');
        if (playBtn) {
            playBtn.src = 'images/spotify/play.png';
        }

        // Update song info with first track
        if (playlist.tracks && playlist.tracks.items && playlist.tracks.items.length > 0) {
            const firstTrack = playlist.tracks.items[0].track;
            updateSongInfo({
                image: (firstTrack.album.images && firstTrack.album.images[0] && firstTrack.album.images[0].url) || 'images/spotify/default-song.png',
                name: firstTrack.name,
                artists: firstTrack.artists.map((artist) => artist.name).join(', ')
            });
        }

        // Enable all control buttons for playlist playback
        updateControlButtonsState(true);

        // Specifically enable next button and handle previous button state
        const nextButton = document.getElementById('next-button');
        const prevButton = document.getElementById('prev-button');

        if (nextButton) {
            nextButton.style.opacity = '1';
            nextButton.style.cursor = 'pointer';
            nextButton.onclick = playNextTrack;
        }

        if (prevButton) {
            // Initially disable previous button since we're at the start
            prevButton.style.opacity = '0.5';
            prevButton.style.cursor = 'not-allowed';
            prevButton.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                showToast('At the start of the first track.', true);
            };
        }

        // Show success message
        showToast(`Playing playlist: ${playlist.name}`);

        // Add current playlist to history
        playlistHistory.push(playlist);
        currentPlaylistIndex = playlistHistory.length - 1;
    } catch (error) {
        if (error.message.includes('403: Premium required')) {
            showToast('Spotify Premium is required to play music. Please upgrade your account.', true);
        } else if (!error.message.includes('404')) {
            showToast('Unable to play playlist. Please try again.', true);
        }
    }
}

// Save app state and Spotify state on unload
window.addEventListener('beforeunload', function () {
  try {
    // Save timer-related app state
    saveAppState();

    // Save user's Spotify state
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (user.id) {
      saveUserSpotifyState(user.id);
    }

    // Save playback state
    const deviceId = localStorage.getItem('spotify_device_id');
    if (deviceId && window.player && typeof window.player.getCurrentState === 'function') {
      window.player.getCurrentState().then((state) => {
        if (state && state.track_window && state.track_window.current_track) {
          const playbackState = {
            uri: state.track_window.current_track.uri,
            position: state.position,
            timestamp: Date.now()
          };
          localStorage.setItem(PLAYBACK_STATE_KEY, JSON.stringify(playbackState));
        }
      });
    }
  } catch (e) { /* ignore */ }
});

// Restore playback state on load
window.addEventListener('DOMContentLoaded', async () => {
  const playbackStateStr = localStorage.getItem(PLAYBACK_STATE_KEY);
  if (playbackStateStr) {
    try {
      const playbackState = JSON.parse(playbackStateStr);
      if (playbackState.timestamp && (Date.now() - playbackState.timestamp)
         < PLAYBACK_STATE_EXPIRY) {
        // Try to resume playback
        const deviceId = localStorage.getItem('spotify_device_id');
        if (deviceId && playbackState.uri) {
          await callSpotifyApi(`/me/player/play?device_id=${deviceId}`, 'PUT', {
            uris: [playbackState.uri],
            position_ms: playbackState.position || 0
          });
        }
      }
    } catch (e) { /* ignore */ }
    // Remove the saved state after attempting to restore
    localStorage.removeItem(PLAYBACK_STATE_KEY);
  }
});

async function restoreAppState() {
  const stateStr = getCookie(APP_STATE_KEY);
  if (!stateStr) return;
  try {
    const state = JSON.parse(stateStr);
    if (!state.timestamp || (Date.now() - state.timestamp) > APP_STATE_EXPIRY) {
      deleteCookie(APP_STATE_KEY);
      return;
    }

    // DO NOT restore timer state from APP_STATE_KEY - this causes cross-user contamination
    // eslint-disable-next-line max-len
    // Timer state should only be restored from user-specific cookies by the timer's loadTimerState() method
    // eslint-disable-next-line max-len
    // The APP_STATE_KEY cookie is shared across all users and will cause User A's timer to show for User B



    deleteCookie(APP_STATE_KEY);
  } catch (e) { /* ignore */ }
}

window.addEventListener('DOMContentLoaded', restoreAppState);

function savePlaybackState(uri, position) {
  if (!uri) return;
    const state = {
        uri,
    position: position || 0,
        timestamp: Date.now()
    };
  localStorage.setItem(PLAYBACK_STATE_KEY, JSON.stringify(state));
}

// Listen for playback state changes and save immediately
function setupPlaybackStateListener() {
  if (window.player && typeof window.player.addListener === 'function') {
    window.player.addListener('player_state_changed', (state) => {
      if (state && state.track_window && state.track_window.current_track) {
        savePlaybackState(state.track_window.current_track.uri, state.position);
      }
    });
  }
}

// Call this after player is initialized
window.addEventListener('DOMContentLoaded', () => {
  setupPlaybackStateListener();

  // Restore playback state on load
  const playbackStateStr = localStorage.getItem(PLAYBACK_STATE_KEY);
  if (playbackStateStr) {
    try {
      const playbackState = JSON.parse(playbackStateStr);
      if (playbackState.timestamp && (Date.now() - playbackState.timestamp)
        < PLAYBACK_STATE_EXPIRY) {
        const deviceId = localStorage.getItem('spotify_device_id');
        if (deviceId && playbackState.uri) {
          callSpotifyApi(`/me/player/play?device_id=${deviceId}`, 'PUT', {
            uris: [playbackState.uri],
            position_ms: playbackState.position || 0
          }).then(() => {
            // Optionally update UI here if needed
          });
        }
      }
    } catch (e) { /* ignore */ }
    // Remove the saved state after attempting to restore
    localStorage.removeItem(PLAYBACK_STATE_KEY);
  }
});

document.addEventListener('DOMContentLoaded', function() {
    const params = new URLSearchParams(window.location.search);
    const error = params.get('error');
    if (error) {
        // Show a toast for any error, customize message for known errors
        let message = 'Spotify connection failed. Please try again or contact the administrator.';
        if (
            error === 'account_not_added'
            || error === 'invalid_token'
            || error === 'server_error'
            || error === 'invalid_client'
            || error === 'invalid_grant'
            || error === 'state_mismatch'
        ) {
            message = 'This Spotify account is not added to the developer dashboard or there was an authorization error. Please contact the administrator or use a different account.';
        } else if (error === 'spotify_already_linked') {
            message = 'This Spotify account is already linked to another user. Please use a different account or unlink it first.';
        }
        showToast(message, true);
    }
});

function savePlayerState({
 uri, position, isPlaying, shuffle, repeat, volume
}) {
  const state = {
    uri,
    position: position || 0,
    isPlaying: !!isPlaying,
    shuffle: !!shuffle,
    repeat: repeat || 'off',
    volume: typeof volume === 'number' ? volume : 1,
    timestamp: Date.now()
  };
  localStorage.setItem(PLAYER_STATE_KEY, JSON.stringify(state));
}

function restorePlayerState() {
  const stateStr = localStorage.getItem(PLAYER_STATE_KEY);
  if (!stateStr) return null;
  try {
    const state = JSON.parse(stateStr);
    // Only restore if state is recent (e.g., within 15 minutes)
    if (state.timestamp && (Date.now() - state.timestamp) < 15 * 60 * 1000) {
      return state;
    }
  } catch (e) { /* ignore */ }
  return null;
}

// Save state on relevant events
function setupPlayerStatePersistence() {
  if (window.player && typeof window.player.addListener === 'function') {
    window.player.addListener('player_state_changed', (state) => {
      if (state && state.track_window && state.track_window.current_track) {
        savePlayerState({
          uri: state.track_window.current_track.uri,
          position: state.position,
          isPlaying: !state.paused,
          shuffle: state.shuffle,
          repeat: state.repeat_mode, // 0: off, 1: context, 2: track
          volume: state.volume
        });
      }
    });
  }
}

// On page load, restore state or show ready UI
window.addEventListener('DOMContentLoaded', async () => {
  setupPlayerStatePersistence();
  const state = restorePlayerState();
  if (state) {
    // Restore button states
    setShuffle(state.shuffle);
    setRepeat(state.repeat);
    setVolume(state.volume);
    // Try to resume playback
    const deviceId = localStorage.getItem('spotify_device_id');
    if (deviceId && state.uri) {
      try {
        await callSpotifyApi(`/me/player/play?device_id=${deviceId}`, 'PUT', {
          uris: [state.uri],
          position_ms: state.position || 0
        });
        if (!state.isPlaying) {
          await callSpotifyApi('/me/player/pause', 'PUT');
        }
      } catch (e) {
        // If playback fails, check if playing on another device
        const playback = await callSpotifyApi('/me/player');
        if (playback && playback.device && playback.device.id !== deviceId && playback.is_playing) {
          showToast('This Spotify account is playing music on another device.', true);
        } else {
          showToast('Unable to resume playback. Please select a song.', true);
        }
      }
    }
  } else {
    // No saved state, keep player ready
    resetPlayerUI && resetPlayerUI();
  }
});

// Ensure resetPlayerUI is always defined to prevent ReferenceError
if (typeof window.resetPlayerUI === 'undefined') {
  window.resetPlayerUI = function() {};
}

// Function to clear all user-related state (for logout scenarios)
function clearAllUserState() {
    clearUserState();
}

// Make clearAllUserState available globally for other scripts to use
window.clearAllUserState = clearAllUserState;

// Make showToast available globally for other scripts to use
window.showToast = showToast;
