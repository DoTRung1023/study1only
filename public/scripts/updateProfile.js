/* eslint-disable no-unused-vars */
// Modal functions - declared at top for global access
function showConfirmModal() {
    // Remove focus from all input fields to prevent typing into background inputs
    document.activeElement.blur();

    // Also blur all input fields and select elements to be extra sure
    const inputs = document.querySelectorAll('input, select, textarea');
    inputs.forEach((input) => input.blur());

    // Show the modal
    document.getElementById('confirmModal').style.display = 'block';
}

function closeConfirmModal() {
    document.getElementById('confirmModal').style.display = 'none';
}

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

// Global user variable
let user;

// Wait for DOM to be ready before setting placeholders and initializing elements
document.addEventListener('DOMContentLoaded', async function() {
    // Get user data from session instead of localStorage
    try {
        user = await getCurrentUserData();
    } catch (error) {
        // If session check fails, redirect to login
        window.location.href = 'login.html';
        return;
    }

    if (user) {
        // Populate placeholders with fresh data
        const usernameElement = document.getElementById('username');
        const addressElement = document.getElementById('address');

        if (usernameElement) {
            usernameElement.placeholder = user.username || 'Old Username';
        }
        if (addressElement) {
            addressElement.placeholder = user.address || 'Old City';
        }

        // Debug: Check what's in user.region after refresh
    }

    // Elements - now safely accessible after DOM is ready
    const usernameInput = document.getElementById('username');
    const addressInput = document.getElementById('address');
    // const countrySelect = $('#country'); // jQuery for Select2
    const passwordInput = document.getElementById('password');
    const confirmPasswordInput = document.getElementById('confirm-password');
    const confirmPasswordGroup = document.getElementById('confirm-password-group');
    const usernameError = document.getElementById('username-error');
    const passwordError = document.getElementById('password-error');
    // const countryError = document.getElementById('country-error');
    const confirmButton = document.getElementById('confirm-button');

    // Initialize Select2 for country dropdown
    $(document).ready(function() {
        // Hide the original select
        $('#country').hide();

        // Get the user's region or set a default placeholder
        const userRegionPlaceholder = user.region || 'Select your country';

        // Define the clear handler function separately to avoid arguments.callee
        function handleClearEvent() {
            // When cleared, reset to show old country as placeholder (or default if no region)
            $('#country').empty().append('<option value="">Select your country</option>');

            // Re-populate countries and reset placeholder to old country
            fetch('https://restcountries.com/v3.1/all?fields=name')
                .then((response) => response.json())
                .then((countries) => {
                    countries.sort((a, b) => a.name.common.localeCompare(b.name.common));
                    countries.forEach((country) => {
                        $('#country').append(new Option(country.name.common, country.name.common));
                    });

                    // Set the user's current country as the default selected value
                    if (user.region) {
                        $('#country').val(user.region);
                    }

                    // Reset placeholder to user's original region (or default)
                    $('#country').select2('destroy').select2({
                        placeholder: userRegionPlaceholder,
                        allowClear: true,
                        width: '100%',
                        theme: 'default',
                        minimumResultsForSearch: 0,
                        dropdownParent: $('.form-container'),
                        language: {
                            noResults: function() {
                                return "No countries found";
                            },
                            searching: function() {
                                return "Searching...";
                            }
                        }
                    })
                    .on('select2:open', function() {
                        $('.select2-container--open').addClass('select2-custom');
                        setTimeout(function() {
                            $('.select2-search__field').attr('placeholder', 'Search');
                        }, 0);
                    })
                    .on('select2:select', function() {
                        $('#country-error').hide();
                    })
                    .on('select2:clear', handleClearEvent); // Use function reference instead of arguments.callee
                })
                .catch((error) => {
                    showToast('Error loading countries for clear event:', error);
                });

            // Clear error when country is cleared
            $('#country-error').hide();
        }

        // Initialize Select2
        $('#country').select2({
            placeholder: userRegionPlaceholder,
            allowClear: true,
            width: '100%',
            theme: 'default',
            minimumResultsForSearch: 0,
            dropdownParent: $('.form-container'),
            language: {
                noResults: function() {
                    return "No countries found";
                },
                searching: function() {
                    return "Searching...";
                }
            }
        })
        .on('select2:open', function() {
            $('.select2-container--open').addClass('select2-custom');
            setTimeout(function() {
                $('.select2-search__field').attr('placeholder', 'Search');
            }, 0);
        })
        .on('select2:select', function() {
            $('#country-error').hide();
        })
        .on('select2:clear', handleClearEvent)
        .on('select2:opening', function() {
            // Clear error when dropdown is opening
            $('#country-error').hide();
        });

        // Populate countries from the REST API
        fetch('https://restcountries.com/v3.1/all?fields=name')
            .then((response) => response.json())
            .then((countries) => {
                countries.sort((a, b) => a.name.common.localeCompare(b.name.common));
                countries.forEach((country) => {
                    $('#country').append(new Option(country.name.common, country.name.common));
                });

                // Set the user's current country as the default selected value if it exists
                if (user.region) {
                    $('#country').val(user.region).trigger('change');
                } else {
                    // Since user has no country set, we'll leave it as the default placeholder
                }
            })
            .catch((error) => {
                showToast('Error loading countries:', error);
            });
    });

    // Clear placeholder on focus only if the input field is empty
    usernameInput.addEventListener('focus', () => {
        if (usernameInput.value === '') {
            usernameInput.placeholder = '';
        }
    });

    addressInput.addEventListener('focus', () => {
        if (addressInput.value === '') {
            addressInput.placeholder = '';
        }
    });

    passwordInput.addEventListener('focus', () => {
        if (passwordInput.value === '') {
            passwordInput.placeholder = '';
        }
    });

    // Restore placeholder on blur if the input field is empty
    usernameInput.addEventListener('blur', () => {
        if (usernameInput.value === '') {
            usernameInput.placeholder = user.username;
        }
    });

    addressInput.addEventListener('blur', () => {
        if (addressInput.value === '') {
            addressInput.placeholder = user.address || '';
        }
    });

    passwordInput.addEventListener('blur', () => {
        if (passwordInput.value === '') {
            passwordInput.placeholder = 'New Password';
        }
    });

    // Show confirm password field only when a new password is typed
    passwordInput.addEventListener('input', () => {
        const passwordValue = passwordInput.value.trim();

        // If the password field is empty, hide the confirm password field and clear its value
        if (passwordValue === '') {
            confirmPasswordGroup.style.display = 'none'; // Hide the confirm password field
            confirmPasswordInput.value = ''; // Clear the confirm password field
            passwordError.style.display = 'none'; // Hide the password error message
        } else {
            confirmPasswordGroup.style.display = 'block'; // Show the confirm password field

            // Check if the confirm password matches the password
            if (confirmPasswordInput.value !== passwordValue) {
                passwordError.style.display = 'block';
                passwordError.textContent = 'Passwords do not match.';
            } else {
                passwordError.style.display = 'none';
            }
        }
    });

    // Validate confirm password
    confirmPasswordInput.addEventListener('input', () => {
        const passwordValue = passwordInput.value.trim();
        const confirmPasswordValue = confirmPasswordInput.value.trim();

        // If the confirm password does not match the password, show an error
        if (confirmPasswordValue !== passwordValue) {
            passwordError.style.display = 'block';
            passwordError.textContent = 'Passwords do not match.';
        } else {
            passwordError.style.display = 'none';
        }
    });

    // Validate username length, spaces, and availability
    usernameInput.addEventListener('input', async () => {
        const username = usernameInput.value.trim();

        // Check for length and spaces first
        if (username.length > 10) {
            usernameError.style.display = 'block';
            usernameError.textContent = 'Username must not exceed 10 characters.';
            return;
        }
        if (/\s/.test(username)) {
            usernameError.style.display = 'block';
            usernameError.textContent = 'Username must not contain spaces.';
            return;
        }

        // If the username is the same as the old username, hide the error message
        if (username === user.username) {
            usernameError.style.display = 'none';
            return;
        }

        // Now check for availability
        try {
            const response = await fetch('/users/check-username', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username })
            });
            // const data = await response.json();

            if (response.status === 409) {
                usernameError.style.display = 'block';
                usernameError.textContent = 'Username is already taken.';
            } else {
                usernameError.style.display = 'none';
            }
        } catch (error) {
            showToast('Error checking username availability:', error);
        }
    });

    // Validate password length
    passwordInput.addEventListener('input', () => {
        const password = passwordInput.value.trim();

        if (password === '') {
            passwordError.style.display = 'none';
            return;
        }

        if (password.length < 6 || password.length > 20) {
            passwordError.style.display = 'block';
            passwordError.textContent = 'Password must be between 6 and 20 characters.';
        } else {
            passwordError.style.display = 'none';
        }
    });

    // Handle confirm button click
    confirmButton.addEventListener('click', async () => {
        // Validate inputs
        if (usernameError.style.display === 'block' || passwordError.style.display === 'block') {
            showToast('Please fix the errors before submitting.', true);
            return;
        }

        const newUsername = usernameInput.value.trim();
        const newAddress = addressInput.value.trim();
        const newCountry = $('#country').val(); // Get selected country
        const newPassword = passwordInput.value.trim();

        // Show custom confirmation modal
        showConfirmModal();
    });

}); // End DOMContentLoaded

