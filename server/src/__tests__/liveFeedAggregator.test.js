/**
 * server/src/__tests__/liveFeedAggregator.test.js
 * ===============================================
 * Test Suite for Live Feed & Stories Aggregation Architecture:
 * 1. CacheManager (In-memory LRU/TTL, Sets, Deduplication)
 * 2. Feed Providers (BaseFeedProvider, CuratedContentProvider, RssFeedProvider)
 * 3. FeedAggregator (Zero PostgreSQL footprint, deduplication, interleaving, delta polling)
 * 4. FeedController (Live feed & stories HTTP endpoints)
 */

const cacheManager = require('../services/cache/CacheManager');
const BaseFeedProvider = require('../services/aggregator/BaseFeedProvider');
const CuratedContentProvider = require('../services/aggregator/CuratedContentProvider');
const RssFeedProvider = require('../services/aggregator/RssFeedProvider');
const { FeedAggregator } = require('../services/aggregator/FeedAggregator');
const feedController = require('../controllers/feedController');

// Mock database query
jest.mock('../config/db', () => ({
  query: jest.fn()
}));

const db = require('../config/db');

describe('Live Feed & Stories Aggregation Suite', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await cacheManager.clear();
  });

  // ==========================================================================
  // 1. CacheManager Tests
  // ==========================================================================
  describe('CacheManager', () => {
    it('should set and get values with TTL', async () => {
      await cacheManager.set('test:key1', { hello: 'world' }, 60);
      const val = await cacheManager.get('test:key1');
      expect(val).toEqual({ hello: 'world' });
    });

    it('should return null for expired keys', async () => {
      // Set with 0 or negative TTL to simulate immediate expiration
      await cacheManager.set('test:expired', 'foo', -1);
      const val = await cacheManager.get('test:expired');
      expect(val).toBeNull();
    });

    it('should support Set operations (sadd, sismember, scard)', async () => {
      const setKey = 'test:set';
      const added1 = await cacheManager.sadd(setKey, 'item_1', 60);
      expect(added1).toBe(true);

      const addedDuplicate = await cacheManager.sadd(setKey, 'item_1', 60);
      expect(addedDuplicate).toBe(false);

      const exists1 = await cacheManager.sismember(setKey, 'item_1');
      const exists2 = await cacheManager.sismember(setKey, 'item_2');

      expect(exists1).toBe(true);
      expect(exists2).toBe(false);

      const card = await cacheManager.scard(setKey);
      expect(card).toBe(1);
    });

    it('should evict oldest items when exceeding max capacity', async () => {
      // Create a small CacheManager to verify LRU eviction
      const { CacheManager } = require('../services/cache/CacheManager');
      const tinyCache = new CacheManager({ maxItems: 3 });

      await tinyCache.set('k1', 'v1', 60);
      await tinyCache.set('k2', 'v2', 60);
      await tinyCache.set('k3', 'v3', 60);
      await tinyCache.set('k4', 'v4', 60); // Causes eviction of k1

      expect(await tinyCache.get('k1')).toBeNull();
      expect(await tinyCache.get('k2')).toBe('v2');
      expect(await tinyCache.get('k4')).toBe('v4');
    });
  });

  // ==========================================================================
  // 2. Feed Providers Tests
  // ==========================================================================
  describe('Feed Providers', () => {
    it('BaseFeedProvider should sanitize text and strip HTML', () => {
      const provider = new BaseFeedProvider({ name: 'TestProvider' });
      const dirty = '<p>Hello <b>World</b> &amp; welcome &lt;friends&gt;!</p>';
      const clean = provider.sanitizeText(dirty);
      expect(clean).toBe('Hello World & welcome <friends>!');
    });

    it('BaseFeedProvider circuit breaker trips after repeated failures', async () => {
      const provider = new BaseFeedProvider('FailingProvider', { failureThreshold: 2, cooldownMs: 10000 });
      provider.executeWithTimeout = jest.fn().mockRejectedValue(new Error('Network drop'));

      expect(provider.isCircuitOpen()).toBe(false);
      provider.recordFailure(new Error('Network 1'));
      provider.recordFailure(new Error('Network 2'));

      expect(provider.isCircuitOpen()).toBe(true);

      // Attempting to fetch while circuit is open should throw circuit breaker error
      await expect(provider.fetchWithTimeout('https://example.com/fail')).rejects.toThrow(
        /Circuit open/i
      );
    });

    it('CuratedContentProvider should return curated photography posts with valid schema', async () => {
      const provider = new CuratedContentProvider();
      const posts = await provider.fetchPosts();

      expect(Array.isArray(posts)).toBe(true);
      expect(posts.length).toBeGreaterThan(0);

      const sample = posts[0];
      expect(sample).toHaveProperty('id');
      expect(sample).toHaveProperty('username');
      expect(sample).toHaveProperty('image_url');
      expect(sample).toHaveProperty('caption');
      expect(sample).toHaveProperty('is_external', true);
      expect(sample).toHaveProperty('source', 'Unsplash');
    });

    it('CuratedContentProvider should return curated active stories', async () => {
      const provider = new CuratedContentProvider();
      const stories = await provider.fetchStories();

      expect(Array.isArray(stories)).toBe(true);
      expect(stories.length).toBeGreaterThan(0);

      const creator = stories[0];
      expect(creator).toHaveProperty('userId');
      expect(creator).toHaveProperty('username');
      expect(creator).toHaveProperty('avatarUrl');
      expect(creator).toHaveProperty('isExternal', true);
      expect(Array.isArray(creator.stories)).toBe(true);
      expect(creator.stories[0]).toHaveProperty('mediaUrl');
      expect(creator.stories[0]).toHaveProperty('isExternal', true);
    });

    it('RssFeedProvider should parse XML RSS items into normalized posts', async () => {
      const provider = new RssFeedProvider();
      const mockXml = `
        <rss version="2.0">
          <channel>
            <title>Mock Tech Feed</title>
            <item>
              <title>Mars Rover Makes New Geological Discovery</title>
              <link>https://example.com/mars-rover</link>
              <description><![CDATA[New strata identified by the Curiosity rover on Mount Sharp.]]></description>
              <enclosure url="https://images.unsplash.com/photo-sample" type="image/jpeg" />
              <pubDate>Mon, 14 Sep 2026 04:00:00 GMT</pubDate>
            </item>
          </channel>
        </rss>
      `;

      const items = provider.parseRssXml(mockXml, {
        name: 'Mock Tech',
        url: 'https://example.com/rss',
        category: 'tech',
        author: 'Tech Insider',
        avatar: '/uploads/avatars/tech.png'
      });

      expect(items.length).toBe(1);
      expect(items[0].caption).toContain('Mars Rover Makes New Geological Discovery');
      expect(items[0].image_url).toBe('https://images.unsplash.com/photo-sample');
      expect(items[0].source).toBe('RSSProvider');
      expect(items[0].is_external).toBe(true);
    });
  });

  // ==========================================================================
  // 3. FeedAggregator Tests
  // ==========================================================================
  describe('FeedAggregator', () => {
    let aggregator;

    beforeEach(() => {
      aggregator = new FeedAggregator({ cacheTtl: 60, dedupTtl: 3600 });
    });

    it('should generate deterministic fingerprints', () => {
      const fp1 = aggregator.generateFingerprint('Unsplash', 'img_123');
      const fp2 = aggregator.generateFingerprint('Unsplash', 'img_123');
      const fp3 = aggregator.generateFingerprint('Unsplash', 'img_456');

      expect(fp1).toBe(fp2);
      expect(fp1).not.toBe(fp3);
    });

    it('should interleave VibeGrid user posts with external posts', () => {
      const userPosts = [
        { id: 1, caption: 'User Post 1', is_external: false },
        { id: 2, caption: 'User Post 2', is_external: false }
      ];

      const extPosts = [
        { id: 'ext_1', caption: 'Ext 1', is_external: true },
        { id: 'ext_2', caption: 'Ext 2', is_external: true },
        { id: 'ext_3', caption: 'Ext 3', is_external: true },
        { id: 'ext_4', caption: 'Ext 4', is_external: true }
      ];

      const interleaved = aggregator.interleaveContent(userPosts, extPosts);

      // Expected pattern: User 1, Ext 1, Ext 2, User 2, Ext 3, Ext 4
      expect(interleaved[0].id).toBe(1);
      expect(interleaved[1].id).toBe('ext_1');
      expect(interleaved[2].id).toBe('ext_2');
      expect(interleaved[3].id).toBe(2);
      expect(interleaved[4].id).toBe('ext_3');
      expect(interleaved[5].id).toBe('ext_4');
    });

    it('getFeed should return interleaved posts without writing to PostgreSQL', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          {
            id: 101,
            user_id: 1,
            username: 'sophia_wander',
            full_name: 'Sophia Chen',
            avatar_url: '/uploads/avatars/sophia.jpg',
            caption: 'Sunset in Santorini',
            image_url: '/uploads/posts/santorini.jpg',
            created_at: new Date().toISOString(),
            is_external: false,
            likes_count: 5,
            comments_count: 2
          }
        ]
      });

      const feed = await aggregator.getFeed({ page: 1, limit: 10 });

      expect(feed).toHaveProperty('posts');
      expect(feed.posts.length).toBeGreaterThan(0);
      // DB was queried for reading real posts, but NO INSERT queries were executed
      expect(db.query).toHaveBeenCalledTimes(1);
      expect(db.query.mock.calls[0][0]).toContain('SELECT');
      expect(db.query.mock.calls[0][0]).not.toContain('INSERT');

      // Check that external posts are present and marked is_external: true
      const externalItem = feed.posts.find((p) => p.is_external === true);
      expect(externalItem).toBeDefined();
      expect(externalItem.source).toBeDefined();
    });

    it('getFeed delta polling should filter posts created after since timestamp', async () => {
      // Mock existing feed in cache
      const oldTime = new Date('2026-09-14T01:00:00Z').toISOString();
      const newTime = new Date('2026-09-14T03:00:00Z').toISOString();

      await cacheManager.set('feed:global:all', [
        { id: 'ext_new', caption: 'Brand new post', created_at: newTime, is_external: true },
        { id: 'ext_old', caption: 'Earlier post', created_at: oldTime, is_external: true }
      ], 600);

      const deltaResult = await aggregator.getFeed({
        since: new Date('2026-09-14T02:00:00Z').toISOString()
      });

      expect(deltaResult.hasNew).toBe(true);
      expect(deltaResult.totalNew).toBe(1);
      expect(deltaResult.posts[0].id).toBe('ext_new');
    });

    it('getStories should aggregate VibeGrid user stories and external discovery stories', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          {
            id: 201,
            user_id: 2,
            username: 'alex_design',
            full_name: 'Alex Rivera',
            avatar_url: '/uploads/avatars/alex.jpg',
            media_url: '/uploads/stories/alex_story.jpg',
            created_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 86400000).toISOString()
          }
        ]
      });

      const stories = await aggregator.getStories();
      expect(Array.isArray(stories)).toBe(true);
      expect(stories.length).toBeGreaterThan(1);

      // First creator is the real VibeGrid user
      expect(stories[0].username).toBe('alex_design');
      expect(stories[0].isExternal).toBe(false);

      // Second creator is external discovery story
      const extStoryCreator = stories.find((c) => c.isExternal === true);
      expect(extStoryCreator).toBeDefined();
      expect(extStoryCreator.stories.length).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // 4. FeedController HTTP Endpoint Tests
  // ==========================================================================
  describe('FeedController Endpoints', () => {
    let req, res, next;

    beforeEach(() => {
      req = {
        query: {},
        user: null
      };
      res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis()
      };
      next = jest.fn();
    });

    it('getLiveFeed should respond with 200 and feed posts', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await feedController.getLiveFeed(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          posts: expect.any(Array)
        })
      );
    });

    it('getLiveStories should respond with 200 and story creators', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await feedController.getLiveStories(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          creators: expect.any(Array)
        })
      );
    });
  });
});
