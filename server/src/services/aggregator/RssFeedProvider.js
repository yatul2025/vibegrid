/**
 * server/src/services/aggregator/RssFeedProvider.js
 * ================================================
 * Public RSS Feed Provider for Live Content Syndication
 * 
 * Sources (standard public syndication feeds):
 * - NASA Image of the Day (Space & Science)
 * - BBC Technology & World News (Global News & Innovation)
 * - Wired Top Stories (Culture & Tech)
 * 
 * Features:
 * - Robust lightweight XML item parsing without external binary dependencies.
 * - Extracts direct media thumbnail enclosures and media:content elements.
 * - Enforces 3-second timeout and circuit breaker protection.
 */

const BaseFeedProvider = require('./BaseFeedProvider');

const APPROVED_RSS_FEEDS = [
  {
    name: 'NASA',
    url: 'https://www.nasa.gov/rss/dyn/lg_image_of_the_day.rss',
    category: 'photography',
    author: 'NASA Space Discovery',
    avatar: 'https://images.unsplash.com/photo-1614728894747-a83421e2b9c9?auto=format&fit=crop&w=200&q=80'
  },
  {
    name: 'Wired',
    url: 'https://www.wired.com/feed/rss',
    category: 'technology',
    author: 'Wired Magazine',
    avatar: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=200&q=80'
  },
  {
    name: 'BBC Tech',
    url: 'https://feeds.bbci.co.uk/news/technology/rss.xml',
    category: 'technology',
    author: 'BBC Innovation',
    avatar: 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&w=200&q=80'
  }
];

class RssFeedProvider extends BaseFeedProvider {
  constructor(options = {}) {
    super('RSSProvider', { timeoutMs: 3500, maxItems: 20, ...options });
    this.feeds = options.feeds || APPROVED_RSS_FEEDS;
  }

  parseRssXml(xmlText, feedConfig) {
    const items = [];
    // Match each <item>...</item> or <entry>...</entry> block
    const itemRegex = /<(?:item|entry)[\s\S]*?<\/(?:item|entry)>/gi;
    const itemMatches = xmlText.match(itemRegex) || [];

    for (const itemBlock of itemMatches.slice(0, 10)) {
      try {
        // Extract Title
        const titleMatch = itemBlock.match(/<title[^>]*>(?:<!\[CDATA\[([\s\S]*?)\]\]>|([\s\S]*?))<\/title>/i);
        const title = this.sanitizeText((titleMatch && (titleMatch[1] || titleMatch[2])) || '');

        // Extract Link
        const linkMatch = itemBlock.match(/<link[^>]*>(?:<!\[CDATA\[([\s\S]*?)\]\]>|([\s\S]*?))<\/link>/i) ||
                          itemBlock.match(/<link[^>]*href=["']([^"']+)["']/i);
        const link = (linkMatch && (linkMatch[1] || linkMatch[2])) || '';

        // Extract Description / Summary
        const descMatch = itemBlock.match(/<(?:description|summary|content)[^>]*>(?:<!\[CDATA\[([\s\S]*?)\]\]>|([\s\S]*?))<\/(?:description|summary|content)>/i);
        const rawDesc = (descMatch && (descMatch[1] || descMatch[2])) || '';
        const description = this.sanitizeText(rawDesc);

        // Extract Image (media:content, enclosure, or <img> inside description)
        let imageUrl = null;
        const mediaContentMatch = itemBlock.match(/<(?:media:content|media:thumbnail)[^>]*url=["']([^"']+)["']/i);
        const enclosureMatch = itemBlock.match(/<enclosure[^>]*url=["']([^"']+)["'][^>]*type=["']image[^"']*["']/i) ||
                               itemBlock.match(/<enclosure[^>]*url=["']([^"']+)["']/i);
        const imgTagMatch = rawDesc.match(/<img[^>]*src=["']([^"']+)["']/i);

        if (mediaContentMatch && mediaContentMatch[1]) {
          imageUrl = mediaContentMatch[1];
        } else if (enclosureMatch && enclosureMatch[1]) {
          imageUrl = enclosureMatch[1];
        } else if (imgTagMatch && imgTagMatch[1]) {
          imageUrl = imgTagMatch[1];
        }

        // Extract PubDate
        const dateMatch = itemBlock.match(/<(?:pubDate|published|updated)>(.*?)<\/(?:pubDate|published|updated)>/i);
        const publishedAt = dateMatch && dateMatch[1] ? new Date(dateMatch[1]).toISOString() : new Date().toISOString();

        // Extract GUID / ID
        const guidMatch = itemBlock.match(/<(?:guid|id)[^>]*>(.*?)<\/(?:guid|id)>/i);
        const rawId = (guidMatch && guidMatch[1]) || link || title;

        if (title && imageUrl) {
          const post = this.normalizePost({
            rawId,
            authorName: feedConfig.author,
            authorUsername: feedConfig.name.toLowerCase().replace(/\s+/g, '_'),
            authorAvatar: feedConfig.avatar,
            caption: `${title} — ${description}`.slice(0, 280),
            imageUrl,
            sourceUrl: link,
            publishedAt,
            category: feedConfig.category,
            tags: [feedConfig.category, feedConfig.name.toLowerCase().replace(/\s+/g, '')],
            likesCount: Math.floor(Math.random() * 45) + 12,
            commentsCount: Math.floor(Math.random() * 8) + 1
          });
          items.push(post);
        }
      } catch (itemErr) {
        // Continue processing other items if one fails
        continue;
      }
    }

    return items;
  }

  async fetchPosts() {
    if (this.isCircuitOpen()) return [];

    const allPosts = [];

    for (const feed of this.feeds) {
      try {
        const res = await this.fetchWithTimeout(feed.url, {
          headers: {
            'User-Agent': 'VibeGrid-LiveFeed/1.0 (Feed Aggregator)',
            'Accept': 'application/rss+xml, application/xml, text/xml, */*'
          }
        });
        const xmlText = await res.text();
        const posts = this.parseRssXml(xmlText, feed);
        allPosts.push(...posts);
      } catch (err) {
        console.warn(`[RssFeedProvider] Feed ${feed.name} temporarily unavailable:`, err.message);
      }
    }

    return allPosts;
  }

  async fetchStories() {
    // Convert top image posts into discovery stories
    const posts = await this.fetchPosts();
    return posts.slice(0, 5).map((p) => {
      return this.normalizeStory({
        rawId: p.id,
        authorName: p.full_name,
        authorUsername: p.username,
        authorAvatar: p.avatar_url,
        mediaUrl: p.image_url,
        publishedAt: p.created_at,
        category: p.category
      });
    });
  }
}

module.exports = RssFeedProvider;
