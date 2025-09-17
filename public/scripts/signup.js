
function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.style.display = "block";
  toast.classList.add("show");

  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => {
      toast.style.display = "none";
    }, 500);
  }, 3000);
}

// Function to check if all conditions are met
async function validateForm() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const address = document.getElementById('address').value;
    const confirmPassword = document.getElementById('confirm-password').value;
    const country = $('#country').val();

    const usernameError = document.getElementById('username-error');
    const addressError = document.getElementById('address-error');
    const passwordError = document.getElementById('password-error');
    const confirmPasswordError = document.getElementById('confirm-password-error');
    const countryError = document.getElementById('country-error');

    let isValid = true;

    // Validate username
    if (username.length < 1 || username.length > 10) {
        usernameError.textContent = 'Username must be between 1 and 10 characters.';
        usernameError.style.display = 'block';
        isValid = false;
    } else if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        usernameError.textContent = 'Username can only contain letters, numbers, and underscores.';
        usernameError.style.display = 'block';
        isValid = false;
    } else {
        usernameError.style.display = 'none';
        try {
            const response = await fetch('/users/check-username', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username })
            });
            // const data = await response.json();
            if (response.status === 409){
                usernameError.textContent = 'Username already exists.';
                usernameError.style.display = 'block';
                isValid = false;
            } else {
                usernameError.style.display = 'none';
            }
        } catch (error) {
            usernameError.textContent = 'Error checking username.';
            usernameError.style.display = 'block';
            isValid = false;
        }
    }

    // Validate address
    if (address.trim() === '') {
        addressError.textContent = 'This field is required.';
        addressError.style.display = 'block';
        isValid = false;
    } else {
        addressError.style.display = 'none';
    }

    // Validate password
    if (password.length < 6 || password.length > 20) {
        passwordError.textContent = 'Password must be between 6 and 20 characters.';
        passwordError.style.display = 'block';
        isValid = false;
    } else {
        passwordError.style.display = 'none';
    }

    // Validate confirm password
    if (password !== confirmPassword) {
        confirmPasswordError.textContent = 'Passwords do not match.';
        confirmPasswordError.style.display = 'block';
        isValid = false;
    } else {
        confirmPasswordError.style.display = 'none';
    }

    // Validate country
    if (!country) {
        countryError.textContent = 'Please select your country';
        countryError.style.display = 'block';
        isValid = false;
    } else {
        countryError.style.display = 'none';
    }

    // Enable or disable the Confirm button
    const confirmButton = document.querySelector('.btn-confirm');
    if (isValid) {
        confirmButton.disabled = false;
        confirmButton.classList.remove('disabled');
    } else {
        confirmButton.disabled = true;
        confirmButton.classList.add('disabled');
    }
}

// Debounce function to delay validation until the user stops typing
function debounce(func, delay) {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), delay);
    };
}

// Add event listeners for real-time validation with debounce
document.getElementById('username').addEventListener('input', debounce(validateForm, 300));
document.getElementById('address').addEventListener('input', validateForm);
document.getElementById('password').addEventListener('input', validateForm);
document.getElementById('confirm-password').addEventListener('input', debounce(validateForm, 300));

// Disable the Confirm button by default
document.querySelector('.btn-confirm').disabled = true;
document.querySelector('.btn-confirm').classList.add('disabled');

// Show password error immediately on page load
validateForm();

// Show confirmation modal
function showConfirmModal() {
    document.getElementById('confirmModal').style.display = 'block';
}

// Close confirmation modal
function closeConfirmModal() {
    document.getElementById('confirmModal').style.display = 'none';
}

// Close notification
function closeNotification() {
    document.getElementById('successNotification').style.display = 'none';
}

// Show success notification
function showSuccessNotification() {
    document.getElementById('successNotification').style.display = 'block';
    // Auto-hide after 3 seconds
    setTimeout(() => {
        closeNotification();
        window.location.href = '/login.html';
    }, 3000);
}

// Submit signup
// eslint-disable-next-line no-unused-vars
async function submitSignup() {
    const username = document.getElementById('username').value;
    const address = document.getElementById('address').value;
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirm-password').value;
    const country = $('#country').val();

    try {
        const response = await fetch('/users/signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username,
                address,
                password,
                confirmPassword,
                country
            })
        });

        const data = await response.json();

        if (response.ok) {
            closeConfirmModal();
            showSuccessNotification();
        } else {
            showToast(data.message || 'An error occurred.');
        }
    } catch (error) {
        showToast('An error occurred. Please try again.');
    }
}

// Toggle password visibility
// eslint-disable-next-line no-unused-vars
function togglePassword() {
    const passwordInput = document.getElementById('password');
    const toggleIcon = document.getElementById('toggleIcon');

    const isHidden = passwordInput.getAttribute('type') === 'password';
    passwordInput.setAttribute('type', isHidden ? 'text' : 'password');
    toggleIcon.innerHTML = isHidden
        ? '<img src="images/unhide.png" alt="unhide" />'
        : '<img src="images/hide.png" alt="hide" />';
}

// Initialize Select2 for country dropdown immediately
$(document).ready(function() {
    // Hide the original select
    $('#country').hide();

    // Initialize Select2
    $('#country').select2({
        placeholder: 'select your country',
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
        // Add custom class when dropdown is open
        $('.select2-container--open').addClass('select2-custom');
        // Add placeholder to search box
        setTimeout(function() {
            $('.select2-search__field').attr('placeholder', 'Search');
        }, 0);
    })
    .on('select2:select', function() {
        // Clear error when country is selected
        $('#country-error').hide();
        validateForm();
    })
    .on('select2:clear', function() {
        // Show error when country is cleared
        $('#country-error').show();
        validateForm();
    });

    // Fetch countries from REST Countries API
    fetch('https://restcountries.com/v3.1/all?fields=name')
        .then((response) => response.json())
        .then((countries) => {
            // Sort countries alphabetically by name
            countries.sort((a, b) => a.name.common.localeCompare(b.name.common));
            // Clear existing options except the placeholder
            $('#country').empty().append('<option value="">Select your country</option>');
            // Add countries to the dropdown
            countries.forEach((country) => {
                $('#country').append(new Option(country.name.common, country.name.common));
            });
        })
        .catch((error) => {
            // Error fetching countries
        });
});

// Intercept form submission
document.getElementById("signupForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const confirmButton = document.getElementById("confirmButton");
    if (!confirmButton.disabled) {
        showConfirmModal();
    }
});
