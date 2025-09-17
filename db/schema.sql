-- Active: 1747301656292@@127.0.0.1@3306
DROP DATABASE IF EXISTS study1only_db;

-- Create database with explicit collation
CREATE DATABASE IF NOT EXISTS study1only_db
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

USE study1only_db;

-- USERS TABLE
CREATE TABLE IF NOT EXISTS users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL COLLATE utf8mb4_unicode_ci,
    password VARCHAR(255) NOT NULL,
    address TEXT,
    avatar_link VARCHAR(255) DEFAULT '/images/default-avatar.png',
    role ENUM('user', 'admin') DEFAULT 'user',
    total_study_time TIME DEFAULT '00:00:00',
    current_streak INT DEFAULT 0,
    longest_streak INT DEFAULT 0,
    region VARCHAR(100), -- Country/region of user
    created_date DATETIME DEFAULT CURRENT_TIMESTAMP, -- Account creation time
    last_login DATETIME, -- Most recent login timestamp
    background VARCHAR(255) DEFAULT '/images/default-background.png', -- User's background image
    spotify_id VARCHAR(100) UNIQUE -- Spotify user ID
);

-- SPOTIFY AUTH TABLE
CREATE TABLE IF NOT EXISTS spotify_auth (
    user_id INT PRIMARY KEY,
    spotify_user_id VARCHAR(100) NOT NULL,
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    token_expiry DATETIME NOT NULL,
    is_premium BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- BACKGROUND IMAGES TABLE
CREATE TABLE IF NOT EXISTS background_images (
    background_id INT AUTO_INCREMENT PRIMARY KEY,
    image_url VARCHAR(255) NOT NULL,
    description TEXT,
    photographer VARCHAR(100),
    width INT,
    height INT,
    INDEX idx_image_url (image_url)
);

-- SESSIONS TABLE - stores all sessions with start_time and end_time (NULL = active)
CREATE TABLE IF NOT EXISTS sessions (
    session_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    start_time DATETIME(3) NOT NULL, -- Added millisecond precision
    end_time DATETIME(3) NULL, -- NULL for active sessions, added millisecond precision
    duration INT GENERATED ALWAYS AS (CASE WHEN end_time IS NOT NULL THEN TIMESTAMPDIFF(SECOND, start_time, end_time) ELSE NULL END) STORED, -- Changed to SECONDS
    FOREIGN KEY (user_id) REFERENCES users(user_id),
    INDEX idx_user_sessions (user_id, start_time),
    INDEX idx_session_date (user_id, start_time, end_time),
    INDEX idx_active_sessions (user_id, end_time) -- For finding active sessions (end_time IS NULL)
);

-- ALBUMS TABLE
CREATE TABLE IF NOT EXISTS albums (
    album_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    album_name VARCHAR(50) NOT NULL,
    image_count INT DEFAULT 0,
    avatar_link VARCHAR(255) DEFAULT '/images/pexel/default-album.png',
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    INDEX idx_user_albums (user_id)
);

-- ALBUM IMAGES TABLE (Junction table for many-to-many relationship)
CREATE TABLE IF NOT EXISTS album_images (
    album_id INT NOT NULL,
    background_id INT NOT NULL,
    PRIMARY KEY (album_id, background_id),
    FOREIGN KEY (album_id) REFERENCES albums(album_id) ON DELETE CASCADE,
    FOREIGN KEY (background_id) REFERENCES background_images(background_id) ON DELETE CASCADE
);

INSERT INTO users (username, password, address, role, region, created_date, avatar_link)
VALUES ('advanmin', '$2b$10$LWFSM1Af9F6aax6hqtNtLejAC4XVFXssbRaSil24GArngjzKJKtQq', 'Admin Address', 'admin', 'Australia', CURRENT_TIMESTAMP, '/images/default-avatar.png');
-- username: advanmin
-- password: toilaadminday123
