/**
 * server/src/services/aggregator/CuratedContentProvider.js
 * ========================================================
 * Curated Multi-Category Live Discovery Provider
 * 
 * Provides rotating high-resolution media across all major interest verticals:
 * - Entertainment (Cinema, Music Festivals, Pop Culture)
 * - Jokes & Humor (Tech memes, Relatable laughs, Comedy)
 * - Education & Science (Space, Nature, Discoveries, History)
 * - Sports (Football, Basketball, Formula 1, Athletics)
 * - News & Current Affairs (Global, Tech, Innovation)
 * - Travel & Photography (Cinematic cityscapes, landscapes)
 * 
 * Generates dynamic rolling timestamps and randomized engagement counters
 * so every page refresh feels actively alive and fresh.
 */

const BaseFeedProvider = require('./BaseFeedProvider');

const CURATED_MEDIA_BANK = [
  // ==========================================
  // 1. ENTERTAINMENT (Movies, Music, Festivals)
  // ==========================================
  {
    id: 'ent_cinema_premiere',
    author: 'Cinema Chronicles',
    username: 'cinema_daily',
    avatar: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=400&q=80',
    caption: 'Opening night at Venice Film Festival! 🎬 The standing ovation lasted 12 straight minutes. Cinema is truly alive and kicking.',
    imageUrl: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=1200&q=80',
    category: 'entertainment',
    tags: ['cinema', 'movies', 'filmfestival', 'venice', 'entertainment'],
    sourceUrl: 'https://unsplash.com/photos/movie-theater'
  },
  {
    id: 'ent_live_concert_vibes',
    author: 'Liam Vance',
    username: 'soundwave_live',
    avatar: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=400&q=80',
    caption: 'Bass dropping at 130 BPM with 40,000 voices singing in unison 🎸⚡ That post-chorus stadium laser shower gives goosebumps.',
    imageUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=1200&q=80',
    category: 'entertainment',
    tags: ['concert', 'livemusic', 'festival', 'vibes', 'bass'],
    sourceUrl: 'https://unsplash.com/photos/concert-crowd'
  },
  {
    id: 'ent_vinyl_collection',
    author: 'Maya Lin',
    username: 'vinyl_notes',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
    caption: 'Late night analog listening session 🎶 1974 original pressing on the turntable. Nothing replicates the needle-drop warmth.',
    imageUrl: 'https://images.unsplash.com/photo-1539185441755-769473a23570?auto=format&fit=crop&w=1200&q=80',
    category: 'entertainment',
    tags: ['vinyl', 'music', 'audiophile', 'retro', 'chill'],
    sourceUrl: 'https://unsplash.com/photos/vinyl-record'
  },

  // ==========================================
  // 2. JOKES & HUMOR (Memes, Comedy, Laughs)
  // ==========================================
  {
    id: 'joke_code_deploy_friday',
    author: 'Daily Dev Memes',
    username: 'meme_central',
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=400&q=80',
    caption: 'Me: "It\'s just a 1-line CSS fix, let\'s push directly to main at 5:45 PM on Friday." 💻🔥 Production 2 seconds later:',
    imageUrl: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=1200&q=80',
    category: 'jokes',
    tags: ['humor', 'jokes', 'devhumor', 'meme', 'programming'],
    sourceUrl: 'https://unsplash.com/photos/matrix-code'
  },
  {
    id: 'joke_cat_judgment',
    author: 'Cleo & Friends',
    username: 'paws_and_giggles',
    avatar: 'https://images.unsplash.com/photo-1543610892-0b1f7e6d8ac1?auto=format&fit=crop&w=400&q=80',
    caption: 'My cat watching me set my 6th alarm knowing full well I\'m going to hit snooze on all of them 😹☕️',
    imageUrl: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&w=1200&q=80',
    category: 'jokes',
    tags: ['cat', 'funny', 'humor', 'pets', 'relatable'],
    sourceUrl: 'https://unsplash.com/photos/cute-cat'
  },
  {
    id: 'joke_coffee_survival',
    author: 'Office Survivalist',
    username: 'daily_giggles',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
    caption: '"This meeting could have been an email" — A memoir written in the steam of my 3rd double espresso ☕️😴',
    imageUrl: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=1200&q=80',
    category: 'jokes',
    tags: ['coffee', 'workhumor', 'meme', 'office', 'jokes'],
    sourceUrl: 'https://unsplash.com/photos/coffee-cup'
  },

  // ==========================================
  // 3. EDUCATION & SCIENCE (Space, Nature, Tech)
  // ==========================================
  {
    id: 'edu_deep_space_nebula',
    author: 'Cosmic Horizons',
    username: 'science_daily',
    avatar: 'https://images.unsplash.com/photo-1614728894747-a83421e2b9c9?auto=format&fit=crop&w=400&q=80',
    caption: 'Did you know? The Carina Nebula is home to Eta Carinae — a stellar system over 5 million times brighter than our Sun! 🌌✨ Science continues to blow minds.',
    imageUrl: 'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?auto=format&fit=crop&w=1200&q=80',
    category: 'education',
    tags: ['education', 'space', 'science', 'astronomy', 'cosmos'],
    sourceUrl: 'https://unsplash.com/photos/carina-nebula'
  },
  {
    id: 'edu_ocean_deep_dive',
    author: 'Deep Sea Institute',
    username: 'ocean_discovery',
    avatar: 'https://images.unsplash.com/photo-1518837695005-2083093ee35b?auto=format&fit=crop&w=400&q=80',
    caption: 'Over 80% of Earth\'s oceans remain completely unexplored 🌊 Bioluminescent creatures at 3,000 meters produce their own light through luciferin chemical reactions.',
    imageUrl: 'https://images.unsplash.com/photo-1682687220063-4742bd7fd538?auto=format&fit=crop&w=1200&q=80',
    category: 'education',
    tags: ['ocean', 'marinebiology', 'education', 'nature', 'science'],
    sourceUrl: 'https://unsplash.com/photos/underwater-reef'
  },
  {
    id: 'edu_quantum_breakthrough',
    author: 'Tech Innovators Academy',
    username: 'quantum_lab',
    avatar: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=400&q=80',
    caption: 'Inside the cryostat chamber: Qubits cooled down to 15 millikelvin — colder than deep interstellar space! 🔬⚛️ Quantum computing explained in simple terms.',
    imageUrl: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?auto=format&fit=crop&w=1200&q=80',
    category: 'education',
    tags: ['quantum', 'physics', 'education', 'stem', 'innovation'],
    sourceUrl: 'https://unsplash.com/photos/quantum-abstract'
  },

  // ==========================================
  // 4. SPORTS (Football, Racing, Athletics)
  // ==========================================
  {
    id: 'sport_champions_night',
    author: 'Stadium Pulse',
    username: 'arena_sports',
    avatar: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=400&q=80',
    caption: '94th-minute stoppage time screamer from 30 yards out! ⚽️🔥 The floodlights, the roaring crowd, the sheer poetry of European nights.',
    imageUrl: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=1200&q=80',
    category: 'sports',
    tags: ['sports', 'football', 'soccer', 'stadium', 'matchday'],
    sourceUrl: 'https://unsplash.com/photos/soccer-stadium'
  },
  {
    id: 'sport_f1_monaco_apex',
    author: 'Apex Velocity',
    username: 'speed_chronicles',
    avatar: 'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?auto=format&fit=crop&w=400&q=80',
    caption: 'Kissing the barrier at Swimming Pool chicane at 220 km/h 🏎️💨 Millimeters separating pole position from carbon fiber debris.',
    imageUrl: 'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?auto=format&fit=crop&w=1200&q=80',
    category: 'sports',
    tags: ['f1', 'motorsport', 'racing', 'speed', 'sports'],
    sourceUrl: 'https://unsplash.com/photos/race-car'
  },
  {
    id: 'sport_basketball_dunk',
    author: 'Hoop Dreams',
    username: 'court_vision',
    avatar: 'https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=400&q=80',
    caption: 'Fast-break transition into an explosive two-handed reverse slam! 🏀 Defying gravity when the game is on the line.',
    imageUrl: 'https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=1200&q=80',
    category: 'sports',
    tags: ['basketball', 'nba', 'dunk', 'sports', 'athletics'],
    sourceUrl: 'https://unsplash.com/photos/basketball-player'
  },

  // ==========================================
  // 5. NEWS & CURRENT AFFAIRS (Global, Tech)
  // ==========================================
  {
    id: 'news_global_summit',
    author: 'Global Brief',
    username: 'world_news_wire',
    avatar: 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&w=400&q=80',
    caption: 'BREAKING: Global consortium approves new clean energy transition milestone funding 🌍🌱 150 nations pledge zero emissions target acceleration.',
    imageUrl: 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&w=1200&q=80',
    category: 'news',
    tags: ['news', 'global', 'climate', 'worldnews', 'breaking'],
    sourceUrl: 'https://unsplash.com/photos/news-microphone'
  },
  {
    id: 'news_ai_robotics_summit',
    author: 'Tech Ticker',
    username: 'tech_bulletin',
    avatar: 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&w=400&q=80',
    caption: 'Next-generation humanoid robotics demonstration in Tokyo showcases delicate tactile feedback handling eggs and glassware 🤖🦾',
    imageUrl: 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&w=1200&q=80',
    category: 'news',
    tags: ['news', 'tech', 'robotics', 'ai', 'future'],
    sourceUrl: 'https://unsplash.com/photos/robot-technology'
  },

  // ==========================================
  // 6. TRAVEL & PHOTOGRAPHY
  // ==========================================
  {
    id: 'travel_kyoto_bamboo',
    author: 'Elena Rostova',
    username: 'elena_culinary',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80',
    caption: 'Morning mist filtering through the bamboo groves of Arashiyama 🎋☕️ Matcha in hand before the city stirs.',
    imageUrl: 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=1200&q=80',
    category: 'photography',
    tags: ['kyoto', 'japan', 'travel', 'wanderlust'],
    sourceUrl: 'https://unsplash.com/photos/bamboo-forest'
  },
  {
    id: 'travel_amalfi_cliff',
    author: 'Sophia Laurent',
    username: 'sophia_wander',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
    caption: 'Positano pastel houses cascading straight into the Tyrrhenian Sea 🌊☀️ Mediterranean summer feeling infinite.',
    imageUrl: 'https://images.unsplash.com/photo-1533105079780-92b9be482077?auto=format&fit=crop&w=1200&q=80',
    category: 'photography',
    tags: ['amalfi', 'positano', 'italy', 'summer'],
    sourceUrl: 'https://unsplash.com/photos/amalfi-coast'
  },
  {
    id: 'photo_nordic_aurora',
    author: 'Liam Chen',
    username: 'liam_visuals',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80',
    caption: 'Northern lights dancing over frozen fjords in Tromsø 🌌❄️ 20-second exposure in sub-zero silence.',
    imageUrl: 'https://images.unsplash.com/photo-1517411032315-54ef2cb783bb?auto=format&fit=crop&w=1200&q=80',
    category: 'photography',
    tags: ['aurora', 'norway', 'nightphotography', 'arctic'],
    sourceUrl: 'https://unsplash.com/photos/northern-lights'
  }
];

