/* eslint-disable no-unused-vars */
/* eslint-disable no-lonely-if */
/* eslint-disable no-use-before-define */


(function() {
    // 'use strict';

    // Initialize global flag for tracking profile popup opening method
    window.profileOpenedViaKeyboard = false;

    // Track if user is navigating via keyboard or mouse
    let isUsingKeyboard = false;

    // Detect keyboard usage
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Tab') {
            isUsingKeyboard = true;
        }
    });

    // Detect mouse usage
    document.addEventListener('mousedown', function() {
        isUsingKeyboard = false;
    });


    function closeActiveModals() {
        // List of modal/popup selectors
        const modals = [
            '#profile-popup',
            '#nav-popup',
            '#avatar-popup',
            '#add-to-album-modal',
            '#create-album-modal',
            '#edit-album-modal',
            '#deleteAlbumModal',
            '#viewAlbumModal'
        ];

        modals.forEach((modalSelector) => {
            const modal = document.querySelector(modalSelector);
            if (modal) {
                if (modal.style.display !== 'none' && !modal.hasAttribute('hidden')) {
                    // Try to find and click the close button
                    const closeBtn = modal.querySelector('.close, .modal-close, .add-to-album-close, .create-album-close, .edit-album-close, .view-album-close, #avatar-cancel');
                    if (closeBtn) {
                        closeBtn.click();
                    } else {
                        // Fallback: hide the modal directly
                        modal.style.display = 'none';
                    }
                }
            }
        });

        // Close profile popup using vanilla JS function
        if (window.closeProfilePopup) {
            window.closeProfilePopup();
        }
    }


    document.addEventListener('keydown', function(event) {
        // Escape key - Close modals/popups
        if (event.key === 'Escape') {
            closeActiveModals();
        }

        // Alt + H - Go to Home section (if on home page)
        if (event.altKey && event.key === 'h' && document.getElementById('home-section')) {
            event.preventDefault();
            // eslint-disable-next-line no-use-before-define
            navigateToSection('studysolo');
        }

        // Alt + A - Go to Achievements section (if on home page)
        if (event.altKey && event.key === 'a' && document.getElementById('achievements-section')) {
            event.preventDefault();
            navigateToSection('achievements');
        }

        // Alt + L - Go to Leaderboard section (if on home page)
        if (event.altKey && event.key === 'l' && document.getElementById('leaderboard-section')) {
            event.preventDefault();
            navigateToSection('leaderboard');
        }

        // Alt + S - Go to Study Stats section (if on home page)
        if (event.altKey && event.key === 's' && document.getElementById('studystats-section')) {
            event.preventDefault();
            navigateToSection('studystats');
        }

        // Space bar - Play/Pause timer (when timer button is focused)
        if (event.key === ' ' && event.target.id === 'toggle-button') {
            event.preventDefault();
            event.target.click();
        }

        // Enter key - Activate focused elements
        if (event.key === 'Enter') {
            handleEnterKey(event);
        }
    });



    function navigateToSection(sectionName) {
        const navItem = document.querySelector(`.nav-item[data-popup="${sectionName}"]`);
        if (navItem) {
            navItem.click();
            navItem.focus();
        }
    }


    function handleEnterKey(event) {
        const { target } = event.target;

        // Handle div elements with role="button" or clickable divs
        if (
            target.tagName === 'DIV' && (
                (target.hasAttribute('role') && target.getAttribute('role') === 'button') || target.classList.contains('nav-item') || target.classList.contains('clickable')
               )
        ) {
            event.preventDefault();
            target.click();
        }

        // Handle custom elements that should respond to Enter
        if (target.classList.contains('leaderboard-tab')
            || target.classList.contains('nav-item')
            || target.classList.contains('album-sort-btn')) {
            event.preventDefault();
            target.click();
            }
    }

    function initializeKeyboardNavigation() {
        const homeSection = document.getElementById('home-section');

        if (homeSection) {
            initializeHomeKeyboardNavigation();
        }


        const updateForm = document.getElementById('update-form');

        if (updateForm) {
            initializeUpdateKeyboardNavigation();
        }
    }


    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeKeyboardNavigation);
    } else {
        initializeKeyboardNavigation();
    }

    function initializeHomeKeyboardNavigation() {
        const toggleButton = document.getElementById('toggle-button');
        const resetButton = document.getElementById('reset-button');

        if (toggleButton) {
            toggleButton.addEventListener('keydown', function(event) {
                if (event.key === ' ' || event.key === 'Enter') {
                    event.preventDefault();
                    this.click();
                }
            });
        }

        if (resetButton) {
            resetButton.addEventListener('keydown', function(event) {
                if (event.key === ' ' || event.key === 'Enter') {
                    event.preventDefault();
                    this.click();
                }
            });
        }

        const navItems = document.querySelectorAll('.nav-item');

        navItems.forEach((navItem) => {
            // Skip profile link - it gets special handling below
            if (navItem.id === 'profile-link') {
                return;
            }

            // Ensure nav items are focusable
            if (!navItem.hasAttribute('tabindex')) {
                navItem.setAttribute('tabindex', '0');
            }

                        navItem.addEventListener('keydown', function(event) {
                if (event.key === 'Enter' || event.key === ' ') {
                    // Prevent any default browser behavior and event bubbling
                    event.preventDefault();
                    event.stopPropagation();
                    event.stopImmediatePropagation();


                    // Add a flag to prevent double-clicks
                    if (this.hasAttribute('data-keyboard-clicking')) {
                        return;
                    }

                    this.setAttribute('data-keyboard-clicking', 'true');

                    // Use setTimeout to avoid double-click issues and allow DOM to settle
                    setTimeout(() => {
                        this.click();
                        // Remove the flag after click is processed
                        setTimeout(() => {
                            this.removeAttribute('data-keyboard-clicking');
                        }, 100);
                    }, 10);
                }
            });
        });

        const profileLink = document.getElementById('profile-link');
        if (profileLink) {
            const profileInfo = ({
                id: profileLink.id,
                tabindex: profileLink.getAttribute('tabindex'),
                role: profileLink.getAttribute('role'),
                'aria-label': profileLink.getAttribute('aria-label'),
                className: profileLink.className
            });

            profileLink.setAttribute('role', 'button');
            profileLink.setAttribute('aria-label', 'Open profile menu');
            if (!profileLink.hasAttribute('tabindex')) {
                profileLink.setAttribute('tabindex', '0');
            }

            // Add keyboard event listener for profile popup
            profileLink.addEventListener('keydown', profileKeyboardHandler);
            profileLink.setAttribute('data-keyboard-handler', 'true');


        }

        const backgroundContainer = document.querySelector('.background-container');
        if (backgroundContainer) {
            // Make source tabs keyboard accessible (Pexels and Albums tabs)
            const sourceTabs = backgroundContainer.querySelectorAll('.source span, #pexels, #saved');
            sourceTabs.forEach((tab) => {
                if (!tab.hasAttribute('tabindex')) {
                    tab.setAttribute('tabindex', '0');
                    tab.setAttribute('role', 'button');
                    tab.setAttribute('aria-label', tab.textContent + ' tab');
                    tab.addEventListener('keydown', function(event) {
                        if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            this.click();
                        }
                    });
                }
            });

            // Also specifically target the Pexels and Albums tabs by ID
            const pexelsTab = document.getElementById('pexels');
            const albumsTab = document.getElementById('saved');

            [pexelsTab, albumsTab].forEach((tab) => {
                if (tab && !tab.hasAttribute('tabindex')) {
                    tab.setAttribute('tabindex', '0');
                    tab.setAttribute('role', 'button');
                    tab.setAttribute('aria-label', tab.textContent + ' tab - switch source');
                    tab.addEventListener('keydown', function(event) {
                        if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            this.click();
                        }
                    });
                }
            });

            // Enhance search input
            const searchInput = backgroundContainer.querySelector('.search-input');
            if (searchInput) {
                searchInput.addEventListener('keydown', function(event) {
                    if (event.key === 'Escape') {
                        this.value = '';
                        this.blur();
                    }
                    // Enter key triggers search
                    if (event.key === 'Enter') {
                        event.preventDefault();
                        // Trigger search if there's content
                        if (this.value.trim()) {
                            // Simulate search trigger depends on existing search implementation
                            const searchEvent = new Event('input', { bubbles: true });
                            this.dispatchEvent(searchEvent);
                        }
                    }
                });
            }

            // Make clear search button accessible
            const clearSearchBtn = backgroundContainer.querySelector('.clear-icon-bg');
            if (clearSearchBtn) {
                clearSearchBtn.setAttribute('tabindex', '0');
                clearSearchBtn.setAttribute('role', 'button');
                clearSearchBtn.setAttribute('aria-label', 'Clear search');
                clearSearchBtn.addEventListener('keydown', function(event) {
                    if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        this.click();
                    }
                });
            }

            // Make minimize and create album buttons accessible
            const minimizeBtn = backgroundContainer.querySelector('.background-top-left');
            if (minimizeBtn) {
                minimizeBtn.setAttribute('tabindex', '0');
                minimizeBtn.setAttribute('role', 'button');
                minimizeBtn.addEventListener('keydown', function(event) {
                    if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        this.click();
                    }
                });
            }

            const createAlbumBtn = backgroundContainer.querySelector('.background-top-right');
            if (createAlbumBtn) {
                createAlbumBtn.setAttribute('tabindex', '0');
                createAlbumBtn.setAttribute('role', 'button');
                createAlbumBtn.addEventListener('keydown', function(event) {
                    if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        this.click();
                    }
                });
            }

            setupPexelsKeyboardNavigation(backgroundContainer);

            const albumSortBtn = backgroundContainer.querySelector('#album-sort-btn');
            if (albumSortBtn) {
                albumSortBtn.setAttribute('tabindex', '0');
                albumSortBtn.addEventListener('keydown', function(event) {
                    if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        this.click();
                    }
                });
            }
        }

        setupProfilePopupNavigation();

        // Make all clickable images keyboard accessible
        const allClickableImages = document.querySelectorAll('img[onclick], img[title]');
        allClickableImages.forEach((img) => {
            if (!img.hasAttribute('tabindex')) {
                img.setAttribute('tabindex', '0');
                img.setAttribute('role', 'button');
                img.addEventListener('keydown', function(event) {
                    if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        this.click();
                    }
                });
            }
        });

        // Make all elements with onclick accessible
        const allClickableElements = document.querySelectorAll('[onclick]');
        allClickableElements.forEach((element) => {
            if (!element.hasAttribute('tabindex')) {
                element.setAttribute('tabindex', '0');
                if (!element.hasAttribute('role') && element.tagName !== 'BUTTON' && element.tagName !== 'A') {
                    element.setAttribute('role', 'button');
                }
                element.addEventListener('keydown', function(event) {
                    if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        this.click();
                    }
                });
            }
        });

        const spotifyContainer = document.querySelector('#spotify-container');
        if (spotifyContainer) {
            setupSpotifyKeyboardNavigation(spotifyContainer);
        }

        const leaderboardTabs = document.querySelectorAll('.leaderboard-tab');
        leaderboardTabs.forEach((tab, index) => {
            tab.addEventListener('keydown', function(event) {
                if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
                    event.preventDefault();
                    const tabs = Array.from(leaderboardTabs);
                    let newIndex;

                    if (event.key === 'ArrowLeft') {
                        newIndex = index > 0 ? index - 1 : tabs.length - 1;
                    } else {
                        newIndex = index < tabs.length - 1 ? index + 1 : 0;
                    }

                    tabs[newIndex].focus();
                    tabs[newIndex].click();
                }
            });
        });

        // Final scan to catch any missed interactive elements
        setTimeout(() => {
                         const allInteractiveElements = document.querySelectorAll(
                 'button, input[type="button"], input[type="submit"], input[type="reset"], '
                 + '[role="button"], .nav-item, #profile-link, .timer-button, .leaderboard-tab, '
                 + '.background-top-left, .background-top-right, .clear-icon-bg, '
                 + '.source span, #pexels, #saved, #album-sort-btn, '
                 + '[onclick], img[title], img[onclick]'
             );

            allInteractiveElements.forEach((element) => {
                if (!element.hasAttribute('tabindex')
                    && element.style.display !== 'none'
                    && element.style.visibility !== 'hidden'
                    && element.style.cursor !== 'not-allowed'
                    && element.style.opacity !== '0.5'
                    && !element.disabled) {
                    element.setAttribute('tabindex', '0');
                    if (!element.hasAttribute('role')
                        && element.tagName !== 'BUTTON'
                        &&element.tagName !== 'A'
                        && element.tagName !== 'INPUT') {
                        element.setAttribute('role', 'button');
                    }

                                         // Remove existing listener if any, then add new one
                     if (element.id === 'profile-link') {
                         element.removeEventListener('keydown', profileKeyboardHandler);
                         element.addEventListener('keydown', profileKeyboardHandler);
                     } else {
                         element.removeEventListener('keydown', keyboardActivationHandler);
                         element.addEventListener('keydown', keyboardActivationHandler);
                     }
                }
            });
        }, 1000); // Wait 1 second for dynamic content to load
    }

    function initializeUpdateKeyboardNavigation() {
        const form = document.getElementById('update-form');
        if (!form) return;

        const formFields = form.querySelectorAll('input, select, textarea');

        formFields.forEach((field, index) => {
            field.addEventListener('keydown', function(event) {
                // Enter key - Submit form for specific fields
                if (event.key === 'Enter') {
                    const fieldId = this.id;
                    // Allow Enter to submit for username, address, password, and confirm-password
                    if (fieldId === 'username' || fieldId === 'address'
                        || fieldId === 'password' || fieldId === 'confirm-password') {
                        event.preventDefault();
                        const submitBtn = form.querySelector('#confirm-button, .btn-confirm, [type="submit"]');
                        if (submitBtn && !submitBtn.disabled) {
                            submitBtn.click();
                        }
                    }
                }

                // Ctrl + Enter - Submit form from any field
                if (event.ctrlKey && event.key === 'Enter') {
                    event.preventDefault();
                    const submitBtn = form.querySelector('#confirm-button, .btn-confirm, [type="submit"]');
                    if (submitBtn && !submitBtn.disabled) {
                        submitBtn.click();
                    }
                }

                // Escape - Clear current field
                if (event.key === 'Escape') {
                    if (this.type !== 'submit' && this.type !== 'button') {
                        this.value = '';
                    }
                }
            });
        });

        const buttons = form.querySelectorAll('button, .btn');
        buttons.forEach((button) => {
            button.addEventListener('keydown', function(event) {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    this.click();
                }
            });
        });

        const select2Elements = form.querySelectorAll('.select2');
        select2Elements.forEach((select) => {
            select.addEventListener('keydown', function(event) {
                // Don't submit form when pressing Enter on country dropdown
                if (event.key === 'Enter' && select.id === 'country') {
                    // Let Select2 handle the Enter key for dropdown opening/selection
                    return;
                }

                // Open dropdown with Space (but not Enter for country field)
                if (event.key === ' ') {
                    const select2Container = this.nextElementSibling;
                    if (select2Container && select2Container.classList.contains('select2-container')) {
                        const selection = select2Container.querySelector('.select2-selection');
                        if (selection) {
                            event.preventDefault();
                            selection.click();
                        }
                    }
                }
            });
        });

        const errorMessages = form.querySelectorAll('.error-message');
        errorMessages.forEach((errorMsg) => {
            // Make error messages live regions for screen readers
            errorMsg.setAttribute('role', 'alert');
            errorMsg.setAttribute('aria-live', 'polite');
        });
    }

    let lastFocusedElement = null;

    document.addEventListener('focusin', function(event) {
        lastFocusedElement = event.target;
    });

    function setupProfilePopupNavigation() {

        // Enhanced profile popup button setup
        const profilePopupButtons = [
            { id: 'change-details', label: 'Change Personal Details' },
            { id: 'change-avatar', label: 'Change Avatar' },
            { id: 'logout', label: 'Log Out' }
        ];

                profilePopupButtons.forEach(({ id, label }, index) => {
            const button = document.getElementById(id);
            if (button) {

                // Ensure button is focusable with proper tab order
                button.setAttribute('tabindex', '0');

                // Add proper role if it's not a real button
                if (button.tagName !== 'BUTTON' && !button.hasAttribute('role')) {
                    button.setAttribute('role', 'button');
                }

                // Add aria-label for screen readers
                if (!button.hasAttribute('aria-label')) {
                    button.setAttribute('aria-label', label);
                }

                // Remove existing keyboard handlers to avoid duplicates
                button.removeEventListener('keydown', keyboardActivationHandler);

                // Add comprehensive keyboard support
                button.addEventListener('keydown', function(event) {
                    if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        event.stopPropagation();

                        this.click();
                    }

                    // Escape key closes the profile popup
                    if (event.key === 'Escape') {
                        event.preventDefault();
                        closeActiveModals();
                    }

                    // Arrow key navigation within profile popup (alternative to Tab)
                    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                        event.preventDefault();
                        navigateProfileButtons(event.key === 'ArrowDown' ? 'next' : 'prev');
                    }
                });

                // Add smart focus styling - only show border for keyboard navigation
                button.addEventListener('focus', function() {
                    if (isUsingKeyboard) {
                        this.style.outline = '2px solid #005fcc';
                        this.style.outlineOffset = '1px';
                    }
                });

                button.addEventListener('blur', function() {
                    this.style.outline = '';
                    this.style.outlineOffset = '';
                });

                // Remove focus outline when clicked with mouse
                button.addEventListener('mousedown', function() {
                    this.style.outline = '';
                    this.style.outlineOffset = '';
                });

            }
        });

        // Add profile popup focus management
        setupProfilePopupFocusManagement();

        // Setup focus trap for profile popup
        setupProfilePopupFocusTrap();

        // Setup avatar popup keyboard navigation
        setupAvatarPopupNavigation();
    }

    function setupProfilePopupFocusManagement() {
        const profilePopup = document.getElementById('profile-popup');
        if (!profilePopup) {
            return;
        }


        // Monitor popup visibility changes using vanilla JS
        if (window.toggleProfilePopup) {
            // Override the toggle function to add focus management
            const originalToggle = window.toggleProfilePopup;
            window.toggleProfilePopup = function(event) {
                const wasVisible = window.profilePopupVisible || false;
                const result = originalToggle.call(this, event);

                // Focus first button when popup opens via keyboard ONLY
                if (!wasVisible && window.profilePopupVisible && window.profileOpenedViaKeyboard) {
                    setTimeout(() => {
                        focusFirstProfileButton();
                    }, 50);
                }

                return result;
            };
        }

        // Also monitor DOM changes for the popup visibility (keyboard only)
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                    const popup = mutation.target;
                    if (popup.id === 'profile-popup') {
                        const isVisible = popup.style.display === 'block' || window.profilePopupVisible;

                        if (isVisible && window.profileOpenedViaKeyboard) {
                            setTimeout(() => {
                                focusFirstProfileButton();
                            }, 50);
                        }
                    }
                }
            });
        });

        observer.observe(profilePopup, {
            attributes: true,
            attributeFilter: ['style']
        });

    }

    function navigateProfileButtons(direction) {
        const buttons = ['change-details', 'change-avatar', 'logout'];
        const currentFocus = document.activeElement;
        const currentIndex = buttons.findIndex((id) => currentFocus && currentFocus.id === id);

        if (currentIndex === -1) {
            // If no profile button is focused, focus the first one
            focusFirstProfileButton();
            return;
        }

        let nextIndex;
        if (direction === 'next') {
            nextIndex = currentIndex < buttons.length - 1 ? currentIndex + 1 : 0;
        } else {
            nextIndex = currentIndex > 0 ? currentIndex - 1 : buttons.length - 1;
        }

        const nextButton = document.getElementById(buttons[nextIndex]);
        if (nextButton && nextButton.offsetParent !== null) {
            nextButton.focus();
        }
    }

    function focusFirstProfileButton() {
        const firstButton = document.getElementById('change-details');
        if (firstButton && firstButton.offsetParent !== null) {
            firstButton.focus();
        }
    }

    function setupProfilePopupFocusTrap() {
        const profilePopup = document.getElementById('profile-popup');
        if (!profilePopup) {
            return;
        }


        // Get all focusable elements in the profile popup
        function getFocusableElements() {
            return profilePopup.querySelectorAll(
                'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            );
        }

        // Handle tab navigation within popup
        profilePopup.addEventListener('keydown', function(event) {
            // Only trap focus if popup is visible
            const isVisible = profilePopup.style.display === 'block' || window.profilePopupVisible;

            if (!isVisible) return;

            if (event.key === 'Tab') {
                const focusableElements = getFocusableElements();

                if (focusableElements.length === 0) return;

                const firstElement = focusableElements[0];
                const lastElement = focusableElements[focusableElements.length - 1];

                if (event.shiftKey) {
                    // Shift + Tab (going backwards)
                    if (document.activeElement === firstElement) {
                        event.preventDefault();
                        lastElement.focus();
                    }
                } else {
                    // Tab (going forwards)
                    if (document.activeElement === lastElement) {
                        event.preventDefault();
                        firstElement.focus();
                    }
                }
            }
        });

    }

    function setupAvatarPopupNavigation() {

        // Avatar popup interactive elements
        const avatarPopupElements = [
            { id: 'choose-avatar', label: 'Choose from computer', type: 'action' },
            { id: 'reset-avatar', label: 'Reset to default avatar', type: 'action' },
            { id: 'avatar-cancel', label: 'Cancel avatar change', type: 'button' },
            { id: 'avatar-confirm', label: 'Confirm avatar change', type: 'button' }
        ];

        avatarPopupElements.forEach(({ id, label, type }) => {
            const element = document.getElementById(id);
            if (element) {

                // Ensure element is focusable
                element.setAttribute('tabindex', '0');

                // Add proper role if not a button
                if (type === 'action' && !element.hasAttribute('role')) {
                    element.setAttribute('role', 'button');
                }

                // Add aria-label for screen readers
                if (!element.hasAttribute('aria-label')) {
                    element.setAttribute('aria-label', label);
                }

                // Remove existing keyboard handlers to avoid duplicates
                element.removeEventListener('keydown', avatarPopupKeyboardHandler);

                // Add keyboard support
                element.addEventListener('keydown', avatarPopupKeyboardHandler);

                // Add smart focus styling - only show border for keyboard navigation
                element.addEventListener('focus', function() {
                    if (isUsingKeyboard) {
                        this.style.outline = '2px solid #005fcc';
                        this.style.outlineOffset = '1px';
                    }
                });

                element.addEventListener('blur', function() {
                    this.style.outline = '';
                    this.style.outlineOffset = '';
                });

                // Remove focus outline when clicked with mouse
                element.addEventListener('mousedown', function() {
                    this.style.outline = '';
                    this.style.outlineOffset = '';
                });

            }
        });

        // Setup avatar popup focus management
        setupAvatarPopupFocusManagement();

        // Setup avatar popup focus trap
        setupAvatarPopupFocusTrap();

    }

    function avatarPopupKeyboardHandler(event) {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            event.stopPropagation();

            this.click();
        }

        // Escape key closes the avatar popup
        if (event.key === 'Escape') {
            event.preventDefault();
            closeActiveModals();
        }

        // Arrow key navigation within avatar popup
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            navigateAvatarPopupElements(event.key === 'ArrowDown' ? 'next' : 'prev');
        }
    }

    function setupAvatarPopupFocusManagement() {
        const avatarPopup = document.getElementById('avatar-popup');
        if (!avatarPopup) {
            return;
        }


        // Monitor avatar popup visibility changes
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                    const popup = mutation.target;
                    if (popup.id === 'avatar-popup') {
                        const isVisible = popup.style.display === 'flex';

                        if (isVisible) {
                            setTimeout(() => {
                                focusFirstAvatarElement();
                            }, 100);
                        }
                    }
                }
            });
        });

        observer.observe(avatarPopup, {
            attributes: true,
            attributeFilter: ['style']
        });

    }

    function navigateAvatarPopupElements(direction) {
        const elements = ['choose-avatar', 'reset-avatar', 'avatar-cancel', 'avatar-confirm'];
        const currentFocus = document.activeElement;
        const currentIndex = elements.findIndex((id) => currentFocus && currentFocus.id === id);

        if (currentIndex === -1) {
            // If no avatar element is focused, focus the first one
            focusFirstAvatarElement();
            return;
        }

        let nextIndex;
        if (direction === 'next') {
            nextIndex = currentIndex < elements.length - 1 ? currentIndex + 1 : 0;
        } else {
            nextIndex = currentIndex > 0 ? currentIndex - 1 : elements.length - 1;
        }

        const nextElement = document.getElementById(elements[nextIndex]);
        if (nextElement && nextElement.offsetParent !== null) {
            nextElement.focus();
        }
    }

    function focusFirstAvatarElement() {
        const firstElement = document.getElementById('choose-avatar');
        if (firstElement && firstElement.offsetParent !== null) {
            firstElement.focus();
        }
    }

    function setupAvatarPopupFocusTrap() {
        const avatarPopup = document.getElementById('avatar-popup');
        if (!avatarPopup) {
            return;
        }


        // Get all focusable elements in the avatar popup
        function getAvatarFocusableElements() {
            return avatarPopup.querySelectorAll(
                'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            );
        }

        // Handle tab navigation within popup
        avatarPopup.addEventListener('keydown', function(event) {
            // Only trap focus if popup is visible
            const isVisible = avatarPopup.style.display === 'flex';

            if (!isVisible) return;

            if (event.key === 'Tab') {
                const focusableElements = getAvatarFocusableElements();

                if (focusableElements.length === 0) return;

                const firstElement = focusableElements[0];
                const lastElement = focusableElements[focusableElements.length - 1];

                if (event.shiftKey) {
                    // Shift + Tab (going backwards)
                    if (document.activeElement === firstElement) {
                        event.preventDefault();
                        lastElement.focus();
                    }
                } else {
                    // Tab (going forwards)
                    if (document.activeElement === lastElement) {
                        event.preventDefault();
                        firstElement.focus();
                    }
                }
            }
        });

    }

    function trapFocus(modal) {
        const focusableElements = modal.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );

        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        modal.addEventListener('keydown', function(event) {
            if (event.key === 'Tab') {
                if (event.shiftKey) {
                    // Shift + Tab
                    if (document.activeElement === firstElement) {
                        event.preventDefault();
                        lastElement.focus();
                    }
                } else {
                    // Tab
                    if (document.activeElement === lastElement) {
                        event.preventDefault();
                        firstElement.focus();
                    }
                }
            }
        });

        // Focus first element when modal opens
        firstElement.focus();
    }

    const modalObserver = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                const modal = mutation.target;
                if (modal.style.display !== 'none' && !modal.hasAttribute('hidden')) {
                    // Modal opened
                    setTimeout(() => trapFocus(modal), 100);
                } else {
                    // Modal closed - restore focus
                    if (lastFocusedElement && lastFocusedElement !== modal) {
                        lastFocusedElement.focus();
                    }
                }
            }
        });
    });

    // Observe all potential modals
    document.querySelectorAll('[id$="modal"], [id$="popup"], .modal, .popup').forEach((modal) => {
        modalObserver.observe(modal, {
            attributes: true,
            attributeFilter: ['style', 'hidden']
        });
    });

    document.addEventListener('DOMContentLoaded', function() {
        // Add keyboard navigation indicators - only show on keyboard focus
        const style = document.createElement('style');
                style.textContent = `
            /* Remove default focus outline for all elements */
            * {
                outline: none;
            }

            /* Only show focus outline for keyboard navigation */
            .nav-item:focus-visible,
            .leaderboard-tab:focus-visible,
            .timer-button:focus-visible,
            .photo-card:focus-visible,
            .album-list-card:focus-visible,
            .track-item:focus-visible,
            .playlist-item:focus-visible,
            .play-button:focus-visible,
            .pause-button:focus-visible,
            .track-play-button:focus-visible,
            .shuffle-btn:focus-visible,
            .repeat-btn:focus-visible,
            .volume-btn:focus-visible,
            .sort-dropdown-btn:focus-visible,
            .background-top-left:focus-visible,
            .background-top-right:focus-visible,
            .clear-icon-bg:focus-visible,
            .source span:focus-visible,
            #album-sort-btn:focus-visible,
            button:focus-visible,
            [role="button"]:focus-visible,
            [tabindex]:focus-visible {
                outline: 2px solid #005fcc !important;
                outline-offset: 1px !important;
                box-shadow: 0 0 0 1px white, 0 0 0 3px #005fcc !important;
            }

            /* Spotify elements hover states for keyboard focus */
            .track-item:focus,
            .playlist-item:focus {
                background-color: rgba(0, 95, 204, 0.1) !important;
            }

            /* Photo card focus enhancement */
            .photo-card:focus {
                transform: scale(1.02) !important;
                z-index: 10 !important;
            }

            /* Album card focus enhancement */
            .album-list-card:focus {
                background-color: rgba(0, 95, 204, 0.1) !important;
                border: 2px solid #005fcc !important;
            }
        `;
        document.head.appendChild(style);

    });

    function setupPexelsKeyboardNavigation(container) {
        // Enhanced function to make Pexels elements focusable
        function enhancePexelsElements() {
            // First, ensure Pexels and Albums tabs are always focusable
            const pexelsTab = document.getElementById('pexels');
            const albumsTab = document.getElementById('saved');

            [pexelsTab, albumsTab].forEach((tab) => {
                if (tab && !tab.hasAttribute('tabindex')) {
                    tab.setAttribute('tabindex', '0');
                    tab.setAttribute('role', 'button');
                    tab.setAttribute('aria-label', tab.textContent + ' tab - switch between Pexels and Albums');
                    tab.addEventListener('keydown', function(event) {
                        if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            this.click();
                        }
                    });
                }
            });

            // Also target by class selector as backup
            const sourceTabs = container.querySelectorAll('.source span');
            sourceTabs.forEach((tab) => {
                if (!tab.hasAttribute('tabindex')) {
                    tab.setAttribute('tabindex', '0');
                    tab.setAttribute('role', 'button');
                    tab.setAttribute('aria-label', tab.textContent + ' tab');
                    tab.addEventListener('keydown', function(event) {
                        if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            this.click();
                        }
                    });
                }
            });

            // Photo cards in Pexels results
            const photoCards = container.querySelectorAll('.photo-card');
            photoCards.forEach((card) => {
                if (!card.hasAttribute('tabindex')) {
                    card.setAttribute('tabindex', '0');
                    card.setAttribute('role', 'button');
                    card.setAttribute('aria-label', 'Set as background image');
                    card.addEventListener('keydown', function(event) {
                        if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            this.click();
                        }
                    });
                }
            });

            // Album cards in album results
            const albumCards = container.querySelectorAll('.album-list-card');
            albumCards.forEach((card) => {
                if (!card.hasAttribute('tabindex')) {
                    card.setAttribute('tabindex', '0');
                    card.setAttribute('role', 'button');
                    card.setAttribute('aria-label', 'View album images');
                    card.addEventListener('keydown', function(event) {
                        if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            this.click();
                        }
                    });
                }
            });

            // Action icons within cards (save, share buttons)
            const actionIcons = container.querySelectorAll('.action-icon, .album-edit-btn img');
            actionIcons.forEach((icon) => {
                if (!icon.hasAttribute('tabindex')) {
                    icon.setAttribute('tabindex', '0');
                    icon.setAttribute('role', 'button');
                    icon.addEventListener('keydown', function(event) {
                        if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            this.click();
                        }
                    });
                }
            });

            // Maximize overlay buttons
            const maximizeOverlays = container.querySelectorAll('.maximize-overlay');
            maximizeOverlays.forEach((overlay) => {
                if (!overlay.hasAttribute('tabindex')) {
                    overlay.setAttribute('tabindex', '0');
                    overlay.setAttribute('role', 'button');
                    overlay.setAttribute('aria-label', 'Preview background');
                    overlay.addEventListener('keydown', function(event) {
                        if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            this.click();
                        }
                    });
                }
            });
        }

        // Handle dynamically loaded Pexels results
        const pexelsResults = container.querySelector('.pexels-results');
        if (pexelsResults) {
            const observer = new MutationObserver(function(mutations) {
                mutations.forEach(function(mutation) {
                    mutation.addedNodes.forEach(function(node) {
                        if (node.nodeType === 1) {
                            // Check if it's a photo card or contains photo cards
                            if (node.classList && node.classList.contains('photo-card')) {
                                if (!node.hasAttribute('tabindex')) {
                                    node.setAttribute('tabindex', '0');
                                    node.setAttribute('role', 'button');
                                    node.setAttribute('aria-label', 'Set as background image');
                                    node.addEventListener('keydown', function(event) {
                                        if (event.key === 'Enter' || event.key === ' ') {
                                            event.preventDefault();
                                            this.click();
                                        }
                                    });
                                }
                            } else if (node.querySelectorAll) {
                                // Check for photo cards within the node
                                const photoCards = node.querySelectorAll('.photo-card');
                                photoCards.forEach((card) => {
                                    if (!card.hasAttribute('tabindex')) {
                                        card.setAttribute('tabindex', '0');
                                        card.setAttribute('role', 'button');
                                        card.setAttribute('aria-label', 'Set as background image');
                                        card.addEventListener('keydown', function(event) {
                                            if (event.key === 'Enter' || event.key === ' ') {
                                                event.preventDefault();
                                                this.click();
                                            }
                                        });
                                    }
                                });
                            }
                        }
                    });
                });
            });

            observer.observe(pexelsResults, { childList: true, subtree: true });
        }

        // Album results keyboard navigation
        const albumResults = container.querySelector('.album-results');
        if (albumResults) {
            const albumObserver = new MutationObserver(function(mutations) {
                mutations.forEach(function(mutation) {
                    mutation.addedNodes.forEach(function(node) {
                        if (node.nodeType === 1) {
                            if (node.classList && node.classList.contains('album-list-card')) {
                                if (!node.hasAttribute('tabindex')) {
                                    node.setAttribute('tabindex', '0');
                                    node.setAttribute('role', 'button');
                                    node.setAttribute('aria-label', 'View album images');
                                    node.addEventListener('keydown', function(event) {
                                        if (event.key === 'Enter' || event.key === ' ') {
                                            event.preventDefault();
                                            this.click();
                                        }
                                    });
                                }
                            } else if (node.querySelectorAll) {
                                const albumCards = node.querySelectorAll('.album-list-card');
                                albumCards.forEach((card) => {
                                    if (!card.hasAttribute('tabindex')) {
                                        card.setAttribute('tabindex', '0');
                                        card.setAttribute('role', 'button');
                                        card.setAttribute('aria-label', 'View album images');
                                        card.addEventListener('keydown', function(event) {
                                            if (event.key === 'Enter' || event.key === ' ') {
                                                event.preventDefault();
                                                this.click();
                                            }
                                        });
                                    }
                                });
                            }
                        }
                    });
                });
            });

            albumObserver.observe(albumResults, { childList: true, subtree: true });
        }

        // Initial enhancement and periodic re-enhancement for dynamic content
        enhancePexelsElements();

        // Re-enhance elements every 3 seconds to catch any dynamically loaded content
        setInterval(enhancePexelsElements, 3000);
    }

    function setupSpotifyKeyboardNavigation(container) {
        // Enhanced Spotify element selector based on actual IDs from the code
        function enhanceSpotifyElements() {
            // Control buttons with specific IDs
            const controlButtonIds = [
                'play-button', 'prev-button', 'next-button', 'shuffle-button',
                'repeat-button', 'volume-button', 'share-button', 'sort-playlist-button'
            ];

            controlButtonIds.forEach((buttonId) => {
                const button = document.getElementById(buttonId);
                if (button && !button.hasAttribute('tabindex')) {
                    button.setAttribute('tabindex', '0');
                    if (!button.hasAttribute('role')) {
                        button.setAttribute('role', 'button');
                    }
                    button.addEventListener('keydown', function(event) {
                        if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            this.click();
                        }
                    });
                }
            });

            // Search and playlist buttons
            const interactiveElements = container.querySelectorAll(
                '.search-button, .playlist-button, .sort-button, .track-item, .playlist-item, '
                + '.search-x-icon, .logout-button, .minimize-button'
            );

            interactiveElements.forEach((element) => {
                if (!element.hasAttribute('tabindex')) {
                    element.setAttribute('tabindex', '0');
                    if (!element.hasAttribute('role')) {
                        element.setAttribute('role', 'button');
                    }
                    element.addEventListener('keydown', function(event) {
                        if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            this.click();
                        }
                    });
                }
            });

            // Volume slider special handling
            const volumeSlider = document.getElementById('volume-slider');
            if (volumeSlider && !volumeSlider.hasAttribute('tabindex')) {
                volumeSlider.setAttribute('tabindex', '0');
            }

            // Search input
            const searchInput = container.querySelector('.search-input');
            if (searchInput && !searchInput.hasAttribute('tabindex')) {
                searchInput.setAttribute('tabindex', '0');
            }
        }

        // Handle dynamically loaded Spotify content
        const observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                mutation.addedNodes.forEach(function(node) {
                    if (node.nodeType === 1) {
                        // For track and playlist items that are dynamically added
                        if (node.classList && (node.classList.contains('track-item') || node.classList.contains('playlist-item'))) {
                            if (!node.hasAttribute('tabindex')) {
                                node.setAttribute('tabindex', '0');
                                node.setAttribute('role', 'button');
                                node.addEventListener('keydown', function(event) {
                                    if (event.key === 'Enter' || event.key === ' ') {
                                        event.preventDefault();
                                        this.click();
                                    }
                                });
                            }
                        }

                        // For any new buttons or interactive elements
                        if (node.querySelectorAll) {
                            const newInteractiveElements = node.querySelectorAll(
                                '.track-item, .playlist-item, .sort-button, .search-button, .playlist-button'
                            );

                            newInteractiveElements.forEach((element) => {
                                if (!element.hasAttribute('tabindex')) {
                                    element.setAttribute('tabindex', '0');
                                    if (!element.hasAttribute('role')) {
                                        element.setAttribute('role', 'button');
                                    }
                                    element.addEventListener('keydown', function(event) {
                                        if (event.key === 'Enter' || event.key === ' ') {
                                            event.preventDefault();
                                            this.click();
                                        }
                                    });
                                }
                            });
                        }
                    }
                });
            });
        });

        observer.observe(container, { childList: true, subtree: true });

        // Initial enhancement and periodic re-enhancement for dynamic content
        enhanceSpotifyElements();

        // Re-enhance elements every 2 seconds to catch any dynamically loaded content
        setInterval(enhanceSpotifyElements, 2000);
    }

    function forceEnhanceAllElements() {
        // Timer buttons
        const timerButtons = document.querySelectorAll('#toggle-button, #reset-button');
        timerButtons.forEach((button) => {
            if (button && !button.hasAttribute('tabindex')) {
                button.setAttribute('tabindex', '0');
                button.removeEventListener('keydown', keyboardActivationHandler);
                button.addEventListener('keydown', keyboardActivationHandler);
            }
        });

        // Navigation items
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach((navItem) => {
            if (!navItem.hasAttribute('tabindex')) {
                navItem.setAttribute('tabindex', '0');
                // Special handling for profile link
                if (navItem.id === 'profile-link') {
                    navItem.removeEventListener('keydown', profileKeyboardHandler);
                    navItem.addEventListener('keydown', profileKeyboardHandler);
                } else {
                    navItem.removeEventListener('keydown', keyboardActivationHandler);
                    navItem.addEventListener('keydown', keyboardActivationHandler);
                }
            }
        });

        // Profile popup buttons
        const profileButtons = document.querySelectorAll('#change-details, #change-avatar, #logout');
        profileButtons.forEach((button) => {
            if (button && !button.hasAttribute('tabindex')) {
                button.setAttribute('tabindex', '0');
                if (!button.hasAttribute('role') && button.tagName !== 'BUTTON') {
                    button.setAttribute('role', 'button');
                }
                button.removeEventListener('keydown', keyboardActivationHandler);
                button.addEventListener('keydown', keyboardActivationHandler);
            }
        });

        // All buttons on the page
        const allButtons = document.querySelectorAll('button');
        allButtons.forEach((button) => {
            if (!button.hasAttribute('tabindex')
                && button.style.cursor !== 'not-allowed'
                && button.style.opacity !== '0.5'
                && !button.disabled) {
                button.setAttribute('tabindex', '0');
                button.removeEventListener('keydown', keyboardActivationHandler);
                button.addEventListener('keydown', keyboardActivationHandler);
            }
        });

        // All clickable images and elements with onclick
        const allClickable = document.querySelectorAll('img[onclick], img[title], [onclick]');
        allClickable.forEach((element) => {
            if (!element.hasAttribute('tabindex')
                && element.style.cursor !== 'not-allowed'
                && element.style.opacity !== '0.5') {
                element.setAttribute('tabindex', '0');
                if (!element.hasAttribute('role') && element.tagName !== 'BUTTON' && element.tagName !== 'A') {
                    element.setAttribute('role', 'button');
                }
                element.removeEventListener('keydown', keyboardActivationHandler);
                element.addEventListener('keydown', keyboardActivationHandler);
            }
        });

        // Re-enhance all elements in Spotify container
        const spotifyContainer = document.querySelector('#spotify-container');
        if (spotifyContainer) {
            // Force all Spotify control buttons to be focusable
            const spotifyButtons = spotifyContainer.querySelectorAll(
                'img, button, .search-button, .playlist-button, .sort-button, '
                + '.track-item, .playlist-item, .control-button, .logout-button, .minimize-button'
            );

            spotifyButtons.forEach((element) => {
                if (!element.hasAttribute('tabindex')
                    && element.style.cursor !== 'not-allowed'
                    && element.style.opacity !== '0.5') {
                    element.setAttribute('tabindex', '0');
                    if (!element.hasAttribute('role') && element.tagName !== 'INPUT') {
                        element.setAttribute('role', 'button');
                    }
                    // Remove any existing keyboard listeners to avoid duplicates
                    element.removeEventListener('keydown', keyboardActivationHandler);
                    element.addEventListener('keydown', keyboardActivationHandler);
                }
            });
        }

        // Re-enhance all elements in background container
        const backgroundContainer = document.querySelector('.background-container');
        if (backgroundContainer) {
            // Specifically ensure Pexels and Albums tabs are always focusable
            const pexelsTab = document.getElementById('pexels');
            const albumsTab = document.getElementById('saved');

            [pexelsTab, albumsTab].forEach((tab) => {
                if (tab && !tab.hasAttribute('tabindex')) {
                    tab.setAttribute('tabindex', '0');
                    tab.setAttribute('role', 'button');
                    tab.setAttribute('aria-label', tab.textContent + ' tab - switch source');
                    tab.removeEventListener('keydown', keyboardActivationHandler);
                    tab.addEventListener('keydown', keyboardActivationHandler);
                }
            });

            const backgroundElements = backgroundContainer.querySelectorAll(
                '.photo-card, .album-list-card, .action-icon, .maximize-overlay, '
                + '.background-top-left, .background-top-right, .clear-icon-bg, '
                + '.source span, #pexels, #saved, #album-sort-btn, .album-edit-btn img'
            );

            backgroundElements.forEach((element) => {
                if (!element.hasAttribute('tabindex')) {
                    element.setAttribute('tabindex', '0');
                    if (!element.hasAttribute('role') && element.tagName !== 'INPUT') {
                        element.setAttribute('role', 'button');
                    }
                    element.removeEventListener('keydown', keyboardActivationHandler);
                    element.addEventListener('keydown', keyboardActivationHandler);
                }
            });
        }
    }

    // Generic keyboard activation handler
    function keyboardActivationHandler(event) {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            this.click();
        }
    }

                // Special keyboard handler for profile link with extensive debugging
    function profileKeyboardHandler(event) {

        if (event.key === 'Enter' || event.key === ' ') {
            // For profile link, be less aggressive with event prevention
            event.preventDefault();

            // Add double-click protection for profile too
            if (event.target.hasAttribute('data-keyboard-clicking')) {
                return;
            }

            event.target.setAttribute('data-keyboard-clicking', 'true');

            // Set flag to indicate this was opened via keyboard
            window.profileOpenedViaKeyboard = true;

            // Try vanilla JS method first (most reliable)
            if (window.toggleProfilePopup && typeof window.toggleProfilePopup === 'function') {
                try {
                    const wasVisible = window.profilePopupVisible;
                    window.toggleProfilePopup();

                    // If popup just opened, focus first button immediately (keyboard only)
                    if (!wasVisible && window.profilePopupVisible) {
                        setTimeout(() => {
                            focusFirstProfileButton();
                        }, 50);
                    }
                } catch (error) {
                    // Fallback to click if method fails
                    setTimeout(() => {
                        event.target.click();
                    }, 10);
                }
            } else {
                // Fallback to click if function isn't available
                setTimeout(() => {
                    event.target.click();
                }, 10);
            }

            // Remove the click protection flag and keyboard flag
            setTimeout(() => {
                event.target.removeAttribute('data-keyboard-clicking');
                window.profileOpenedViaKeyboard = false;
            }, 200);

        }
    }

    // Make functions globally available
    window.keyboardNav = {
        closeActiveModals,
        navigateToSection,
        trapFocus,
        setupPexelsKeyboardNavigation,
        setupSpotifyKeyboardNavigation,
        forceEnhanceAllElements,
        setupProfilePopupNavigation,
        focusFirstProfileButton,
        setupProfilePopupFocusTrap,
        setupAvatarPopupNavigation,
        focusFirstAvatarElement
    };

    // Call force enhancement every 5 seconds to ensure everything is accessible
    setInterval(forceEnhanceAllElements, 5000);

            // Additional initialization specifically for profile link
    setTimeout(() => {
        const profileLink = document.getElementById('profile-link');

        if (profileLink) {
            const profileDebugInfo = ({
                tabindex: profileLink.getAttribute('tabindex'),
                role: profileLink.getAttribute('role'),
                'aria-label': profileLink.getAttribute('aria-label'),
                'data-keyboard-handler': profileLink.getAttribute('data-keyboard-handler'),
                className: profileLink.className
            });

            // Ensure it has proper accessibility attributes
            profileLink.setAttribute('tabindex', '0');
            profileLink.setAttribute('role', 'button');
            profileLink.setAttribute('aria-label', 'Open profile menu');

            // Add keyboard handler if not already present
            const hasKeyboardHandler = profileLink.hasAttribute('data-keyboard-handler');

            if (!hasKeyboardHandler) {
                profileLink.addEventListener('keydown', profileKeyboardHandler);
                profileLink.setAttribute('data-keyboard-handler', 'true');
            }

        // Final test
        // if (window.toggleProfilePopup) {}


        }
    }, 1000); // Wait 1 second for everything to load

}());
