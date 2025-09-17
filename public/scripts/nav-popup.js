document.addEventListener('DOMContentLoaded', function () {
  // Popup content for each nav item (for popup-based sections)
  const navData = {
    studystats: {
      title: '',
      body: `
        <div class="stats-container">
          <span class="nav-popup-close">&times;</span>
          <div class="stats-header">
            <div class="stat-label">This week</div>
          </div>
          <div class="stat-time-row">
            <img src="images/timer-clock.png" alt="Timer Clock" class="timer-icon">
            <span class="stat-time" id="week-time">00:00:00</span>
          </div>

          <div class="stat-label">This month</div>
          <div class="stat-time-row">
            <img src="images/timer-clock.png" alt="Timer Clock" class="timer-icon">
            <span class="stat-time" id="month-time">00:00:00</span>
          </div>

          <div class="stat-label">All time</div>
          <div class="stat-time-row">
            <img src="images/timer-clock.png" alt="Timer Clock" class="timer-icon">
            <span class="stat-time" id="all-time">00:00:00</span>
          </div>
        </div>
      `,
      type: 'stats'
    }
  };

  let currentPopupType = null;
  let previousPageState = null; // Track the page state before opening study stats popup
  const appContainer = document.querySelector('.app-container');

  // Function to manage tabindex for elements in different app sections
  function updateTabIndex() {
    // Get the current visible section based on container class
    const isHomeVisible = appContainer.classList.contains('show-home');
    const isAchievementsVisible = appContainer.classList.contains('show-achievements');
    const isLeaderboardVisible = appContainer.classList.contains('show-leaderboard');
    const isStudyStatsVisible = appContainer.classList.contains('show-studystats');



    // Define focusable elements for each section - find ALL elements regardless of current tabindex
    const sections = {
      home: {
        visible: isHomeVisible,
        selector: '#home-section'
      },
      achievements: {
        visible: isAchievementsVisible,
        selector: '#achievements-section'
      },
      leaderboard: {
        visible: isLeaderboardVisible,
        selector: '#leaderboard-section'
      },
      studystats: {
        visible: isStudyStatsVisible,
        selector: '#studystats-section'
      }
    };

        // Keep all navigation items accessible - users able to Tab to navigate between sections
    const navItems = document.querySelectorAll('.nav-item[data-popup]');
    navItems.forEach((navItem) => {
      // Restore navigation items to be accessible
      if (navItem.hasAttribute('data-original-tabindex')) {
        const originalValue = navItem.getAttribute('data-original-tabindex');
        if (originalValue === 'null') {
          navItem.removeAttribute('tabindex');
        } else {
          navItem.setAttribute('tabindex', originalValue);
        }
        navItem.removeAttribute('data-original-tabindex');
      }
    });

    // Handle modal/popup elements that are outside sections
    const modalSelectors = [
      '#profile-popup',
      '#nav-popup',
      '#avatar-popup',
      '.add-to-album-modal',
      '.create-album-modal',
      '.edit-album-modal',
      '#deleteAlbumModal',
      '#viewAlbumModal'
    ];

    modalSelectors.forEach((modalSelector) => {
      const modal = document.querySelector(modalSelector);
      if (modal) {
        const isModalVisible = modal.style.display !== 'none' && !modal.hasAttribute('hidden');
        const modalElements = modal.querySelectorAll('button, input, select, textarea, a[href], [contenteditable="true"], [tabindex]');

        modalElements.forEach((element) => {
          if (isModalVisible) {
            // Restore original tabindex for visible modals
            if (element.hasAttribute('data-original-tabindex')) {
              const originalValue = element.getAttribute('data-original-tabindex');
              if (originalValue === 'null') {
                element.removeAttribute('tabindex');
              } else {
                element.setAttribute('tabindex', originalValue);
              }
              element.removeAttribute('data-original-tabindex');
            }
          } else {
            // Disable tab access for hidden modals
            if (!element.hasAttribute('data-original-tabindex')) {
              const originalTabindex = element.getAttribute('tabindex');
              element.setAttribute('data-original-tabindex', originalTabindex || 'null');
            }
            element.setAttribute('tabindex', '-1');
          }
        });
      }
    });

    // Update tabindex for each section
    Object.keys(sections).forEach((sectionKey) => {
      const section = sections[sectionKey];
      const sectionElement = document.querySelector(section.selector);

      if (sectionElement) {
        // Set section-level accessibility attributes
        if (section.visible) {
          // Make section accessible
          sectionElement.removeAttribute('aria-hidden');
          sectionElement.removeAttribute('inert');
        } else {
          // Hide section from assistive technology
          sectionElement.setAttribute('aria-hidden', 'true');
          // Use inert if supported (modern browsers)
          if ('inert' in sectionElement) {
            sectionElement.inert = true;
          }
        }

        // Find all naturally focusable elements within this section
        const focusableSelectors = [
          'button',
          'input',
          'select',
          'textarea',
          'a[href]',
          '[contenteditable="true"]',
          '[tabindex]',
          'summary' // for details/summary elements
        ];

        const elements = [];
        focusableSelectors.forEach((sel) => {
          try {
            const found = sectionElement.querySelectorAll(sel);
            elements.push(...found);
          } catch (e) {
            // Invalid selector
          }
        });

        // Also disable the section container itself if it has tabindex or is focusable
        if (sectionElement.hasAttribute('tabindex') || sectionElement.tabIndex >= 0) {
          elements.push(sectionElement);
        }

        // Set tabindex based on visibility
        elements.forEach((element) => {
          if (section.visible) {
            // Remove tabindex to make elements focusable (or restore original)
            if (element.hasAttribute('data-original-tabindex')) {
              const originalValue = element.getAttribute('data-original-tabindex');
              if (originalValue === 'null') {
                element.removeAttribute('tabindex');
              } else {
                element.setAttribute('tabindex', originalValue);
              }
              element.removeAttribute('data-original-tabindex');
            }
          } else {
            // Save original tabindex and set to -1 to make unfocusable
            if (!element.hasAttribute('data-original-tabindex')) {
              const originalTabindex = element.getAttribute('tabindex');
              element.setAttribute('data-original-tabindex', originalTabindex || 'null');
            }
            element.setAttribute('tabindex', '-1');
          }
        });
      }
    });
  }

  // Function to load study stats from backend
  async function loadStudyStats() {
    try {
      const response = await fetch('/users/study-stats', {
        method: 'GET',
        credentials: 'include'
      });

      if (response.ok) {
        const stats = await response.json();

        // Update the displayed stats
        const weekTimeElement = document.getElementById('week-time');
        const monthTimeElement = document.getElementById('month-time');
        const allTimeElement = document.getElementById('all-time');

        if (weekTimeElement) weekTimeElement.textContent = stats.thisWeek;
        if (monthTimeElement) monthTimeElement.textContent = stats.thisMonth;
        if (allTimeElement) allTimeElement.textContent = stats.allTime;
      }
    } catch (error) {
      // Error loading study stats
    }
  }

  // Function to remove active state from all nav items
  function clearActiveNavItems() {
    document.querySelectorAll('.nav-group .nav-item').forEach((item) => {
      item.classList.remove('nav-active');
      item.classList.remove('active');
    });
  }

    // Function to close popup
  function closePopup() {
    const popup = document.getElementById('nav-popup');
    if (popup) {
      popup.style.display = 'none';

      // If closing study stats popup, restore previous page state
      if (currentPopupType === 'studystats' && previousPageState) {
        appContainer.className = previousPageState.containerClass;
        // Restore the active nav item
        clearActiveNavItems();
        if (previousPageState.activeNavItem) {
          previousPageState.activeNavItem.classList.add('active');
        }
        // Update tab navigation state for restored page
        updateTabIndex();
        previousPageState = null;
      }
      // Don't clear active nav items for regular popup closes - home button to lose active state

      currentPopupType = null;
    }
  }

    // Function to show popup
  function showPopup(type) {
    const popup = document.getElementById('nav-popup');
    const popupTitle = document.getElementById('nav-popup-title');
    const popupBody = document.getElementById('nav-popup-body');
    const data = navData[type];

    // Close any existing popup first
    closePopup();

    // Clear any existing classes and styles
    popup.className = 'nav-popup';
    const popupContent = popup.querySelector('.nav-popup-content');

    // Only set position for stats popup, not for default popups
    if (data.type === 'stats') {
      popup.classList.add('stats-popup');
      const navItem = document.querySelector(`.nav-item[data-popup="${type}"]`);
      if (navItem) {
        const rect = navItem.getBoundingClientRect();
        popupContent.style.position = 'fixed';

        // Position stats popup right below the studystats icon
        const popupWidth = 240; // width of the stats popup
        let leftPosition = rect.left + (rect.width / 2) - (popupWidth / 2);
        // Responsive top position: mobile screens need more space due to taller nav bar
        let topPosition = 20;
        if (window.innerWidth < 768) {
          // Use fixed positioning for mobile based on CSS analysis
          // Very small mobile (<= 541px): nav bar is shorter, title visible
          if (window.innerWidth <= 541) {
            topPosition = 80; // 3px gap for small screens
          } else {
            topPosition = 95; // 3px gap for medium screens
          }
        }

        // Calculate positioning values

        // Ensure popup doesn't go off screen
        const windowWidth = window.innerWidth;
        const margin = 20; // 20px margin from screen edges

        if (leftPosition < margin) {
          leftPosition = margin;
        } else if (leftPosition + popupWidth > windowWidth - margin) {
          leftPosition = windowWidth - popupWidth - margin;
        }

        // Force the positioning with !important styles
        popupContent.style.setProperty('top', `${topPosition}px`, 'important');
        popupContent.style.setProperty('left', `${leftPosition}px`, 'important');
        popupContent.style.setProperty('right', 'auto', 'important');
        popupContent.style.setProperty('transform', 'none', 'important');
        popupContent.style.setProperty('margin-left', '0', 'important');
        popupContent.style.setProperty('margin-right', '0', 'important');
      }
    } else {
      popup.classList.add('default-popup');
    }

    popupTitle.textContent = data.title;
    popupBody.innerHTML = data.body;

    // Add active state to clicked item
    const navItem = document.querySelector(`.nav-item[data-popup="${type}"]`);
    navItem.classList.add('nav-active');
    navItem.classList.add('active');

    // Show the popup after positioning is set
    popup.style.display = 'block';
    currentPopupType = type;

    // For stats popup, ensure positioning is applied after display
    if (data.type === 'stats') {
      setTimeout(() => {
        const targetNavItem = document.querySelector(`.nav-item[data-popup="${type}"]`);
        if (targetNavItem) {
          const targetRect = targetNavItem.getBoundingClientRect();
          const popupWidth = 240;
          let leftPosition = targetRect.left + (targetRect.width / 2) - (popupWidth / 2);
          // Responsive top position: mobile screens need more space due to taller nav bar
          let topPosition = 20;
          if (window.innerWidth < 768) {
            // Use fixed positioning for mobile based on CSS analysis
            // Very small mobile (<= 541px): nav bar is shorter, title visible
            if (window.innerWidth <= 541) {
              topPosition = 80; // 3px gap for small screens
            } else {
              topPosition = 95; // 3px gap for medium screens
            }
          }

          // Ensure popup doesn't go off screen
          const windowWidth = window.innerWidth;
          const margin = 20;

          if (leftPosition < margin) {
            leftPosition = margin;
          } else if (leftPosition + popupWidth > windowWidth - margin) {
            leftPosition = windowWidth - popupWidth - margin;
          }

          // Force the positioning again to ensure it takes effect
          popupContent.style.setProperty('top', `${topPosition}px`, 'important');
          popupContent.style.setProperty('left', `${leftPosition}px`, 'important');
        }
      }, 10);
    }

    // Load study stats if this is the stats popup
    if (type === 'studystats') {
      loadStudyStats();
    }

    // Add event listener for close button if it's the stats popup
    if (data.type === 'stats') {
      const closeButton = popup.querySelector('.nav-popup-close');
      if (closeButton) {
        // Remove any existing click listeners by cloning
        const newCloseButton = closeButton.cloneNode(true);
        closeButton.parentNode.replaceChild(newCloseButton, closeButton);
        // Add new click listener
        newCloseButton.addEventListener('click', function(e) {
          e.stopPropagation();
          closePopup();
        });
      }
    }
  }

  // Function to handle navigation transitions
  function handleNavigation(type) {
    clearActiveNavItems();

    // Stop any running timer when navigating away from home page
    if (type !== 'studysolo') {
      if (window.personalTimer) {
        // Only pause the timer if it's running, don't reset it
        if (window.personalTimer.isRunning) {
          try {
            window.personalTimer.pauseTimer();
          } catch (error) {
            // Error pausing timer
          }
        }
      } else {
        // Try to wait for timer to become available
        setTimeout(() => {
          if (window.personalTimer && window.personalTimer.isRunning) {
            window.personalTimer.pauseTimer();
          }
        }, 100);
      }
    }

    // Handle transitions for different sections
    if (type === 'studysolo') {
      appContainer.className = 'app-container show-home';
    } else if (type === 'achievements') {
      appContainer.className = 'app-container show-achievements';
      // Always refresh achievements when navigating to achievements section
      if (typeof window.refreshAchievements === 'function') {
        // Add multiple refresh attempts to ensure data is loaded
        setTimeout(() => {
          window.refreshAchievements().catch((error) => {
            // Error refreshing achievements
          });
        }, 0);

        // Additional refresh after a short delay to catch any missed updates
        setTimeout(() => {
          window.refreshAchievements().catch((error) => {
            // Error in delayed achievement refresh
          });
        }, 200);
      }
    } else if (type === 'studystats') {
      appContainer.className = 'app-container show-studystats';
    } else if (type === 'leaderboard') {
      appContainer.className = 'app-container show-leaderboard';
    }

    // Update tabindex for focusable elements based on new visible section
    updateTabIndex();

    // Add active class to clicked nav item
    const navItem = document.querySelector(`.nav-item[data-popup="${type}"]`);
    if (navItem) {
      navItem.classList.add('active');
    }
  }

    // Listen for nav-item clicks
  document.querySelectorAll('.nav-group .nav-item[data-popup]').forEach(function (item) {
    item.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      const popupType = this.getAttribute('data-popup');

            // Handle Study Stats as popup (can be opened on any page)
      if (popupType === 'studystats') {
        // If clicking the same popup that's already open, close it
        if (currentPopupType === popupType) {
          closePopup();
          return;
        }

        // Save current page state before opening study stats popup
        const currentActiveNavItem = document.querySelector('.nav-item.active');
        previousPageState = {
          containerClass: appContainer.className,
          activeNavItem: currentActiveNavItem
        };

        // Show the stats popup without changing page
        showPopup(popupType);
      } else {
        // Close any open popup before navigating
        closePopup();

        // Check if we're already on the target page
        // const isAlreadyOnTarget = (popupType === 'achievements'
        //   && appContainer.classList.contains('show-achievements'))
        //   || (popupType === 'leaderboard' && appContainer.classList.contains('show-leaderboard'))
        //   || (popupType === 'studysolo' && appContainer.classList.contains('show-home'));

        // Handle page transitions for other sections
        handleNavigation(popupType);

        // Special handling for achievements - always refresh, even if already on achievements page
        if (popupType === 'achievements') {
          // Always refresh achievements when clicking the achievements tab
          if (typeof window.refreshAchievements === 'function') {
            // Multiple refresh attempts to ensure data is current
            setTimeout(() => {
              window.refreshAchievements().catch((error) => {
                // Error refreshing achievements on click
              });
            }, 100);

            setTimeout(() => {
              window.refreshAchievements().catch((error) => {
                // Error in second achievement refresh on click
              });
            }, 300);
          }
        }
      }
    });
  });

  // Close popup when clicking outside
  document.addEventListener('click', function (e) {
    const popup = document.getElementById('nav-popup');
    if (!popup || popup.style.display === 'none') return;

    const navItems = document.querySelectorAll('.nav-group .nav-item[data-popup]');

    // Check if click is on a nav item (don't close if clicking nav items)
    let clickedOnNavItem = false;
    navItems.forEach(function (item) {
      if (item.contains(e.target)) {
        clickedOnNavItem = true;
      }
    });

    // If clicked on nav item, let the nav item handler deal with it
    if (clickedOnNavItem) {
      return;
    }

    // Check if click is on search inputs (Spotify or Pexels) - don't interfere with search
    const isSearchInput = e.target.matches('.search-input')
                         || e.target.closest('.search-box')
                         || e.target.closest('.pexels-search-box')
                         || e.target.closest('.album-search-box')
                         || e.target.closest('#search-container')
                         || e.target.closest('.search-pexels')
                         || e.target.closest('.search-album');

    if (isSearchInput) {
      return; // Don't close popup or affect navigation when interacting with search
    }

    // For stats popup, check if click is inside the stats container
    if (popup.classList.contains('stats-popup')) {
      const statsContainer = popup.querySelector('.stats-container');
      // If clicking inside the stats container, don't close
      if (statsContainer && statsContainer.contains(e.target)) {
        return;
      }
      // If clicking outside the stats container, close the popup
      closePopup();
    } else {
      // For other popups, use the original logic
      const popupContent = popup.querySelector('.nav-popup-content');
      if (!popupContent.contains(e.target)) {
        closePopup();
      }
    }
  });

  // Set default view to home
  appContainer.className = 'app-container show-home';
  document.querySelector('.nav-item[data-popup="studysolo"]').classList.add('active');

  // Set initial tab navigation state
  updateTabIndex();

  // Make updateTabIndex globally accessible for other scripts
  window.updateTabIndex = updateTabIndex;

    // Debug function to test tab navigation
  window.debugTabNavigation = function() {
    // const leaderboardButtons = document.querySelectorAll('#leaderboard-section button');
    // const achievementElements
    // = document.querySelectorAll('#achievements-section button, #achievements-section input,
    // #achievements-section select, #achievements-section a');

    // Check ALL focusable elements in the page
    // const allFocusable
    // = document.querySelectorAll('button, input, select, textarea, a[href],
    // [contenteditable="true"], [tabindex]:not([tabindex="-1"])');

    updateTabIndex();
  };

  // Handle window resize to reposition stats popup if open
  window.addEventListener('resize', function() {
    if (currentPopupType === 'studystats') {
      showPopup('studystats');
    }
  });
});
