/* eslint-disable no-await-in-loop */
/* eslint-disable consistent-return */
const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');
require('dotenv').config();

// Database configuration
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    database: process.env.DB_NAME || 'study1only_db'
};

// Get user's albums
router.get('/user/:userId', async (req, res) => {
    const { userId } = req.params;

    try {
        const connection = await mysql.createConnection(dbConfig);

        // Get all albums for the user
        const [albums] = await connection.execute(
            'SELECT album_id, album_name, image_count, avatar_link FROM albums WHERE user_id = ?',
            [userId]
        );

        await connection.end();

        res.json(albums);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch albums' });
    }
});

// Create a new album
router.post('/', async (req, res) => {
    const { user_id, album_name } = req.body;

    // Validate input
    if (!user_id || !album_name) {
        return res.status(400).json({ error: 'User ID and album name are required' });
    }

    if (album_name.length < 1 || album_name.length > 25) {
        return res.status(400).json({ error: 'Album name must be between 1 and 25 characters' });
    }

    try {
        const connection = await mysql.createConnection(dbConfig);

        // Insert the new album
        const [result] = await connection.execute(
            'INSERT INTO albums (user_id, album_name) VALUES (?, ?)',
            [user_id, album_name]
        );

        await connection.end();

        res.status(201).json({
            message: 'Album created successfully',
            album_id: result.insertId
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to create album' });
    }
});

// Add image to album
router.post('/add-image', async (req, res) => {
    const {
 album_id, image_url, photographer, width, height, alt_text
} = req.body;

    try {
        const connection = await mysql.createConnection(dbConfig);

        // First, insert or get the image from background_images table
        const [existingImage] = await connection.execute(
            'SELECT background_id FROM background_images WHERE image_url = ?',
            [image_url]
        );

        let background_id;
        if (existingImage.length === 0) {
            // Insert new image
            const [insertResult] = await connection.execute(
                'INSERT INTO background_images (image_url, description, photographer, width, height) VALUES (?, ?, ?, ?, ?)',
                [image_url, alt_text, photographer, width, height]
            );
            background_id = insertResult.insertId;
        } else {
            background_id = existingImage[0].background_id;
        }

        // Check if image already exists in the album
        const [existingAlbumImage] = await connection.execute(
            'SELECT * FROM album_images WHERE album_id = ? AND background_id = ?',
            [album_id, background_id]
        );

        if (existingAlbumImage.length > 0) {
            await connection.end();
            // Return success but indicate it was already there
            return res.status(200).json({
                message: 'Image is already in this album',
                alreadyExists: true
            });
        }

        // Then, create the relationship in album_images
        await connection.execute(
            'INSERT INTO album_images (album_id, background_id) VALUES (?, ?)',
            [album_id, background_id]
        );

        // Update the image count in albums table
        await connection.execute(
            'UPDATE albums SET image_count = image_count + 1 WHERE album_id = ?',
            [album_id]
        );

        await connection.end();

        res.status(201).json({
            message: 'Image added to album successfully'
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to add image to album' });
    }
});

// Get album details with images
router.get('/:albumId/details', async (req, res) => {
    const { albumId } = req.params;

    try {
        const connection = await mysql.createConnection(dbConfig);

        // Get album information
        const [albumInfo] = await connection.execute(
            'SELECT album_id, album_name, image_count, avatar_link FROM albums WHERE album_id = ?',
            [albumId]
        );

        if (albumInfo.length === 0) {
            await connection.end();
            return res.status(404).json({ error: 'Album not found' });
        }

        // Get all images in the album
        const [images] = await connection.execute(
            `SELECT bi.background_id, bi.image_url, bi.description, bi.photographer, bi.width, bi.height
             FROM album_images ai
             JOIN background_images bi ON ai.background_id = bi.background_id
             WHERE ai.album_id = ?`,
            [albumId]
        );

        await connection.end();

        res.json({
            album: albumInfo[0],
            images: images
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch album details' });
    }
});

// Update album
router.put('/:albumId', async (req, res) => {
    const { albumId } = req.params;
    const { album_name, avatar_link } = req.body;

    // Validate input
    if (!album_name) {
        return res.status(400).json({ error: 'Album name is required' });
    }

    if (album_name.length < 1 || album_name.length > 50) {
        return res.status(400).json({ error: 'Album name must be between 1 and 50 characters' });
    }

    try {
        const connection = await mysql.createConnection(dbConfig);

        // Check if album exists
        const [existingAlbum] = await connection.execute(
            'SELECT album_id FROM albums WHERE album_id = ?',
            [albumId]
        );

        if (existingAlbum.length === 0) {
            await connection.end();
            return res.status(404).json({ error: 'Album not found' });
        }

        // Update album
        const updateFields = ['album_name = ?'];
        const updateValues = [album_name];

        if (avatar_link) {
            updateFields.push('avatar_link = ?');
            updateValues.push(avatar_link);
        }

        updateValues.push(albumId);

        await connection.execute(
            `UPDATE albums SET ${updateFields.join(', ')} WHERE album_id = ?`,
            updateValues
        );

        await connection.end();

        res.json({
            message: 'Album updated successfully'
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update album' });
    }
});

// Delete album
router.delete('/:albumId', async (req, res) => {
    const { albumId } = req.params;

    try {
        const connection = await mysql.createConnection(dbConfig);

        // Check if album exists
        const [existingAlbum] = await connection.execute(
            'SELECT album_id FROM albums WHERE album_id = ?',
            [albumId]
        );

        if (existingAlbum.length === 0) {
            await connection.end();
            return res.status(404).json({ error: 'Album not found' });
        }

        // Get all images that are in this album
        const [albumImages] = await connection.execute(
            'SELECT background_id FROM album_images WHERE album_id = ?',
            [albumId]
        );

        // For each image, check if it's used in other albums
        const imagesToDelete = [];
        for (const albumImage of albumImages) {
            const [otherAlbumUsage] = await connection.execute(
                'SELECT COUNT(*) as count FROM album_images WHERE background_id = ? AND album_id != ?',
                [albumImage.background_id, albumId]
            );

            // If the image is not used in any other album, mark it for deletion
            if (otherAlbumUsage[0].count === 0) {
                imagesToDelete.push(albumImage.background_id);
            }
        }

        // Delete album images relationships first (foreign key constraint)
        await connection.execute(
            'DELETE FROM album_images WHERE album_id = ?',
            [albumId]
        );

        // Delete images that are not used in other albums
        if (imagesToDelete.length > 0) {
            const placeholders = imagesToDelete.map(() => '?').join(',');
            await connection.execute(
                `DELETE FROM background_images WHERE background_id IN (${placeholders})`,
                imagesToDelete
            );
        }

        // Delete the album
        await connection.execute(
            'DELETE FROM albums WHERE album_id = ?',
            [albumId]
        );

        await connection.end();

        res.json({
            message: 'Album deleted successfully',
            deletedImages: imagesToDelete.length
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete album' });
    }
});

// Remove specific images from album
router.post('/:albumId/remove-images', async (req, res) => {
    const { albumId } = req.params;
    const { imageIds } = req.body; // Array of background_ids to remove

    if (!imageIds || !Array.isArray(imageIds) || imageIds.length === 0) {
        return res.status(400).json({ error: 'Image IDs array is required' });
    }

    try {
        const connection = await mysql.createConnection(dbConfig);

        // Check if album exists
        const [existingAlbum] = await connection.execute(
            'SELECT album_id FROM albums WHERE album_id = ?',
            [albumId]
        );

        if (existingAlbum.length === 0) {
            await connection.end();
            return res.status(404).json({ error: 'Album not found' });
        }

        // For each image, check if it's used in other albums
        const imagesToDeleteFromDB = [];
        for (const imageId of imageIds) {
            const [otherAlbumUsage] = await connection.execute(
                'SELECT COUNT(*) as count FROM album_images WHERE background_id = ? AND album_id != ?',
                [imageId, albumId]
            );

            // If the image is not used in any other album, mark it for deletion from DB
            if (otherAlbumUsage[0].count === 0) {
                imagesToDeleteFromDB.push(imageId);
            }
        }

        // Remove images from album_images table
        const placeholders = imageIds.map(() => '?').join(',');
        await connection.execute(
            `DELETE FROM album_images WHERE album_id = ? AND background_id IN (${placeholders})`,
            [albumId, ...imageIds]
        );

        // Delete images that are not used in other albums from background_images table
        if (imagesToDeleteFromDB.length > 0) {
            const dbPlaceholders = imagesToDeleteFromDB.map(() => '?').join(',');
            await connection.execute(
                `DELETE FROM background_images WHERE background_id IN (${dbPlaceholders})`,
                imagesToDeleteFromDB
            );
        }

        // Update the image count in albums table
        await connection.execute(
            'UPDATE albums SET image_count = image_count - ? WHERE album_id = ?',
            [imageIds.length, albumId]
        );

        await connection.end();

        res.json({
            message: 'Images removed successfully',
            removedFromAlbum: imageIds.length,
            deletedFromDatabase: imagesToDeleteFromDB.length
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to remove images from album' });
    }
});

// Clear all images from album
router.post('/:albumId/clear-images', async (req, res) => {
    const { albumId } = req.params;

    try {
        const connection = await mysql.createConnection(dbConfig);

        // Check if album exists
        const [existingAlbum] = await connection.execute(
            'SELECT album_id FROM albums WHERE album_id = ?',
            [albumId]
        );

        if (existingAlbum.length === 0) {
            await connection.end();
            return res.status(404).json({ error: 'Album not found' });
        }

        // Get all images in this album
        const [albumImages] = await connection.execute(
            'SELECT background_id FROM album_images WHERE album_id = ?',
            [albumId]
        );

        if (albumImages.length === 0) {
            await connection.end();
            return res.json({
                message: 'Album is already empty',
                removedFromAlbum: 0,
                deletedFromDatabase: 0
            });
        }

        // For each image, check if it's used in other albums
        const imagesToDeleteFromDB = [];
        for (const albumImage of albumImages) {
            const [otherAlbumUsage] = await connection.execute(
                'SELECT COUNT(*) as count FROM album_images WHERE background_id = ? AND album_id != ?',
                [albumImage.background_id, albumId]
            );

            // If the image is not used in any other album, mark it for deletion from DB
            if (otherAlbumUsage[0].count === 0) {
                imagesToDeleteFromDB.push(albumImage.background_id);
            }
        }

        // Remove all images from album_images table
        await connection.execute(
            'DELETE FROM album_images WHERE album_id = ?',
            [albumId]
        );

        // Delete images that are not used in other albums from background_images table
        if (imagesToDeleteFromDB.length > 0) {
            const placeholders = imagesToDeleteFromDB.map(() => '?').join(',');
            await connection.execute(
                `DELETE FROM background_images WHERE background_id IN (${placeholders})`,
                imagesToDeleteFromDB
            );
        }

        // Update the image count in albums table
        await connection.execute(
            'UPDATE albums SET image_count = 0 WHERE album_id = ?',
            [albumId]
        );

        await connection.end();

        res.json({
            message: 'All images cleared from album',
            removedFromAlbum: albumImages.length,
            deletedFromDatabase: imagesToDeleteFromDB.length
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to clear images from album' });
    }
});

module.exports = router;
