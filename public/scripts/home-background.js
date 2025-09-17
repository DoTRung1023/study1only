/* eslint-disable no-param-reassign */
/* eslint-disable no-undef */
/* eslint-disable no-unused-vars */
/* eslint-disable no-await-in-loop */
/* eslint-disable no-shadow */
/* eslint-disable no-use-before-define */
/* eslint-disable no-useless-catch */
// Background functionality
document.addEventListener('DOMContentLoaded', function() {
    // Initialize album sort state first
    window.albumSortField = 'Album Name';
    window.albumSortOrder = 'Ascending';
    window.albumSortDropdownVisible = false;

    // Store original background for preview functionality
    const appContainer = document.querySelector('.app-container');
    let originalBackground = {
        image: appContainer ? appContainer.style.backgroundImage : '',
        size: appContainer ? appContainer.style.backgroundSize : '',
        position: appContainer ? appContainer.style.backgroundPosition : ''
    };
    let previewTimer = null;

    // Store the current photo being added to album
    let currentPhotoToAdd = null;
    let selectedAlbums = new Set();

    // Variable to store current album being edited
    let currentEditingAlbum = null;
    let selectedAvatarImage = null;
    let hasChanges = false;

    // Helper function to show user-friendly messages
    function showBackgroundToast(message, isError = false) {
        // Find or create toast element
        let toast = document.getElementById("bg-toast");
        if (!toast) {
            toast = document.createElement("div");
            toast.id = "bg-toast";
            toast.className = "bg-toast";
            document.body.appendChild(toast);
        }

        // Reset toast state
        toast.classList.remove("show");

        // Set message and error state
        toast.textContent = message;
        toast.className = `bg-toast${isError ? ' error' : ''}`;

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

    // Make showBackgroundToast globally accessible
    window.showBackgroundToast = showBackgroundToast;

    // Get the background buttons
    const pexelsButton = document.getElementById("pexels");
    const savedButton = document.getElementById("saved");
    const backgroundContainer = document.querySelector(".background-container");
    const minimizeButton = document.querySelector(".background-top-left");
    const openButton = document.querySelector(".open-button");

    // Get search elements
    const searchPexels = document.querySelector(".search-pexels");
    const searchAlbum = document.querySelector(".search-album");
    const pexelsSearchInput = document.querySelector(".pexels-search-box .search-input");
    const pexelsClearIcon = document.querySelector(".pexels-search-box .clear-icon-bg");
    const pexelsResults = document.querySelector(".pexels-results");
    const albumResults = document.querySelector(".album-results");

    // Pexels API configuration
    let PEXELS_API_KEY = ''; // Will be set after fetching from server
    const PEXELS_API_URL = 'https://api.pexels.com/v1/search';

    // Fetch Pexels API key from server
    async function initializePexelsAPI() {
        try {
            const response = await fetch('/api/pexels-key');
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to fetch API key');
            }
            const data = await response.json();
            if (!data.key) {
                throw new Error('Invalid API key response');
            }
            PEXELS_API_KEY = data.key;
        } catch (error) {
            showBackgroundToast('Error initializing Pexels API. Please try again later.', true);
        }
    }

    // Initialize Pexels API when the page loads
    initializePexelsAPI();

    // Function to check if Pexels API key is configured
    function isPexelsConfigured() {
        return PEXELS_API_KEY && PEXELS_API_KEY.length > 0;
    }

    // Function to show preview notification
    function showPreviewNotification() {
        // Remove existing notification if any
        const existing = document.querySelector('.preview-notification');
        if (existing) {
            existing.remove();
        }

        const notification = document.createElement('div');
        notification.className = 'preview-notification';
        notification.innerHTML = `
            <div>Background Preview Active</div>
            <div style="font-size: 14px; margin-top: 5px; opacity: 0.8;">Auto-revert in 10 seconds</div>
        `;
        document.body.appendChild(notification);
    }

    // Function to hide preview notification
    function hidePreviewNotification() {
        const notification = document.querySelector('.preview-notification');
        if (notification) {
            notification.remove();
        }
    }

    // Function to revert to original background
    function revertToOriginalBackground() {
        if (previewTimer) {
            clearTimeout(previewTimer);
            previewTimer = null;
        }

        // Restore original background
        if (appContainer) {
            appContainer.style.backgroundImage = originalBackground.image || '';
            appContainer.style.backgroundSize = originalBackground.size || '';
            appContainer.style.backgroundPosition = originalBackground.position || '';
        }

        // Hide preview notification
        hidePreviewNotification();
    }

    // Function to set the background image from the user's saved background (from DB)
    async function setBackgroundFromUser() {
        try {
            const response = await fetch('/users/me');
            if (response.ok) {
                const user = await response.json();
                if (user && user.background) {
                    const bgAppContainer = document.querySelector('.app-container');
                    if (bgAppContainer) {
                        bgAppContainer.style.backgroundImage = `url('${user.background}')`;
                        bgAppContainer.style.backgroundSize = 'cover';
                        bgAppContainer.style.backgroundPosition = 'center';
                    }
                }
            }
        } catch (e) {
            // fallback: do nothing
        }
    }

    // Call this function on page load
    window.addEventListener('DOMContentLoaded', setBackgroundFromUser);

    // Function to update the background in the database and UI
    async function updateBackground(photo) {
        // Clear any active preview first
        if (previewTimer) {
            clearTimeout(previewTimer);
            previewTimer = null;
            hidePreviewNotification();
        }

        try {
            // Get the current user
            const userResponse = await fetch('/users/me');
            if (!userResponse.ok) {
                throw new Error('User authentication failed');
            }
            const user = await userResponse.json();
            const newBackground = photo.src.original || photo.src;

            // Check if newBackground is a valid URL
            if (typeof newBackground !== 'string' || !newBackground.startsWith('http')) {
                showBackgroundToast('Invalid background image URL!', true);
                return;
            }

            // Immediately update the UI
            const bgAppContainer = document.querySelector('.app-container');
            if (bgAppContainer) {
                bgAppContainer.style.backgroundImage = `url('${newBackground}')`;
                bgAppContainer.style.backgroundSize = 'cover';
                bgAppContainer.style.backgroundPosition = 'center';
            }

            // Update stored original background to the new background
            originalBackground = {
                image: bgAppContainer ? bgAppContainer.style.backgroundImage : '',
                size: bgAppContainer ? bgAppContainer.style.backgroundSize : '',
                position: bgAppContainer ? bgAppContainer.style.backgroundPosition : ''
            };

            // Update the background in the database
            const response = await fetch('/users/update-background', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    user_id: user.id,
                    background: newBackground
                })
            });

            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.error || 'Failed to update background in database');
            }

            showBackgroundToast('Background saved successfully!');
        } catch (error) {
            // Re-throw error so it can be caught by caller
            throw error;
        }
    }

    // Function to set photo as background
    function setAsBackground(photo) {
        // Clear any active preview first
        if (previewTimer) {
            clearTimeout(previewTimer);
            previewTimer = null;
            hidePreviewNotification();
        }

        if (appContainer) {
            appContainer.style.backgroundImage = `url('${photo.src.original}')`;
            appContainer.style.backgroundSize = 'cover';
            appContainer.style.backgroundPosition = 'center';

            // Update stored original background to the new background
            originalBackground = {
                image: appContainer.style.backgroundImage,
                size: appContainer.style.backgroundSize,
                position: appContainer.style.backgroundPosition
            };

            showBackgroundToast('Background updated successfully!');
        }
    }

    // Make setAsBackground globally accessible
    window.setAsBackground = setAsBackground;

    // Function to preview photo as background temporarily
    function previewAsBackground(photo) {
        if (!appContainer) return;

        // Clear any existing preview timer
        if (previewTimer) {
            clearTimeout(previewTimer);
        }

        // Store current background as original if not already stored
        if (!originalBackground.image) {
            originalBackground = {
                image: appContainer.style.backgroundImage,
                size: appContainer.style.backgroundSize,
                position: appContainer.style.backgroundPosition
            };
        }

        // Set preview background
        appContainer.style.backgroundImage = `url('${photo.src.original}')`;
        appContainer.style.backgroundSize = 'cover';
        appContainer.style.backgroundPosition = 'center';

        // Show preview notification
        showPreviewNotification();

        // Auto-revert after 10 seconds
        previewTimer = setTimeout(() => {
            revertToOriginalBackground();
        }, 10000);
    }

    // Make previewAsBackground globally accessible
    window.previewAsBackground = previewAsBackground;

    // Function to create album item element with click handler
    function createAlbumItem(album, photo, modal) {
        const item = document.createElement('div');
        item.className = 'add-to-album-item';
        item.title = album.album_name;
        item.setAttribute('data-album-id', album.album_id);
        item.innerHTML = `
            <div class="album-checkbox-container">
                <img src="/images/pexel/not-choose.png" class="album-checkbox-img" alt="Not chosen" />
            </div>
            <div class="add-to-album-thumb">
                <img src="${album.avatar_link}" alt="Album" />
            </div>
            <div class="add-to-album-name" title="${album.album_name}">${album.album_name}</div>
            <div class="add-to-album-count">${album.image_count}</div>
        `;

        // Add click handler to toggle album selection
        item.addEventListener('click', () => {
            const img = item.querySelector('.album-checkbox-img');
            if (selectedAlbums.has(album.album_id)) {
                selectedAlbums.delete(album.album_id);
                img.src = '/images/pexel/not-choose.png';
                img.alt = 'Not chosen';
                item.classList.remove('selected');
            } else {
                selectedAlbums.add(album.album_id);
                img.src = '/images/pexel/chosen.png';
                img.alt = 'Chosen';
                item.classList.add('selected');
            }

            // Show/hide confirm button based on selection
            const confirmBtn = document.getElementById('add-to-album-confirm');
            if (selectedAlbums.size > 0) {
                confirmBtn.classList.add('enabled');
            } else {
                confirmBtn.classList.remove('enabled');
            }
        });

        return item;
    }

    // Function to add image to multiple albums
    async function addImageToAlbums(photo, albumIds, modal) {
        let successCount = 0;
        let existingCount = 0;

        for (const albumId of albumIds) {
            try {
                const response = await fetch('/api/albums/add-image', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        album_id: albumId,
                        image_url: photo.src.original,
                        photographer: photo.photographer,
                        width: photo.width,
                        height: photo.height,
                        alt_text: photo.alt
                    })
                });

                const data = await response.json();

                if (!response.ok && !data.alreadyExists) {
                    throw new Error(data.error || 'Failed to add image to album');
                }

                if (data.alreadyExists) {
                    existingCount++;
                } else {
                    successCount++;
                    // Update the image count in UI
                    const albumItem = document.querySelector(`.add-to-album-item[data-album-id="${albumId}"]`);
                    if (albumItem) {
                        const countElement = albumItem.querySelector('.add-to-album-count');
                        const currentCount = parseInt(countElement.textContent, 10);
                        countElement.textContent = currentCount + 1;
                    }
                }
            } catch (error) {
                showBackgroundToast(`Failed to add image to some albums: ${error.message}`, true);
                return;
            }
        }

        // Show success message
        if (successCount > 0 || existingCount > 0) {
            let message = '';
            if (successCount > 0) {
                message += `Added to ${successCount} album${successCount > 1 ? 's' : ''}`;
            }
            if (existingCount > 0) {
                if (successCount > 0) message += ' and ';
                message += `already in ${existingCount} album${existingCount > 1 ? 's' : ''}`;
            }
            showBackgroundToast(message);
            modal.style.display = 'none';
            selectedAlbums.clear();
        }
    }

    // Function to show the Add to Album modal
    async function showAddToAlbumModal(photo) {
        currentPhotoToAdd = photo;
        selectedAlbums.clear();
        const modal = document.getElementById('add-to-album-modal');
        const closeBtn = document.getElementById('add-to-album-close');
        const plusBtn = document.getElementById('add-to-album-plus');
        const albumList = document.getElementById('add-to-album-list');

        // Get current user data from session
        const userResponse = await fetch('/users/me');
        if (!userResponse.ok) {
            showBackgroundToast('Please log in to add images to albums', true);
            return;
        }
        const userData = await userResponse.json();
        const userId = userData.id;

        try {
            // Fetch user's albums
            const response = await fetch(`/api/albums/user/${userId}`);
            if (!response.ok) {
                throw new Error('Failed to fetch albums');
            }
            const albums = await response.json();

            // Sort albums alphabetically by album_name
            albums.sort((a, b) => a.album_name.localeCompare(b.album_name));

            // Render albums
            albumList.innerHTML = '';
            if (albums.length === 0) {
                // Show message when no albums exist
                const noAlbumsDiv = document.createElement('div');
                noAlbumsDiv.className = 'no-results';
                noAlbumsDiv.textContent = 'No albums found. Create one using the + button!';
                noAlbumsDiv.style.textAlign = 'center';
                noAlbumsDiv.style.padding = '40px 20px';
                noAlbumsDiv.style.color = '#666';
                noAlbumsDiv.style.fontSize = '18px';
                noAlbumsDiv.style.fontFamily = 'Fredoka, sans-serif';
                albumList.appendChild(noAlbumsDiv);
            } else {
                albums.forEach((album) => {
                    const item = createAlbumItem(album, photo, modal);
                    item.setAttribute('data-album-id', album.album_id);
                    albumList.appendChild(item);
                });
            }

            // Add confirm button if not exists
            let confirmBtn = document.getElementById('add-to-album-confirm');
            if (!confirmBtn) {
                confirmBtn = document.createElement('button');
                confirmBtn.id = 'add-to-album-confirm';
                confirmBtn.className = 'add-to-album-confirm';
                confirmBtn.textContent = 'Confirm';
                modal.querySelector('.add-to-album-content').appendChild(confirmBtn);
            } else {
                confirmBtn.textContent = 'Confirm';
            }
            // Always show, but toggle enabled class
            if (selectedAlbums.size > 0) {
                confirmBtn.classList.add('enabled');
            } else {
                confirmBtn.classList.remove('enabled');
            }

            // Add confirm button click handler
            confirmBtn.onclick = () => {
                if (selectedAlbums.size > 0) {
                    addImageToAlbums(photo, Array.from(selectedAlbums), modal);
                }
            };

            // Show modal
            modal.style.display = 'flex';

            // Close handler
            closeBtn.onclick = () => {
                modal.style.display = 'none';
                currentPhotoToAdd = null;
                selectedAlbums.clear();
            };

            // Plus handler to show create album modal
            plusBtn.onclick = () => {
                createAlbumModal.style.display = 'flex';
                albumNameInput.value = '';
                lengthCounter.textContent = '0/25';
                checkBtn.classList.remove('active');
            };
        } catch (error) {
            showBackgroundToast('Failed to load albums', true);
        }
    }

    // Function to save photo (to be implemented)
    function savePhoto(photo) {
        showAddToAlbumModal(photo);
        // showBackgroundToast('Photo saved successfully!');
        // TODO: Implement save functionality
    }

    // Function to share photo
    function sharePhoto(photo) {
        // Copy image link to clipboard
        const imageUrl = photo.src.original;

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(imageUrl)
                .then(() => {
                    showBackgroundToast('Image link copied to clipboard!');
                })
                .catch((error) => {
                    showBackgroundToast('Failed to copy link to clipboard', true);
                });
        } else {
            // Fallback for older browsers
            try {
                const textArea = document.createElement('textarea');
                textArea.value = imageUrl;
                textArea.style.position = 'fixed';
                textArea.style.left = '-999999px';
                textArea.style.top = '-999999px';
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                const successful = document.execCommand('copy');
                document.body.removeChild(textArea);

                if (successful) {
                    showBackgroundToast('Image link copied to clipboard!');
                } else {
                    showBackgroundToast('Failed to copy link to clipboard', true);
                }
            } catch (error) {
                showBackgroundToast('Failed to copy link to clipboard', true);
            }
        }
    }

    // Function to create a photo card element
    function createPhotoCard(photo) {
        const card = document.createElement('div');
        card.className = 'photo-card';
        card.title = 'Click to set as background'; // Add tooltip for main clickable area

        // Create image container with maximize overlay
        const imageContainer = document.createElement('div');
        imageContainer.className = 'photo-image-container';

        const img = document.createElement('img');
        img.src = photo.src.medium;
        img.alt = photo.alt;
        img.loading = 'lazy';
        img.title = 'Click to set as background'; // Add tooltip to image

        // Add error handler for fallback image
        img.onerror = function() {
            this.src = 'images/pexel/no-image.png';
            this.onerror = null; // Prevent infinite loop if fallback image also fails
        };

        // Create maximize overlay
        const maximizeOverlay = document.createElement('div');
        maximizeOverlay.className = 'maximize-overlay';
        maximizeOverlay.title = 'Preview background (10s auto-revert)';

        const maximizeIcon = document.createElement('img');
        maximizeIcon.src = 'images/pexel/maximize.png';
        maximizeIcon.alt = 'Preview';
        maximizeIcon.className = 'maximize-icon';

        maximizeOverlay.appendChild(maximizeIcon);

        // Add click event to maximize overlay for preview
        maximizeOverlay.addEventListener('click', (e) => {
            e.stopPropagation();
            previewAsBackground(photo);
        });

        imageContainer.appendChild(img);
        imageContainer.appendChild(maximizeOverlay);

        const infoContainer = document.createElement('div');
        infoContainer.className = 'photo-info';

        const description = document.createElement('p');
        description.className = 'description tooltip';
        const descText = photo.alt || 'No description';
        description.textContent = descText;
        description.setAttribute('data-tooltip', descText);
        description.title = descText; // Native tooltip as fallback

        const photographer = document.createElement('p');
        photographer.textContent = `By: ${photo.photographer}`;

        const dimension = document.createElement('p');
        dimension.textContent = `${photo.width}×${photo.height}`;

        const actions = document.createElement('div');
        actions.className = 'photo-actions';

        const saveBtn = document.createElement('img');
        saveBtn.src = 'images/pexel/not-save.png';
        saveBtn.alt = 'Save';
        saveBtn.className = 'action-icon';
        saveBtn.title = 'Save photo'; // Add tooltip for save button
        saveBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            savePhoto(photo);
        });

        const shareBtn = document.createElement('img');
        shareBtn.src = 'images/pexel/share.png';
        shareBtn.alt = 'Share';
        shareBtn.className = 'action-icon';
        shareBtn.title = 'Share photo'; // Add tooltip for share button
        shareBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            sharePhoto(photo);
        });

        actions.appendChild(saveBtn);
        actions.appendChild(shareBtn);

        infoContainer.appendChild(description);
        infoContainer.appendChild(photographer);
        infoContainer.appendChild(dimension);

        card.appendChild(imageContainer);
        card.appendChild(infoContainer);
        card.appendChild(actions);

        // Add click event to set as background (only on the main card area, not buttons)
        card.addEventListener('click', (e) => {
            // Check if the click was on an action button or maximize overlay
            if (e.target.classList.contains('action-icon')
                || e.target.classList.contains('maximize-icon')
                || e.target.classList.contains('maximize-overlay')) {
                return;
            }

            // Try updateBackground first (saves to database), fallback to setAsBackground
            updateBackground(photo).catch(() => {
                // If updateBackground fails (auth issues), just update UI
                setAsBackground(photo);
                showBackgroundToast('Background updated (UI only - please login to save)', true);
            });
        });

        // Add mouse events to manage tooltip display
        card.addEventListener('mouseenter', (e) => {
            // Hide card tooltip when hovering over elements with their own tooltips
            if (e.target.classList.contains('tooltip')
                || e.target.classList.contains('action-icon')
                || e.target.classList.contains('maximize-overlay')
                || e.target.classList.contains('maximize-icon')) {
                card.removeAttribute('title');
            } else {
                card.title = 'Click to set as background';
            }
        });

        // Add specific mouse events for the image
        img.addEventListener('mouseenter', () => {
            img.title = 'Click to set as background';
            card.removeAttribute('title'); // Remove card tooltip when hovering on image
        });

        img.addEventListener('mouseleave', () => {
            card.title = 'Click to set as background'; // Restore card tooltip
        });

        card.addEventListener('mouseleave', () => {
            // Restore card tooltip when leaving
            card.title = 'Click to set as background';
        });

        return card;
    }

    // Function to display search results
    function displaySearchResults(photos) {
        pexelsResults.innerHTML = '';
        if (photos.length === 0) {
            const noResults = document.createElement('div');
            noResults.className = 'no-results';
            noResults.textContent = 'No photos found';
            pexelsResults.appendChild(noResults);
            return;
        }

        photos.forEach((photo) => {
            const card = createPhotoCard(photo);
            pexelsResults.appendChild(card);
        });
    }

    // Function to search Pexels API
    async function searchPexelsPhotos(query) {
        if (!isPexelsConfigured()) {
            showBackgroundToast('Pexels API key is not configured. Please add your API key to use this feature.', true);
            return [];
        }

        // Show loading message
        pexelsResults.innerHTML = '';
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'no-results';
        loadingDiv.textContent = 'Loading photos...';
        pexelsResults.appendChild(loadingDiv);

        try {
            const response = await fetch(`${PEXELS_API_URL}?query=${query}&per_page=80`, {
                headers: {
                    Authorization: PEXELS_API_KEY
                }
            });

            if (!response.ok) {
                if (response.status === 401) {
                    showBackgroundToast('Invalid Pexels API key. Please check your configuration.', true);
                } else if (response.status === 429) {
                    showBackgroundToast('Rate limit exceeded. Please try again later.', true);
                } else {
                    showBackgroundToast(`Error: ${response.status} - ${response.statusText}`, true);
                }
                return [];
            }

            const data = await response.json();
            return data.photos;
        } catch (error) {
            showBackgroundToast('Network error. Please check your internet connection and try again.', true);
            return [];
        }
    }

    // Function to handle switching between Pexels and Saved views
    function switchView(activeButton, inactiveButton) {
        activeButton.classList.add("active");
        inactiveButton.classList.remove("active");

        // Show/hide appropriate search view
        if (activeButton === pexelsButton) {
            searchPexels.classList.add('active');
            searchAlbum.classList.remove('active');
            // Hide album results when on Pexels tab
            if (albumResults) {
                albumResults.style.display = 'none';
            }
            // Clear pexels search when switching to album
            if (pexelsSearchInput) {
                pexelsSearchInput.value = '';
                pexelsClearIcon.classList.remove('visible');
                pexelsResults.innerHTML = '';
            }
        } else {
            searchPexels.classList.remove('active');
            searchAlbum.classList.add('active');
            // Show album results when on Saved tab
            if (albumResults) {
                albumResults.style.display = 'flex';
            }
            // Load and render albums for Saved tab
            window.renderAlbumResults();
            // Clear pexels search when switching to album
            if (pexelsSearchInput) {
                pexelsSearchInput.value = '';
                pexelsClearIcon.classList.remove('visible');
                pexelsResults.innerHTML = '';
            }
        }
    }

    // Add click event listeners for Pexels/Saved toggle
    if (pexelsButton && savedButton) {
        pexelsButton.addEventListener("click", function() {
            switchView(pexelsButton, savedButton);
            // Track active source (pexels)
        });

        savedButton.addEventListener("click", function() {
            switchView(savedButton, pexelsButton);
            // Track active source (saved)
        });

        // Initialize view
        if (savedButton.classList.contains('active')) {
            searchAlbum.classList.add('active');
        } else {
            searchPexels.classList.add('active');
        }
    }

    // Add minimize/maximize functionality
    if (minimizeButton && backgroundContainer && openButton) {
        let isMinimized = false;

        minimizeButton.addEventListener("click", function() {
            isMinimized = true;
            backgroundContainer.classList.add('minimized');
        });

        openButton.addEventListener("click", function() {
            isMinimized = false;
            backgroundContainer.classList.remove('minimized');
        });
    }

    // Function to handle search input
    function setupSearch(searchInput, clearIcon, resultsContainer, searchCallback) {
        let searchTimeout;

        function updateClearButton() {
            const hasText = searchInput.value.trim().length > 0;
            if (hasText) {
                clearIcon.classList.add('visible');
            } else {
                clearIcon.classList.remove('visible');
            }
        }

        function clearSearch() {
            const input = searchInput;
            const results = resultsContainer;
            input.value = '';
            clearIcon.classList.remove('visible');
            results.innerHTML = '';
            input.focus();
        }

        searchInput.addEventListener('input', function() {
            if (searchTimeout) {
                clearTimeout(searchTimeout);
            }

            updateClearButton();

            const query = searchInput.value.trim();

            // If input is empty, immediately clear results
            if (query === '') {
                if (searchCallback) {
                    searchCallback('');
                }
                return;
            }

            // For non-empty queries, use timeout
            searchTimeout = setTimeout(() => {
                if (searchCallback) {
                    searchCallback(query);
                }
            }, 500);
        });

        clearIcon.addEventListener('click', clearSearch);

        // Initialize clear button state
        updateClearButton();
    }

    // Setup Pexels search
    if (pexelsSearchInput && pexelsClearIcon) {
        setupSearch(pexelsSearchInput, pexelsClearIcon, pexelsResults, async (query) => {
            if (query.trim() === '') {
                // Clear results when search is empty
                pexelsResults.innerHTML = '';
                return;
            }
            const photos = await searchPexelsPhotos(query);
            displaySearchResults(photos);
        });
    }

    // Setup Album search
    if (albumSearchInput && albumClearIcon) {
        setupSearch(albumSearchInput, albumClearIcon, albumResults, (query) => {
            if (query.trim() === '') {
                // Clear results when search is empty
                albumResults.innerHTML = '';

            }
            // TODO: Implement Album search
        });
    }

    // Create Album Modal Functionality
    const createAlbumModal = document.getElementById('create-album-modal');
    const createAlbumBtn = document.querySelector('.background-top-right');
    const closeBtn = document.getElementById('create-album-close');
    const checkBtn = document.getElementById('create-album-check');
    const albumNameInput = document.getElementById('album-name');
    const lengthCounter = document.querySelector('.length-counter');

    // Handle input validation and character counter
    albumNameInput.addEventListener('input', function() {
        const { length } = this.value;
        lengthCounter.textContent = `${length}/25`;

        // Enable/disable check button based on input length
        if (length > 0 && length <= 25) {
            checkBtn.classList.add('active');
        } else {
            checkBtn.classList.remove('active');
        }
    });

    // Show modal when create album button is clicked
    createAlbumBtn.addEventListener('click', function() {
        createAlbumModal.style.display = 'flex';
        albumNameInput.value = '';
        lengthCounter.textContent = '0/25';
        checkBtn.classList.remove('active');
    });

    // Close modal when close button is clicked
    closeBtn.addEventListener('click', function() {
        createAlbumModal.style.display = 'none';
    });

    // Handle album creation
    checkBtn.addEventListener('click', async function() {
        if (!checkBtn.classList.contains('active')) return;

        const albumName = albumNameInput.value;

        try {
            // Get current user data from session
            const userResponse = await fetch('/users/me');
            if (!userResponse.ok) {
                showBackgroundToast('Please log in to create albums', true);
                return;
            }
            const userData = await userResponse.json();
            const userId = userData.id;

            const response = await fetch('/api/albums', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    user_id: userId,
                    album_name: albumName
                })
            });

            if (!response.ok) {
                throw new Error('Failed to create album');
            }

            // Close create album modal
            createAlbumModal.style.display = 'none';
            showBackgroundToast('Album created successfully!');

            // Refresh the album list in the add-to-album modal
            const albumList = document.getElementById('add-to-album-list');
            if (albumList) {
                const albumsResponse = await fetch(`/api/albums/user/${userId}`);
                if (albumsResponse.ok) {
                    const albums = await albumsResponse.json();
                    // Sort albums alphabetically by album_name
                    albums.sort((a, b) => a.album_name.localeCompare(b.album_name));

                    // Store currently selected albums before clearing the list
                    const currentlySelected = new Set(selectedAlbums);

                    albumList.innerHTML = '';
                    albums.forEach((album) => {
                        const item = createAlbumItem(album, currentPhotoToAdd, document.getElementById('add-to-album-modal'));
                        albumList.appendChild(item);

                        // Restore selection state if this album was previously selected
                        if (currentlySelected.has(album.album_id)) {
                            const img = item.querySelector('.album-checkbox-img');
                            img.src = '/images/pexel/chosen.png';
                            img.alt = 'Chosen';
                            item.classList.add('selected');
                        }
                    });

                    // Update confirm button state
                    const confirmBtn = document.getElementById('add-to-album-confirm');
                    if (confirmBtn) {
                        if (selectedAlbums.size > 0) {
                            confirmBtn.classList.add('enabled');
                        } else {
                            confirmBtn.classList.remove('enabled');
                        }
                    }
                }
            }

            // Refresh the Saved tab album list if it's currently active
            const savedTab = document.getElementById('saved');
            if (savedTab && savedTab.classList.contains('active')) {
                window.renderAlbumResults();
            }
        } catch (error) {
            showBackgroundToast('Failed to create album', true);
        }
    });

    // --- Album Sort Dropdown State ---
    let albumSortField = 'Album Name'; // 'Album Name' or 'Total Images'
    let albumSortOrder = 'Ascending'; // 'Ascending' or 'Descending'
    let albumSortDropdownVisible = false;

    // --- Album Sort Dropdown Rendering ---
    window.renderAlbumSortDropdown = function() {
        const dropdown = document.getElementById('album-sort-dropdown');
        if (!dropdown) return;
        dropdown.innerHTML = window.albumSortDropdownVisible ? `
            <div class="dropdown-section">
                <div class="dropdown-item ${window.albumSortField === 'Album Name' ? 'selected' : ''}" data-field="Album Name">
                    <img src="images/pexel/sort/check.png" alt="check" style="width: 14px; height: 14px; margin-right: 5px;${window.albumSortField === 'Album Name' ? '' : 'opacity:0;'}"/>Album Name
                </div>
                <div class="dropdown-item ${window.albumSortField === 'Total Images' ? 'selected' : ''}" data-field="Total Images">
                    <img src="images/pexel/sort/check.png" alt="check" style="width: 14px; height: 14px; margin-right: 5px;${window.albumSortField === 'Total Images' ? '' : 'opacity:0;'}"/>Total Images
                </div>
            </div>
            <hr class="dropdown-divider">
            <div class="dropdown-section">
                <div class="dropdown-item ${window.albumSortOrder === 'Ascending' ? 'selected' : ''}" data-order="Ascending">
                    <img src="images/pexel/sort/check.png" alt="check" style="width: 14px; height: 14px; margin-right: 5px;${window.albumSortOrder === 'Ascending' ? '' : 'opacity:0;'}"/>Ascending
                </div>
                <div class="dropdown-item ${window.albumSortOrder === 'Descending' ? 'selected' : ''}" data-order="Descending">
                    <img src="images/pexel/sort/check.png" alt="check" style="width: 14px; height: 14px; margin-right: 5px;${window.albumSortOrder === 'Descending' ? '' : 'opacity:0;'}"/>Descending
                </div>
            </div>
        ` : '';
        if (window.albumSortDropdownVisible) {
            dropdown.style.display = 'block';
        } else {
            dropdown.style.display = 'none';
        }
    };

    window.sortAlbums = function(albums) {
        let sorted = [...albums];
        if (window.albumSortField === 'Album Name') {
            sorted.sort((a, b) => a.album_name.localeCompare(b.album_name));
        } else if (window.albumSortField === 'Total Images') {
            sorted.sort((a, b) => (a.image_count || 0) - (b.image_count || 0));
        }
        if (window.albumSortOrder === 'Descending') {
            sorted.reverse();
        }
        return sorted;
    };

    // Helper functions to show/hide changes
    function showChanges() {
        hasChanges = true;
        const confirmBtn = document.getElementById('edit-album-confirm');
        confirmBtn.classList.add('has-changes');
    }

    function hideChanges() {
        hasChanges = false;
        const confirmBtn = document.getElementById('edit-album-confirm');
        confirmBtn.classList.remove('has-changes');
    }

    // Function to show edit album modal
    async function showEditAlbumModal(album) {
        currentEditingAlbum = album;
        selectedAvatarImage = null;
        hasChanges = false;

        const modal = document.getElementById('edit-album-modal');
        const editCloseBtn = document.getElementById('edit-album-close');
        const deleteBtn = document.getElementById('edit-album-delete');
        const nameInput = document.getElementById('edit-album-name');
        const validationText = document.querySelector('.edit-validation-text');
        const avatarImg = document.getElementById('edit-album-avatar');
        const imagesContainer = document.getElementById('edit-album-images');
        const confirmBtn = document.getElementById('edit-album-confirm');

        try {
            // Fetch album details with images
            const response = await fetch(`/api/albums/${album.album_id}/details`);
            if (!response.ok) {
                throw new Error('Failed to fetch album details');
            }
            const albumData = await response.json();

            // Populate form with current album data
            nameInput.placeholder = albumData.album.album_name;
            nameInput.value = '';
            avatarImg.src = albumData.album.avatar_link || 'images/pexel/default-album.png';
            // Ensure avatar has consistent styling (remove any inline styles)
            avatarImg.removeAttribute('style');

            // Initialize character counter
            const editLengthCounter = document.querySelector('.edit-length-counter');
            if (editLengthCounter) {
                editLengthCounter.textContent = '0/25';
            }

            // Initialize confirm button state - start disabled since no changes yet
            hideChanges();

            // Clear and populate images
            imagesContainer.innerHTML = '';
            if (albumData.images.length === 0) {
                // Show message when no images in album
                const noImagesDiv = document.createElement('div');
                noImagesDiv.className = 'no-results';
                noImagesDiv.textContent = 'No images in this album';
                noImagesDiv.style.gridColumn = '1 / -1'; // Span all columns
                noImagesDiv.style.textAlign = 'center';
                noImagesDiv.style.padding = '30px 10px 30px 19px';
                noImagesDiv.style.color = '#666';
                noImagesDiv.style.fontSize = '20px';
                imagesContainer.appendChild(noImagesDiv);
            } else {
                albumData.images.forEach((image) => {
                    const imageItem = document.createElement('div');
                    imageItem.className = 'edit-album-image-item';
                    imageItem.innerHTML = `<img src="${image.image_url}" alt="${image.description || 'Album image'}" />`;

                    // Add click handler to select as avatar
                    imageItem.addEventListener('click', () => {
                        // Check if this image is already selected
                        const isCurrentlySelected = imageItem.classList.contains('selected');

                        // Remove all previous selections
                        document.querySelectorAll('.edit-album-image-item.selected').forEach((item) => {
                            item.classList.remove('selected');
                        });

                        if (isCurrentlySelected) {
                            // If clicking on already selected image, unselect it
                            selectedAvatarImage = null;

                            // Revert to original avatar
                            avatarImg.src = albumData.album.avatar_link || 'images/pexel/default-album.png';
                            avatarImg.removeAttribute('style');
                        } else {
                            // Select this new image
                            imageItem.classList.add('selected');
                            selectedAvatarImage = image.image_url;

                            // Update avatar - let CSS handle the sizing
                            avatarImg.src = image.image_url;
                            // Remove any inline styles that might interfere
                            avatarImg.removeAttribute('style');
                        }

                        // Update changes state based on current selections
                        const nameChanged = nameInput.value.trim().length > 0
                        && nameInput.value.trim() !== albumData.album.album_name;
                        const avatarChanged = selectedAvatarImage !== null;

                        if (nameChanged || avatarChanged) {
                            showChanges();
                        } else {
                            hideChanges();
                        }
                    });

                    imagesContainer.appendChild(imageItem);
                });
            }

            // Handle name input changes
            nameInput.addEventListener('input', function(event) {
                const { value } = event.target;
                const { length } = value;
                const currentName = albumData.album.album_name;
                const lengthCounter = document.querySelector('.edit-length-counter');

                // Update character counter
                if (lengthCounter) {
                    lengthCounter.textContent = `${length}/25`;
                }

                // Show red text when there's input (length > 0)
                if (length > 0) {
                    validationText.style.opacity = '1';
                } else {
                    validationText.style.opacity = '0';
                }

                // Show confirm button only if there are valid changes
                // For name: either user typed a new name, or selected a new avatar
                const nameChanged = length > 0 && value.trim() !== currentName;
                const avatarChanged = selectedAvatarImage !== null;

                if ((nameChanged && length >= 1 && length <= 25) || avatarChanged) {
                    showChanges();
                } else {
                    hideChanges();
                }
            });

            // Close button handler
            editCloseBtn.onclick = () => {
                modal.style.display = 'none';
                currentEditingAlbum = null;
                selectedAvatarImage = null;
                hasChanges = false;
            };

            // Delete button handler
            deleteBtn.onclick = () => {
                showDeleteAlbumModal(album);
            };

            // Confirm button handler
            confirmBtn.onclick = async () => {
                if (!hasChanges) return;

                // Use original name if input is empty, otherwise use the new input
                const newName = nameInput.value.trim() || albumData.album.album_name;

                // Only validate length if user actually typed something
                if (nameInput.value.trim()
                    && (nameInput.value.trim().length < 1 || nameInput.value.trim().length > 25)) {
                    showBackgroundToast('Album name must be between 1 and 25 characters', true);
                    return;
                }

                try {
                    const updateData = {
                        album_name: newName
                    };

                    if (selectedAvatarImage) {
                        updateData.avatar_link = selectedAvatarImage;
                    }

                    const updateResponse = await fetch(`/api/albums/${album.album_id}`, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(updateData)
                    });

                    if (!updateResponse.ok) {
                        throw new Error('Failed to update album');
                    }

                    modal.style.display = 'none';
                    showBackgroundToast('Album updated successfully!');

                    // Refresh album list
                    window.renderAlbumResults();
                } catch (error) {
                    showBackgroundToast('Failed to update album', true);
                }
            };

            // Show modal
            modal.style.display = 'flex';

        } catch (error) {
            showBackgroundToast('Failed to load album details', true);
        }
    }

    // Function to show delete album confirmation modal
    function showDeleteAlbumModal(album) {
        const modal = document.getElementById('deleteAlbumModal');
        const modalText = document.getElementById('deleteAlbumModalText');
        const closeBtn = document.getElementById('deleteAlbumModalClose');
        const cancelBtn = document.getElementById('deleteAlbumModalCancel');
        const confirmBtn = document.getElementById('deleteAlbumModalConfirm');

        // Update modal text with album name
        modalText.textContent = `Are you sure you want to delete the album "${album.album_name}"? This action cannot be undone.`;

        // Close modal handlers
        const closeModal = () => {
            modal.style.display = 'none';
        };

        closeBtn.onclick = closeModal;
        cancelBtn.onclick = closeModal;

        // Confirm delete handler
        confirmBtn.onclick = async () => {
            try {
                const deleteResponse = await fetch(`/api/albums/${album.album_id}`, {
                    method: 'DELETE'
                });

                if (!deleteResponse.ok) {
                    throw new Error('Failed to delete album');
                }

                const result = await deleteResponse.json();

                // Close modals
                modal.style.display = 'none';
                const editModal = document.getElementById('edit-album-modal');
                if (editModal) {
                    editModal.style.display = 'none';
                }

                // Show success message with additional info about deleted images
                let message = 'Album deleted successfully!';
                if (result.deletedImages > 0) {
                    message += ` ${result.deletedImages} unused image(s) were also removed.`;
                }
                showBackgroundToast(message);

                // Refresh album list
                window.renderAlbumResults();
            } catch (error) {
                showBackgroundToast('Failed to delete album', true);
                modal.style.display = 'none';
            }
        };

        // Close modal when clicking outside - DISABLED
        // modal.onclick = (e) => {
        //     if (e.target === modal) {
        //         closeModal();
        //     }
        // };

        // Show modal
        modal.style.display = 'block';
    }

    // Function to show delete all images confirmation modal
    function showDeleteAllImagesModal(album, imageCount) {
        const modal = document.getElementById('deleteAlbumModal');
        const modalText = document.getElementById('deleteAlbumModalText');
        const closeBtn = document.getElementById('deleteAlbumModalClose');
        const cancelBtn = document.getElementById('deleteAlbumModalCancel');
        const confirmBtn = document.getElementById('deleteAlbumModalConfirm');

        // Update modal text for image deletion
        modalText.textContent = `Are you sure you want to remove all ${imageCount} image(s) from "${album.album_name}"? This action cannot be undone.`;

        // Close modal handlers
        const closeModal = () => {
            modal.style.display = 'none';
        };

        closeBtn.onclick = closeModal;
        cancelBtn.onclick = closeModal;

        // Confirm delete handler for images
        confirmBtn.onclick = async () => {
            try {
                const deleteResponse = await fetch(`/api/albums/${album.album_id}/clear-images`, {
                    method: 'POST'
                });

                if (!deleteResponse.ok) {
                    throw new Error('Failed to clear images');
                }

                const result = await deleteResponse.json();

                // Close modal
                modal.style.display = 'none';

                // Refresh the view album modal (this will update the disabled state)
                showViewAlbumModal(album);

                // Show success message
                const { message } = result;
                let finalMessage = message;
                if (result.deletedFromDatabase > 0) {
                    finalMessage += ` ${result.deletedFromDatabase} unused image(s) were also permanently deleted.`;
                }
                showBackgroundToast(finalMessage);

                // Refresh album list
                window.renderAlbumResults();
            } catch (error) {
                showBackgroundToast('Failed to clear images from album', true);
                modal.style.display = 'none';
            }
        };

        // Close modal when clicking outside - DISABLED
        // modal.onclick = (e) => {
        //     if (e.target === modal) {
        //         closeModal();
        //     }
        // };

        // Show modal
        modal.style.display = 'block';
    }

    // Function to show delete selected images confirmation modal
    function showDeleteSelectedImagesModal(album, imageCount, selectedImages) {
        const modal = document.getElementById('deleteAlbumModal');
        const modalText = document.getElementById('deleteAlbumModalText');
        const closeBtn = document.getElementById('deleteAlbumModalClose');
        const cancelBtn = document.getElementById('deleteAlbumModalCancel');
        const confirmBtn = document.getElementById('deleteAlbumModalConfirm');

        // Update modal text for selected images deletion
        modalText.textContent = `Are you sure you want to remove ${imageCount} selected image(s) from "${album.album_name}"? This action cannot be undone.`;

        // Close modal handlers
        const closeModal = () => {
            modal.style.display = 'none';
        };

        closeBtn.onclick = closeModal;
        cancelBtn.onclick = closeModal;

        // Confirm delete handler for selected images
        confirmBtn.onclick = async () => {
            try {
                const removeResponse = await fetch(`/api/albums/${album.album_id}/remove-images`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        imageIds: Array.from(selectedImages)
                    })
                });

                if (!removeResponse.ok) {
                    throw new Error('Failed to remove images');
                }

                const result = await removeResponse.json();

                // Close modal
                modal.style.display = 'none';

                // Refresh the view album modal
                showViewAlbumModal(album);

                // Show success message
                const { message } = result;
                let finalMessage = message;
                if (result.deletedFromDatabase > 0) {
                    finalMessage += ` ${result.deletedFromDatabase} unused image(s) were also permanently deleted.`;
                }
                showBackgroundToast(finalMessage);

                // Refresh album list
                window.renderAlbumResults();
            } catch (error) {
                showBackgroundToast('Failed to remove images from album', true);
                modal.style.display = 'none';
            }
        };

        // Close modal when clicking outside - DISABLED
        // modal.onclick = (e) => {
        //     if (e.target === modal) {
        //         closeModal();
        //     }
        // };

        // Show modal
        modal.style.display = 'block';
    }

    window.renderAlbumResults = async function() {
        if (!albumResults) return;
        // Ensure albumResults is visible
        albumResults.style.display = 'flex';
        albumResults.innerHTML = '';
        // Get current user data from session
        let user;
        try {
            const userResponse = await fetch('/users/me');
            if (!userResponse.ok) {
                albumResults.innerHTML = '<div class="no-results">Please log in to view albums</div>';
                return;
            }
            user = await userResponse.json();
        } catch (error) {
            albumResults.innerHTML = '<div class="no-results">Failed to load user data</div>';
            return;
        }
        try {
            // Fetch user's albums (user.id from /users/me endpoint)
            const response = await fetch(`/api/albums/user/${user.id}`);
            if (!response.ok) {
                albumResults.innerHTML = '<div class="no-results">Failed to fetch albums</div>';
                return;
            }
            const albums = await response.json();

            // Use the sortAlbums function instead of hardcoded sort
            const sortedAlbums = window.sortAlbums(albums);

            if (sortedAlbums.length === 0) {
                albumResults.innerHTML = '<div class="no-results">No albums found</div>';
                return;
            }
            sortedAlbums.forEach((album) => {
                const card = document.createElement('div');
                card.className = 'album-list-card';
                card.innerHTML = `
                    <div class="album-list-thumb">
                        <img src="${album.avatar_link}" alt="Album" />
                    </div>
                    <div class="album-list-info">
                        <div class="album-list-name" title="${album.album_name}">${album.album_name}</div>
                        <div class="album-list-count">${album.image_count}</div>
                    </div>
                    <div class="album-edit-btn">
                        <img src="images/pexel/edit.png" alt="Edit Album" title="Edit album" />
                    </div>
                `;

                // Add click event to main card to view album images
                card.addEventListener('click', (e) => {
                    // Don't trigger if clicking on edit button
                    if (!e.target.closest('.album-edit-btn')) {
                        showViewAlbumModal(album);
                    }
                });

                // Add tooltip to the album card
                card.title = 'See all images in this album';

                // Add click event to edit button
                const editBtn = card.querySelector('.album-edit-btn');
                editBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    showEditAlbumModal(album);
                });

                albumResults.appendChild(card);
            });
        } catch (error) {
            albumResults.innerHTML = '<div class="no-results">Error loading albums</div>';
        }
    };

    // Set default sort state on window for global access
    window.albumSortField = 'Album Name';
    window.albumSortOrder = 'Ascending';
    window.albumSortDropdownVisible = false;

    // Function to show view album images modal
    async function showViewAlbumModal(album) {
        const modal = document.getElementById('viewAlbumModal');
        const titleElement = document.getElementById('viewAlbumTitle');
        const closeBtn = document.getElementById('viewAlbumClose');
        const deleteAllBtn = document.getElementById('viewAlbumDeleteAll');
        const imagesContainer = document.getElementById('viewAlbumImages');
        const removeSelectedBtn = document.getElementById('viewAlbumRemoveSelected');

        let selectedImages = new Set();

        titleElement.textContent = album.album_name;

        try {
            // Fetch album details with images
            const response = await fetch(`/api/albums/${album.album_id}/details`);
            if (!response.ok) {
                throw new Error('Failed to fetch album details');
            }
            const albumData = await response.json();

            // Clear and populate images
            imagesContainer.innerHTML = '';
            selectedImages.clear();
            removeSelectedBtn.classList.remove('enabled');

            if (albumData.images.length === 0) {
                // Disable delete all button when album is empty
                deleteAllBtn.classList.add('disabled');

                // Show message when no images in album
                const noImagesDiv = document.createElement('div');
                noImagesDiv.className = 'view-album-no-images';
                noImagesDiv.textContent = 'No images in this album';
                imagesContainer.appendChild(noImagesDiv);
            } else {
                // Enable delete all button when album has images
                deleteAllBtn.classList.remove('disabled');

                albumData.images.forEach((image) => {
                    const imageItem = document.createElement('div');
                    imageItem.className = 'view-album-image-item';
                    imageItem.setAttribute('data-image-id', image.background_id);

                    // Create image container (similar to photo-image-container)
                    const imageContainer = document.createElement('div');
                    imageContainer.className = 'view-album-image-container';
                    imageContainer.title = 'Click to set as background';

                    const img = document.createElement('img');
                    img.src = image.image_url;
                    img.alt = image.description || 'Album image';
                    img.loading = 'lazy';
                    img.title = 'Click to set as background'; // Add tooltip to image

                    // Add error handler for fallback image
                    img.onerror = function() {
                        this.src = 'images/pexel/no-image.png';
                        this.onerror = null; // Prevent infinite loop if fallback image also fails
                    };

                    // Create maximize overlay (like in Pexels search)
                    const maximizeOverlay = document.createElement('div');
                    maximizeOverlay.className = 'view-album-maximize-overlay';
                    maximizeOverlay.title = 'Preview background (10s auto-revert)';

                    const maximizeIcon = document.createElement('img');
                    maximizeIcon.src = 'images/pexel/maximize.png';
                    maximizeIcon.alt = 'Preview';
                    maximizeIcon.className = 'view-album-maximize-icon';

                    maximizeOverlay.appendChild(maximizeIcon);
                    imageContainer.appendChild(img);
                    imageContainer.appendChild(maximizeOverlay);

                    // Add maximize overlay click handler for preview
                    maximizeOverlay.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const photo = {
                            id: image.background_id,
                            src: {
                                original: image.image_url
                            },
                            photographer: image.photographer,
                            alt: image.description || 'Album image'
                        };
                        previewAsBackground(photo);
                    });

                    // Add image click handler for setting as background
                    imageItem.addEventListener('click', (e) => {
                        // Only trigger if not clicking on overlay or action buttons
                        if (!e.target.closest('.view-album-maximize-overlay')
                            && !e.target.closest('.view-album-image-actions')) {
                            const photo = {
                                id: image.background_id,
                                src: {
                                    original: image.image_url
                                },
                                photographer: image.photographer,
                                alt: image.description || 'Album image'
                            };

                            // Try updateBackground first (saves to database)
                            updateBackground(photo).catch(() => {
                                // If updateBackground fails (auth issues), just update UI
                                setAsBackground(photo);
                                showBackgroundToast('Background updated (UI only - please login to save)', true);
                            });
                        }
                    });

                    // Set tooltip on the main item
                    imageItem.title = 'Click to set as background';

                    // Create info container (similar to photo-info)
                    const infoContainer = document.createElement('div');
                    infoContainer.className = 'view-album-image-info';

                    const description = document.createElement('p');
                    description.className = 'description';
                    const descText = image.description || 'No description';
                    description.textContent = descText;
                    description.title = descText; // Native tooltip

                    const photographer = document.createElement('p');
                    photographer.textContent = `By: ${image.photographer || 'Unknown'}`;

                    const dimension = document.createElement('p');
                    dimension.textContent = `${image.width}×${image.height}`;

                    infoContainer.appendChild(description);
                    infoContainer.appendChild(photographer);
                    infoContainer.appendChild(dimension);

                    // Create actions container (similar to photo-actions)
                    const actions = document.createElement('div');
                    actions.className = 'view-album-image-actions';

                    const checkbox = document.createElement('img');
                    checkbox.src = 'images/pexel/not-choose.png';
                    checkbox.alt = 'Select';
                    checkbox.className = 'view-album-checkbox';
                    checkbox.title = 'Select for removal';
                    checkbox.setAttribute('data-image-id', image.background_id);

                    const shareBtn = document.createElement('img');
                    shareBtn.src = 'images/pexel/copy-saved-image.png';
                    shareBtn.alt = 'Copy Link';
                    shareBtn.className = 'view-album-share';
                    shareBtn.title = 'Copy image link';
                    shareBtn.setAttribute('data-image-url', image.image_url);

                    actions.appendChild(shareBtn);
                    actions.appendChild(checkbox);

                    // Assemble the complete item
                    imageItem.appendChild(imageContainer);
                    imageItem.appendChild(infoContainer);
                    imageItem.appendChild(actions);

                    // Add checkbox click handler
                    checkbox.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const imageId = parseInt(checkbox.getAttribute('data-image-id'), 10);

                        if (selectedImages.has(imageId)) {
                            selectedImages.delete(imageId);
                            checkbox.src = 'images/pexel/not-choose.png';
                            checkbox.alt = 'Select';
                        } else {
                            selectedImages.add(imageId);
                            checkbox.src = 'images/pexel/chosen.png';
                            checkbox.alt = 'Selected';
                        }

                        // Show/hide remove button based on selection
                        if (selectedImages.size > 0) {
                            removeSelectedBtn.classList.add('enabled');
                            removeSelectedBtn.textContent = `Remove Selected (${selectedImages.size})`;
                        } else {
                            removeSelectedBtn.classList.remove('enabled');
                            removeSelectedBtn.textContent = 'Remove Selected';
                        }
                    });

                    // Add share click handler
                    shareBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const imageUrl = shareBtn.getAttribute('data-image-url');

                        if (navigator.clipboard && navigator.clipboard.writeText) {
                            navigator.clipboard.writeText(imageUrl)
                                .then(() => {
                                    showBackgroundToast('Image link copied to clipboard!');
                                })
                                .catch(() => {
                                    showBackgroundToast('Failed to copy link to clipboard', true);
                                });
                        } else {
                            // Fallback for older browsers
                            try {
                                const textArea = document.createElement('textarea');
                                textArea.value = imageUrl;
                                textArea.style.position = 'fixed';
                                textArea.style.left = '-999999px';
                                textArea.style.top = '-999999px';
                                document.body.appendChild(textArea);
                                textArea.focus();
                                textArea.select();
                                const successful = document.execCommand('copy');
                                document.body.removeChild(textArea);

                                if (successful) {
                                    showBackgroundToast('Image link copied to clipboard!');
                                } else {
                                    showBackgroundToast('Failed to copy link to clipboard', true);
                                }
                            } catch (error) {
                                showBackgroundToast('Failed to copy link to clipboard', true);
                            }
                        }
                    });

                    imagesContainer.appendChild(imageItem);
                });
            }

            // Close button handler
            closeBtn.onclick = () => {
                modal.style.display = 'none';
            };

            // Delete all images handler
            deleteAllBtn.onclick = async () => {
                // Check if button is disabled
                if (deleteAllBtn.classList.contains('disabled')) {
                    return;
                }

                if (albumData.images.length === 0) {
                    showBackgroundToast('Album is already empty', true);
                    return;
                }

                showDeleteAllImagesModal(album, albumData.images.length);
            };

            // Remove selected images handler
            removeSelectedBtn.onclick = async () => {
                if (selectedImages.size === 0) return;

                const imageCount = selectedImages.size;
                showDeleteSelectedImagesModal(album, imageCount, selectedImages);
            };

            // Close modal when clicking outside - DISABLED
            // modal.onclick = (e) => {
            //     if (e.target === modal) {
            //         modal.style.display = 'none';
            //     }
            // };

            // Show modal
            modal.style.display = 'flex';

        } catch (error) {
            showBackgroundToast('Failed to load album details', true);
        }
    }

    // Make showViewAlbumModal globally accessible
    window.showViewAlbumModal = showViewAlbumModal;
});

