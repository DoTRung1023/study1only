// Modal CAPTCHA logic
let captchaResult = 0;
let captchaAttempts = 0;
const MAX_CAPTCHA_ATTEMPTS = 5;
const LOCKOUT_DURATION = 30 * 60 * 1000; // 30 minutes in milliseconds
// eslint-disable-next-line no-unused-vars
let pendingUserData = null; // Store user data temporarily until CAPTCHA is completed

// Helper functions for error message display
function showErrorMessage(message) {
  const errorMessage = document.getElementById("error-message");
  const errorContainer = document.getElementById("error-message-container");
  errorMessage.textContent = message;
  errorContainer.style.display = "flex";
}

function hideErrorMessage() {
  const errorContainer = document.getElementById("error-message-container");
  errorContainer.style.display = "none";
}

// Check if user is already authenticated and redirect accordingly
(async function checkExistingAuth() {
    try {
        const response = await fetch('/users/me', {
            method: 'GET',
            credentials: 'include',
            headers: {
                Accept: 'application/json'
            }
        });

        if (response.ok) {
            const userData = await response.json();
            // User is already authenticated, redirect to appropriate page
            if (userData.role === 'admin') {
                window.location.href = '/admin.html';
            } else {
                window.location.href = '/home.html';
            }
        }
        // If not authenticated, continue with normal login page behavior
    } catch (error) {
        // If there's an error checking auth, continue with normal login page behavior
    }
}());

function generateModalCaptcha() {
  let num1 = Math.floor(Math.random() * 9) + 1; // 1-9
  let num2 = Math.floor(Math.random() * 9) + 1; // 1-9

  // Randomly choose operation: 0 for multiplication, 1 for addition, 2 for subtraction
  const operation = Math.floor(Math.random() * 3);
  let question;
  let result;

  switch (operation) {
    case 0: // Multiplication
      result = num1 * num2;
      question = `What is ${num1} × ${num2}?`;
      break;
    case 1: // Addition
      result = num1 + num2;
      question = `What is ${num1} + ${num2}?`;
      break;
    case 2: // Subtraction
      // Ensure num1 is greater than num2 to avoid negative results
      if (num1 < num2) {
        [num1, num2] = [num2, num1]; // Swap numbers
      }
      result = num1 - num2;
      question = `What is ${num1} - ${num2}?`;
      break;
    default: // Fallback to multiplication
      result = num1 * num2;
      question = `What is ${num1} × ${num2}?`;
      break;
  }

  captchaResult = result;
  document.getElementById("modal-captcha-question").textContent = question;
  document.getElementById("modal-captcha-answer").value = "";
}

function showCaptchaModal() {
  generateModalCaptcha();
  document.getElementById("captcha-modal").style.display = "flex";
  document.body.style.overflow = "hidden";
  document.getElementById("modal-captcha-answer").focus();
  // Clear any previous error message when first showing the modal
  document.getElementById("modal-captcha-error").textContent = "";
}

function hideCaptchaModal() {
  document.getElementById("captcha-modal").style.display = "none";
  document.body.style.overflow = "auto";
  // Reset attempt counter when modal is closed
  captchaAttempts = 0;
}

// eslint-disable-next-line no-unused-vars
function togglePassword() {
  const passwordInput = document.getElementById("password");
  const toggleIcon = document.getElementById("toggleIcon");

  const isHidden = passwordInput.getAttribute("type") === "password";
  passwordInput.setAttribute("type", isHidden ? "text" : "password");
  toggleIcon.innerHTML = isHidden
    ? '<img src="images/unhide.png" alt="unhide" />'
    : '<img src="images/hide.png" alt="hide" />';
}

// Check if user is locked out
function checkLockout(username) {
  const lockoutInfo = JSON.parse(localStorage.getItem('captchaLockout') || '{}');
  if (lockoutInfo[username] && lockoutInfo[username].timestamp) {
    const timeLeft = lockoutInfo[username].timestamp + LOCKOUT_DURATION - Date.now();
    if (timeLeft > 0) {
      showErrorMessage("Error login please try it later");
      return true;
    }
    // Lockout expired for this username
    delete lockoutInfo[username];
    localStorage.setItem('captchaLockout', JSON.stringify(lockoutInfo));
    captchaAttempts = 0;
  }
  return false;
}

