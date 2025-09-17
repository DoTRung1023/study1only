// Toast notification function
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


// Wait for DOM to be fully loaded before manipulating elements
document.addEventListener('DOMContentLoaded', async function() {
  // Function to get current user data from session
  async function getCurrentUserData() {
    try {
      const response = await fetch('/users/me', {
        method: 'GET',
        credentials: 'include',
        headers: {
          Accept: 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to get user data from session');
      }

      return await response.json();
    } catch (error) {
      showToast('Error getting user data from session:', error);
      throw error;
    }
  }

  // Get user data from session instead of localStorage
  let user;
  try {
    user = await getCurrentUserData();
  } catch (error) {
    // If session check fails, redirect to login
    window.location.href = 'login.html';
    return;
  }

  if (!user) {
    window.location.href = 'login.html';
    return;
  }

  // Profile popup state
  let profilePopupVisible = false;

  // Update profile name in nav and popup
  const navProfile = document.querySelector('#profile-link span');
  const popupProfile = document.querySelector('#profile-popup h3');

  if (navProfile) {
    navProfile.textContent = user.username || 'User';
  }

  if (popupProfile) {
    popupProfile.textContent = user.username || 'User';
  }

  // Update avatar in nav and popup
  const navAvatar = document.querySelector('#profile-link .profile-avatar');
  const popupAvatar = document.querySelector('#profile-popup .profile-header img');

  // Helper function to set avatar with fallback
  function setAvatar(element, avatarLink) {
    if (!element) return;

    const newSrc = avatarLink && avatarLink.trim() !== ''
      ? avatarLink
      : 'images/default-avatar.png';

    const img = new Image();
    img.onload = function() {
      const targetElement = element;
      targetElement.src = newSrc;
      if (targetElement.classList.contains('profile-avatar')) {
        targetElement.style.width = '40px';
        targetElement.style.height = '40px';
      } else {
        // Check if mobile device (width < 768px) for bigger avatar
        const isMobile = window.innerWidth < 768;
        const avatarSize = isMobile ? '90px' : '70px';
        targetElement.style.width = avatarSize;
        targetElement.style.height = avatarSize;
      }
      targetElement.style.objectFit = 'cover';
    };

    img.onerror = function() {
      const targetElement = element;
      targetElement.src = 'images/default-avatar.png';
    };

    img.src = newSrc;
  }

  const avatarUrl = user.photo || user.avatar_link;
  setAvatar(navAvatar, avatarUrl);
  setAvatar(popupAvatar, avatarUrl);

  // Profile popup functionality
  function toggleProfilePopup(event) {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }

    profilePopupVisible = !profilePopupVisible;

    const popup = document.getElementById('profile-popup');
    if (popup) {
      popup.style.display = profilePopupVisible ? 'block' : 'none';
    }

  }

  function closeProfilePopup() {
    profilePopupVisible = false;
    const popup = document.getElementById('profile-popup');
    if (popup) {
      popup.style.display = 'none';
    }
  }

  function openAvatarPopup() {
    closeProfilePopup();
    const avatarPopup = document.getElementById('avatar-popup');
    if (avatarPopup) {
      avatarPopup.style.display = 'flex';
    }
  }

  // Add event listeners
  const profileLink = document.getElementById('profile-link');
  if (profileLink) {
    profileLink.addEventListener('click', toggleProfilePopup);
    profileLink.addEventListener('keyup', function(e) {
      if (e.key === 'Enter' || e.key === ' ') {
        toggleProfilePopup(e);
      }
    });
  }

  // Click outside to close popup
  document.addEventListener('click', function(event) {
    const profilePopup = document.getElementById('profile-popup');
    const profileLinkEl = document.getElementById('profile-link');

    if (profilePopup && profileLinkEl
        && !profilePopup.contains(event.target)
        && !profileLinkEl.contains(event.target)) {
      closeProfilePopup();
    }
  });

  // Profile action handlers
  const changeAvatarBtn = document.getElementById('change-avatar');
  if (changeAvatarBtn) {
    changeAvatarBtn.addEventListener('click', openAvatarPopup);
  }

  const logoutBtn = document.getElementById('logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async function(e) {
      e.preventDefault();
      e.stopPropagation();

      try {
        const response = await fetch('/users/logout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          credentials: 'same-origin'
        });

        if (!response.ok) {
          throw new Error('Logout failed');
        }

        // Clear all user-related data (including timer state)
        if (typeof window.clearAllUserState === 'function') {
          window.clearAllUserState();
        } else {
        localStorage.clear();
        }

        setTimeout(() => {
          window.location.href = '/login.html';
        }, 100);
      } catch (error) {
        // Clear all user-related data (including timer state)
        if (typeof window.clearAllUserState === 'function') {
          window.clearAllUserState();
        } else {
        localStorage.clear();
        }

        setTimeout(() => {
          window.location.href = '/login.html';
        }, 100);
      }
    });
  }

  // Make functions globally available
  window.toggleProfilePopup = toggleProfilePopup;
  window.closeProfilePopup = closeProfilePopup;
  window.openAvatarPopup = openAvatarPopup;
});

// Add a backup initialization for cases where the DOMContentLoaded event might have already fired
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  // Small timeout to ensure DOM is accessible
  setTimeout(function() {
    const event = new Event('DOMContentLoaded');
    document.dispatchEvent(event);
  }, 100);
}
