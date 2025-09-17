/* eslint-disable no-unused-vars */
/* eslint-disable no-use-before-define */
document.addEventListener('DOMContentLoaded', function() {
    // Initialize achievements when page loads
    initializeAchievements();
});

// Achievement data structure
const achievementTemplates = {
    'timeless-seeker': {
        title: 'TIMELESS SEEKER',
        description: 'Study for a total of 90 minutes in a single day with Study1Only!',
        lockedDescription: 'Study for a total of 90 minutes in a single day to unlock this achievement.',
        icon: 'images/timeless-seeker.png'
    },
    'rising-flame': {
        title: 'RISING FLAME',
        description: 'Use Study1Only continuously for 3 days!',
        lockedDescription: 'Study for 3 consecutive days to unlock this achievement.',
        icon: 'images/rising-flame.png'
    },
    'endurance-scholar': {
        title: 'ENDURANCE SCHOLAR',
        description: 'Accumulate a total of 300 minutes of study time!',
        lockedDescription: 'Study for a total of 300 minutes to unlock this achievement.',
        icon: 'images/endurance-scholar.png'
    }
};

// Function to create achievement HTML
function createAchievementHTML(achievement) {
    const isAchieved = achievement.achieved;
    const isLocked = !isAchieved;

    return `
        <div class="achievement-item ${isAchieved ? 'achieved' : 'locked'}" data-achievement-id="${achievement.id}">
            <img src="${achievement.icon}" alt="${achievement.title}" class="achievement-icon ${isLocked ? 'locked-icon' : ''}">
            <div class="achievement-info">
                <h3 class="achievement-title">${achievement.title}</h3>
                <p class="achievement-description">${isAchieved ? achievement.description : achievement.lockedDescription}</p>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${Math.min((achievement.progress / achievement.total) * 100, 100)}%"></div>
                </div>
                <div class="progress-info">
                    <span class="progress-text">${achievement.progress}/${achievement.total}</span>
                    <div class="achievement-status ${isAchieved ? 'achieved' : ''}">
                        <span class="status-icon ${isLocked ? 'locked' : ''}">${isAchieved ? '✓' : '🔒'}</span>
                        <span class="status-text">${isAchieved ? 'Achieved' : 'Locked'}</span>
                    </div>
                </div>
                ${isAchieved ? '<span class="checkmark">✓</span>' : ''}
            </div>
        </div>
    `;
}

// Function to initialize achievements display
async function initializeAchievements() {
    try {
        // Show default achievements immediately for better UX
        showDefaultAchievements();
        // Then load real data from server immediately
        await refreshAchievements();
    } catch (error) {
        // Keep default achievements if server request fails
        showDefaultAchievements();
    }
}

// Function to show default achievements (fallback)
function showDefaultAchievements() {
    const achievementList = document.querySelector('.achievement-list');
    if (!achievementList) return;

    const defaultAchievements = [
        {
            id: 'timeless-seeker', progress: 0, total: 90, achieved: false
        },
        {
            id: 'rising-flame', progress: 0, total: 3, achieved: false
        },
        {
            id: 'endurance-scholar', progress: 0, total: 300, achieved: false
        }
    ];

    const html = defaultAchievements.map((achievement) => {
        const template = achievementTemplates[achievement.id];
        return createAchievementHTML({ ...achievement, ...template });
    }).join('');

    achievementList.innerHTML = html;
}

// Function to update achievement progress in real-time
function updateAchievementProgress(achievementId, currentProgress, totalProgress) {
    const achievementItem = document.querySelector(`[data-achievement-id="${achievementId}"]`);
    if (!achievementItem) return;

    const progressFill = achievementItem.querySelector('.progress-fill');
    const progressText = achievementItem.querySelector('.progress-text');

    if (progressFill && progressText) {
        const percentage = Math.min((currentProgress / totalProgress) * 100, 100);
        progressFill.style.width = `${percentage}%`;
        progressText.textContent = `${currentProgress}/${totalProgress}`;

        // Check if achievement is now completed
        if (currentProgress >= totalProgress) {
            const statusIcon = achievementItem.querySelector('.status-icon');
            const statusText = achievementItem.querySelector('.status-text');
            const checkmark = achievementItem.querySelector('.checkmark');

            if (statusIcon && statusText) {
                statusIcon.textContent = '✓';
                statusIcon.classList.remove('locked');
                statusText.textContent = 'Achieved';
                achievementItem.classList.remove('locked');
                achievementItem.classList.add('achieved');
            }

            if (!checkmark) {
                const newCheckmark = document.createElement('span');
                newCheckmark.className = 'checkmark';
                newCheckmark.textContent = '✓';
                achievementItem.querySelector('.achievement-info').appendChild(newCheckmark);
            }
        }
    }
}

