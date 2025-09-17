/* eslint-disable no-unused-vars */
document.addEventListener('DOMContentLoaded', function () {
  // Profile popup state
  let profilePopupVisible = false;

  // Spotify state
   let showPlaylist = false;

  // Profile popup methods
  function toggleProfilePopup(event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    profilePopupVisible = !profilePopupVisible;

    const profilePopup = document.getElementById('profile-popup');
    if (profilePopup) {
      profilePopup.style.display = profilePopupVisible ? 'block' : 'none';
    }
  }

  function closeProfilePopup() {
    profilePopupVisible = false;
    const profilePopup = document.getElementById('profile-popup');
    if (profilePopup) {
      profilePopup.style.display = 'none';
    }
  }

  // Spotify functionality
  function toggleSpotifyView(showPlaylists) {
     showPlaylist = showPlaylists;

    const searchButton = document.querySelector('.search-button');
    const playlistButton = document.querySelector('.playlist-button');
    const searchContainer = document.querySelector('.search-container');
    const playlistContainer = document.querySelector('.playlist-container');

    if (searchButton && playlistButton) {
      // Update button states
      if (showPlaylists) {
        searchButton.classList.remove('active');
        playlistButton.classList.add('active');
      } else {
        searchButton.classList.add('active');
        playlistButton.classList.remove('active');
      }
    }

    // Toggle container visibility
    if (searchContainer && playlistContainer) {
      if (showPlaylists) {
        searchContainer.style.display = 'none';
        playlistContainer.style.display = 'block';
      } else {
        searchContainer.style.display = 'block';
        playlistContainer.style.display = 'none';
      }
    }
  }

  // Sort functionality is now handled by home-spotify.js

  // Set up profile link click handler
  const profileLink = document.getElementById('profile-link');
  if (profileLink) {
    profileLink.addEventListener('click', toggleProfilePopup);
  }

  // Set up Spotify button handlers
  const searchButton = document.querySelector('.search-button');
  const playlistButton = document.querySelector('.playlist-button');

  if (searchButton) {
    searchButton.addEventListener('click', function(event) {
      event.preventDefault();
      toggleSpotifyView(false);
    });
  }

  if (playlistButton) {
    playlistButton.addEventListener('click', function(event) {
      event.preventDefault();
      toggleSpotifyView(true);
    });
  }

  // Sort button is handled by home-spotify.js

  // Sort dropdown handlers are in home-spotify.js

  // Set up document click handler to close dropdowns
  document.addEventListener('click', function(event) {
    const profilePopup = document.getElementById('profile-popup');
    const profileLinkElement = document.getElementById('profile-link');

    // Close profile popup when clicking outside
    if (profilePopupVisible
      && profilePopup
      && profileLinkElement
      && !profilePopup.contains(event.target)
      && event.target !== profileLinkElement) {
      closeProfilePopup();
    }

    // Sort dropdown click handling is in home-spotify.js
  });

  // Initialize default states
  setTimeout(function() {
    // Set default Spotify view to search
    toggleSpotifyView(false);

    // Ensure proper initial button states
    const searchBtn = document.querySelector('.search-button');
    const playlistBtn = document.querySelector('.playlist-button');

    if (searchBtn) searchBtn.classList.add('active');
    if (playlistBtn) playlistBtn.classList.remove('active');
  }, 100);

  // Make functions available globally if needed
  window.toggleProfilePopup = toggleProfilePopup;
  window.closeProfilePopup = closeProfilePopup;
  window.toggleSpotifyView = toggleSpotifyView;
});
