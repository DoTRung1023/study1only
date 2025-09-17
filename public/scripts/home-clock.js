/* eslint-disable no-undef */
// Personal Timer Clock functionality for Study1Only
class PersonalTimer {
    constructor() {
        // Timer state
        this.timerInterval = null;
        this.timeInSeconds = 0;
        this.isRunning = false;
        this.sessionDuration = 0;
        this.breakDuration = 0;
        this.isBreakTime = false;
        this.studySessionStartTime = null;
        this.userId = null;
        this.timerStartTime = null;
        this.originalDuration = 0;

        // Initialize the timer
        this.init();
    }

        // Save timer state to cookies (user-specific)
    saveTimerState() {
        const userId = PersonalTimer.getUserId();
        if (!userId) {
            return;
        }

        const state = {
            userId: userId, // Include user ID in the state
            timeInSeconds: this.timeInSeconds,
            isRunning: this.isRunning,
            sessionDuration: this.sessionDuration,
            breakDuration: this.breakDuration,
            isBreakTime: this.isBreakTime,
            studySessionStartTime: this.studySessionStartTime
            && this.studySessionStartTime instanceof Date
            ? this.studySessionStartTime.toISOString() : null,
            timerStartTime: this.timerStartTime
            && this.timerStartTime instanceof Date ? this.timerStartTime.toISOString() : null,
            originalDuration: this.originalDuration,
            savedAt: new Date().toISOString()
        };

        // Save state in user-specific cookie with 24 hour expiration
        if (typeof setCookie === 'function') {
            setCookie(`timer_state_${userId}`, JSON.stringify(state), 24 * 60); // 24 hours
        } else { /* empty */ }
    }

        // Load timer state from cookies (user-specific)
    loadTimerState() {
        const currentUserId = PersonalTimer.getUserId();
        if (!currentUserId) {
            return false;
        }

        let savedState = null;

        // Try to get from user-specific cookie
        if (typeof getCookie === 'function') {
            const cookieData = getCookie(`timer_state_${currentUserId}`);
            if (cookieData) {
                try {
                    savedState = JSON.parse(cookieData);
                } catch (e) { /* empty */ }
            }
        }

        if (savedState) {
            // Verify the state belongs to the current user
            if (savedState.userId !== currentUserId) {
                this.clearTimerState(); // Clear the invalid state
                return false;
            }


            // Restore timer state
            this.timeInSeconds = savedState.timeInSeconds || 0;
            this.sessionDuration = savedState.sessionDuration || 0;
            this.breakDuration = savedState.breakDuration || 0;
            this.isBreakTime = savedState.isBreakTime || false;
            this.originalDuration = savedState.originalDuration || 0;

            // Don't automatically resume running state on load - let user manually start
            this.isRunning = false;

            // Restore dates if they exist
            if (savedState.studySessionStartTime) {
                this.studySessionStartTime = new Date(savedState.studySessionStartTime);
            }
            if (savedState.timerStartTime) {
                this.timerStartTime = new Date(savedState.timerStartTime);
            }

            return true;
        }

        return false;
    }

        // Clear timer state from cookies (user-specific)
    static clearTimerState() {
        const userId = PersonalTimer.getUserId();
        if (userId) {
            setCookie(`timer_state_${userId}`, '', 0); // Delete by setting expiration to past
        }
    }

    // Clear timer state from other users (security measure)
    static clearOtherUsersTimerState() {
        // Clear the old non-user-specific timer state cookie if it exists
        if (typeof deleteCookie === 'function') {
            deleteCookie('timer_state');
        }

        // Note: We cannot easily enumerate all cookies to clear other user timer states
        // due to browser security restrictions, but the loadTimerState function now
        // validates that the user ID matches before loading any state
    }

