/**
 * server/src/services/aggregator/FeedAggregator.js
 * ===============================================
 * Master Feed & Stories Aggregator Engine
 * 
 * Responsibilities:
 * 1. Coordinates external providers (RSS, Curated Media) and VibeGrid PostgreSQL.
 * 2. Deduplicates items using SHA-256 fingerprints in CacheManager.
 * 3. Interleaves real VibeGrid user posts with fresh external content.
 * 4. Aggregates active stories (VibeGrid user stories + external discovery stories).
 * 5. Caches combined feeds in Redis / memory (TTL: 5-15 minutes).
 * 6. Supports delta polling (?since=<timestamp>) for "New posts available" banner.
 * 7. ZERO PostgreSQL storage footprint for external posts and stories.
 */

const crypto = require('crypto');
const cacheManager = require('../cache/CacheManager');
const db = require('../../config/db');
const RssFeedProvider = require('./RssFeedProvider');
const CuratedContentProvider = require('./CuratedContentProvider');

class FeedAggregator {
  constructor(options = {}) {
    this.cacheTtl = options.cacheTtl || 600; // 10 minutes
    this.dedupTtl = options.dedupTtl || 86400; // 24 hours
    this.providers = [
      new RssFeedProvider(),
      new CuratedContentProvider()
    ];
  }

  /**
   * Generates deterministic SHA-256 fingerprint for deduplication
   */
  generateFingerprint(source, externalId) {
    return crypto
      .createHash('sha256')
      .update(`${source}:${externalId}`)
      .digest('hex');
  }

  /**
   * Fetches fresh external items from providers with deduplication
   */
  async getExternalPosts() {
    const cacheKey = 'feed:external';
    const cached = await cacheManager.get(cacheKey);
    if (cached && Array.isArray(cached) && cached.length > 0) {
      return cached;
    }

    const fetchedPosts = [];

    // Run providers concurrently with Promise.allSettled
    const results = await Promise.allSettled(
      this.providers.map((p) => p.fetchPosts())
    );

    for (const res of results) {
      if (res.status === 'fulfilled' && Array.isArray(res.value)) {
        fetchedPosts.push(...res.value);
      }
    }

    // Deduplicate against cache set
    const dedupSetKey = 'dedup:fingerprints';
    const uniquePosts = [];

    for (const post of fetchedPosts) {
      const fingerprint = this.generateFingerprint(post.source, post.id);
      const isDuplicate = await cacheManager.sismember(dedupSetKey, fingerprint);

      if (!isDuplicate) {
        await cacheManager.sadd(dedupSetKey, fingerprint, this.dedupTtl);
        uniquePosts.push(post);
      } else if (uniquePosts.length < 10) {
        // Allow in fallback if total posts are low
        uniquePosts.push(post);
      }
    }

    // Fallback: If network is offline and deduplication filtered everything, use Curated Provider
    if (uniquePosts.length === 0) {
      const fallbackProvider = new CuratedContentProvider();
      const fallbackItems = await fallbackProvider.fetchPosts();
      uniquePosts.push(...fallbackItems);
    }

    // Cache the external posts batch for 10 minutes
    await cacheManager.set(cacheKey, uniquePosts, this.cacheTtl);
    return uniquePosts;
  }

  /**
   * Fetches genuine VibeGrid user posts from PostgreSQL
   */
  async getVibeGridUserPosts(currentUserId = null) {
    try {
      const query = `
        SELECT 
          p.id,
          p.user_id,
          p.image_url,
          p.caption,
          p.created_at,
          u.username,
          u.full_name,
          u.avatar_url,
          false AS is_external,
          'VibeGrid' AS source,
          NULL AS source_url,
          (SELECT COUNT(*)::int FROM likes l WHERE l.post_id = p.id) AS likes_count,
          (SELECT COUNT(*)::int FROM comments c WHERE c.post_id = p.id) AS comments_count,
          CASE 
            WHEN $1::int IS NOT NULL THEN 
              EXISTS(SELECT 1 FROM likes l WHERE l.post_id = p.id AND l.user_id = $1::int)
            ELSE false 
          END AS is_liked,
          CASE 
            WHEN $1::int IS NOT NULL THEN 
              EXISTS(SELECT 1 FROM saved_posts sp WHERE sp.post_id = p.id AND sp.user_id = $1::int)
            ELSE false 
          END AS is_saved
        FROM posts p
        JOIN users u ON p.user_id = u.id
        WHERE p.is_active = TRUE
          AND (
            u.is_private = FALSE
            OR ($1::int IS NOT NULL AND (
              p.user_id = $1::int
              OR EXISTS(SELECT 1 FROM follows f WHERE f.follower_id = $1::int AND f.following_id = p.user_id)
            ))
          )
        ORDER BY p.created_at DESC
        LIMIT 40
      `;

      const res = await db.query(query, [currentUserId]);
      return res.rows || [];
    } catch (err) {
      console.warn('[FeedAggregator] VibeGrid DB fetch error:', err.message);
      return [];
    }
  }