const CURATED_STORIES_BANK = [
  {
    id: 'story_curated_entertainment',
    author: 'Cinema Chronicles',
    username: 'cinema_daily',
    avatar: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=400&q=80',
    mediaUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=800&q=80',
    category: 'entertainment'
  },
  {
    id: 'story_curated_jokes',
    author: 'Daily Dev Memes',
    username: 'meme_central',
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=400&q=80',
    mediaUrl: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&w=800&q=80',
    category: 'jokes'
  },
  {
    id: 'story_curated_education',
    author: 'Cosmic Horizons',
    username: 'science_daily',
    avatar: 'https://images.unsplash.com/photo-1614728894747-a83421e2b9c9?auto=format&fit=crop&w=400&q=80',
    mediaUrl: 'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?auto=format&fit=crop&w=800&q=80',
    category: 'education'
  },
  {
    id: 'story_curated_sports',
    author: 'Stadium Pulse',
    username: 'arena_sports',
    avatar: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=400&q=80',
    mediaUrl: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=800&q=80',
    category: 'sports'
  },
  {
    id: 'story_curated_news',
    author: 'Global Brief',
    username: 'world_news_wire',
    avatar: 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&w=400&q=80',
    mediaUrl: 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&w=800&q=80',
    category: 'news'
  },
  {
    id: 'story_curated_travel',
    author: 'Sophia Laurent',
    username: 'sophia_wander',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
    mediaUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80',
    category: 'travel'
  }
];