    // Retry loading timer state after user data becomes available
    retryTimerStateLoading() {
        let retryCount = 0;
        const maxRetries = 10;
        const retryInterval = 500; // 500ms

                const retryLoad = () => {
            const userId = PersonalTimer.getUserId();
            if (userId) {

                const stateRestored = this.loadTimerState();
                if (stateRestored) {
                    this.updateTimerDisplay();

                    // If timer was restored and has time, update the UI
                    if (this.timeInSeconds > 0) {
                        const timerContainer = document.querySelector('.timer');
                        if (timerContainer && !timerContainer.querySelector('#timer-display')) {
                            // Show the timer display instead of setup
                            timerContainer.innerHTML = `
                                <div class="timer-header">
                                    <img src="images/timer-clock.png" alt="Timer Icon" class="timer-icon">
                                    <p>${this.isBreakTime ? 'Break Time' : 'Personal Timer'}</p>
                                </div>
                                <h1 id="timer-display">${PersonalTimer.formatTime(this.timeInSeconds)}</h1>
                                <div class="timer-controls">
                                    <button class="timer-button" id="toggle-button" type="button"
                                            title="Continue timer" aria-label="Play/Pause timer">
                                        <img src="images/timer-play.png" alt="" class="button-icon" role="presentation">
                                    </button>
                                    <button class="timer-button" id="reset-button" type="button"
                                            title="Start new study session" aria-label="Reset timer">
                                        <img src="images/timer-stop.png" alt="" class="button-icon" role="presentation">
                                    </button>
                                </div>
                            `;

                            // Reattach event listeners
                            this.attachEventListeners();
                        }
                    }
                    return; // Success, stop retrying
                }
            }

            retryCount++;
            if (retryCount < maxRetries) {
                setTimeout(retryLoad, retryInterval);
            }
        };

        // Start retrying after a short delay
        setTimeout(retryLoad, retryInterval);
    }

    // [DEPRECATED] Clear timer states from all other users to prevent cross-user contamination
    // This method is no longer used as it was too aggressive and destroyed legitimate timer data
    static clearAllOtherUserTimerStates() {
        const currentUserId = PersonalTimer.getUserId();
        if (!currentUserId) {
            return;
        }

        // Get all cookies and find timer_state cookies for other users
        const allCookies = document.cookie.split(';');
        const timerStateCookies = [];
        const allTimerCookies = [];

        for (let cookie of allCookies) {
            const cookiePair = cookie.trim().split('=');
            const cookieName = cookiePair[0];

            // Find all timer_state cookies (for debugging)
            if (cookieName.startsWith('timer_state_')) {
                allTimerCookies.push(cookieName);

                // Only add to deletion list if it's NOT the current user's cookie
                if (cookieName !== `timer_state_${currentUserId}`) {
                    timerStateCookies.push(cookieName);
                }
            }
        }

        // Delete all timer state cookies from other users
        if (typeof deleteCookie === 'function') {
            for (let cookieName of timerStateCookies) {
                deleteCookie(cookieName);
            }
        }

    }