document.addEventListener('DOMContentLoaded', async function() {
    window.renderAlbumSortDropdown(); // Ensure dropdown is initialized
    const sortBtn = document.getElementById('album-sort-btn');
    const dropdown = document.getElementById('album-sort-dropdown');
    // Fetch albums for the current user and render
    if (document.getElementById('saved').classList.contains('active')) {
        // Get current user from session
        fetch('/users/me')
            .then((userRes) => (userRes.ok ? userRes.json() : null))
            .then((user) => {
                if (!user) {
                    // User not logged in, show empty state
                    renderSearchAlbums([]);
                    return Promise.resolve([]);
                }
                return fetch(`/api/albums/user/${user.id}`)
                    .then((res) => (res.ok ? res.json() : []));
            })
            .then((albums) => {
                window.allAlbums = albums;
                window.renderAlbumResults();
            })
            .catch((err) => {
                window.allAlbums = [];
                window.renderAlbumResults();
            });
    }
    if (sortBtn) {
        sortBtn.onclick = function(e) {
            e.stopPropagation();
            window.albumSortDropdownVisible = !window.albumSortDropdownVisible;
            window.renderAlbumSortDropdown();
        };
    }
    if (dropdown) {
        dropdown.onclick = function(e) {
            e.stopPropagation(); // Prevent click from bubbling to document
            var dropdownItem = e.target.closest('.dropdown-item');
            var field = dropdownItem && dropdownItem.getAttribute('data-field');
            var order = dropdownItem && dropdownItem.getAttribute('data-order');
            if (field) window.albumSortField = field;
            if (order) window.albumSortOrder = order;
            window.renderAlbumSortDropdown();
            window.renderAlbumResults();
        };
    }
    document.addEventListener('click', function(e) {
        if (window.albumSortDropdownVisible
            && !dropdown.contains(e.target) && e.target !== sortBtn) {
            window.albumSortDropdownVisible = false;
            window.renderAlbumSortDropdown();
        }
    });
});

// Update Saved tab click event to use the new renderAlbumResults
const savedTab = document.getElementById('saved');
if (savedTab) {
    savedTab.addEventListener('click', async function() {
        setTimeout(async () => {
            if (savedTab.classList.contains('active')) {
                // Ensure album results are visible and populated
                if (albumResults) {
                    albumResults.style.display = 'flex';
                }
                await window.renderAlbumResults();
            }
        }, 100);
    });
}

// Album search input only filters the in-memory list
const albumSearchInput = document.querySelector('.album-search-box .search-input');
if (albumSearchInput) {
    albumSearchInput.addEventListener('input', function() {
        window.renderAlbumResults();
    });
}
