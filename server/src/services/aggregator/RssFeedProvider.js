/**
 * server/src/services/aggregator/RssFeedProvider.js
 * ================================================
 * Public Multi-Category RSS Feed Provider for Live Content Syndication
 * 
 * Sources:
 * - Education & Science: NASA Image of the Day
 * - World & Breaking News: BBC World News
 * - Technology & Innovation: BBC Technology, Wired
 * - Sports: BBC Sport Football & Athletics
 * - Entertainment & Pop Culture: Variety Entertainment
 * 
 * Features:
 * - Robust lightweight XML item parsing without external heavy dependencies.
 * - Extracts direct media enclosures, media:content, and media:thumbnail elements.
 * - Categorized image fallbacks when RSS item lacks visual media enclosure.
 * - Balanced quotas per source so no single feed dominates the timeline.
 */

const BaseFeedProvider = require('./BaseFeedProvider');

const CATEGORY_FALLBACK_IMAGES = {
  education: [
    'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1507668077129-56e32842fceb?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?auto=format&fit=crop&w=1200&q=80'
  ],
  news: [
    'https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1495020689067-958852a7765e?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?auto=format&fit=crop&w=1200&q=80'
  ],
  sports: [
    'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=1200&q=80'
  ],
  entertainment: [
    'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1200&q=80'
  ],
  jokes: [
    'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=1200&q=80'
  ],
  technology: [
    'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&w=1200&q=80'
  ]
};

const APPROVED_RSS_FEEDS = [
  {
    name: 'NASA Discovery',
    url: 'https://www.nasa.gov/rss/dyn/lg_image_of_the_day.rss',
    category: 'education',
    author: 'NASA Space & Science',
    avatar: 'https://images.unsplash.com/photo-1614728894747-a83421e2b9c9?auto=format&fit=crop&w=200&q=80',
    maxItemsPerFetch: 3
  },
  {
    name: 'BBC World News',
    url: 'https://feeds.bbci.co.uk/news/world/rss.xml',
    category: 'news',
    author: 'BBC Global Dispatch',
    avatar: 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&w=200&q=80',
    maxItemsPerFetch: 4
  },
  {
    name: 'BBC Tech',
    url: 'https://feeds.bbci.co.uk/news/technology/rss.xml',
    category: 'education',
    author: 'BBC Tech Innovation',
    avatar: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=200&q=80',
    maxItemsPerFetch: 3
  },
  {
    name: 'BBC Sport',
    url: 'https://feeds.bbci.co.uk/sport/rss.xml',
    category: 'sports',
    author: 'BBC Sports Arena',
    avatar: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=200&q=80',
    maxItemsPerFetch: 4
  },
  {
    name: 'Variety Entertainment',
    url: 'https://variety.com/feed/',
    category: 'entertainment',
    author: 'Variety Culture & Cinema',
    avatar: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=200&q=80',
    maxItemsPerFetch: 3
  },
  {
    name: 'The Verge',
    url: 'https://www.theverge.com/rss/index.xml',
    category: 'news',
    author: 'The Verge Tech & Media',
    avatar: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=200&q=80',
    maxItemsPerFetch: 3
  }
];

class RssFeedProvider extends BaseFeedProvider {
  constructor(options = {}) {
    super('RSSProvider', { timeoutMs: 3500, maxItems: 30, ...options });
    this.feeds = options.feeds || APPROVED_RSS_FEEDS;
    this.batchOffset = 0;
  }

