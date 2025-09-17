// Global variables
let currentPeriod = 'weekly';
let currentRegion = '';
let isLoadingLeaderboard = false;
let retryTimeout = null;

// Display leaderboard data with retry mechanism
async function displayLeaderboard(retryCount = 0) {
    if (isLoadingLeaderboard) {
        return;
    }

    // Clear any existing retry timeout
    if (retryTimeout) {
        clearTimeout(retryTimeout);
        retryTimeout = null;
    }

    isLoadingLeaderboard = true;
    const maxRetries = 3;
    const leaderboardContainer = document.querySelector('.leaderboard-container');

    // Clear existing content
    const oldHeader = document.querySelector('.leaderboard-header-section');
    const oldContent = document.querySelector('.leaderboard-data-section');
    const oldCurrentUser = document.querySelector('.current-user-section');
    if (oldHeader) oldHeader.remove();
    if (oldContent) oldContent.remove();
    if (oldCurrentUser) oldCurrentUser.remove();

    // Show loading state
    const loadingSection = document.createElement('div');
    loadingSection.className = 'leaderboard-loading';
    loadingSection.innerHTML = `
        <div class="loading-spinner"></div>
        <p>Loading leaderboard data...</p>
    `;
    leaderboardContainer.appendChild(loadingSection);

    try {
        // Get current user data from localStorage
        const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
        const userId = currentUser.id || currentUser.user_id; // Try both id and user_id

        // Build API URL with parameters
        const params = new URLSearchParams();
        if (currentRegion) params.append('region', currentRegion);
        if (userId) params.append('user_id', userId);

        const apiUrl = `/timer/api/leaderboard/${currentPeriod}?${params.toString()}`;

        // Fetch data from backend with timeout
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000); // 10 second timeout

        const response = await fetch(apiUrl, {
            signal: controller.signal
        });
        clearTimeout(timeout);

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP error! status: ${response.status}, text: ${errorText}`);
        }

        const data = await response.json();
        const leaderboardData = data.leaderboard || [];
        const currentUserData = data.currentUser;

        // Remove loading state
        const loadingElement = document.querySelector('.leaderboard-loading');
        if (loadingElement) {
            loadingElement.remove();
        }

        // Get available regions from the backend
        let regions = [];
        try {
            const regionsResponse = await fetch('/timer/api/regions');
            if (regionsResponse.ok) {
                regions = await regionsResponse.json();
            }
        } catch (regionsError) {
            regions = [...new Set(leaderboardData.map((item) => item.region))].sort();
        }

        // Filter data by region if one is selected (filtered by backend, but keep for consistency)
        const filteredData = leaderboardData;

        // Create header section (fixed, non-scrollable)
        const headerSection = document.createElement('div');
        headerSection.className = 'leaderboard-header-section';

        const headerRow = document.createElement('div');
        headerRow.className = 'leaderboard-header-row';
        headerRow.innerHTML = `
            <div>Rank</div>
            <div>Name</div>
            <div>City</div>
            <div class="region-header" id="region-header-clickable">
                <img src="images/filter.png" alt="Filter" class="filter-icon">
                <span class="region-display-text">${currentRegion || 'All Regions'}</span>
                <select id="region-select" class="region-select">
                    <option value="">All Regions</option>
                    ${regions.map((region) => `
                        <option value="${region}" ${region === currentRegion ? 'selected' : ''}>
                            ${region}
                        </option>
                    `).join('')}
                </select>
            </div>
            <div>Study Time</div>
        `;
        headerSection.appendChild(headerRow);
        leaderboardContainer.appendChild(headerSection);

        // Add event listener to region select
        const regionSelect = headerRow.querySelector('#region-select');
        regionSelect.addEventListener('change', (e) => {
            currentRegion = e.target.value;
            displayLeaderboard();
        });

        // Add click event listener to the entire region header area
        const regionHeader = headerRow.querySelector('#region-header-clickable');
        regionHeader.addEventListener('click', (e) => {
            // Prevent event bubbling
            e.stopPropagation();
            // Trigger the select dropdown
            regionSelect.focus();
            // Use a small delay to ensure focus is set before triggering
            setTimeout(() => {
                const event = new MouseEvent('mousedown', {
                    view: window,
                    bubbles: true,
                    cancelable: true
                });
                regionSelect.dispatchEvent(event);
            }, 10);
        });

        // Create data section (scrollable)
        const dataSection = document.createElement('div');
        dataSection.className = 'leaderboard-data-section';

        // Display filtered data
        filteredData.forEach((item, index) => {
            const position = item.rank;
            const row = document.createElement('div');
            row.className = `leaderboard-item ${position <= 3 ? `top-${position}` : ''}`;

            // Create position content based on rank
            let positionContent;
            if (position <= 3) {
                let suffix;
                if (position === 1) {
                    suffix = 'st';
                } else if (position === 2) {
                    suffix = 'nd';
                } else {
                    suffix = 'rd';
                }
                positionContent = `<img src="images/rank/${position}${suffix}.png" alt="${position}${suffix} place" class="rank-image">`;
            } else {
                positionContent = position;
            }

            const userAvatar = item.avatar_link || 'images/default-avatar.png';

            row.innerHTML = `
                <div class="position">${positionContent}</div>
                <div class="name">
                    <img src="${userAvatar}" alt="User avatar" class="user-avatar" onerror="this.src='images/default-avatar.png'">
                    <span>${item.name}</span>
                </div>
                <div class="city">${item.city || 'Unknown'}</div>
                <div class="region">${item.region || 'Unknown Region'}</div>
                <div class="total-time">${item.totalTime}</div>
            `;

            dataSection.appendChild(row);
        });

        // Append data section to container
        leaderboardContainer.appendChild(dataSection);

        // Create current user section
        const currentUserSection = document.createElement('div');
        currentUserSection.className = 'current-user-section';

        // Use currentUserData if available, otherwise use localStorage fallback
        let userDisplayData;
        if (currentUserData) {
            userDisplayData = {
                rank: currentUserData.rank,
                avatar: currentUserData.avatar_link || 'images/default-avatar.png',
                name: currentUserData.name,
                city: currentUserData.city || 'Unknown',
                region: currentUserData.region || 'Unknown Region',
                totalTime: currentUserData.totalTime
            };
        } else {
            // Current user not found in the filtered region, show appropriate message
            currentUserSection.innerHTML = `
                <div class="current-user-not-found">
                    <div class="not-found-message">
                        You are not in the selected region${currentRegion ? ` (${currentRegion})` : ''}.
                        <br>
                        <span class="change-region-hint">Select "All Regions" to see your ranking.</span>
                    </div>
                </div>
            `;
            leaderboardContainer.appendChild(currentUserSection);
            return; // Exit early since we don't need to process rank content
        }

        let rankContent;
        if (userDisplayData.rank <= 3) {
            let suffix;
            if (userDisplayData.rank === 1) {
                suffix = 'st';
            } else if (userDisplayData.rank === 2) {
                suffix = 'nd';
            } else {
                suffix = 'rd';
            }
            rankContent = `<img src="images/rank/${userDisplayData.rank}${suffix}.png" alt="${userDisplayData.rank} place" class="rank-image">`;
        } else {
            rankContent = userDisplayData.rank;
        }

        currentUserSection.innerHTML = `
            <div class="leaderboard-item current-user">
                <div class="position">${rankContent}</div>
                <div class="name">
                    <img src="${userDisplayData.avatar}" alt="User avatar" class="user-avatar" onerror="this.src='images/default-avatar.png'">
                    <span>${userDisplayData.name}</span>
                </div>
                <div class="city">${userDisplayData.city}</div>
                <div class="region">${userDisplayData.region}</div>
                <div class="total-time">${userDisplayData.totalTime}</div>
            </div>
        `;

        // Append current user section to container
        leaderboardContainer.appendChild(currentUserSection);

    } catch (error) {
        // Remove loading state if it exists
        const loadingElement = document.querySelector('.leaderboard-loading');
        if (loadingElement) {
            loadingElement.remove();
        }

        // Show error state
        const errorSection = document.createElement('div');
        errorSection.className = 'leaderboard-error';
        errorSection.innerHTML = `
            <div class="error-message">
                Unable to load leaderboard data. Please try again later.
            </div>
            <button class="retry-button" onclick="displayLeaderboard()">Retry</button>
        `;
        leaderboardContainer.appendChild(errorSection);

        // Retry logic
        if (retryCount < maxRetries) {
            retryTimeout = setTimeout(() => {
                displayLeaderboard(retryCount + 1);
            }, Math.min(1000 * (2 ** retryCount), 10000)); // Exponential backoff, max 10s
        }
    } finally {
        isLoadingLeaderboard = false;
    }
}

// Initialize leaderboard
document.addEventListener('DOMContentLoaded', () => {
    // Set up tab click handlers
    const tabs = document.querySelectorAll('.leaderboard-tab');
    tabs.forEach((tab) => {
        tab.addEventListener('click', () => {
            // Remove active class from all tabs
            tabs.forEach((t) => t.classList.remove('active'));
            // Add active class to clicked tab
            tab.classList.add('active');
            currentPeriod = tab.dataset.period;
            // Always refresh data when switching tabs
            displayLeaderboard();
        });
    });

    // Initial data load
    displayLeaderboard();
});

// Function to refresh leaderboard (can be called from other scripts)
window.refreshLeaderboard = function() {
    if (typeof displayLeaderboard === 'function') {
        displayLeaderboard();
    }
};

// Auto-refresh leaderboard when the leaderboard section becomes visible
const leaderboardObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
            const appContainer = document.querySelector('.app-container');
            if (appContainer && appContainer.classList.contains('show-leaderboard')) {
                // Leaderboard just became visible, refresh data
                displayLeaderboard();
            }
        }
    });
});

// Start observing the app container for class changes
const appContainer = document.querySelector('.app-container');
if (appContainer) {
    leaderboardObserver.observe(appContainer, { attributes: true });
}


