// Authentication check - runs immediately when page loads
(async function checkAdminAuth() {
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

        // Check if user has admin role
        if (!userData.role || userData.role !== 'admin') {
            window.location.href = '/login.html?error=access_denied';
            return;
        }

        // User is authenticated and is admin, show the page content
        document.body.style.display = 'block';

    } catch (error) {
        window.location.href = '/login.html?error=auth_error';
    }
}());
