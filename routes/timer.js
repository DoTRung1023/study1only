/* eslint-disable consistent-return */
/* eslint-disable no-unused-vars */
const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');
require('dotenv').config(); // Load .env config

// Database connection pool configuration
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  database: process.env.DB_NAME || 'study1only_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Helper function to get database connection from pool
async function getConnection() {
  return pool.getConnection();
}

// Helper function to parse local time string to Date object
function parseLocalTime(localTimeString) {
  // Convert "YYYY-MM-DD HH:MM:SS.mmm" to Date object
  // Since this is already in user's local time, we create a Date object directly
  return new Date(localTimeString);
}

// Helper function to format date as YYYY-MM-DD from local time
function formatLocalDate(localTimeString) {
  return localTimeString.split(' ')[0]; // Get the date part (YYYY-MM-DD)
}

// Helper function to update user's total study time
async function updateUserTotalStudyTime(connection, user_id) {
  const [totalResult] = await connection.execute(
    'SELECT SUM(duration) as total_seconds FROM sessions WHERE user_id = ? AND end_time IS NOT NULL',
    [user_id]
  );

  const totalSeconds = totalResult[0] ? totalResult[0].total_seconds || 0 : 0;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const formattedTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  await connection.execute(
    'UPDATE users SET total_study_time = ? WHERE user_id = ?',
    [formattedTime, user_id]
  );
}

// Helper function to split cross-midnight sessions based on date change
function splitCrossMidnightSession(startLocalTime, endLocalTime) {
  const sessions = [];
  const startDate = parseLocalTime(startLocalTime);
  const endDate = parseLocalTime(endLocalTime);

  let currentStart = new Date(startDate);

  while (currentStart < endDate) {
    // Get the end of current day (23:59:59.999 of the same day)
    const currentDay = currentStart.toDateString();
    const endOfDay = new Date(currentStart);
    endOfDay.setHours(23, 59, 59, 999);

    const sessionEnd = endDate <= endOfDay ? endDate : endOfDay;

    if (currentStart < sessionEnd) {
      sessions.push({
        start_time: new Date(currentStart),
        end_time: new Date(sessionEnd)
      });
    }

    // Move to start of next day (00:00:00.000)
    currentStart = new Date(endOfDay.getTime() + 1);
  }

  return sessions;
}