let isRefreshing = false;

// Function to refresh achievements from server
async function refreshAchievements() {
    // Prevent multiple simultaneous refresh calls
    if (isRefreshing) {
        return;
    }

    isRefreshing = true;

    try {
        const response = await fetch('/api/achievements/check', {
            method: 'GET',
            credentials: 'include',
            headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                Pragma: 'no-cache',
                Expires: '0'
            }
        });

        if (!response.ok) throw new Error('Failed to fetch achievements');

        const data = await response.json();

        // Update achievement display only if we have valid data
        const achievementList = document.querySelector('.achievement-list');
        if (achievementList && data.achievements && Array.isArray(data.achievements)) {
            const html = data.achievements.map((achievement) => {
                const template = achievementTemplates[achievement.id];
                if (template) {
                    return createAchievementHTML({ ...achievement, ...template });
                }
                return '';
            }).filter((item) => item).join('');

            if (html) {
                achievementList.innerHTML = html;
            }
        }

        // Update total counter in header
        const totalSpan = document.querySelector('.achievements-header .total');
        if (totalSpan && data.summary) {
            totalSpan.textContent = `(Total: ${data.summary.achieved}/${data.summary.total})`;
        }


    } catch (error) {
        // Only show default if we don't already have content
        const achievementList = document.querySelector('.achievement-list');
        if (!achievementList || achievementList.children.length === 0) {
            showDefaultAchievements();
        }
        throw error; // Re-throw to allow caller to handle
    } finally {
        isRefreshing = false;
    }
}

// Make refreshAchievements globally available
window.refreshAchievements = refreshAchievements;

// Enhanced auto-refresh achievements when page becomes visible or when navigating to achievements
let achievementRefreshInterval;

function startAchievementAutoRefresh() {
    if (achievementRefreshInterval) {
        clearInterval(achievementRefreshInterval);
    }

    // Refresh immediately when starting auto-refresh
    const appContainer = document.querySelector('.app-container');
    if (appContainer && appContainer.classList.contains('show-achievements')) {
        refreshAchievements().catch((error) => {
        });
    }

    // Then set up periodic refresh
    achievementRefreshInterval = setInterval(() => {
        const container = document.querySelector('.app-container');
        if (container && container.classList.contains('show-achievements')) {
            refreshAchievements().catch((error) => {
            });
        }
    }, 30000); // Refresh every 30 seconds
}

// Listen for page visibility changes to refresh achievements
document.addEventListener('visibilitychange', function() {
    if (!document.hidden) {
        const appContainer = document.querySelector('.app-container');
        if (appContainer && appContainer.classList.contains('show-achievements')) {
            // Refresh achievements when page becomes visible
            setTimeout(() => {
                refreshAchievements().catch((error) => {
                });
            }, 100);
        }
    }
});

// Start auto-refresh when page loads
document.addEventListener('DOMContentLoaded', startAchievementAutoRefresh);

// Also refresh when the achievements section becomes visible
const observer = new MutationObserver(function(mutations) {
    mutations.forEach(function(mutation) {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
            const { target } = mutation;
            if (target.classList.contains('app-container')) {
                if (target.classList.contains('show-achievements')) {
                    // Achievements section just became visible, refresh data
                    setTimeout(() => {
                        refreshAchievements().catch((error) => {
                        });
                    }, 50);
                }
            }
        }
    });
});

// Start observing changes to the app container
document.addEventListener('DOMContentLoaded', function() {
    const appContainer = document.querySelector('.app-container');
    if (appContainer) {
        observer.observe(appContainer, { attributes: true });
    }
});
