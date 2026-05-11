# Study1Only – Music-Enhanced Learning Platform

**Live:** https://study1only.onrender.com

A web-based productivity platform that combines a Pomodoro-style study timer, Spotify music integration, and social features to help students stay focused and motivated.

---

## Setup

### Prerequisites

- Node.js and npm
- MySQL server

### Database

```bash
# Start MySQL and initialise schema
sudo service mysql start
mysql < db/schema.sql
```

### Install & Run

```bash
npm install
npm start
```

For development with auto-reload:

```bash
npm run dev
```

The app runs on `http://localhost:8080`.

### Environment Variables

Create a `.env` file in the project root:

```
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
SPOTIFY_REDIRECT_URI=http://localhost:8080/spotify/callback
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_db_password
DB_NAME=study1only_db
SESSION_SECRET=your_session_secret
PEXELS_API_KEY=your_pexels_api_key
```

---

## Test Accounts

| Role  | Username / Email          | Password          |
|-------|---------------------------|-------------------|
| Admin | advanmin                  | toilaadminday123  |
| Spotify test | testvanuser@gmail.com | testuser123    |

---

## Features

### Spotify Integration
- Play music during study sessions via the Spotify Web Playback SDK
- Search songs and artists; browse liked songs and saved playlists
- Detects playback on other devices and disables controls accordingly
- Spotify logout without page reload

### Study Timer
- Custom session and break durations with audio notifications
- Session statistics: total study time broken down by week, month, and all-time

### Background Customization
- Dynamic backgrounds via the Pexels API
- Custom albums to organise and save favourite backgrounds

### Social Features
- Global and country-based leaderboards
- Achievement system for study milestones and login streaks
- Daily study streak and login streak tracking

### User Management
- Registration and login with CAPTCHA verification
- Profile management: username, password, avatar, country
- Account security: bcrypt hashing, secure sessions, account lockout

### Admin Dashboard
- View, edit, and remove user accounts

---

## Limitations

- **Spotify Developer Mode:** Users must be added to the Spotify developer dashboard to access Spotify features.
- **Premium required for playback:** Free accounts can search and browse but cannot play music.
- **One-to-one Spotify linking:** Each Spotify account can only be linked to one platform account.
- **External API dependency:** Spotify and Pexels APIs must be available for full functionality.

### Deployment (Render + Clever Cloud free tier)

- **Cold starts:** The app sleeps after 15 minutes of inactivity. The first request after sleep takes ~30 seconds to respond.
- **Ephemeral file storage:** Uploaded files (avatars, etc.) are stored on Render's local filesystem and are wiped on every redeploy or restart. Uploads do not persist long-term.
- **Sessions lost on restart:** `express-session` uses an in-memory store, so all active sessions are cleared whenever the app restarts or redeploys.
- **Database limits:** Clever Cloud's free MySQL plan is a shared instance with limited storage and concurrent connections — not suitable for production traffic.
- **Spotify redirect URI:** If the Render app URL ever changes, the redirect URI must be manually updated in the Spotify Developer Dashboard and in the environment variables.

---

## Technology Stack

| Layer      | Technology                              |
|------------|-----------------------------------------|
| Frontend   | HTML5, CSS3, JavaScript                 |
| Backend    | Node.js, Express.js                     |
| Database   | MySQL (mysql2)                          |
| APIs       | Spotify Web API, Pexels API             |
| Security   | bcrypt, helmet, express-rate-limit, xss |

---

## Team – Group 111 (COMP SCI 2207/7207, 2025 Semester 1)

| Member | Contributions |
|--------|---------------|
| Nam Trung Tran | Achievement system, database architecture, admin page, navigation bar |
| Tri Dung Nguyen | Leaderboard, study statistics, clock frontend, user avatar upload, responsive design |
| Minh Chien Nguyen *(Leader)* | Clock functionality, study statistics backend, login system, session management |
| Hai Trung Do | Background system, Spotify integration, cookie management, code integration |