// Clear Spotify-related data
function clearSpotifyData() {
  localStorage.removeItem('spotify_access_token');
  localStorage.removeItem('spotify_refresh_token');
  localStorage.removeItem('spotify_user_id');
}

// Intercept login button to check credentials first
document.getElementById("loginButton").addEventListener("click", async (e) => {
  e.preventDefault();

  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;
  hideErrorMessage();

  // Add validation for empty fields
  if (!username.trim() || !password.trim()) {
    showErrorMessage("Username and password are required");
    return;
  }

  if (checkLockout(username)) {
    return;
  }

  // Validate username length
  if (username.length > 10) {
    showErrorMessage("Username must be 10 characters or less");
    return;
  }

  // Get user's local time zone
  const { timeZone } = Intl.DateTimeFormat().resolvedOptions().timeZone;
  // Get client's current datetime in MySQL format (local time)
  const now = new Date();
  const pad = (n) => n.toString().padStart(2, '0');
  const clientDateTime = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

  try {
    const response = await fetch('/users/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username: username,
        password: password,
        timeZone: timeZone, // send time zone to backend
        clientDateTime: clientDateTime // send client datetime to backend (local time)
      })
    });

    let data;
    try {
      data = await response.json();
    } catch (parseError) {
      showErrorMessage("Too many login attempts please try again later");
      return;
    }

    if (!response.ok) {
      // Show the specific error message from the server
      showErrorMessage(data.message || 'Login failed');
      return;
    }

    // Validate user data structure
    if (!data.user || typeof data.user !== 'object') {
      showErrorMessage("Too many login attempts please try again");
      return;
    }

    // Store user data temporarily - don't save to localStorage until CAPTCHA is completed
    pendingUserData = {
      user_id: data.user.id,
      username: data.user.username,
      avatar_link: data.user.avatar_link || '/images/default-avatar.png',
      role: data.user.role,
      region: data.user.region,
      address: data.user.address,
      total_study_time: data.user.total_study_time,
      current_streak: data.user.current_streak,
      longest_streak: data.user.longest_streak,
      background: data.user.background || '/images/default-background.png'
    };

    // Clear any existing Spotify data before storing new user data
    clearSpotifyData();

    // Credentials are correct, show CAPTCHA modal
    showCaptchaModal();
  } catch (error) {
    showErrorMessage("Network error. Please try again.");
  }
});

