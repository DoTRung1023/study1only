// Achievement integration for PersonalTimer
// This file handles achievement refreshing when timer completes

// Timer completion handler for achievements
function onTimerComplete(sessionDuration) {
  setTimeout(() => {
    if (typeof window.refreshAchievements === 'function') {
      window.refreshAchievements().catch((error) => {
        // Error refreshing achievements
      });
    }
  }, 1000);
}

// Initialize achievement timer listener
document.addEventListener('DOMContentLoaded', function() {
  // Listen for timer completion events from PersonalTimer (home-clock.js)
  document.addEventListener('timerComplete', function(event) {
    onTimerComplete(event.detail.duration);
  });
});

// Make achievement refresh function globally available
window.onTimerComplete = onTimerComplete;
