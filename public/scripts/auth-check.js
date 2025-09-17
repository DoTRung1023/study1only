// Authentication check - runs immediately when page loads
(async function checkAuth() {
    try {
        const response = await fetch('/users/me', {
            method: 'GET',
            credentials: 'include',
            headers: {
                Accept: 'application/json'
            }
        });

        if (!response.ok) {
            // User is not authenticated
            window.location.href = '/login.html?error=auth_required';
            return;
        }

        const userData = await response.json();

        // Check if user is admin trying to access regular user pages
        if (userData.role === 'admin') {
            window.location.href = '/admin.html';
            return;
        }

        // User is authenticated and is a regular user, show the page content with proper centering
        document.body.classList.add('authenticated');

    } catch (error) {
        window.location.href = '/login.html?error=auth_error';
    }
}());