// Handle CAPTCHA modal submit
document.getElementById("modal-captcha-submit").addEventListener("click", async () => {
  const username = document.getElementById("username").value;
  const errorDiv = document.getElementById("modal-captcha-error");

  if (checkLockout(username)) {
    hideCaptchaModal();
    return;
  }

  const answer = document.getElementById("modal-captcha-answer").value;

  if (!answer.trim()) {
    errorDiv.textContent = "Please enter an answer";
    errorDiv.style.display = "block";
    return;
  }

  const userAnswer = parseInt(answer, 10);
  if (isNaN(userAnswer)) {
    errorDiv.textContent = "Please enter a valid number";
    errorDiv.style.display = "block";
    return;
  }

  if (userAnswer !== captchaResult) {
    captchaAttempts++;
    if (captchaAttempts >= MAX_CAPTCHA_ATTEMPTS) {
      // Set lockout for this specific username
      const lockoutInfo = JSON.parse(localStorage.getItem('captchaLockout') || '{}');
      lockoutInfo[username] = {
        timestamp: Date.now()
      };
      localStorage.setItem('captchaLockout', JSON.stringify(lockoutInfo));

      hideCaptchaModal();
      showErrorMessage("Error login please try it later");
      return;
    }
    errorDiv.textContent = "Incorrect answer. Please try again.";
    errorDiv.style.display = "block";
    document.getElementById("modal-captcha-answer").value = "";
    // Generate new question after showing error
    setTimeout(() => {
      generateModalCaptcha();
    }, 1000); // Wait 1 second before showing new question
    return;
  }

  // CAPTCHA is correct, now complete the login by creating session
  try {
    // Get user's local time zone
    const { timeZone } = Intl.DateTimeFormat().resolvedOptions().timeZone;
    // Get client's current datetime in MySQL format (local time)
    const now = new Date();
    const pad = (n) => n.toString().padStart(2, '0');
    const clientDateTime = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

    const completeLoginResponse = await fetch('/users/complete-login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({
        username: username,
        timeZone: timeZone,
        clientDateTime: clientDateTime
      })
    });

    if (!completeLoginResponse.ok) {
      const errorData = await completeLoginResponse.json();
      hideCaptchaModal();
      showErrorMessage(errorData.message || 'Login completion failed');
      return;
    }

    const loginData = await completeLoginResponse.json();

    // Now that login is completed successfully, store user data in localStorage
    // Use the complete user data from the server response
    const userData = {
      user_id: loginData.user.id,
      username: loginData.user.username,
      avatar_link: loginData.user.avatar_link,
      role: loginData.user.role,
      region: loginData.user.region,
      address: loginData.user.address,
      total_study_time: loginData.user.total_study_time,
      current_streak: loginData.user.current_streak,
      longest_streak: loginData.user.longest_streak,
      background: loginData.user.background,
      spotifyConnected: loginData.user.spotifyConnected,
      spotifyIsPremium: loginData.user.spotifyIsPremium
    };
    localStorage.setItem('user', JSON.stringify(userData));

    // Clear any existing Spotify data before storing new user data
    clearSpotifyData();

    // Session is valid, proceed with redirect
    hideCaptchaModal();
    // Restore Spotify tokens if connected
    fetch('/my-tokens')
      .then((res) => {
        if (res.ok) {
          return res.json();
        }
        return null;
      })
      .then((tokens) => {
        if (tokens) {
          localStorage.setItem('spotify_access_token', tokens.access_token);
          localStorage.setItem('spotify_refresh_token', tokens.refresh_token);
          // Optionally store expiry, etc.
        }
        if (userData.role && userData.role.toUpperCase() === "ADMIN") {
          window.location.href = "/admin.html";
        } else {
          window.location.href = "/home.html";
        }
      });
  } catch (error) {
    hideCaptchaModal();
    pendingUserData = null; // Clear pending data
    clearSpotifyData();
    showErrorMessage("Network error during login completion. Please try again.");
  }
});

// Handle CAPTCHA cancel button
document.getElementById("modal-captcha-cancel").addEventListener("click", async () => {
  hideCaptchaModal();
  // Clear any stored user data since they canceled
  pendingUserData = null; // Clear pending data
  clearSpotifyData();
});

// Allow pressing Enter in the modal input to submit
document.getElementById("modal-captcha-answer").addEventListener("keydown", function(e) {
  if (e.key === "Enter") {
    document.getElementById("modal-captcha-submit").click();
  }
});

// Handle URL parameters for error messages
document.addEventListener('DOMContentLoaded', function() {
  const urlParams = new URLSearchParams(window.location.search);
  const error = urlParams.get('error');

  if (error) {
    // const errorMessage = document.getElementById("error-message");
    let message = '';

    switch (error) {
      case 'access_denied':
        message = 'Access denied. You need admin privileges to access this page.';
        break;
      case 'auth_required':
        message = 'Please log in to access this page.';
        break;
      case 'auth_error':
        message = 'Authentication error. Please try logging in again.';
        break;
      case 'session_expired':
        message = 'Your session has expired. Please log in again.';
        break;
      case 'session_error':
        message = 'Session error. Please try logging in again.';
        break;
      default:
        message = 'Please log in to continue.';
    }

    showErrorMessage(message);

    // Clear the URL parameter after showing the message
    window.history.replaceState({}, document.title, window.location.pathname);
  }
});
