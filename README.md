# Group Repository for COMP SCI 2207/7207 Web & Database Computing Web Application Project (2023 Semester 1)

Your group's shared repository for the WDC 2023 Web App Project.

Auto commit/push/sync to Github is disabled by default in this repository.
- Enable the GitDoc extension to use this fucntionality (either in your VSCode settings, or in the Dev Container settings)

See [HERE](https://myuni.adelaide.edu.au/courses/85266/pages/2023-web-application-group-project-specification) for the project specification.

We recommend using the 'Shared Repository Model (Branch & Pull)' to collaborate on your work in this single repostory.
- You can read more about collaborating on GitHub repositories [HERE](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests)
- When working on the same file at the same time, the 'Live Share' feature in VSCode can also help.



# ------------------------------------------------------------------------------
# Study1Only - Music-Enhanced Learning Platform
# ------------------------------------------------------------------------------

## Project Description

Study1Only is a web-based productivity platform designed to enhance focus and motivation through a music-integrated study environment. Aimed primarily at students aged 15–25, including high school, university, and remote learners, the platform combines essential study tools with customizable music playback and background visuals to create a distraction-free, engaging atmosphere.

The platform integrates with Spotify for personalized music experiences and provides comprehensive study session tracking, user management, social features like leaderboards and achievements to maintain motivation during study sessions.

## Setup Instructions

### Prerequisites

- Node.js and npm installed
- MySQL server installed and running
- Git for cloning the repository

### Database Setup

- Set up terminal to accept connection to MySQL without password
- Start MySQL server and initialize database:

```bash
# Start MySQL server
sudo service mysql start

# Initialize database schema
mysql < db/schema.sql
```

### Application Setup

- Clone the repository:
```bash
git clone https://github.com/UAdelaide/25S1_WDC_UG_Groups_111.git
```

- Install dependencies:
```bash
npm install express mysql2 bcrypt multer express-validator he luxon axios dotenv request
```

- Start the application:
```bash
npm start
```

## Test Accounts

### Admin Account:
- Username: advanmin
- Password: toilaadminday123

### Spotify Test Account:
- Username: testvanuser@gmail.com
- Password: testuser123

## Features and Functionality

### Core Features

#### Spotify Integration
- Music Playback: Play music during study sessions
- Search Functionality: Search for songs and artists
- Liked Songs Access: Access your Spotify liked songs library
- Playlist Management: Search and access saved playlists from your Spotify account
- Seamless Integration: Connect your Spotify account for personalized music experience

#### Background Customization
- Dynamic Backgrounds: Change study environment backgrounds
- Custom Albums: Create and organize custom background collections
- Save to Albums: Save favorite backgrounds to personal albums
- Visual Environment: Enhance focus with curated visual environments

#### Study Session Management
- Custom Session Timer: Set personalized study session durations
- Break Intervals: Configure custom break intervals between study sessions
- Study Statistics: Comprehensive analytics including:
  - Total study time (all-time, monthly, weekly breakdowns)

#### Social Features
- Leaderboards: Compare study time with other users through global and country-based rankings
- Achievements: Unlock motivational achievements when reaching study milestones and login streak goals
- Streak Tracking: Monitor daily study streaks, login streaks, and longest streaks
- Regional Competition: Country-specific leaderboards for local competition and motivation

## Completed Functionality

### User Management System
- Secure Authentication: Complete user registration and login with CAPTCHA verification
- Profile Management: Users can update personal details, username, password, avatar, and country
- Country-Based Features: Users select their country during signup for regional leaderboard rankings
- Account Security: Password hashing, secure session management, and account lockout protection

### Admin Dashboard
- User Administration: Admin controls for user management
- User Data Management: Change user data and information
- Account Control: Add and remove user accounts
- User Oversight: Administrative control over user accounts and data

### Spotify Integration
- Music Playback: Fully functional music playback during study sessions
- Search Functionality: Complete search system for songs and artists
- Liked Songs Access: Full access to user's Spotify liked songs library
- Playlist Management: Complete search and access to saved playlists from Spotify account
- OAuth Integration: Secure Spotify account connection with token management

### Background Customization
- Dynamic Backgrounds: Complete background changing functionality
- Custom Albums: Fully implemented custom background collection system
- Save to Albums: Complete functionality to save favorite backgrounds to personal albums
- Visual Environment: Full integration with Pexels API for curated visual environments

### Study Session Management
- Custom Session Timer: Personalized study session duration customization
- Break Intervals: Custom break intervals between study sessions with audio notifications
- Session Transitions: Sound alerts when transitioning from study to break sessions
- Study Statistics: Total study time tracking by week, month, and all-time
- Performance Analytics: Statistics integration with leaderboard positioning and achievement progress

### Social Features
- Leaderboards: Complete global and country-based ranking system
- Achievements: Fully implemented achievement system for study milestones and login streaks
- Streak Tracking: Complete daily study streak and login streak monitoring system
- Regional Competition: Full country-specific leaderboard functionality

### Technical Infrastructure
- Responsive Design: Complete cross-device compatibility
- API Integration: Full integration with Spotify and Pexels APIs
- Database Management: Complete MySQL database with optimized performance
- Security Implementation: Full OWASP-compliant security measures including XSS, CSRF, and SQL injection protection

## Known Bugs and Limitations

### Limitations
- Spotify Developer Account Restriction: Users need to be added to the user management of our Spotify developer account to access Spotify features
- Premium Account Requirement: Only Spotify Premium accounts can play music through the platform. Non-premium users can access all other Spotify features (search, browse playlists, view liked songs) but cannot initiate playback
- One-to-One Spotify Account Linking: Each Spotify account can only be linked to one web account (Spotify API restriction)
- API Dependencies: Platform functionality depends on external API availability (Spotify, Pexels)

## Technology Stack
- Frontend: Vue.js, HTML5, CSS3, JavaScript
- Backend: Node.js with Express.js framework
- Database: MySQL relational database
- Architecture: MVC (Model-View-Controller) pattern
- APIs: Spotify Web API, Pexels API
- Security: bcrypt password hashing, CAPTCHA verification, OWASP security guidelines

## Team

Group 111:
- Nam Trung Tran - Achievement system (backend & frontend), Database architecture, Admin page (backend & frontend), Navigation bar, Home page transition, Tester
- Tri Dung Nguyen - Leaderboard system (frontend & backend), Study statistics, Clock frontend, User avatar upload, Home page frontend, Navigation bar, Responsive design
- Minh Chien Nguyen (Leader) - Clock functionality, Study statistics backend, UI design, Login system (frontend & backend), User detail updates, User login session management
- Hai Trung Do - Background system (frontend & backend), Team code merging and integration, Spotify integration (frontend & backend), Cookie management

For additional support or questions, please refer to the project documentation or contact the development team.