// Start timer session
router.post('/start', async (req, res) => {
  const { user_id, timezone = 'UTC', local_time } = req.body;

  if (!user_id || !local_time) {
    return res.status(400).json({ error: 'User ID and local time are required' });
  }

  let connection;
  try {
    connection = await getConnection();
    // Parse the local time string to a Date object
    const localDateTime = parseLocalTime(local_time);

    // Check if user already has an active session
    const [existingSession] = await connection.execute(
      'SELECT session_id FROM sessions WHERE user_id = ? AND end_time IS NULL',
      [user_id]
    );

    if (existingSession.length > 0) {
      return res.status(400).json({ error: 'Timer session already active' });
    }

    // Insert new session with NULL end_time (indicates active session)
    // Store the user's local time directly
    const [result] = await connection.execute(
      'INSERT INTO sessions (user_id, start_time, end_time) VALUES (?, ?, NULL)',
      [user_id, localDateTime]
    );

    res.json({
      success: true,
      message: 'Timer started successfully',
      sessionId: result.insertId,
      startTime: local_time, // Return the original local time string
      timezone: timezone
    });

  } catch (error) {
    res.status(500).json({
      error: 'Failed to start timer',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

// Stop timer session
router.post('/stop', async (req, res) => {
  const { user_id, timezone = 'UTC', local_time } = req.body;

  if (!user_id || !local_time) {
    return res.status(400).json({ error: 'User ID and local time are required' });
  }

  let connection;
  try {
    connection = await getConnection();
    // Parse the local time string to a Date object
    const localEndTime = parseLocalTime(local_time);

    // Get active session
    const [activeSession] = await connection.execute(
      'SELECT session_id, start_time FROM sessions WHERE user_id = ? AND end_time IS NULL',
      [user_id]
    );

    if (activeSession.length === 0) {
      return res.status(400).json({ error: 'No active timer session found' });
    }

    const sessionId = activeSession[0].session_id;
    const sessionStart = new Date(activeSession[0].start_time);
    const sessionEnd = localEndTime;

    // Check if session crosses midnight by comparing dates
    const startDate = sessionStart.toDateString();
    const endDate = sessionEnd.toDateString();

    if (startDate !== endDate) {
      // Handle cross-midnight session
      // eslint-disable-next-line max-len
      const sessions = splitCrossMidnightSession(sessionStart.toISOString(), sessionEnd.toISOString());

      // Update the original session to end at midnight
      await connection.execute(
        'UPDATE sessions SET end_time = ? WHERE session_id = ?',
        [sessions[0].end_time, sessionId]
      );

      // Insert additional sessions for subsequent days
      for (let i = 1; i < sessions.length; i++) {
        // eslint-disable-next-line no-await-in-loop
        await connection.execute(
          'INSERT INTO sessions (user_id, start_time, end_time) VALUES (?, ?, ?)',
          [user_id, sessions[i].start_time, sessions[i].end_time]
        );
      }

      res.json({
        success: true,
        message: 'Timer stopped successfully',
        totalDuration: Math.floor((sessionEnd - sessionStart) / 1000),
        sessionsCreated: sessions.length,
        timezone: timezone,
        sessions: sessions.map((s) => ({
          start: s.start_time.toISOString(),
          end: s.end_time.toISOString(),
          date: s.start_time.toISOString().split('T')[0]
        }))
      });
    } else {
      // Normal session - just update end_time
      await connection.execute(
        'UPDATE sessions SET end_time = ? WHERE session_id = ?',
        [sessionEnd, sessionId]
      );

      res.json({
        success: true,
        message: 'Timer stopped successfully',
        totalDuration: Math.floor((sessionEnd - sessionStart) / 1000),
        sessionsCreated: 1,
        timezone: timezone,
        sessions: [{
          start: sessionStart.toISOString(),
          end: sessionEnd.toISOString(),
          date: sessionStart.toISOString().split('T')[0]
        }]
      });
    }

    // Update user's total study time
    await updateUserTotalStudyTime(connection, user_id);

  } catch (error) {
    res.status(500).json({ error: 'Failed to stop timer' });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

// Handle browser close/logout (cleanup active sessions)
router.post('/cleanup', async (req, res) => {
  const {
 user_id, timezone = 'UTC', local_time, reason = 'manual'
} = req.body;

  if (!user_id) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  let connection;
  try {
    connection = await getConnection();
    // Use current time if local_time not provided (for backward compatibility)
    const endTime = local_time ? parseLocalTime(local_time) : new Date();

    // Get active sessions
    const [activeSessions] = await connection.execute(
      'SELECT session_id, start_time FROM sessions WHERE user_id = ? AND end_time IS NULL',
      [user_id]
    );

    if (activeSessions.length === 0) {
      return res.json({
        success: true,
        message: 'No active sessions to cleanup',
        reason: reason
      });
    }

    let totalSessionsCreated = 0;
    const cleanedSessions = [];

    for (const session of activeSessions) {
      const sessionId = session.session_id;
      const sessionStart = new Date(session.start_time);
      const sessionEnd = endTime;

      // Calculate session duration for logging
      const durationMs = sessionEnd.getTime() - sessionStart.getTime();
      // eslint-disable-next-line max-len
      const durationMinutes = Math.round((durationMs / 1000 / 60) * 100) / 100; // Round to 2 decimal places

      // Check if session crosses midnight by comparing dates
      const startDate = sessionStart.toDateString();
      const endDate = sessionEnd.toDateString();

      if (startDate !== endDate) {
        // Handle cross-midnight session
        // eslint-disable-next-line max-len
        const sessions = splitCrossMidnightSession(sessionStart.toISOString(), sessionEnd.toISOString());

        // Update the original session to end at midnight
        // eslint-disable-next-line no-await-in-loop
        await connection.execute(
          'UPDATE sessions SET end_time = ? WHERE session_id = ?',
          [sessions[0].end_time, sessionId]
        );

        // Insert additional sessions for subsequent days
        for (let i = 1; i < sessions.length; i++) {
          // eslint-disable-next-line no-await-in-loop
          await connection.execute(
            'INSERT INTO sessions (user_id, start_time, end_time) VALUES (?, ?, ?)',
            [user_id, sessions[i].start_time, sessions[i].end_time]
          );
        }

        totalSessionsCreated += sessions.length;
        cleanedSessions.push({
          originalSessionId: sessionId,
          sessionsCreated: sessions.length,
          duration: durationMinutes
        });
      } else {
        // Normal session - just update end_time
        // eslint-disable-next-line no-await-in-loop
        await connection.execute(
          'UPDATE sessions SET end_time = ? WHERE session_id = ?',
          [sessionEnd, sessionId]
        );

        totalSessionsCreated += 1;
        cleanedSessions.push({
          sessionId: sessionId,
          sessionsCreated: 1,
          duration: durationMinutes
        });
      }
    }

    // Update user's total study time
    await updateUserTotalStudyTime(connection, user_id);

    res.json({
      success: true,
      message: 'Active sessions cleaned up successfully',
      sessionsCreated: totalSessionsCreated,
      timezone: timezone,
      reason: reason,
      cleanedSessions: cleanedSessions,
      endTime: local_time || new Date().toISOString()
    });

  } catch (error) {
    res.status(500).json({ error: 'Failed to cleanup sessions', details: error.message });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

// Get user's daily study statistics
router.get('/stats/:user_id', async (req, res) => {
  const { user_id } = req.params;
  const { days = 7, timezone = 'UTC' } = req.query; // Keep timezone for client info

  if (!user_id) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  let connection;
  try {
    connection = await getConnection();

    // Calculate the start date for the period
    // (simple date math since times are stored in user's local timezone)
    const now = new Date();
    const daysAgo = new Date(now.getTime() - (days * 24 * 60 * 60 * 1000));
    const startDate = daysAgo.toISOString().split('T')[0]; // YYYY-MM-DD format

    // Get daily study times for the specified period (only completed sessions)
    // Since times are stored in user's local timezone, we can use simple DATE() function
    const [dailyStats] = await connection.execute(`
      SELECT
        DATE(start_time) as study_date,
        SUM(duration) as total_seconds,
        COUNT(*) as session_count,
        CASE
          WHEN SUM(duration) >= 3600 THEN CONCAT(FLOOR(SUM(duration)/3600), 'h ', FLOOR((SUM(duration)%3600)/60), 'm ', SUM(duration)%60, 's')
          WHEN SUM(duration) >= 60 THEN CONCAT(FLOOR(SUM(duration)/60), 'm ', SUM(duration)%60, 's')
          ELSE CONCAT(SUM(duration), 's')
        END as formatted_time
      FROM sessions
      WHERE user_id = ?
        AND DATE(start_time) >= ?
        AND end_time IS NOT NULL
      GROUP BY DATE(start_time)
      ORDER BY study_date DESC
    `, [user_id, startDate]);

    // Get total study time from user table
    const [totalStats] = await connection.execute(
      'SELECT total_study_time FROM users WHERE user_id = ?',
      [user_id]
    );

    // Get recent completed sessions
    const [recentSessions] = await connection.execute(`
      SELECT
        session_id,
        start_time,
        end_time,
        duration,
        DATE(start_time) as session_date
      FROM sessions
      WHERE user_id = ? AND end_time IS NOT NULL
      ORDER BY start_time DESC
      LIMIT 10
    `, [user_id]);

    // Check if there's an active session
    const [activeSession] = await connection.execute(`
      SELECT
        session_id,
        start_time,
        TIMESTAMPDIFF(SECOND, start_time, NOW()) as seconds_running
      FROM sessions
      WHERE user_id = ? AND end_time IS NULL
    `, [user_id]);

    res.json({
      success: true,
      timezone: timezone,
      dailyStats,
      recentSessions,
      activeSession: activeSession.length > 0 ? activeSession[0] : null,
      totalStudyTime: totalStats[0] ? totalStats[0].total_study_time : '00:00:00'
    });

  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch study statistics' });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

// Get study time for a specific date
router.get('/daily/:user_id/:date', async (req, res) => {
  const { user_id, date } = req.params;
  const { timezone = 'UTC' } = req.query; // Keep for client info

  if (!user_id || !date) {
    return res.status(400).json({ error: 'User ID and date are required' });
  }

  let connection;
  try {
    connection = await getConnection();

    // Since times are stored in user's local timezone, we can use simple DATE() comparison
    const [dailySession] = await connection.execute(`
      SELECT
        SUM(duration) as total_seconds,
        COUNT(*) as session_count,
        MIN(start_time) as first_session,
        MAX(end_time) as last_session
      FROM sessions
      WHERE user_id = ? AND DATE(start_time) = ? AND end_time IS NOT NULL
    `, [user_id, date]);

    const [sessionDetails] = await connection.execute(`
      SELECT
        session_id,
        start_time,
        end_time,
        duration
      FROM sessions
      WHERE user_id = ? AND DATE(start_time) = ? AND end_time IS NOT NULL
      ORDER BY start_time ASC
    `, [user_id, date]);

    res.json({
      success: true,
      date,
      timezone: timezone,
      summary: dailySession[0],
      sessions: sessionDetails
    });

  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch daily statistics' });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

// Check if user has an active session
router.get('/active/:user_id', async (req, res) => {
  const { user_id } = req.params;

  if (!user_id) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  let connection;
  try {
    connection = await getConnection();

    const [activeSession] = await connection.execute(`
      SELECT
        session_id,
        start_time,
        TIMESTAMPDIFF(SECOND, start_time, UTC_TIMESTAMP()) as seconds_running
      FROM sessions
      WHERE user_id = ? AND end_time IS NULL
    `, [user_id]);

    res.json({
      success: true,
      hasActiveSession: activeSession.length > 0,
      activeSession: activeSession.length > 0 ? activeSession[0] : null
    });

  } catch (error) {
    res.status(500).json({ error: 'Failed to check active session' });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

// Get leaderboard data (weekly, monthly, all-time)
router.get('/api/leaderboard/:period', async (req, res) => {
  const { period } = req.params;
  const { region, user_id } = req.query;
  let connection;

  try {
    connection = await getConnection();

    // Initialize variables
    let dateFilter = '';
    let queryParams = [];
    const now = new Date();

    // Calculate date range based on period
    if (period === 'weekly') {
      // Get start of current week (Monday)
      const startOfWeek = new Date(now);
      const day = startOfWeek.getDay();
      const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
      startOfWeek.setDate(diff);
      startOfWeek.setHours(0, 0, 0, 0);
      dateFilter = 'AND s.start_time >= ?';
      queryParams.push(startOfWeek);
    } else if (period === 'monthly') {
      // Get start of current month
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      startOfMonth.setHours(0, 0, 0, 0);
      dateFilter = 'AND s.start_time >= ?';
      queryParams.push(startOfMonth);
    } else if (period === 'alltime') {
      // No date filter needed for all time
      dateFilter = '';
    } else {
      return res.status(400).json({ error: 'Invalid period. Must be weekly, monthly, or alltime.' });
    }

    // Add region to params if specified
    const regionFilter = region ? 'AND u.region = ?' : '';
    if (region) {
      queryParams.push(region);
    }

    // Helper function to format seconds into HH:MM:SS
    const formatTime = (seconds) => {
      const hours = Math.floor(seconds / 3600).toString().padStart(2, '0');
      const minutes = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
      const secs = (seconds % 60).toString().padStart(2, '0');
      return `${hours}:${minutes}:${secs}`;
    };

    // Main leaderboard query
    const query = `
      WITH RankedUsers AS (
        SELECT
          u.user_id,
          u.username as name,
          u.address as city,
          COALESCE(u.region, 'Unknown Region') as region,
          u.avatar_link,
          u.created_date,
          COALESCE(SUM(CASE WHEN s.duration IS NULL THEN 0 ELSE s.duration END), 0) as totalTimeSeconds,
          DENSE_RANK() OVER (
            ORDER BY COALESCE(SUM(CASE WHEN s.duration IS NULL THEN 0 ELSE s.duration END), 0) DESC,
            u.created_date ASC
          ) as user_rank
        FROM users u
        LEFT JOIN sessions s ON u.user_id = s.user_id
          AND s.end_time IS NOT NULL
          ${dateFilter}
        WHERE u.role = 'user'
          ${regionFilter}
        GROUP BY
          u.user_id,
          u.username,
          u.address,
          u.region,
          u.avatar_link,
          u.created_date
      )
      SELECT *
      FROM RankedUsers
      ORDER BY totalTimeSeconds DESC, created_date ASC, user_id ASC
      LIMIT 100
    `;

    const [results] = await connection.execute(query, queryParams);

    // Format the results
    const leaderboard = results.map((row) => ({
      rank: row.user_rank,
      user_id: row.user_id,
      name: row.name,
      city: row.city || 'Unknown',
      region: row.region,
      avatar_link: row.avatar_link || '/images/default-avatar.png',
      totalTime: formatTime(parseInt(row.totalTimeSeconds || 0, 10)),
      totalTimeSeconds: parseInt(row.totalTimeSeconds || 0, 10)
    }));

    // Get current user's data if user_id is provided
    let currentUser = null;
    if (user_id) {
      // Find current user in the leaderboard first
      currentUser = leaderboard.find((user) => user.user_id.toString() === user_id.toString());

      // If user not in top 100, get their data separately
      if (!currentUser) {
        const currentUserQuery = `
          WITH RankedUsers AS (
            SELECT
              u.user_id,
              u.username as name,
              u.address as city,
              COALESCE(u.region, 'Unknown Region') as region,
              u.avatar_link,
              u.created_date,
              COALESCE(SUM(CASE WHEN s.duration IS NULL THEN 0 ELSE s.duration END), 0) as totalTimeSeconds,
              DENSE_RANK() OVER (
                ORDER BY COALESCE(SUM(CASE WHEN s.duration IS NULL THEN 0 ELSE s.duration END), 0) DESC,
                u.created_date ASC
              ) as user_rank
            FROM users u
            LEFT JOIN sessions s ON u.user_id = s.user_id
              AND s.end_time IS NOT NULL
              ${dateFilter}
            WHERE u.role = 'user'
              ${regionFilter}
            GROUP BY
              u.user_id,
              u.username,
              u.address,
              u.region,
              u.avatar_link,
              u.created_date
          )
          SELECT *
          FROM RankedUsers
          WHERE user_id = ?
        `;

        const currentUserParams = [...queryParams, user_id];
        const [currentUserResult] = await connection.execute(currentUserQuery, currentUserParams);

        if (currentUserResult.length > 0) {
          const userData = currentUserResult[0];
          const rank = parseInt(userData.user_rank, 10); // Ensure rank is a number
          let rankDisplay;
          if (rank <= 3) {
            let suffix;
            if (rank === 1) suffix = 'st';
            else if (rank === 2) suffix = 'nd';
            else suffix = 'rd';
            rankDisplay = `<img src="images/rank/${rank}${suffix}.png" alt="${rank}${suffix} place" class="rank-image">`;
          } else {
            rankDisplay = rank.toString(); // Convert to string for consistency
          }

          currentUser = {
            rank: rankDisplay,
            user_id: userData.user_id,
            name: userData.name,
            city: userData.city || 'Unknown',
            region: userData.region,
            avatar_link: userData.avatar_link || '/images/default-avatar.png',
            totalTime: formatTime(parseInt(userData.totalTimeSeconds || 0, 10)),
            totalTimeSeconds: parseInt(userData.totalTimeSeconds || 0, 10)
          };
        }
      }
    }

    res.json({
      leaderboard,
      currentUser,
      period,
      region: region || null
    });

  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch leaderboard data' });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

// Get available regions for filtering
router.get('/api/regions', async (req, res) => {
  let connection;
  try {
    connection = await getConnection();
    const [results] = await connection.execute(
      'SELECT DISTINCT region FROM users WHERE region IS NOT NULL AND region != "" AND role = "user" ORDER BY region'
    );
    res.json(results.map((r) => r.region));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch regions' });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

module.exports = router;
