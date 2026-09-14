/**
 * server/src/services/aggregator/BaseFeedProvider.js
 * =================================================
 * Abstract Base Provider for External Content Feeds
 * 
 * Features:
 * 1. Standard normalization contract for posts and stories.
 * 2. Strict request timeout (3000ms via AbortController).
 * 3. Circuit breaker: if a provider fails 3 times, it pauses for 10 minutes.
 * 4. Text & HTML sanitization (strips raw markup, protects against XSS).
 */

const crypto = require('crypto');

class BaseFeedProvider {
  constructor(name, options = {}) {
    this.name = name;
    this.timeoutMs = options.timeoutMs || 3000;
    this.maxItems = options.maxItems || 25;
    this.failureCount = 0;
    this.failureThreshold = options.failureThreshold || 3;
    this.cooldownMs = options.cooldownMs || 600000; // 10 minutes
    this.lastFailureTime = 0;
  }

  isCircuitOpen() {
    if (this.failureCount >= this.failureThreshold) {
      if (Date.now() - this.lastFailureTime < this.cooldownMs) {
        return true; // Still in cooldown
      }
      // Reset after cooldown period expires
      this.failureCount = 0;
    }
    return false;
  }

  recordSuccess() {
    this.failureCount = 0;
  }

  recordFailure(error) {
    this.failureCount += 1;
    this.lastFailureTime = Date.now();
    console.warn(`[FeedProvider Error] ${this.name} failure #${this.failureCount}:`, error.message);
  }

  /**
   * Helper to execute fetch with timeout
   */
  async fetchWithTimeout(url, fetchOptions = {}) {
    if (this.isCircuitOpen()) {
      throw new Error(`Circuit open for provider ${this.name}. Cooldown in effect.`);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal
      });
      clearTimeout(timer);

      if (!res.ok) {
        throw new Error(`HTTP ${res.status} from ${url}`);
      }
      this.recordSuccess();
      return res;
    } catch (err) {
      clearTimeout(timer);
      this.recordFailure(err);
      throw err;
    }
  }

  /**
   * Strip HTML tags and normalize whitespace
   */
  sanitizeText(raw) {
    if (!raw) return '';
    return String(raw)
      .replace(/<[^>]*>/g, '') // Strip HTML tags
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ') // Collapse multiple whitespace
      .trim();
  }

  generateCleanId(rawId) {
    if (!rawId) return Math.random().toString(36).slice(2, 12);
    const str = String(rawId).trim();
    // If it contains slashes, colons, spaces or URL-like characters, hash it to a clean 16-character hex string
    if (/[/\\?#&%:\s]/.test(str)) {
      return crypto.createHash('sha256').update(str).digest('hex').slice(0, 16);
    }
    return str.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 48);
  }

  /**
   * Normalizes a post into VibeGrid's universal feed post contract
   */
  normalizePost({
    rawId,
    authorName,
    authorUsername,
    authorAvatar,
    caption,
    imageUrl,
    sourceUrl,
    publishedAt,
    category = 'general',
    tags = [],
    likesCount = 0,
    commentsCount = 0
  }) {
    const cleanId = this.generateCleanId(rawId);
    const safeProviderName = this.name.toLowerCase().replace(/[^a-z0-9_]/g, '');
    const safeUsername = (authorUsername || authorName || 'creator')
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_')
      .slice(0, 30);

    return {
      id: `ext_${safeProviderName}_${cleanId}`,
      is_external: true,
      source: this.name,
      source_url: sourceUrl || null,
      user_id: `ext_user_${safeUsername}`,
      username: safeUsername,
      full_name: authorName || safeUsername,
      avatar_url: authorAvatar || '/uploads/avatars/default-avatar.png',
      image_url: imageUrl,
      caption: this.sanitizeText(caption),
      created_at: publishedAt ? new Date(publishedAt).toISOString() : new Date().toISOString(),
      likes_count: Number(likesCount) || 0,
      comments_count: Number(commentsCount) || 0,
      is_liked: false,
      is_saved: false,
      category: category.toLowerCase(),
      tags: Array.isArray(tags) ? tags : []
    };
  }

  /**
   * Normalizes a story into VibeGrid's universal story contract
   */
  normalizeStory({
    rawId,
    authorName,
    authorUsername,
    authorAvatar,
    mediaUrl,
    publishedAt,
    expiresAt,
    category = 'general'
  }) {
    const cleanId = this.generateCleanId(rawId);
    const safeProviderName = this.name.toLowerCase().replace(/[^a-z0-9_]/g, '');
    const safeUsername = (authorUsername || authorName || 'creator')
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_')
      .slice(0, 30);

    const createdAtDate = publishedAt ? new Date(publishedAt) : new Date();
    const expiresAtDate = expiresAt ? new Date(expiresAt) : new Date(createdAtDate.getTime() + 86400000);

    return {
      id: `ext_story_${safeProviderName}_${cleanId}`,
      is_external: true,
      isExternal: true,
      source: this.name,
      userId: `ext_creator_${safeUsername}`,
      username: safeUsername,
      fullName: authorName || safeUsername,
      avatarUrl: authorAvatar || '/uploads/avatars/default-avatar.png',
      isCurrentUser: false,
      category,
      stories: [
        {
          id: `ext_story_${this.name.toLowerCase()}_${cleanId}`,
          mediaUrl,
          createdAt: createdAtDate.toISOString(),
          expiresAt: expiresAtDate.toISOString(),
          isExternal: true,
          source: this.name
        }
      ]
    };
  }

  // To be implemented by subclasses
  async fetchPosts() {
    return [];
  }

  async fetchStories() {
    return [];
  }
}

module.exports = BaseFeedProvider;