class CuratedContentProvider extends BaseFeedProvider {
  constructor(options = {}) {
    super('Unsplash', { timeoutMs: 2000, maxItems: 40, ...options });
  }

  async fetchPosts(filterCategory = null) {
    const now = Date.now();

    // Filter by category if requested (mapping jokes/humor, education, etc.)
    let items = [...CURATED_MEDIA_BANK];
    if (filterCategory && filterCategory !== 'all') {
      const cleanCat = filterCategory.toLowerCase();
      items = items.filter((item) => {
        if (cleanCat === 'jokes' || cleanCat === 'humor' || cleanCat === 'joc') {
          return item.category === 'jokes';
        }
        if (cleanCat === 'education' || cleanCat === 'eduartion' || cleanCat === 'science') {
          return item.category === 'education';
        }
        return item.category === cleanCat;
      });
      // If none match, fallback to all items
      if (items.length === 0) items = [...CURATED_MEDIA_BANK];
    }

    // Shuffle items dynamically so refresh provides fresh discovery order
    const shuffled = [...items].sort(() => Math.random() - 0.5);

    return shuffled.map((item, idx) => {
      // Dynamic rolling timestamps within the last 3-90 minutes
      const minutesAgo = (idx * 9) + Math.floor(Math.random() * 5) + 2;
      const publishedAt = new Date(now - (minutesAgo * 60000)).toISOString();

      return this.normalizePost({
        rawId: `${item.id}_${now}`,
        authorName: item.author,
        authorUsername: item.username,
        authorAvatar: item.avatar,
        caption: item.caption,
        imageUrl: item.imageUrl,
        sourceUrl: item.sourceUrl,
        publishedAt,
        category: item.category,
        tags: item.tags,
        likesCount: 28 + Math.floor(Math.random() * 65),
        commentsCount: 3 + Math.floor(Math.random() * 12)
      });
    });
  }

  async fetchStories() {
    const now = Date.now();
    // Shuffle active discovery stories
    const shuffled = [...CURATED_STORIES_BANK].sort(() => Math.random() - 0.5);

    return shuffled.map((item, idx) => {
      const hoursAgo = idx + 1;
      const publishedAt = new Date(now - (hoursAgo * 3600000)).toISOString();
      const expiresAt = new Date(now + ((24 - hoursAgo) * 3600000)).toISOString();

      return this.normalizeStory({
        rawId: `${item.id}_${now}`,
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
