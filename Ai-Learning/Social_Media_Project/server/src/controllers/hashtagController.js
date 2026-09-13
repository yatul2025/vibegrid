/**
 * src/controllers/hashtagController.js
 * ====================================
 * Hashtags & Topic Discovery Controller
 * 
 * Handles:
 * 1. getTrendingHashtags: Top hashtags ranked by post engagement/count.
 * 2. getHashtagPosts: Chronological/popular posts tagged with a specific hashtag.
 */

const { query } = require('../config/db');

/**
 * Get trending hashtags
 * Route: GET /api/hashtags/trending
 */
const getTrendingHashtags = async (req, res, next) => {
  try {
    const trendingQuery = `
      SELECT 
        h.id,
        h.name,
        COUNT(ph.post_id)::int AS post_count
      FROM hashtags h
      JOIN post_hashtags ph ON h.id = ph.hashtag_id
      GROUP BY h.id, h.name
      HAVING COUNT(ph.post_id) > 0
      ORDER BY post_count DESC, h.name ASC
      LIMIT 25
    `;
    const result = await query(trendingQuery);

    res.status(200).json({
      success: true,
      data: {
        hashtags: result.rows,
        total: result.rows.length
      }
    });
  } catch (error) {
    console.error('[Get Trending Hashtags Error]', error);
    next(error);
  }
};

/**
 * Get all posts with a specific hashtag
 * Route: GET /api/hashtags/:tag/posts
 */
const getHashtagPosts = async (req, res, next) => {
  try {
    const rawTag = req.params.tag || '';
    const cleanTag = rawTag.toLowerCase().replace(/^#/, '').trim();
    const viewerId = req.user ? req.user.id : null;

    if (!cleanTag) {
      return res.status(400).json({
        success: false,
        error: 'Invalid hashtag name.'
      });
    }

    // 1. Fetch posts bearing this hashtag
    const postsQuery = `
      SELECT 
        p.id,
        p.user_id,
        p.image_url,
        p.caption,
        p.created_at,
        u.username,
        u.full_name,
        u.avatar_url,
        (SELECT COUNT(*)::int FROM likes l WHERE l.post_id = p.id) AS likes_count,
        (SELECT COUNT(*)::int FROM comments c WHERE c.post_id = p.id) AS comments_count,
        CASE 
          WHEN $2::int IS NOT NULL THEN 
            EXISTS(SELECT 1 FROM likes l WHERE l.post_id = p.id AND l.user_id = $2::int)
          ELSE false 
        END AS is_liked,
        CASE 
          WHEN $2::int IS NOT NULL THEN 
            EXISTS(SELECT 1 FROM saved_posts sp WHERE sp.post_id = p.id AND sp.user_id = $2::int)
          ELSE false 
        END AS is_saved
      FROM posts p
      JOIN post_hashtags ph ON p.id = ph.post_id
      JOIN hashtags h ON ph.hashtag_id = h.id
      JOIN users u ON p.user_id = u.id
      WHERE LOWER(h.name) = $1
      ORDER BY p.created_at DESC
      LIMIT 60
    `;
    const postsResult = await query(postsQuery, [cleanTag, viewerId]);

    // 2. Fetch hashtag stats
    const tagInfoQuery = `
      SELECT 
        id, 
        name,
        (SELECT COUNT(*)::int FROM post_hashtags WHERE hashtag_id = hashtags.id) AS post_count
      FROM hashtags 
      WHERE LOWER(name) = $1
      LIMIT 1
    `;
    const tagInfoResult = await query(tagInfoQuery, [cleanTag]);
    const tagInfo = tagInfoResult.rows[0] || { name: cleanTag, post_count: postsResult.rows.length };

    res.status(200).json({
      success: true,
      data: {
        tag: tagInfo.name,
        postCount: tagInfo.post_count,
        posts: postsResult.rows
      }
    });
  } catch (error) {
    console.error('[Get Hashtag Posts Error]', error);
    next(error);
  }
};

module.exports = {
  getTrendingHashtags,
  getHashtagPosts
};
