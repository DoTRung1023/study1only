/* eslint-disable no-unused-vars */
/* eslint-disable no-undef */
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

function createCircularAvatar(source, size) {
    const circularCanvas = document.createElement('canvas');
    circularCanvas.width = size;
    circularCanvas.height = size;
    const ctx = circularCanvas.getContext('2d');

    // Create circular clipping path
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.clip();

    // Draw image centered and scaled to fit
    const ratio = Math.min(source.width / size, source.height / size);
    ctx.drawImage(
        source,
        (source.width - size * ratio) / 2,
        (source.height - size * ratio) / 2,
        size * ratio,
        size * ratio,
        0,
        0,
        size,
        size
    );

    return circularCanvas;
}

document.addEventListener('DOMContentLoaded', function () {
    const avatarPopup = document.getElementById('avatar-popup');
    const changeAvatarBtn = document.getElementById('change-avatar');
    const cancelBtn = document.getElementById('avatar-cancel');
    const confirmBtn = document.getElementById('avatar-confirm');
    const chooseAvatar = document.getElementById('choose-avatar');
    const avatarInput = document.getElementById('avatar-input');
    const uploadArea = document.getElementById('avatar-upload-area');
    const resetAvatar = document.getElementById('reset-avatar');

    let cropper;
    let isResetPending = false; // Track if reset is pending

        // Set cursor to default for all avatar images on page load
    const navAvatarImg = document.querySelector('.profile-avatar');
    const profileAvatarImg = document.querySelector('.profile-header img');

    if (navAvatarImg) {
        navAvatarImg.style.setProperty('cursor', 'default', 'important');
    }
    if (profileAvatarImg) {
        profileAvatarImg.style.setProperty('cursor', 'default', 'important');
    }

    // Function to get current user data from session
    async function getCurrentUserData() {
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

        return response.json();
    }

    // Show popup
    changeAvatarBtn.addEventListener('click', async function (e) {
        e.preventDefault();
        avatarPopup.style.display = 'flex';
        uploadArea.innerHTML = '';
        avatarInput.value = '';
        isResetPending = false;

        try {
            // Get the current avatar URL from session instead of localStorage
            const userData = await getCurrentUserData();
            if (userData && userData.avatar_link) {
                // Create a new image with timestamp to prevent caching
                const timestamp = new Date().getTime();
                let currentAvatar = userData.avatar_link;

                // Handle default avatar path consistently
                if (currentAvatar === '/images/default-avatar.png') {
                    currentAvatar = '/images/default-avatar.png';
                }

                // Add timestamp to prevent caching
                currentAvatar = `${currentAvatar}?t=${timestamp}`;

                // Create a new image element with error handling
                const img = new Image();
                img.onload = function() {
                    uploadArea.innerHTML = `<img id="avatar-preview" src="${currentAvatar}" alt="Avatar" style="width: 100%; height: 100%; object-fit: cover;">`;
                };
                img.onerror = function() {
                    // If loading fails, show default avatar
                    const defaultAvatar = '/images/default-avatar.png';
                    uploadArea.innerHTML = `<img id="avatar-preview" src="${defaultAvatar}" alt="Avatar" style="width: 100%; height: 100%; object-fit: cover;">`;
                };
                img.src = currentAvatar;
            } else {
                // If no avatar_link in userData, show default avatar
                const defaultAvatar = '/images/default-avatar.png';
                uploadArea.innerHTML = `<img id="avatar-preview" src="${defaultAvatar}" alt="Avatar" style="width: 100%; height: 100%; object-fit: cover;">`;
            }
        } catch (error) {
            // Fallback to default avatar if session check fails
            const defaultAvatar = '/images/default-avatar.png';
            uploadArea.innerHTML = `<img id="avatar-preview" src="${defaultAvatar}" alt="Avatar" style="width: 100%; height: 100%; object-fit: cover;">`;
        }
    });

    // Hide popup
    cancelBtn.addEventListener('click', async function () {
        avatarPopup.style.display = 'none';
        isResetPending = false;

        try {
            // Restore the original avatar from session instead of localStorage
            const userData = await getCurrentUserData();
            if (userData && userData.avatar_link) {
                const currentAvatar = userData.avatar_link;
                uploadArea.innerHTML = `<img src="${currentAvatar}" alt="Avatar">`;
            }
        } catch (error) { /* empty */ }

        if (cropper) {
            cropper.destroy();
            cropper = null;
        }
    });

    // File selection handlers
    chooseAvatar.addEventListener('click', () => avatarInput.click());

    // uploadArea.addEventListener('click', () => avatarInput.click());
    // Image cropping initialization
    avatarInput.addEventListener('change', function () {
        if (this.files && this.files[0]) {
            isResetPending = false; // Clear reset state when new file is selected
            const reader = new FileReader();
            reader.onload = (e) => {
                uploadArea.innerHTML = `
                    <div class="cropper-container">
                        <img id="cropper-image" src="${e.target.result}">
                    </div>
                `;
                const image = document.getElementById('cropper-image');
                cropper = new Cropper(image, {
                    aspectRatio: 1,
                    viewMode: 1,
                    guides: true,
                    background: true,
                    center: true,
                    dragMode: 'move',
                    autoCropArea: 0.8,
                    responsive: true,
                    restore: true,
                    checkCrossOrigin: true,
                    movable: true,
                    zoomable: true,
                    zoomOnTouch: true,
                    zoomOnWheel: true,
                    wheelZoomRatio: 0.1,
                    minContainerWidth: 150,
                    minContainerHeight: 150,
                    minCanvasWidth: 150,
                    minCanvasHeight: 150,
                    minCropBoxWidth: 150,
                    minCropBoxHeight: 150,
                    initialAspectRatio: 1,
                    rotatable: false,
                    scalable: true,
                    cropBoxMovable: true,
                    cropBoxResizable: true,
                    toggleDragModeOnDblclick: false,
                    ready() {
                        this.cropper.crop();
                    }
                });
            };
            reader.readAsDataURL(this.files[0]);
        }
    });

    // Reset avatar handler
    resetAvatar.addEventListener('click', async function () {
        const defaultAvatar = '/images/default-avatar.png';

        // Create a new image element to ensure proper sizing
        const img = new Image();
        img.onload = function() {
            // Create preview with proper sizing
            uploadArea.innerHTML = `<img id="avatar-preview" src="${defaultAvatar}" alt="Avatar" style="width: 100%; height: 100%; object-fit: cover;">`;
        };
        img.onerror = function() {
            showToast('Failed to load default avatar. Please try again.', true);
        };
        img.src = defaultAvatar;

        // Destroy cropper if it exists
        if (cropper) {
            cropper.destroy();
            cropper = null;
        }

        // Clear file input
        avatarInput.value = '';

        // Set flag to indicate reset is pending
        isResetPending = true;
    });

    // Confirm and update avatars
    confirmBtn.addEventListener('click', async function (e) {
        // Prevent default form submission
        e.preventDefault();

        try {
            // Get user data from session instead of localStorage
            const userData = await getCurrentUserData();
            if (!userData || !userData.id) {
                throw new Error('User data not found in session');
            }

            // If no changes are made (no file selected and no reset pending), just close the popup
            if (!cropper && !isResetPending) {
                avatarPopup.style.display = 'none';
                return;
            }

            // Show loading state
            confirmBtn.textContent = 'Saving...';
            confirmBtn.disabled = true;

            let response;
            let data;

            if (isResetPending) {
                // Handle reset to default avatar
                response = await fetch('/users/reset-photo', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ userId: userData.id })
                });

                // Check if response is ok before parsing
                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`Server error: ${response.status} ${response.statusText}`);
                }

                data = await response.json();

                // Note: No need to update localStorage since we're using session-based auth
                // The server session already contains the updated data

                // Add timestamp to prevent caching
                const timestamp = new Date().getTime();
                const avatarUrl = `/images/default-avatar.png?t=${timestamp}`;

                // Update navigation avatar immediately
                const navAvatar = document.querySelector('.profile-avatar');
                if (navAvatar) {
                    navAvatar.src = avatarUrl;
                    navAvatar.style.width = '40px';
                    navAvatar.style.height = '40px';
                    navAvatar.style.objectFit = 'cover';
                    navAvatar.style.setProperty('cursor', 'default', 'important');
                } else { /* empty */ }

                // Update profile popup avatar immediately
                const profileAvatar = document.querySelector('.profile-header img');
                if (profileAvatar) {
                    profileAvatar.src = avatarUrl;
                    // Check if mobile device (width < 768px) for bigger avatar
                    const isMobile = window.innerWidth < 768;
                    const avatarSize = isMobile ? '90px' : '70px';
                    profileAvatar.style.width = avatarSize;
                    profileAvatar.style.height = avatarSize;
                    profileAvatar.style.objectFit = 'cover';
                    profileAvatar.style.setProperty('cursor', 'default', 'important');
                } else { /* empty */ }

                showToast('Avatar reset to default successfully!');

                // Refresh leaderboard if the function exists
                if (typeof window.refreshLeaderboard === 'function') {
                    setTimeout(() => {
                        window.refreshLeaderboard();
                    }, 300); // Small delay to ensure data is updated
                }

                avatarPopup.style.display = 'none';
            } else if (cropper) {
                // Handle cropped image upload
                const canvas = cropper.getCroppedCanvas({
                    fillColor: 'transparent',
                    imageSmoothingQuality: 'high'
                });

                // Create circular avatars for nav and profile
                const navAvatar = createCircularAvatar(canvas, 45);
                const profileAvatar = createCircularAvatar(canvas, 70);

                // Convert canvas to blob
                const blob = await new Promise((resolve) => {
                    canvas.toBlob((result) => resolve(result), 'image/png', 1.0);
                });

                // Create FormData
                const formData = new FormData();
                formData.append('photo', blob, 'avatar.png');
                formData.append('userId', userData.id);

                // Send to server
                response = await fetch('/users/update-photo', {
                    method: 'POST',
                    body: formData
                });

                // Check if response is ok before parsing
                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`Server error: ${response.status} ${response.statusText}`);
                }

                data = await response.json();

                // Note: No need to update localStorage since we're using session-based auth
                // The server session already contains the updated data

                // Update the avatars with full resolution images from server
                const timestamp = new Date().getTime();
                const avatarUrl = `${data.photoUrl}?t=${timestamp}`;

                // Create new image elements to ensure proper loading
                const navImg = new Image();
                const profileImg = new Image();

                navImg.onload = function() {
                    const navAvatarEl = document.querySelector('.profile-avatar');
                    navAvatarEl.src = avatarUrl;
                    navAvatarEl.style.setProperty('cursor', 'default', 'important');
                };
                profileImg.onload = function() {
                    const profileAvatarEl = document.querySelector('.profile-header img');
                    profileAvatarEl.src = avatarUrl;
                    profileAvatarEl.style.setProperty('cursor', 'default', 'important');
                };

                navImg.src = avatarUrl;
                profileImg.src = avatarUrl;

                showToast('Avatar updated successfully!');

                // Refresh leaderboard if the function exists
                if (typeof window.refreshLeaderboard === 'function') {
                    setTimeout(() => {
                        window.refreshLeaderboard();
                    }, 300); // Small delay to ensure data is updated
                }

                cropper.destroy();
                cropper = null;
            }

        } catch (error) {
            showToast(error.message || 'Failed to update avatar. Please try again.', true);
        } finally {
            // Reset button state and close popup
            confirmBtn.textContent = 'Confirm';
            confirmBtn.disabled = false;
            isResetPending = false;
            avatarPopup.style.display = 'none';
        }
    });
}); // End of DOMContentLoaded event listener
