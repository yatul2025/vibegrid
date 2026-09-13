/**
 * server/src/db/seedRealisticFeeds.js
 * ===================================
 * Seeds VibeGrid with 10 authentic user personas, 28 curated aesthetic posts,
 * interactive comments, realistic likes, hashtags, follows, and active stories.
 */

const { Pool } = require('pg');
const bcrypt = require('bcrypt');
require('dotenv').config({ path: 'server/.env' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const SALT_ROUNDS = 10;

// 10 Believable Personas
const PERSONAS = [
  {
    username: 'sophia_wander',
    email: 'sophia@vibegrid.io',
    full_name: 'Sophia Laurent',
    bio: 'Chasing golden light across continents ✈️📸 Paris | Tokyo | Amalfi Coast',
    avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80'
  },
  {
    username: 'alex_design',
    email: 'alex@vibegrid.io',
    full_name: 'Alex Morgan',
    bio: 'Architect & minimalist designer 📐☕️ Building spaces where light meets structure.',
    avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80'
  },
  {
    username: 'elena_culinary',
    email: 'elena@vibegrid.io',
    full_name: 'Elena Rostova',
    bio: 'Pastry chef & sourdough alchemist 🥐🍓 Tasting the world one espresso at a time.',
    avatar_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80'
  },
  {
    username: 'liam_visuals',
    email: 'liam@vibegrid.io',
    full_name: 'Liam Chen',
    bio: 'Street photography & cinematic frames 🌧️🏙️ Tokyo neon & rainy asphalt.',
    avatar_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80'
  },
  {
    username: 'aria_nature',
    email: 'aria@vibegrid.io',
    full_name: 'Aria Sharma',
    bio: 'Wilderness seeker 🌲⛰️ Sunrise on peaks & misty valley silence.',
    avatar_url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80'
  },
  {
    username: 'marcus_tech',
    email: 'marcus@vibegrid.io',
    full_name: 'Marcus Vance',
    bio: 'Building AI & crafting clean code ⚡️🤖 Mechanical keyboards & midnight commits.',
    avatar_url: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=400&q=80'
  },
  {
    username: 'chloe_fitness',
    email: 'chloe@vibegrid.io',
    full_name: 'Chloe Bennett',
    bio: 'Pilates coach & morning runner 🌿🏃‍♀️ Movement is medicine.',
    avatar_url: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=400&q=80'
  },
  {
    username: 'mateo_sound',
    email: 'mateo@vibegrid.io',
    full_name: 'Mateo Silva',
    bio: 'Analog souls & jazz vinyl 🎷🎧 Sound designer living between 70s funk and ambient lo-fi.',
    avatar_url: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=400&q=80'
  },
  {
    username: 'maya_art',
    email: 'maya@vibegrid.io',
    full_name: 'Maya Lin',
    bio: 'Ceramics & botanical forms 🪴🏺 Handcrafted porcelain and slow mornings.',
    avatar_url: 'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?auto=format&fit=crop&w=400&q=80'
  },
  {
    username: 'oliver_style',
    email: 'oliver@vibegrid.io',
    full_name: 'Oliver Wright',
    bio: 'Editorial stylist & archivist 🧥🕶️ Monochrome minimalism and vintage outerwear.',
    avatar_url: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=400&q=80'
  }
];

// 28 Aesthetic Curated Feeds
const SEED_POSTS = [
  // Sophia (Travel)
  {
    author: 'sophia_wander',
    image_url: 'https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?auto=format&fit=crop&w=1080&q=80',
    caption: 'Golden hour never hits quite like it does from the cliffside in Oia. The blue domes glowing against the Aegean sea. 🌅🇬🇷 #wanderlust #travel #goldenhour #santorini #greece',
    hoursAgo: 2
  },
  {
    author: 'sophia_wander',
    image_url: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=1080&q=80',
    caption: 'Woke up at 5:30 AM to catch Arashiyama before the crowds arrived. Just the wind through the bamboo stalks and pure silence. 🎋⛩️ #japan #travel #kyoto #mindfulness #wanderlust',
    hoursAgo: 14
  },
  {
    author: 'sophia_wander',
    image_url: 'https://images.unsplash.com/photo-1533105079780-92b9be482077?auto=format&fit=crop&w=1080&q=80',
    caption: 'Pastel houses cascading straight down into turquoise waters. Italy in June is simply unmatched. 🍋🛵 #amalfi #italy #travel #summervibes #coastal',
    hoursAgo: 28
  },

  // Alex (Architecture & Design)
  {
    author: 'alex_design',
    image_url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1080&q=80',
    caption: 'Light, shadow, and cantilevered concrete. When architecture becomes sculpture. 📐✨ #architecture #minimalism #design #modernism #structure',
    hoursAgo: 4
  },
  {
    author: 'alex_design',
    image_url: 'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=1080&q=80',
    caption: 'Simplicity is the ultimate sophistication. Natural oak, linen textures, and soft morning light. 🌿🪑 #interiordesign #minimalism #scandinavian #homedecor #aesthetic',
    hoursAgo: 18
  },
  {
    author: 'alex_design',
    image_url: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=1080&q=80',
    caption: 'Curves that guide the eye into infinity. Geometry in architectural flow. 🌀🏛️ #architecture #design #geometry #perspective #art',
    hoursAgo: 36
  },

  // Elena (Culinary & Coffee)
  {
    author: 'elena_culinary',
    image_url: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=1080&q=80',
    caption: '48 hours of lamination and cold fermentation pays off in every single crispy, buttery layer. Morning perfection! 🥐☕️ #baking #pastry #croissant #foodie #artisanal',
    hoursAgo: 5
  },
  {
    author: 'elena_culinary',
    image_url: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=1080&q=80',
    caption: 'The morning ritual. Ethiopian single-origin pulled at 9 bars with notes of bergamot and jasmine. ☕️🤎 #coffee #coffeetime #latteart #espresso #morningvibes',
    hoursAgo: 20
  },
  {
    author: 'elena_culinary',
    image_url: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=1080&q=80',
    caption: 'San Marzano tomatoes, buffalo mozzarella, fresh basil, and 90 seconds at 900°F. Pure tradition. 🍕🔥 #pizza #foodie #culinaryart #italianfood #delicious',
    hoursAgo: 42
  },

  // Liam (Street Photography)
  {
    author: 'liam_visuals',
    image_url: 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=1080&q=80',
    caption: 'Blade Runner aesthetics in real life. Shinjuku after an evening downpour never disappoints the lens. 🌧️🏮 #streetphotography #tokyovibes #neon #cyberpunk #cityscape',
    hoursAgo: 6
  },
  {
    author: 'liam_visuals',
    image_url: 'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?auto=format&fit=crop&w=1080&q=80',
    caption: 'Chasing light through the avenues of Manhattan. New York energy is electric at 6 PM. 🚕🌇 #nyc #streetphotography #urban #goldenhour #newyorkcity',
    hoursAgo: 22
  },
  {
    author: 'liam_visuals',
    image_url: 'https://images.unsplash.com/photo-1517649763962-0c623266ddc0?auto=format&fit=crop&w=1080&q=80',
    caption: 'Faces in transit. The unspoken choreography of public transport. 🚇📷 #streetlife #streetphotography #moodygrams #cinematic #city',
    hoursAgo: 48
  },

  // Aria (Nature & Wilderness)
  {
    author: 'aria_nature',
    image_url: 'https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=1080&q=80',
    caption: 'Sunbeams breaking through the morning canopy in the Cascades. Deep breaths and pine scent. 🌲✨ #nature #wilderness #mountains #forest #peaceful',
    hoursAgo: 7
  },
  {
    author: 'aria_nature',
    image_url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1080&q=80',
    caption: 'A 14-mile hike that ended in this view. Water so still it mirrored the sky like glass. 🏔️💧 #hiking #explore #landscape #alpine #nature',
    hoursAgo: 25
  },
  {
    author: 'aria_nature',
    image_url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1080&q=80',
    caption: 'Zero light pollution out in Moab. When you look up and remember how vast the universe really is. 🌌✨ #astrophotography #milkyway #desert #stargazing #nightsky',
    hoursAgo: 50
  },

  // Marcus (Tech & Code)
  {
    author: 'marcus_tech',
    image_url: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=1080&q=80',
    caption: 'Late night sprint. Shipping new features while the city sleeps. Mechanical switches clicking in cadence. 💻⚡️ #techlife #developer #desksetup #coding #workspace',
    hoursAgo: 8
  },
  {
    author: 'marcus_tech',
    image_url: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=1080&q=80',
    caption: 'Gateron oil kings lubed and filmed. Sound test coming up. Typing feels like butter. ⌨️🎙️ #mechkeys #mechanicalkeyboard #setup #custom #gear',
    hoursAgo: 26
  },
  {
    author: 'marcus_tech',
    image_url: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1080&q=80',
    caption: 'Silicon and copper traces. The physical substrate of intelligence. 🤖🔌 #technology #engineering #hardware #cyberpunk #future',
    hoursAgo: 55
  },

  // Chloe (Fitness & Movement)
  {
    author: 'chloe_fitness',
    image_url: 'https://images.unsplash.com/photo-1483721074577-83296238b684?auto=format&fit=crop&w=1080&q=80',
    caption: '7 miles before 8 AM. Nothing clears the head quite like salt air and uphill strides. 🏃‍♀️🌊 #running #fitness #morningroutine #trailrunning #healthylifestyle',
    hoursAgo: 9
  },
  {
    author: 'chloe_fitness',
    image_url: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=1080&q=80',
    caption: 'Grounding session. Lengthening, breathing, and finding alignment from within. 🧘‍♀️🌿 #yoga #pilates #wellness #mindfulness #selfcare',
    hoursAgo: 30
  },
  {
    author: 'chloe_fitness',
    image_url: 'https://images.unsplash.com/photo-1511690656952-34342bb7c2f2?auto=format&fit=crop&w=1080&q=80',
    caption: 'Fueling post-workout. Spirulina, mango, almond milk, and antioxidant berries. 🫐🥑 #nutrition #smoothiebowl #healthyfood #plantbased #eatwell',
    hoursAgo: 60
  },

  // Mateo (Sound & Vinyl)
  {
    author: 'mateo_sound',
    image_url: 'https://images.unsplash.com/photo-1539185441755-769473a23570?auto=format&fit=crop&w=1080&q=80',
    caption: "Miles Davis 'Kind of Blue' spinning on the vintage Technics. Analog warmth is a feeling you can't compress. 🎷🎶 #vinyl #audiophile #jazz #musiclover #vintagesound",
    hoursAgo: 10
  },
  {
    author: 'mateo_sound',
    image_url: 'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?auto=format&fit=crop&w=1080&q=80',
    caption: 'Crafting chord progressions on the Juno-106. Late night frequencies hit different. 🎹🎧 #musicproducer #synthwave #homestudio #beats #creativity',
    hoursAgo: 34
  },
  {
    author: 'mateo_sound',
    image_url: 'https://images.unsplash.com/photo-1483412033650-1015ddeb83d1?auto=format&fit=crop&w=1080&q=80',
    caption: 'Sunday spent crate digging in Berlin. Found a rare Japanese press of Casiopea! 🇯🇵📻 #cratedigging #vinyl #records #music #discovery',
    hoursAgo: 65
  },

  // Maya (Ceramics & Plants)
  {
    author: 'maya_art',
    image_url: 'https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?auto=format&fit=crop&w=1080&q=80',
    caption: 'Fresh off the wheel. Embracing organic wobbles and subtle finger marks. Wabi-sabi in clay. 🪴🏺 #ceramics #pottery #handmade #slowliving #artisan',
    hoursAgo: 11
  },
  {
    author: 'maya_art',
    image_url: 'https://images.unsplash.com/photo-1463320726281-696a485928c7?auto=format&fit=crop&w=1080&q=80',
    caption: 'Watering morning in the jungle corner. New unfurling leaf on the Monstera deliciosa! 🌿☀️ #plantlover #urbanjungle #botanical #plantparent #indoorplants',
    hoursAgo: 38
  },

  // Oliver (Style & Fashion)
  {
    author: 'oliver_style',
    image_url: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=1080&q=80',
    caption: 'Wool textures and structured shoulders. Layering season is officially here. 🧥🌧️ #streetstyle #mensfashion #tailoring #londonstyle #ootd',
    hoursAgo: 12
  },
  {
    author: 'oliver_style',
    image_url: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=1080&q=80',
    caption: 'Detail matters. Vintage mechanical chronograph paired with hand-stitched Tuscan leather. ⌚️🖤 #details #accessories #vintage #minimalism #style',
    hoursAgo: 40
  }
];

// Conversational comments between personas
const SAMPLE_COMMENTS = [
  'That composition is absolutely stunning! 😍',
  'The tones and lighting here are unmatched 👏',
  'Need to visit this spot immediately! Adding to bucket list 📌',
  'Incredible shot, what lens did you use for this?',
  'This is so calming to look at. Beautiful work ✨',
  'Pure aesthetic perfection. Love your work as always!',
  'The details on this are insane 🔥',
  'Saved this post for weekend inspiration! 🙌',
  'You captured the mood so well here!',
  'Such peaceful vibes 🌿'
];

// Active 24h stories
const SEED_STORIES = [
  {
    author: 'sophia_wander',
    media_url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=720&q=80'
  },
  {
    author: 'alex_design',
    media_url: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=720&q=80'
  },
  {
    author: 'elena_culinary',
    media_url: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=720&q=80'
  },
  {
    author: 'liam_visuals',
    media_url: 'https://images.unsplash.com/photo-1514565131-fce0801e5785?auto=format&fit=crop&w=720&q=80'
  },
  {
    author: 'aria_nature',
    media_url: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=720&q=80'
  },
  {
    author: 'chloe_fitness',
    media_url: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=720&q=80'
  },
  {
    author: 'mateo_sound',
    media_url: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=720&q=80'
  },
  {
    author: 'maya_art',
    media_url: 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=720&q=80'
  }
];

async function seed() {
  console.log('🌱 Starting Realistic Feeds & Personas Seeding...');
  const defaultPasswordHash = await bcrypt.hash('Password123!', SALT_ROUNDS);
  const userMap = {};

  // 1. Insert/Update 10 Personas
  for (const p of PERSONAS) {
    const userRes = await pool.query(
      `INSERT INTO users (username, email, password_hash, full_name, bio, avatar_url)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (username) DO UPDATE SET
         full_name = EXCLUDED.full_name,
         bio = EXCLUDED.bio,
         avatar_url = EXCLUDED.avatar_url
       RETURNING id, username`,
      [p.username, p.email, defaultPasswordHash, p.full_name, p.bio, p.avatar_url]
    );
    userMap[p.username] = userRes.rows[0].id;
    console.log(`  👤 User ready: @${p.username} (ID: ${userRes.rows[0].id})`);
  }

  const userIds = Object.values(userMap);

  // 2. Establish Social Follow Connections
  for (let i = 0; i < userIds.length; i++) {
    for (let j = 0; j < userIds.length; j++) {
      if (i !== j && (i + j) % 2 === 0) {
        await pool.query(
          `INSERT INTO follows (follower_id, following_id)
           VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
          [userIds[i], userIds[j]]
        );
      }
    }
  }
  console.log('  🤝 Follow social graph established');

  // 3. Insert Posts & Extract Hashtags
  const createdPostIds = [];

  for (const post of SEED_POSTS) {
    const authorId = userMap[post.author];
    if (!authorId) continue;

    // Check if post already exists with this image to avoid duplicate spam
    const existing = await pool.query(
      `SELECT id FROM posts WHERE user_id = $1 AND image_url = $2 LIMIT 1`,
      [authorId, post.image_url]
    );

    let postId;
    if (existing.rows.length > 0) {
      postId = existing.rows[0].id;
    } else {
      const createdTime = new Date(Date.now() - post.hoursAgo * 60 * 60 * 1000);
      const postRes = await pool.query(
        `INSERT INTO posts (user_id, image_url, caption, created_at)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [authorId, post.image_url, post.caption, createdTime]
      );
      postId = postRes.rows[0].id;
    }

    createdPostIds.push({ id: postId, authorId });

    // Parse and register hashtags
    const tagMatches = post.caption.match(/#([a-zA-Z0-9_]+)/g);
    if (tagMatches) {
      const uniqueTags = [...new Set(tagMatches.map(t => t.slice(1).toLowerCase()))];
      for (const tag of uniqueTags) {
        const tagRes = await pool.query(
          `INSERT INTO hashtags (name)
           VALUES ($1)
           ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
           RETURNING id`,
          [tag]
        );
        const hashtagId = tagRes.rows[0].id;

        await pool.query(
          `INSERT INTO post_hashtags (post_id, hashtag_id)
           VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
          [postId, hashtagId]
        );
      }
    }
  }
  console.log(`  📸 ${createdPostIds.length} aesthetic posts seeded with hashtags!`);

  // 4. Generate Mutual Likes (15-60 likes per post)
  let totalLikes = 0;
  for (const { id: postId, authorId } of createdPostIds) {
    // Pick random subset of users to like this post
    for (const likerId of userIds) {
      if (Math.random() > 0.35) { // 65% chance each user likes this post
        const res = await pool.query(
          `INSERT INTO likes (user_id, post_id)
           VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
          [likerId, postId]
        );
        if (res.rowCount > 0) totalLikes++;
      }
    }
  }
  console.log(`  ❤️ Added ${totalLikes} realistic likes across all posts!`);

  // 5. Generate Conversational Comments
  let totalComments = 0;
  for (let idx = 0; idx < createdPostIds.length; idx++) {
    const { id: postId, authorId } = createdPostIds[idx];
    const commentCount = (idx % 4) + 1; // 1 to 4 comments per post
    for (let c = 0; c < commentCount; c++) {
      const commenterId = userIds[(idx + c + 1) % userIds.length];
      if (commenterId === authorId) continue;
      const text = SAMPLE_COMMENTS[(idx * 3 + c) % SAMPLE_COMMENTS.length];
      const commentTime = new Date(Date.now() - (idx + 1) * 35 * 60 * 1000);

      await pool.query(
        `INSERT INTO comments (user_id, post_id, comment_text, created_at)
         VALUES ($1, $2, $3, $4)`,
        [commenterId, postId, text, commentTime]
      );
      totalComments++;
    }
  }
  console.log(`  💬 Added ${totalComments} realistic comments across posts!`);

  // 6. Seed Active 24-Hour Stories
  let totalStories = 0;
  for (const story of SEED_STORIES) {
    const creatorId = userMap[story.author];
    if (!creatorId) continue;

    // Check if creator already has active story
    const existingStory = await pool.query(
      `SELECT id FROM stories WHERE user_id = $1 AND expires_at > CURRENT_TIMESTAMP LIMIT 1`,
      [creatorId]
    );

    if (existingStory.rows.length === 0) {
      await pool.query(
        `INSERT INTO stories (user_id, media_url, created_at, expires_at)
         VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '24 hours')`,
        [creatorId, story.media_url]
      );
      totalStories++;
    }
  }
  console.log(`  ⚡️ Seeded ${totalStories} active 24-hour stories into the Story Tray!`);

  console.log('✅ Seeding completed successfully!');
  await pool.end();
}

seed().catch((err) => {
  console.error('❌ Seeding error:', err);
  pool.end();
  process.exit(1);
});