  parseRssXml(xmlText, feedConfig, offset = 0) {
    const items = [];
    const itemRegex = /<(?:item|entry)[\s\S]*?<\/(?:item|entry)>/gi;
    const itemMatches = xmlText.match(itemRegex) || [];

    const limit = feedConfig.maxItemsPerFetch || 3;
    const start = (offset * limit) % Math.max(1, itemMatches.length);
    let candidates = itemMatches.slice(start, start + limit);
    if (candidates.length === 0) candidates = itemMatches.slice(0, limit);

    for (let i = 0; i < candidates.length; i++) {
      const itemBlock = candidates[i];
      try {
        // Extract Title
        const titleMatch = itemBlock.match(/<title[^>]*>(?:<!\[CDATA\[([\s\S]*?)\]\]>|([\s\S]*?))<\/title>/i);
        const title = this.sanitizeText((titleMatch && (titleMatch[1] || titleMatch[2])) || '');

        if (!title) continue;

        // Extract Link
        const linkMatch = itemBlock.match(/<link[^>]*>(?:<!\[CDATA\[([\s\S]*?)\]\]>|([\s\S]*?))<\/link>/i) ||
                          itemBlock.match(/<link[^>]*href=["']([^"']+)["']/i);
        const link = (linkMatch && (linkMatch[1] || linkMatch[2])) || '';

        // Extract Description / Summary
        const descMatch = itemBlock.match(/<(?:description|summary|content)[^>]*>(?:<!\[CDATA\[([\s\S]*?)\]\]>|([\s\S]*?))<\/(?:description|summary|content)>/i);
        const rawDesc = (descMatch && (descMatch[1] || descMatch[2])) || '';
        const description = this.sanitizeText(rawDesc);

        // Extract Image (media:content, media:thumbnail, enclosure, or <img>)
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

        // Fallback: If RSS article doesn't have an enclosure, use a relevant high-res topic image
        if (!imageUrl) {
          const fallbacks = CATEGORY_FALLBACK_IMAGES[feedConfig.category] || CATEGORY_FALLBACK_IMAGES.news;
          imageUrl = fallbacks[i % fallbacks.length];
        }

        // Extract PubDate
        const dateMatch = itemBlock.match(/<(?:pubDate|published|updated)>(.*?)<\/(?:pubDate|published|updated)>/i);
        const publishedAt = dateMatch && dateMatch[1] ? new Date(dateMatch[1]).toISOString() : new Date().toISOString();

        // Extract GUID / ID
        const guidMatch = itemBlock.match(/<(?:guid|id)[^>]*>(.*?)<\/(?:guid|id)>/i);
        const rawId = (guidMatch && guidMatch[1]) || link || title;

        const post = this.normalizePost({
          rawId,
          authorName: feedConfig.author,
          authorUsername: feedConfig.name.toLowerCase().replace(/\s+/g, '_'),
          authorAvatar: feedConfig.avatar,
          caption: description ? `${title} — ${description}`.slice(0, 280) : title.slice(0, 280),
          imageUrl,
          sourceUrl: link,
          publishedAt,
          category: feedConfig.category,
          tags: [feedConfig.category, feedConfig.name.toLowerCase().replace(/\s+/g, '')],
          likesCount: Math.floor(Math.random() * 55) + 18,
          commentsCount: Math.floor(Math.random() * 12) + 2
        });

        items.push(post);
      } catch (itemErr) {
        continue;
      }
    }

    return items;
  }

  async fetchPosts({ refresh = false } = {}) {
    if (this.isCircuitOpen()) return [];

    if (refresh) {
      this.batchOffset = (this.batchOffset + 1) % 4;
    }

    const allPosts = [];

    // Query RSS feeds concurrently
    const feedPromises = this.feeds.map(async (feed) => {
      try {
        const res = await this.fetchWithTimeout(feed.url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/rss+xml, application/xml, text/xml, */*'
          }
        });
        const xmlText = await res.text();
        return this.parseRssXml(xmlText, feed, this.batchOffset);
      } catch (err) {
        return [];
      }
    });

    const results = await Promise.allSettled(feedPromises);
    for (const res of results) {
      if (res.status === 'fulfilled' && Array.isArray(res.value)) {
        allPosts.push(...res.value);
      }
    }

    // Return balanced and shuffled items
    return allPosts.sort(() => Math.random() - 0.5);
  }
}

module.exports = RssFeedProvider;
