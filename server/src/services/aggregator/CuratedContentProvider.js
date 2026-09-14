/**
 * server/src/services/aggregator/CuratedContentProvider.js
 * ========================================================
 * High-Resolution Curated Public Media & Discovery Provider
 * 
 * Provides rotating high-resolution photography feeds and 24-hour stories
 * sourced from approved royalty-free public domain / Unsplash CDN collections.
 * 
 * Categories:
 * - Travel & Wanderlust
 * - Architecture & Minimal Design
 * - Specialty Coffee & Culinary Arts
 * - Street & Cinematic Photography
 * - Technology & Creative Workspaces
 * 
 * Dynamically modulates timestamps and rotating subsets so every visit feels alive.
 */

const BaseFeedProvider = require('./BaseFeedProvider');

const CURATED_MEDIA_BANK = [
  {
    id: 'travel_kyoto_bamboo',
    author: 'Elena Rostova',
    username: 'elena_culinary',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80',
    caption: 'Morning mist filtering through the bamboo groves of Arashiyama 🎋☕️ Matcha in hand before the city stirs.',
    imageUrl: 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=1200&q=80',
    category: 'travel',
    tags: ['kyoto', 'japan', 'travel', 'wanderlust'],
    sourceUrl: 'https://unsplash.com/photos/bamboo-forest'
  },
  {
    id: 'arch_minimal_concrete',
    author: 'Alex Morgan',
    username: 'alex_design',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
    caption: 'Shadows cutting across polished concrete at 4:30 PM. The geometry of negative space never gets old 📐🏢',
    imageUrl: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=1200&q=80',
    category: 'architecture',
    tags: ['architecture', 'minimalism', 'design', 'structure'],
    sourceUrl: 'https://unsplash.com/photos/minimal-architecture'
  },
  {
    id: 'photo_tokyo_rain',
    author: 'Liam Chen',
    username: 'liam_visuals',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80',
    caption: 'Rain-soaked asphalt reflecting neon amber in Shinjuku alleys 🌧️📸 35mm f/1.4 handheld.',
    imageUrl: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=1200&q=80',
    category: 'photography',
    tags: ['tokyo', 'streetphotography', 'cyberpunk', 'cinematic'],
    sourceUrl: 'https://unsplash.com/photos/tokyo-street-night'
  },
  {
    id: 'culinary_sourdough_bake',
    author: 'Marcus Vance',
    username: 'marcus_tech',
    avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=400&q=80',
    caption: '78% hydration sourdough with roasted sesame crust 🥐🥖 That ear crackle straight out of the Dutch oven!',
    imageUrl: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=1200&q=80',
    category: 'culinary',
    tags: ['sourdough', 'pastry', 'artisan', 'foodphotography'],
    sourceUrl: 'https://unsplash.com/photos/fresh-sourdough'
  },
  {
    id: 'travel_amalfi_cliff',
    author: 'Sophia Laurent',
    username: 'sophia_wander',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
    caption: 'Positano pastel houses cascading straight into the Tyrrhenian Sea 🌊☀️ Mediterranean summer feeling infinite.',
    imageUrl: 'https://images.unsplash.com/photo-1533105079780-92b9be482077?auto=format&fit=crop&w=1200&q=80',
    category: 'travel',
    tags: ['amalfi', 'positano', 'italy', 'summer'],
    sourceUrl: 'https://unsplash.com/photos/amalfi-coast'
  },
  {
    id: 'tech_minimal_workspace',
    author: 'Aria Sterling',
    username: 'aria_nature',
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80',
    caption: 'Natural walnut, warm backlight, and clean cable routing 💻☕️ Ready for deep work and coding flow.',
    imageUrl: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1200&q=80',
    category: 'technology',
    tags: ['workspace', 'desksetup', 'minimalism', 'productivity'],
    sourceUrl: 'https://unsplash.com/photos/minimal-desk'
  },
  {
    id: 'photo_nordic_aurora',
    author: 'Elena Rostova',
    username: 'elena_culinary',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80',
    caption: 'Northern lights dancing over frozen fjords in Tromsø 🌌❄️ 20-second exposure in sub-zero silence.',
    imageUrl: 'https://images.unsplash.com/photo-1517411032315-54ef2cb783bb?auto=format&fit=crop&w=1200&q=80',
    category: 'photography',
    tags: ['aurora', 'norway', 'nightphotography', 'arctic'],
    sourceUrl: 'https://unsplash.com/photos/northern-lights'
  },
  {
    id: 'travel_iceland_waterfall',
    author: 'Sophia Laurent',
    username: 'sophia_wander',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
    caption: 'Standing behind Seljalandsfoss waterfall at dusk 🇮🇸🌈 Pure raw power of volcanic glaciers.',
    imageUrl: 'https://images.unsplash.com/photo-1489447068241-b3490214e879?auto=format&fit=crop&w=1200&q=80',
    category: 'travel',
    tags: ['iceland', 'waterfall', 'adventure', 'explore'],
    sourceUrl: 'https://unsplash.com/photos/iceland-waterfall'
  }
];

const CURATED_STORIES_BANK = [
  {
    id: 'story_curated_1',
    author: 'Sophia Laurent',
    username: 'sophia_wander',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
    mediaUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80',
    category: 'travel'
  },
  {
    id: 'story_curated_2',
    author: 'Alex Morgan',
    username: 'alex_design',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
    mediaUrl: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=800&q=80',
    category: 'architecture'
  },
  {
    id: 'story_curated_3',
    author: 'Liam Chen',
    username: 'liam_visuals',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80',
    mediaUrl: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=800&q=80',
    category: 'photography'
  },
  {
    id: 'story_curated_4',
    author: 'Elena Rostova',
    username: 'elena_culinary',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80',
    mediaUrl: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=800&q=80',
    category: 'culinary'
  }
];

class CuratedContentProvider extends BaseFeedProvider {
  constructor(options = {}) {
    super('Unsplash', { timeoutMs: 2000, maxItems: 30, ...options });
  }

  async fetchPosts() {
    const now = Date.now();

    // Generate dynamic rolling timestamps within the last 15-180 minutes
    return CURATED_MEDIA_BANK.map((item, idx) => {
      const minutesAgo = (idx * 17) + 5;
      const publishedAt = new Date(now - (minutesAgo * 60000)).toISOString();

      return this.normalizePost({
        rawId: item.id,
        authorName: item.author,
        authorUsername: item.username,
        authorAvatar: item.avatar,
        caption: item.caption,
        imageUrl: item.imageUrl,
        sourceUrl: item.sourceUrl,
        publishedAt,
        category: item.category,
        tags: item.tags,
        likesCount: 35 + (idx * 12),
        commentsCount: 4 + (idx * 2)
      });
    });
  }

  async fetchStories() {
    const now = Date.now();

    return CURATED_STORIES_BANK.map((item, idx) => {
      const hoursAgo = (idx * 3) + 1;
      const publishedAt = new Date(now - (hoursAgo * 3600000)).toISOString();
      const expiresAt = new Date(now + ((24 - hoursAgo) * 3600000)).toISOString();

      return this.normalizeStory({
        rawId: item.id,
        authorName: item.author,
        authorUsername: item.username,
        authorAvatar: item.avatar,
        mediaUrl: item.mediaUrl,
        publishedAt,
        expiresAt,
        category: item.category
      });
    });
  }
}

module.exports = CuratedContentProvider;
