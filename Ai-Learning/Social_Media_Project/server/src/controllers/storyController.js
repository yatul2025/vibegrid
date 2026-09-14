/**
 * src/controllers/storyController.js
 * ==================================
 * Story Feature Controller for VibeGrid
 * 
 * Implements 24-hour auto-expiring ephemeral stories:
 * 1. createStory: Uploads media, sets expires_at to CURRENT_TIMESTAMP + 24 hours.
 * 2. getActiveStories: Selects stories where expires_at > CURRENT_TIMESTAMP, grouped by creator.
 * 3. deleteStory: Allows creator to remove an active story before 24h expiration.
 */

const path = require('path');
const fs = require('fs');
const db = require('../config/db');
const { saveUploadedMedia, deleteUploadedMedia } = require('../utils/mediaStorage');

/**
 * @desc    Publish a new story (Expires in 24 hours)
 * @route   POST /api/stories
 * @access  Private (Authenticated)
 */
const createStory = async (req, res, next) => {
  try {
    const userId = req.user.id;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Please select an image for your story.'
      });
    }

    // Persist file in database & local storage (serverless-safe)
    const { url: mediaUrl } = await saveUploadedMedia(req.file, 'stories', userId);

    // Parameterized INSERT with PostgreSQL INTERVAL '24 hours'
    const insertQuery = `
      INSERT INTO stories (user_id, media_url, expires_at)
      VALUES ($1, $2, CURRENT_TIMESTAMP + INTERVAL '24 hours')
      RETURNING id, user_id, media_url, created_at, expires_at
    `;

    const result = await db.query(insertQuery, [userId, mediaUrl]);
    const newStory = result.rows[0];

    // Fetch user details for immediate client-side presentation
    const userQuery = `
      SELECT id, username, full_name, avatar_url
      FROM users
      WHERE id = $1
    `;
    const userResult = await db.query(userQuery, [userId]);
    const user = userResult.rows[0];

    res.status(201).json({
      success: true,
      message: 'Story published! It will automatically expire in 24 hours.',
      data: {
        story: newStory,
        user
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all active stories (expires_at > CURRENT_TIMESTAMP)
 * @route   GET /api/stories/active
 * @access  Public / Optional Auth
 */
const getActiveStories = async (req, res, next) => {
  try {
    const currentUserId = req.user ? req.user.id : null;

    // Fetch non-expired stories joined with author info, enforcing story_visibility
    const storiesQuery = `
      SELECT 
        s.id,
        s.user_id,
        s.media_url,
        s.created_at,
        s.expires_at,
        u.username,
        u.full_name,
        u.avatar_url
      FROM stories s
      JOIN users u ON s.user_id = u.id
      WHERE s.expires_at > CURRENT_TIMESTAMP
        AND (
          u.story_visibility = 'everyone'
          OR ($1::int IS NOT NULL AND (
            s.user_id = $1::int
            OR EXISTS(SELECT 1 FROM follows f WHERE f.follower_id = $1::int AND f.following_id = s.user_id)
          ))
        )
      ORDER BY s.created_at ASC
    `;

    const result = await db.query(storiesQuery, [currentUserId]);
    const rows = result.rows;

    // Group stories by creator
    const userMap = new Map();

    rows.forEach((row) => {
      if (!userMap.has(row.user_id)) {
        userMap.set(row.user_id, {
          userId: row.user_id,
          username: row.username,
          fullName: row.full_name,
          avatarUrl: row.avatar_url,
          isCurrentUser: currentUserId === row.user_id,
          stories: []
        });
      }

      userMap.get(row.user_id).stories.push({
        id: row.id,
        mediaUrl: row.media_url,
        createdAt: row.created_at,
        expiresAt: row.expires_at
      });
    });

    // Convert map to array
    const groupedUsers = Array.from(userMap.values());

    // Sort: Current user's stories first (if any), then other creators
    groupedUsers.sort((a, b) => {
      if (a.isCurrentUser) return -1;
      if (b.isCurrentUser) return 1;
      return 0;
    });

    res.status(200).json({
      success: true,
      data: {
        creators: groupedUsers,
        totalActiveStories: rows.length
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete a story
 * @route   DELETE /api/stories/:id
 * @access  Private (Author Only)
 */
const deleteStory = async (req, res, next) => {
  try {
    const storyId = parseInt(req.params.id, 10);
    const userId = req.user.id;

    if (isNaN(storyId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid story ID.'
      });
    }

    // Check ownership
    const checkQuery = `
      SELECT id, user_id, media_url
      FROM stories
      WHERE id = $1
    `;
    const checkResult = await db.query(checkQuery, [storyId]);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Story not found or has already expired.'
      });
    }

    const story = checkResult.rows[0];

    if (story.user_id !== userId) {
      return res.status(403).json({
        success: false,
        error: 'You are only authorized to delete your own stories.'
      });
    }

    // Delete record from database
    await db.query('DELETE FROM stories WHERE id = $1', [storyId]);

    // Remove media file from storage (DB & local cache)
    if (story.media_url && story.media_url.startsWith('/uploads/stories/')) {
      const filename = path.basename(story.media_url);
      deleteUploadedMedia(filename, 'stories').catch(() => {});
    }

    res.status(200).json({
      success: true,
      message: 'Story deleted successfully.'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createStory,
  getActiveStories,
  deleteStory
};