  /**
   * Interleaves genuine VibeGrid posts with external posts
   */
  interleaveContent(userPosts, externalPosts) {
    const combined = [];
    let uIdx = 0;
    let eIdx = 0;

    // Pattern: 1 VibeGrid user post, 2 external posts, 1 VibeGrid, 2 external, etc.
    while (uIdx < userPosts.length || eIdx < externalPosts.length) {
      if (uIdx < userPosts.length) {
        combined.push(userPosts[uIdx++]);
      }
      if (eIdx < externalPosts.length) {
        combined.push(externalPosts[eIdx++]);
      }
      if (eIdx < externalPosts.length) {
        combined.push(externalPosts[eIdx++]);
      }
    }

    return combined;
  }

  /**
   * Main aggregated feed getter
   */
  async getFeed({ currentUserId = null, page = 1, limit = 20, category = null, since = null } = {}) {
    const cacheKey = `feed:global:${category || 'all'}`;

    let allPosts = await cacheManager.get(cacheKey);

    if (!allPosts || !Array.isArray(allPosts) || allPosts.length === 0) {
      // Parallel retrieval: VibeGrid user posts + External discovery posts
      const [userPosts, externalPosts] = await Promise.all([
        this.getVibeGridUserPosts(currentUserId),
        this.getExternalPosts()
      ]);

      let filteredExternal = externalPosts;
      if (category && category !== 'all') {
        filteredExternal = externalPosts.filter((p) => p.category === category.toLowerCase());
      }

      allPosts = this.interleaveContent(userPosts, filteredExternal);

      // Cache the combined mix
      await cacheManager.set(cacheKey, allPosts, this.cacheTtl);
    }

    // If delta polling (?since=<timestamp>)
    if (since) {
      const sinceDate = new Date(since).getTime();
      const newItems = allPosts.filter((p) => new Date(p.created_at).getTime() > sinceDate);
      return {
        posts: newItems,
        totalNew: newItems.length,
        hasNew: newItems.length > 0,
        since
      };
    }

    // Pagination
    const pageNum = Math.max(1, Number(page) || 1);
    const pageSize = Math.min(50, Math.max(1, Number(limit) || 20));
    const offset = (pageNum - 1) * pageSize;

    const paginatedPosts = allPosts.slice(offset, offset + pageSize);

    return {
      posts: paginatedPosts,
      page: pageNum,
      limit: pageSize,
      total: allPosts.length,
      hasMore: offset + pageSize < allPosts.length,
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * Aggregates active stories (PostgreSQL users + External discovery stories)
   */
  async getStories({ currentUserId = null } = {}) {
    const cacheKey = 'stories:global';
    const cached = await cacheManager.get(cacheKey);
    if (cached && Array.isArray(cached) && cached.length > 0) {
      return cached;
    }

    // 1. Fetch real VibeGrid user stories from PostgreSQL
    let userCreators = [];
    try {
      const query = `
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

      const res = await db.query(query, [currentUserId]);
      const userMap = new Map();

      (res.rows || []).forEach((row) => {
        if (!userMap.has(row.user_id)) {
          userMap.set(row.user_id, {
            userId: row.user_id,
            username: row.username,
            fullName: row.full_name,
            avatarUrl: row.avatar_url,
            isCurrentUser: currentUserId === row.user_id,
            isExternal: false,
            stories: []
          });
        }
        userMap.get(row.user_id).stories.push({
          id: row.id,
          mediaUrl: row.media_url,
          createdAt: row.created_at,
          expiresAt: row.expires_at,
          isExternal: false
        });
      });

      userCreators = Array.from(userMap.values());
    } catch (err) {
      console.warn('[FeedAggregator] VibeGrid stories fetch error:', err.message);
    }

    // 2. Fetch external discovery stories from providers
    const externalStories = [];
    const storyResults = await Promise.allSettled(
      this.providers.map((p) => p.fetchStories())
    );

    for (const res of storyResults) {
      if (res.status === 'fulfilled' && Array.isArray(res.value)) {
        externalStories.push(...res.value);
      }
    }

    // 3. Combine: VibeGrid user stories first, then external discovery stories
    const combinedStories = [...userCreators, ...externalStories];

    // Cache combined stories for 10 minutes
    await cacheManager.set(cacheKey, combinedStories, this.cacheTtl);
    return combinedStories;
  }
}

// Export singleton
const feedAggregator = new FeedAggregator();
module.exports = feedAggregator;
module.exports.FeedAggregator = FeedAggregator;