    // Initialize timer functionality
    init() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setupTimer());
        } else {
            this.setupTimer();
        }
    }

    // Setup timer after DOM is ready
    setupTimer() {
        // Clear any existing intervals on load
        this.stopTimer();

        // Clear any legacy non-user-specific timer state cookie
        PersonalTimer.clearOtherUsersTimerState();

        // DO NOT clear other users' timer states -
        // each user should maintain their own persistent timer
        // The user-specific cookie approach
        // (timer_state_${userId}) already prevents cross-contamination
        // Clearing other users' timer states destroys legitimate timer data that should persist

        // Try to restore timer state first
        const stateRestored = this.loadTimerState();

        if (!stateRestored) {
            this.isRunning = false;
            // If state restoration failed due to missing user data, retry after a delay
            this.retryTimerStateLoading();
        }

        this.updateTimerDisplay();

        // Setup event listeners for timer buttons
        this.attachEventListeners();

        // Setup start timer button listener
        this.attachStartTimerListener();

        // Setup time adjustment listeners
        PersonalTimer.attachTimeAdjustmentListeners();

        // Setup cleanup handlers
        this.setupCleanupHandlers();

        // Clean up any orphaned sessions
        PersonalTimer.cleanupActiveSessions();

        // If timer was running and we have time left, show the timer display
        if (stateRestored && this.timeInSeconds > 0) {

            // Show the timer display instead of setup
            const timerContainer = document.querySelector('.timer');
            if (timerContainer) {
                timerContainer.innerHTML = `
                    <div class="timer-header">
                        <img src="images/timer-clock.png" alt="Timer Icon" class="timer-icon">
                        <p>${this.isBreakTime ? 'Break Time' : 'Personal Timer'}</p>
                    </div>
                    <h1 id="timer-display">${PersonalTimer.formatTime(this.timeInSeconds)}</h1>
                    <div class="timer-controls">
                        <button class="timer-button" id="toggle-button" type="button"
                                title="Continue timer" aria-label="Play/Pause timer">
                            <img src="images/timer-play.png" alt="" class="button-icon" role="presentation">
                        </button>
                        <button class="timer-button" id="reset-button" type="button"
                                title="Start new study session" aria-label="Reset timer">
                            <img src="images/timer-stop.png" alt="" class="button-icon" role="presentation">
                        </button>
                    </div>
                `;

                // Reattach event listeners
                this.attachEventListeners();
            }
        }
    }

    // Attach event listeners to timer buttons
    attachEventListeners() {
        const toggleButton = document.getElementById('toggle-button');
        const resetButton = document.getElementById('reset-button');

        if (toggleButton) {
            toggleButton.addEventListener('click', () => this.toggleTimer());
        }

        if (resetButton) {
            resetButton.addEventListener('click', () => this.resetTimer());
        }
    }

    // Get user ID from localStorage
    static getUserId() {
        const userData = JSON.parse(localStorage.getItem('user') || '{}');
        const userId = userData.user_id || userData.id || null;
        return userId;
    }

    // Get user's local timezone
    static getUserTimezone() {
        return Intl.DateTimeFormat().resolvedOptions().timeZone;
    }

    // Get current time in user's local timezone
    static getCurrentTimeInUserTimezone() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        const milliseconds = String(now.getMilliseconds()).padStart(3, '0');

        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds}`;
    }

    // Format time from seconds to HH:MM:SS
    static formatTime(seconds) {
        const hours = Math.floor(seconds / 3600).toString().padStart(2, '0');
        const minutes = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
        const secs = (seconds % 60).toString().padStart(2, '0');
        return `${hours}:${minutes}:${secs}`;
    }

    // Update the timer display
    updateTimerDisplay() {
        const timerDisplay = document.getElementById('timer-display');
        if (timerDisplay) {
            timerDisplay.textContent = PersonalTimer.formatTime(this.timeInSeconds);
        }

        // Update the timer header
        const timerHeader = document.querySelector('.timer-header p');
        if (timerHeader) {
            timerHeader.textContent = this.isBreakTime ? 'Break Time' : 'Personal Timer';
        }

        // Update button states
        const toggleButton = document.querySelector('#toggle-button');
        if (toggleButton) {
            if (this.timeInSeconds === 0) {
                toggleButton.disabled = true;
                toggleButton.style.opacity = '0.5';
                toggleButton.style.cursor = 'not-allowed';
                toggleButton.title = 'No timer set - use reset to start new session';
            } else {
                toggleButton.disabled = false;
                toggleButton.style.opacity = '1';
                toggleButton.style.cursor = 'pointer';
                toggleButton.title = this.isRunning ? 'Pause timer' : 'Continue timer';
            }
        }

        const resetButton = document.querySelector('#reset-button');
        if (resetButton) {
            resetButton.title = 'Start new study session';
        }
    }

    // Play notification sound
    static playNotificationSound() {
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            oscillator.frequency.setValueAtTime(587.33, audioContext.currentTime);

            gainNode.gain.setValueAtTime(0, audioContext.currentTime);
            gainNode.gain.linearRampToValueAtTime(0.5, audioContext.currentTime + 0.1);
            gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.5);

            oscillator.start();
            oscillator.stop(audioContext.currentTime + 0.5);
        } catch (error) {
            // Audio playback failed
        }
    }

    // Start timer session with backend
    async startTimerSession() {
        this.userId = PersonalTimer.getUserId();
        if (!this.userId) {
            return false;
        }

        try {
            const response = await fetch('/timer/start', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    user_id: this.userId,
                    timezone: PersonalTimer.getUserTimezone(),
                    local_time: PersonalTimer.getCurrentTimeInUserTimezone()
                })
            });

            if (!response.ok) {
                return false;
            }

            const data = await response.json();
            if (data.success) {
                this.studySessionStartTime = new Date(data.startTime);
                return true;
            }
            return false;
        } catch (error) {
            return false;
        }
    }

    // Stop timer session with backend
    async stopTimerSession() {
        if (!this.userId) {
            return false;
        }

        try {
            const response = await fetch('/timer/stop', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    user_id: this.userId,
                    timezone: PersonalTimer.getUserTimezone(),
                    local_time: PersonalTimer.getCurrentTimeInUserTimezone()
                })
            });

            if (!response.ok) {
                return false;
            }

            const data = await response.json();
            if (data.success) {
                this.studySessionStartTime = null;

                // Trigger timer completion event for achievements
                const event = new CustomEvent('timerComplete', {
                    detail: { duration: this.originalDuration }
                });
                document.dispatchEvent(event);

                // Refresh leaderboard if function exists
                if (typeof window.refreshLeaderboard === 'function') {
                    setTimeout(() => {
                        window.refreshLeaderboard();
                    }, 500);
                }

                return true;
            }
            return false;
        } catch (error) {
            return false;
        }
    }

    // Start the timer countdown
    startTimer() {
        this.timerStartTime = Date.now();
        this.originalDuration = this.timeInSeconds;

        this.timerInterval = setInterval(async () => {
            const elapsedMs = Date.now() - this.timerStartTime;
            const elapsedSeconds = Math.floor(elapsedMs / 1000);
            const remainingSeconds = Math.max(0, this.originalDuration - elapsedSeconds);

            this.timeInSeconds = remainingSeconds;
            this.updateTimerDisplay();

            if (remainingSeconds <= 0) {
                if (!this.isBreakTime && this.breakDuration > 0) {
                    // End of study session
                    if (this.studySessionStartTime) {
                        await this.stopTimerSession();
                    }

                    // Switch to break timer
                    this.isBreakTime = true;
                    this.timeInSeconds = this.breakDuration;
                    this.originalDuration = this.breakDuration;
                    this.timerStartTime = Date.now();
                    this.updateTimerDisplay();
                    PersonalTimer.playNotificationSound();
                } else {
                    // Timer complete
                    this.stopTimerAndSave();
                }
            }
        }, 100);
    }

    // Stop the timer
    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    // Pause the timer
    pauseTimer() {
        this.stopTimer();
        this.isRunning = false;

        if (this.timerStartTime) {
            const elapsedMs = Date.now() - this.timerStartTime;
            const elapsedSeconds = Math.floor(elapsedMs / 1000);
            this.timeInSeconds = Math.max(0, this.originalDuration - elapsedSeconds);
            this.timerStartTime = null;
        }

        // Save state when pausing
        this.saveTimerState();

        // Update button to show play icon
        const toggleButtonImage = document.querySelector('#toggle-button img');
        const toggleButton = document.querySelector('#toggle-button');
        if (toggleButtonImage) {
            toggleButtonImage.src = 'images/timer-play.png';
            toggleButtonImage.alt = 'Play';
        }
        if (toggleButton) {
            toggleButton.title = 'Continue timer';
        }

        this.updateTimerDisplay();

        if (this.studySessionStartTime && !this.isBreakTime) {
            this.stopTimerSession();
        }
    }

    // Toggle timer play/pause
    async toggleTimer() {
        const toggleButtonImage = document.querySelector('#toggle-button img');
        const toggleButton = document.querySelector('#toggle-button');

        if (this.isRunning) {
            this.pauseTimer();
        } else {
            if (this.timeInSeconds === 0) {
                this.resetTimer();
                return;
            }

            if (!this.isBreakTime) {
                const sessionStarted = await this.startTimerSession();
                if (!sessionStarted) {
                    // If backend session fails, still allow timer to work locally
                }
            }

            if (toggleButtonImage) {
                toggleButtonImage.src = 'images/timer-pause.png';
                toggleButtonImage.alt = 'Pause';
            }
            if (toggleButton) {
                toggleButton.title = 'Pause timer';
            }

            this.isRunning = true;
            this.startTimer();
            // Save state when starting
            this.saveTimerState();
        }
    }

    // Stop timer and save session
    async stopTimerAndSave() {
        this.stopTimer();

        if (this.studySessionStartTime && !this.isBreakTime) {
            await this.stopTimerSession();
        }

        this.timerStartTime = null;
        this.originalDuration = 0;
        this.resetTimer();
    }

    // Reset timer to setup mode
    resetTimer() {
        this.stopTimer();

        if (this.studySessionStartTime && !this.isBreakTime) {
            this.stopTimerSession();
        }

        this.timerStartTime = null;
        this.originalDuration = 0;
        this.isBreakTime = false;
        this.timeInSeconds = 0;
        this.isRunning = false;

        // Clear saved state when resetting
        PersonalTimer.clearTimerState();

        this.updateTimerDisplay();

        const timerContainer = document.querySelector(".timer");
        if (timerContainer) {
            timerContainer.innerHTML = `
                <div class="timer-header">
                    <img src="images/timer-clock.png" alt="Timer Icon" class="timer-icon">
                    <p>Set Timer</p>
                </div>
                <div class="timer-settings">
                    <label>Session Duration:</label>
                    <div class="time-input" id="session-duration">
                        <img src="images/minus-circle.png" alt="Minus" class="minus-icon" data-type="hours">
                        <span class="time-part" contenteditable="true" data-type="hours">00</span>:
                        <span class="time-part" contenteditable="true" data-type="minutes">00</span>:
                        <span class="time-part" contenteditable="true" data-type="seconds">00</span>
                        <img src="images/plus-circle.png" alt="Plus" class="plus-icon" data-type="hours">
                    </div>
                    <label>Break Duration:</label>
                    <div class="time-input" id="break-duration">
                        <img src="images/minus-circle.png" alt="Minus" class="minus-icon" data-type="hours">
                        <span class="time-part" contenteditable="true" data-type="hours">00</span>:
                        <span class="time-part" contenteditable="true" data-type="minutes">00</span>:
                        <span class="time-part" contenteditable="true" data-type="seconds">00</span>
                        <img src="images/plus-circle.png" alt="Plus" class="plus-icon" data-type="hours">
                    </div>
                </div>
                <button class="timer-button rounded-button" id="start-timer-button">Start Timer</button>
            `;

            PersonalTimer.attachTimeAdjustmentListeners();
            this.attachStartTimerListener();
        }
    }

    // Attach listeners for time adjustment controls
    static attachTimeAdjustmentListeners() {
        document.querySelectorAll(".time-input").forEach((timeInputParam) => {
            const timeInput = timeInputParam;
            const minusIcons = timeInput.querySelectorAll(".minus-icon");
            const plusIcons = timeInput.querySelectorAll(".plus-icon");

            timeInput.dataset.selectedType = "hours";

            minusIcons.forEach((icon) => {
                icon.addEventListener("click", () => {
                    const timePart = timeInput.querySelector(`.time-part[data-type="${timeInput.dataset.selectedType}"]`);
                    PersonalTimer.adjustTimePart(timePart, -1);
                });
            });

            plusIcons.forEach((icon) => {
                icon.addEventListener("click", () => {
                    const timePart = timeInput.querySelector(`.time-part[data-type="${timeInput.dataset.selectedType}"]`);
                    PersonalTimer.adjustTimePart(timePart, 1);
                });
            });

            timeInput.querySelectorAll(".time-part").forEach((part) => {
                part.addEventListener("click", (event) => {
                    timeInput.dataset.selectedType = event.target.dataset.type;
                    const range = document.createRange();
                    const selection = window.getSelection();
                    range.selectNodeContents(event.target);
                    selection.removeAllRanges();
                    selection.addRange(range);
                });

                part.addEventListener("input", (event) => {
                    const { target } = event;
                    let value = target.textContent.replace(/\D/g, "");
                    const max = part.dataset.type === "hours" ? 23 : 59;

                    if (value.length > 2) value = value.slice(0, 2);

                    while (value.length > 0 && parseInt(value, 10) > max) {
                        value = value.slice(0, -1);
                    }

                    target.textContent = value;

                    const range = document.createRange();
                    const sel = window.getSelection();
                    range.selectNodeContents(target);
                    range.collapse(false);
                    sel.removeAllRanges();
                    sel.addRange(range);
                });

                part.addEventListener("blur", (event) => {
                    const { target } = event;
                    let value = target.textContent.replace(/\D/g, "");
                    if (value.length === 0) value = "00";
                    if (value.length === 1) value = "0" + value;
                    const max = part.dataset.type === "hours" ? 23 : 59;
                    const num = Math.min(parseInt(value, 10) || 0, max);
                    target.textContent = num.toString().padStart(2, "0");
                });

                part.addEventListener("keydown", (event) => {
                    if (
                        event.key.length > 1
                        || event.key === "Backspace"
                        || event.key === "Delete"
                        || event.key === "ArrowLeft"
                        || event.key === "ArrowRight"
                        || event.key === "Tab"
                    ) {
                        return;
                    }

                    if (
                        part.textContent.length >= 2
                        && window.getSelection().toString().length !== part.textContent.length
                    ) {
                        event.preventDefault();
                    }
                });
            });
        });
    }

    // Attach listener for start timer button
    attachStartTimerListener() {
        const startButton = document.getElementById("start-timer-button");
        if (startButton) {
            startButton.addEventListener("click", async () => {
                const sessionParts = Array.from(document.querySelectorAll("#session-duration .time-part"));
                const breakParts = Array.from(document.querySelectorAll("#break-duration .time-part"));

                this.sessionDuration = PersonalTimer.validateAndConvertToSeconds(sessionParts);
                this.breakDuration = PersonalTimer.validateAndConvertToSeconds(breakParts);

                if (this.sessionDuration === null || this.breakDuration === null) {
                    return;
                }

                if (this.sessionDuration === 0) {
                    // Use showToast if available, otherwise fallback to alert
                    if (typeof window.showToast === 'function') {
                        window.showToast('Session duration must be greater than 0', true);
                    } else {
                        // Wait a bit for showToast to be loaded, then fallback to alert
                        setTimeout(() => {
                            if (typeof window.showToast === 'function') {
                                window.showToast('Session duration must be greater than 0', true);
                            } else { /* empty */ }
                        }, 100);
                    }
                    return;
                }

                const timerContainer = document.querySelector(".timer");
                if (timerContainer) {
                    timerContainer.innerHTML = `
                        <div class="timer-header">
                            <img src="images/timer-clock.png" alt="Timer Icon" class="timer-icon">
                            <p>Personal Timer</p>
                        </div>
                        <h1 id="timer-display">${PersonalTimer.formatTime(this.sessionDuration)}</h1>
                        <div class="timer-controls">
                            <button class="timer-button" id="toggle-button" title="Pause timer">
                                <img src="images/timer-pause.png" alt="Pause" class="button-icon">
                            </button>
                            <button class="timer-button" id="reset-button" title="Start new study session">
                                <img src="images/timer-stop.png" alt="Reset" class="button-icon">
                            </button>
                        </div>
                    `;

                    this.attachEventListeners();
                }

                this.timeInSeconds = this.sessionDuration;
                this.updateTimerDisplay();

                // Save initial timer state
                this.saveTimerState();

                // Start the timer automatically
                this.isRunning = true;
                const sessionStarted = await this.startTimerSession();
                if (sessionStarted) {
                    this.startTimer();
                    // Save state after starting
                    this.saveTimerState();
                } else {
                    const toggleButtonImage = document.querySelector('#toggle-button img');
                    if (toggleButtonImage) {
                        toggleButtonImage.src = 'images/timer-play.png';
                        toggleButtonImage.alt = 'Play';
                    }
                    this.isRunning = false;
                }
            });
        }
    }

    // Adjust time part value
    static adjustTimePart(elementParam, adjustment) {
        const element = elementParam;
        const currentValue = parseInt(element.textContent, 10) || 0;
        const maxValue = element.dataset.type === "seconds" || element.dataset.type === "minutes" ? 59 : 23;
        const newValue = Math.max(0, Math.min(currentValue + adjustment, maxValue));
        element.textContent = newValue.toString().padStart(2, '0');

        const input = element.closest('.time-input');
        if (input && input.dataset.selectedType === element.dataset.type) {
            const range = document.createRange();
            const selection = window.getSelection();
            range.selectNodeContents(element);
            selection.removeAllRanges();
            selection.addRange(range);
        }
    }

    // Validate and convert time parts to seconds
    static validateAndConvertToSeconds(timeParts) {
        const [hours, minutes, seconds] = timeParts.map((part) => {
            const value = part.textContent !== undefined ? part.textContent : part;
            return parseInt(value, 10) || 0;
        });

        if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59 || seconds < 0 || seconds > 59) {
            return null;
        }

        return hours * 3600 + minutes * 60 + seconds;
    }

    // Emergency cleanup for page unload
    async emergencyCleanup(reason = 'unknown') {
        const userId = PersonalTimer.getUserId();
        if (!userId || !this.studySessionStartTime) {
            return;
        }

        const closeTime = PersonalTimer.getCurrentTimeInUserTimezone();
        const timezone = PersonalTimer.getUserTimezone();

        try {
            const data = JSON.stringify({
                user_id: userId,
                timezone: timezone,
                local_time: closeTime,
                reason: reason
            });

            const blob = new Blob([data], { type: 'application/json' });
            navigator.sendBeacon('/timer/cleanup', blob);

            try {
                await fetch('/timer/cleanup', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: data,
                    keepalive: true
                });
            } catch (fetchError) {
                // Backup fetch failed (normal during page unload)
            }
        } catch (error) {
            // Error during emergency cleanup
        }
    }

    // Clean up active sessions
    static async cleanupActiveSessions() {
        const userId = PersonalTimer.getUserId();
        if (!userId) return;

        try {
            await fetch('/timer/cleanup', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    user_id: userId,
                    timezone: PersonalTimer.getUserTimezone(),
                    local_time: PersonalTimer.getCurrentTimeInUserTimezone()
                })
            });
        } catch (error) {
            // Error cleaning up sessions
        }
    }

    // Handle logout cleanup - ensures study session is saved before logout
    async handleLogoutCleanup() {
        try {
            // First, pause and save the current timer state if running
            if (this.isRunning) {
                this.pauseTimer();
            } else {
                // Even if not running, save current state to preserve any timer that was set
                this.saveTimerState();
            }

            // If there's an active study session, clean it up
            if (this.studySessionStartTime) {
                await this.emergencyCleanup('user_logout');
                await PersonalTimer.cleanupActiveSessions();
                this.studySessionStartTime = null;
            }

            // Call server to invalidate session
            const response = await fetch('/users/logout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'same-origin' // Include cookies in the request
            });

            if (!response.ok) {
                throw new Error('Logout failed');
            }

            // Clear all user-related data from localStorage
            localStorage.clear();

            // Note: We don't clear timer state here anymore since it should persist
            // The timer state will be user-specific and cleared when they explicitly reset

            // Redirect to login page after a short delay to ensure session is cleared
            setTimeout(() => {
                window.location.href = '/login.html';
            }, 100);
        } catch (error) {
            // Even if cleanup fails, save timer state and clear local data
            if (this.isRunning) {
                this.pauseTimer();
            } else {
                this.saveTimerState();
            }
            localStorage.clear();
            setTimeout(() => {
                window.location.href = '/login.html';
            }, 100);
        }
    }

    // Setup cleanup handlers for page unload
    setupCleanupHandlers() {
        window.addEventListener('beforeunload', () => {
            // Save current timer state before page unload
            this.saveTimerState();

            // Pause the timer if it's running
            if (this.isRunning) {
                this.pauseTimer();
            }

            if (this.timerInterval) {
                clearInterval(this.timerInterval);
            }
            this.isRunning = false;

            if (this.studySessionStartTime) {
                this.emergencyCleanup('browser_close');
            }
        });

        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                // Save state when tab becomes hidden
                this.saveTimerState();
                if (this.isRunning) {
                    this.pauseTimer();
                }
                if (this.studySessionStartTime) {
                    this.emergencyCleanup('tab_hidden');
                }
            }
        });

        window.addEventListener('pagehide', () => {
            if (this.isRunning) {
                this.pauseTimer();
            }
            if (this.studySessionStartTime) {
                this.emergencyCleanup('page_navigation');
            }
        });

        window.addEventListener('unload', () => {
            if (this.studySessionStartTime) {
                this.emergencyCleanup('page_unload');
            }
        });

        // Handle logout button click
        const logoutButton = document.getElementById('logout');
        if (logoutButton) {
            logoutButton.addEventListener('click', async (event) => {
                // Prevent default logout action to ensure cleanup happens first
                event.preventDefault();

                // Use the dedicated logout cleanup method
                await this.handleLogoutCleanup();
            });
        }
    }
}

// Initialize the timer when the script loads
let personalTimer;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        personalTimer = new PersonalTimer();
        // Make timer available globally for other scripts
        window.personalTimer = personalTimer;
    });
} else {
    personalTimer = new PersonalTimer();
    // Make timer available globally for other scripts
    window.personalTimer = personalTimer;
}