// eslint-disable-next-line no-unused-vars
async function confirmUpdate() {
    // Close the modal first
    closeConfirmModal();

    // Get the form values
    const usernameInput = document.getElementById('username');
    const addressInput = document.getElementById('address');
    const passwordInput = document.getElementById('password');

    const newUsername = usernameInput.value.trim();
    const newAddress = addressInput.value.trim();
    const newCountry = $('#country').val(); // Get selected country
    const newPassword = passwordInput.value.trim();

    try {
        // Get current user data from session to ensure we have the latest user ID
        const currentUser = await getCurrentUserData();

        const response = await fetch('/users/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: currentUser.id, // Use id from session instead of user_id from localStorage
                username: newUsername !== currentUser.username ? newUsername : null,
                address: newAddress || null,
                region: newCountry !== currentUser.region ? newCountry : null,
                password: newPassword || null
            })
        });

        const data = await response.json();
        if (response.ok) {
            showToast('Information updated successfully!');
            // Note: No need to update localStorage since we're using session-based auth
            // The server session already contains the updated data
            setTimeout(() => {
                window.location.href = 'home.html';
            }, 1500);
        } else {
            showToast(data.message || 'An error occurred while updating your information.', true);
        }
    } catch (error) {
        showToast('An error occurred. Please try again.', true);
    }
}
