/* eslint-disable consistent-return */
const express = require('express');
const mysql = require('mysql2/promise');

const router = express.Router();

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    database: process.env.DB_NAME || 'study1only_db'
  };

// Authentication middleware
const requireAuth = (req, res, next) => {
    if (!req.session || !req.session.user) {
        return res.status(401).json({ message: 'Authentication required' });
    }
    next();
};

// GET /achievements/check - Check user's achievement progress
router.get('/check', requireAuth, async (req, res) => {
    const userId = req.session.user.id;

    try {
        const connection = await mysql.createConnection(dbConfig);

        // Get user's current stats
        const [userStats] = await connection.execute(
            'SELECT total_study_time, current_streak, longest_streak FROM users WHERE user_id = ?',
            [userId]
        );

        if (userStats.length === 0) {
            await connection.end();
            return res.status(404).json({ message: 'User not found' });
        }

        const user = userStats[0];

        // Check for 90 minutes in a single day (Timeless Seeker)
        const [dailySessions] = await connection.execute(
            `SELECT
                DATE(start_time) as study_date,
                SUM(duration) as daily_total
             FROM sessions
             WHERE user_id = ? AND end_time IS NOT NULL
             GROUP BY DATE(start_time)
             ORDER BY daily_total DESC
             LIMIT 1`,
            [userId]
        );

        const maxDailyMinutes = dailySessions[0] && dailySessions[0].daily_total
        ? Math.floor(dailySessions[0].daily_total / 60) : 0;

        // Convert total_study_time to minutes
        const timeParts = user.total_study_time.split(':');
        const totalMinutes = parseInt(timeParts[0], 10) * 60
        + parseInt(timeParts[1], 10) + Math.round(parseInt(timeParts[2], 10) / 60);

        // Define achievements with their conditions
        const achievements = [
            {
                id: 'timeless-seeker',
                title: 'TIMELESS SEEKER',
                description: 'Study for a total of 90 minutes in a single day with Study1Only!',
                lockedDescription: 'Study for a total of 90 minutes in a single day to unlock this achievement.',
                progress: Math.min(maxDailyMinutes, 90),
                total: 90,
                icon: 'images/timeless-seeker.png',
                achieved: maxDailyMinutes >= 90,
                condition: 'daily_total'
            },
            {
                id: 'rising-flame',
                title: 'RISING FLAME',
                description: 'Use Study1Only continuously for 3 days!',
                lockedDescription: 'Study for 3 consecutive days to unlock this achievement.',
                progress: Math.min(user.longest_streak, 3),
                total: 3,
                icon: 'images/rising-flame.png',
                achieved: user.longest_streak >= 3,
                condition: 'streak'
            },
            {
                id: 'endurance-scholar',
                title: 'ENDURANCE SCHOLAR',
                description: 'Accumulate a total of 300 minutes of study time!',
                lockedDescription: 'Study for a total of 300 minutes to unlock this achievement.',
                progress: Math.min(totalMinutes, 300),
                total: 300,
                icon: 'images/endurance-scholar.png',
                achieved: totalMinutes >= 300,
                condition: 'total_time'
            }
        ];

        await connection.end();

        // Calculate total achieved
        const totalAchieved = achievements.filter((a) => a.achieved).length;
        const totalPossible = achievements.length;

        res.json({
            achievements,
            summary: {
                achieved: totalAchieved,
                total: totalPossible
            }
        });

    } catch (error) {
        res.status(500).json({ message: 'Internal server error' });
    }
});

module.exports = router;
