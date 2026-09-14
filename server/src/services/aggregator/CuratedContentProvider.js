/**
 * server/src/services/aggregator/CuratedContentProvider.js
 * ========================================================
 * Curated Multi-Category Live Discovery Provider with Rotating Batch Architecture
 * 
 * Provides an extensive, diverse catalog of high-resolution media across all major verticals:
 * - Entertainment (Cinema, Festivals, Vinyl, Broadway, Concerts, Anime)
 * - Jokes & Memes (Developer humor, Pets, Relatable life, Coffee, Office)
 * - Education & Science (Deep Space, Marine Biology, Quantum Physics, Archaeology)
 * - Sports (Football, Formula 1, Basketball, Surfing, Tennis, Skiing)
 * - News & Innovation (Clean Energy, Robotics, Fusion, Aerospace, AI)
 * - Travel & Photography (Kyoto, Amalfi, Tromsø, Santorini, Petra, Swiss Alps)
 * 
 * Guarantees that refreshing the feed or story tray rotates to a completely
 * distinct cohort of posts and stories, avoiding duplicate content.
 */

const BaseFeedProvider = require('./BaseFeedProvider');

const CURATED_MEDIA_BANK = [
  // ==========================================
  // 1. ENTERTAINMENT (12 distinct items)
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
  {
    id: 'ent_indie_rock_tour',
    author: 'The Electric Echo',
    username: 'indie_frequency',
    avatar: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=400&q=80',
    caption: 'Soundcheck in Manchester before tonight\'s sold-out headline show 🎸 Distortion pedals dialed in, reverb set to infinity.',
    imageUrl: 'https://images.unsplash.com/photo-1511735111819-9a3f7709049c?auto=format&fit=crop&w=1200&q=80',
    category: 'entertainment',
    tags: ['indierock', 'band', 'soundcheck', 'live', 'guitar'],
    sourceUrl: 'https://unsplash.com/photos/guitarist-live'
  },
  {
    id: 'ent_broadway_curtain',
    author: 'Broadway Insider',
    username: 'broadway_stage',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
    caption: 'Curtain call emotion on 42nd Street 🎭 When 1,800 people stand up together, the theater energy is unlike anything else in this world.',
    imageUrl: 'https://images.unsplash.com/photo-1507676184212-d03ab07a01bf?auto=format&fit=crop&w=1200&q=80',
    category: 'entertainment',
    tags: ['broadway', 'theatre', 'musical', 'curtaincall', 'nyc'],
    sourceUrl: 'https://unsplash.com/photos/theatre-hall'
  },
  {
    id: 'ent_rooftop_cinema',
    author: 'Skyline Flicks',
    username: 'rooftop_flicks',
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=400&q=80',
    caption: 'Summer rooftop cinema screening under twilight skyline 🍿🌆 Classic 35mm film projected against the downtown evening breeze.',
    imageUrl: 'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?auto=format&fit=crop&w=1200&q=80',
    category: 'entertainment',
    tags: ['rooftop', 'cinema', 'summer', 'cityvibes', 'movies'],
    sourceUrl: 'https://unsplash.com/photos/outdoor-cinema'
  },
  {
    id: 'ent_dj_festival_deck',
    author: 'Pulse Electronic',
    username: 'pulse_electronic',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80',
    caption: 'Sunset mainstage transition into lasers and pyro 🔥 When the melody drops after a 3-minute crescendo, pure euphoria.',
    imageUrl: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=1200&q=80',
    category: 'entertainment',
    tags: ['edm', 'electronic', 'festival', 'dj', 'nightlife'],
    sourceUrl: 'https://unsplash.com/photos/dj-crowd'
  },
  {
    id: 'ent_orchestra_symphony',
    author: 'Philharmonic Voices',
    username: 'symphony_echoes',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80',
    caption: 'Rehearsing Mahler\'s Symphony No. 2 with 110 musicians in acoustic harmony 🎻 Every bow movement perfectly synchronized.',
    imageUrl: 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?auto=format&fit=crop&w=1200&q=80',
    category: 'entertainment',
    tags: ['classical', 'orchestra', 'symphony', 'acoustic', 'violin'],
    sourceUrl: 'https://unsplash.com/photos/orchestra-hall'
  },
  {
    id: 'ent_retro_synthwave',
    author: 'Neon Grid',
    username: 'retro_synthetics',
    avatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=400&q=80',
    caption: 'All analog hardware synth jam at 2 AM 🎹 Purple LED glow, tape delay oscillation, and 80s drum machines bouncing.',
    imageUrl: 'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?auto=format&fit=crop&w=1200&q=80',
    category: 'entertainment',
    tags: ['synthwave', 'retrowave', 'synthesizer', 'studio', 'analog'],
    sourceUrl: 'https://unsplash.com/photos/audio-synthesizer'
  },
  {
    id: 'ent_anime_expo_japan',
    author: 'Tokyo Pop Lens',
    username: 'tokyo_otaku_feed',
    avatar: 'https://images.unsplash.com/photo-1543610892-0b1f7e6d8ac1?auto=format&fit=crop&w=400&q=80',
    caption: 'Akihabara grand animation festival showcase! 🎌 Incredible handcrafted character exhibits celebrating three decades of iconic storytelling.',
    imageUrl: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=1200&q=80',
    category: 'entertainment',
    tags: ['anime', 'akihabara', 'japan', 'popculture', 'manga'],
    sourceUrl: 'https://unsplash.com/photos/anime-exhibit'
  },
  {
    id: 'ent_film_camera_set',
    author: 'Director\'s Viewfinder',
    username: 'directors_cut',
    avatar: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=400&q=80',
    caption: 'Golden hour dolly shot on 65mm anamorphic glass 🎥 Light spilling through the warehouse windows just in time for take 3.',
    imageUrl: 'https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=1200&q=80',
    category: 'entertainment',
    tags: ['filmmaking', 'cinema', 'cinematography', 'camera', 'setlife'],
    sourceUrl: 'https://unsplash.com/photos/film-camera'
  },
  {
    id: 'ent_jazz_cellar_night',
    author: 'Blue Note Chronicles',
    username: 'blue_note_vibes',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
    caption: 'Impromptu saxophone jam in a Greenwich Village basement 🎷 Notes floating through dim candlelight and vintage brass.',
    imageUrl: 'https://images.unsplash.com/photo-1511192336575-5a79af67a629?auto=format&fit=crop&w=1200&q=80',
    category: 'entertainment',
    tags: ['jazz', 'saxophone', 'live', 'mood', 'music'],
    sourceUrl: 'https://unsplash.com/photos/jazz-player'
  },

  // ==========================================
  // 2. JOKES & HUMOR (12 distinct items)
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
  {
    id: 'joke_css_centering',
    author: 'Front-End Therapy',
    username: 'dev_banter',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
    caption: '4 hours in quantum physics: understands string theory. 4 hours in CSS: div is now somewhere in the Atlantic Ocean 🚢😵',
    imageUrl: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=1200&q=80',
    category: 'jokes',
    tags: ['css', 'frontend', 'humor', 'developer', 'webdev'],
    sourceUrl: 'https://unsplash.com/photos/code-editor'
  },
  {
    id: 'joke_dog_zoom_call',
    author: 'Remote Work Pets',
    username: 'goodboy_bytes',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80',
    caption: 'Chief Barketing Officer taking meeting notes on Q3 treat distribution strategy 🐶💻 Very serious professional.',
    imageUrl: 'https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?auto=format&fit=crop&w=1200&q=80',
    category: 'jokes',
    tags: ['dog', 'remotework', 'funny', 'wfh', 'pets'],
    sourceUrl: 'https://unsplash.com/photos/dog-laptop'
  },
  {
    id: 'joke_rubber_duck',
    author: 'Code Confessions',
    username: 'stack_overflowed',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80',
    caption: 'Rubber duck listening to me explain why my O(n^4) recursive function is actually an avant-garde architectural choice 🦆😂',
    imageUrl: 'https://images.unsplash.com/photo-1588702547923-7093a6c3ba33?auto=format&fit=crop&w=1200&q=80',
    category: 'jokes',
    tags: ['rubberduck', 'devhumor', 'programming', 'bug', 'jokes'],
    sourceUrl: 'https://unsplash.com/photos/rubber-duck'
  },
  {
    id: 'joke_wifi_down',
    author: 'Internet Chronicles',
    username: 'tech_lolz',
    avatar: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=400&q=80',
    caption: 'Wi-Fi goes out for 3 minutes: Families wandering living rooms trying to remember what siblings look like without screen glow 📶😱',
    imageUrl: 'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?auto=format&fit=crop&w=1200&q=80',
    category: 'jokes',
    tags: ['wifi', 'relatable', 'technology', 'meme', 'comedy'],
    sourceUrl: 'https://unsplash.com/photos/router-device'
  },
  {
    id: 'joke_git_push_force',
    author: 'Version Control Fails',
    username: 'git_happens',
    avatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=400&q=80',
    caption: 'Senior dev asking in Slack who just ran `git push --force origin main`: Everyone suddenly going into "Do Not Disturb" mode 🏃‍♂️💨',
    imageUrl: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=1200&q=80',
    category: 'jokes',
    tags: ['git', 'gitpush', 'coding', 'senior', 'workhumor'],
    sourceUrl: 'https://unsplash.com/photos/laptop-dark'
  },
  {
    id: 'joke_gym_january',
    author: 'Fitness Realist',
    username: 'relatable_daily',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80',
    caption: 'Me walking past the gym treadmill on my way to grab pizza after doing 4 jumping jacks: "Gotta fuel the recovery" 🍕💪',
    imageUrl: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=1200&q=80',
    category: 'jokes',
    tags: ['gym', 'fitnessmeme', 'relatable', 'humor', 'pizza'],
    sourceUrl: 'https://unsplash.com/photos/gym-weights'
  },
  {
    id: 'joke_dark_mode_burn',
    author: 'Night Owls Collective',
    username: 'darkmode_gang',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
    caption: 'Accidentally opening a light-mode documentation site at 3:15 AM in a pitch-black room: Instant solar flare retina reset ⚡️👀',
    imageUrl: 'https://images.unsplash.com/photo-1508873696983-2df57036476b?auto=format&fit=crop&w=1200&q=80',
    category: 'jokes',
    tags: ['darkmode', 'nightowl', 'meme', 'developer', 'eyes'],
    sourceUrl: 'https://unsplash.com/photos/neon-sign'
  },
  {
    id: 'joke_unread_emails',
    author: 'Inbox Zero Dreamer',
    username: 'inbox_anxiety',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
    caption: '18,492 unread newsletter emails: "I\'ll definitely read all of these over the long weekend" 📩🤥 Narrator: They did not.',
    imageUrl: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80',
    category: 'jokes',
    tags: ['email', 'officehumor', 'procrastination', 'relatable'],
    sourceUrl: 'https://unsplash.com/photos/desk-laptop'
  },
  {
    id: 'joke_bug_feature',
    author: 'Software Alchemy',
    username: 'undocumented_feature',
    avatar: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=400&q=80',
    caption: 'Client: "Why does the button bounce when clicked?" Dev: "That is an organic micro-interaction delight feature." ✨😅',
    imageUrl: 'https://images.unsplash.com/photo-1515879218367-8466d910aaa4?auto=format&fit=crop&w=1200&q=80',
    category: 'jokes',
    tags: ['bug', 'feature', 'design', 'software', 'comedy'],
    sourceUrl: 'https://unsplash.com/photos/programming-code'
  },

  // ==========================================
  // 3. EDUCATION & SCIENCE (12 distinct items)
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
    id: 'edu_quantum_chip',
    author: 'Quantum Frontiers',
    username: 'quantum_lab',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
    caption: 'Inside a superconducting dilution refrigerator cooled to 15 millikelvin (-459.6°F) — colder than deep space vacuum itself ⚛️❄️ Superposition at work.',
    imageUrl: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?auto=format&fit=crop&w=1200&q=80',
    category: 'education',
    tags: ['quantum', 'physics', 'computing', 'science', 'innovation'],
    sourceUrl: 'https://unsplash.com/photos/quantum-hardware'
  },
  {
    id: 'edu_james_webb_galaxy',
    author: 'Deep Space Lens',
    username: 'deep_space_lens',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80',
    caption: 'Light from this ancient cluster left its stars 13.1 billion years ago, just 700 million years after the Big Bang 🔭 Gravitational lensing bent spacetime around it.',
    imageUrl: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?auto=format&fit=crop&w=1200&q=80',
    category: 'education',
    tags: ['space', 'astrophysics', 'galaxy', 'jwst', 'cosmos'],
    sourceUrl: 'https://unsplash.com/photos/galaxy-cluster'
  },
  {
    id: 'edu_bioluminescence_bay',
    author: 'Micro Cosmos Project',
    username: 'micro_universe',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
    caption: 'Every stroke of the kayak illuminates millions of Pyrodinium dinoflagellates glowing electric neon cyan 💡 Single-celled marvels of natural photonics.',
    imageUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
    category: 'education',
    tags: ['bioluminescence', 'biology', 'nature', 'science', 'ocean'],
    sourceUrl: 'https://unsplash.com/photos/glowing-plankton'
  },
  {
    id: 'edu_aurora_magnetosphere',
    author: 'Geophysical Observatory',
    username: 'astro_physics',
    avatar: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=400&q=80',
    caption: 'The Aurora Borealis is literally our planetary shield in action 🌌 Solar wind electrons colliding with oxygen atoms at 100km altitude emit emerald light.',
    imageUrl: 'https://images.unsplash.com/photo-1517411032315-54ef2cb783bb?auto=format&fit=crop&w=1200&q=80',
    category: 'education',
    tags: ['aurora', 'earth', 'geomagnetism', 'science', 'atmosphere'],
    sourceUrl: 'https://unsplash.com/photos/northern-lights-green'
  },
  {
    id: 'edu_geothermal_iceland',
    author: 'Earth Systems Institute',
    username: 'earth_wonders',
    avatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=400&q=80',
    caption: 'Where two continental plates pull apart: The Mid-Atlantic Ridge exposes active magma chambers powering 100% of local municipal energy 🌋💧',
    imageUrl: 'https://images.unsplash.com/photo-1504893524553-b855bce32c67?auto=format&fit=crop&w=1200&q=80',
    category: 'education',
    tags: ['geology', 'earthscience', 'volcano', 'geothermal', 'nature'],
    sourceUrl: 'https://unsplash.com/photos/iceland-geyser'
  },
  {
    id: 'edu_ancient_pompeii',
    author: 'Archaeology Uncovered',
    username: 'history_unveiled',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80',
    caption: 'Recent subterranean excavation uncovers a 2,000-year-old fresco preserved under volcanic ash with pigments as vivid as yesterday 🏛️🎨',
    imageUrl: 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?auto=format&fit=crop&w=1200&q=80',
    category: 'education',
    tags: ['archaeology', 'history', 'rome', 'pompeii', 'art'],
    sourceUrl: 'https://unsplash.com/photos/roman-ruins'
  },
  {
    id: 'edu_dna_crispr_lab',
    author: 'Genomics Frontier',
    username: 'bio_innovate',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
    caption: 'Fluorescence microscopy showing Cas9 enzyme homing onto target DNA sequence 🧬 Molecular scissors enabling precision agriculture and disease cures.',
    imageUrl: 'https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?auto=format&fit=crop&w=1200&q=80',
    category: 'education',
    tags: ['genetics', 'crispr', 'biotech', 'dna', 'science'],
    sourceUrl: 'https://unsplash.com/photos/biology-lab'
  },
  {
    id: 'edu_particle_collider',
    author: 'CERN Chronicles',
    username: 'cern_chronicles',
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=400&q=80',
    caption: '100 meters beneath the Franco-Swiss border: 27 kilometers of superconducting magnets accelerating protons at 99.999999% the speed of light ⚡️⚛️',
    imageUrl: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80',
    category: 'education',
    tags: ['cern', 'physics', 'lhc', 'particles', 'science'],
    sourceUrl: 'https://unsplash.com/photos/accelerator-tunnel'
  },
  {
    id: 'edu_rainforest_canopy',
    author: 'Biodiversity Alliance',
    username: 'flora_fauna',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80',
    caption: 'The Amazon canopy hosts 10% of all known species on Earth 🌿 A single hectare can contain over 750 tree types that collectively regulate regional rainfall.',
    imageUrl: 'https://images.unsplash.com/photo-1511497584788-87676104235f?auto=format&fit=crop&w=1200&q=80',
    category: 'education',
    tags: ['rainforest', 'ecology', 'biodiversity', 'canopy', 'nature'],
    sourceUrl: 'https://unsplash.com/photos/forest-mist'
  },
  {
    id: 'edu_antarctic_ice_core',
    author: 'Polar Climate Lab',
    username: 'polar_science',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80',
    caption: 'Trapped inside this glacial ice core are bubbles of Earth\'s atmosphere from 400,000 years ago ❄️ Pure physical archives of historical carbon cycles.',
    imageUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1200&q=80',
    category: 'education',
    tags: ['antarctica', 'climate', 'icecore', 'science', 'geology'],
    sourceUrl: 'https://unsplash.com/photos/iceberg-ocean'
  },

  // ==========================================
  // 4. SPORTS (12 distinct items)
  // ==========================================
  {
    id: 'sport_overhead_kick',
    author: 'Stadium Pulse',
    username: 'arena_sports',
    avatar: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=400&q=80',
    caption: 'Champions League 93rd-minute winner! ⚽️🔥 Perfect airborne bicycle kick into the top postage stamp corner. The entire stadium erupted into delirium.',
    imageUrl: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=1200&q=80',
    category: 'sports',
    tags: ['football', 'soccer', 'ucl', 'championsleague', 'goal'],
    sourceUrl: 'https://unsplash.com/photos/soccer-stadium'
  },
  {
    id: 'sport_f1_monaco_apex',
    author: 'Speed Chronicles',
    username: 'speed_chronicles',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
    caption: 'Clipping the Swimming Pool chicane curb at 220 km/h with millimeter precision 🏎️💨 In Monaco, contact with the barrier is never forgiven.',
    imageUrl: 'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?auto=format&fit=crop&w=1200&q=80',
    category: 'sports',
    tags: ['f1', 'formula1', 'monaco', 'racing', 'motorsport'],
    sourceUrl: 'https://unsplash.com/photos/race-car'
  },
  {
    id: 'sport_buzzer_beater',
    author: 'Court Vision',
    username: 'court_vision',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80',
    caption: 'Game 7. 0.4 seconds on the clock. Fadeaway jumper over two defenders swishes through the net as the red backboard lights flash 🏀💥 History.',
    imageUrl: 'https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=1200&q=80',
    category: 'sports',
    tags: ['nba', 'basketball', 'buzzerbeater', 'hoops', 'clutch'],
    sourceUrl: 'https://unsplash.com/photos/basketball-dunk'
  },
  {
    id: 'sport_tour_de_france',
    author: 'Peloton Pulse',
    username: 'peloton_pulse',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
    caption: 'Climbing Col du Tourmalet in heavy mountain fog 🚴‍♂️ 14% gradients separating the yellow jersey contenders in agonizing silence.',
    imageUrl: 'https://images.unsplash.com/photo-1517649763962-0c623266ddc0?auto=format&fit=crop&w=1200&q=80',
    category: 'sports',
    tags: ['cycling', 'tourdefrance', 'pyrenees', 'endurance', 'peloton'],
    sourceUrl: 'https://unsplash.com/photos/cycling-peloton'
  },
  {
    id: 'sport_nazare_surf',
    author: 'Big Wave Society',
    username: 'ocean_riders',
    avatar: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=400&q=80',
    caption: 'Towing into a 70-foot monster at Praia do Norte, Nazaré 🌊🏄 The Atlantic canyon channels unfathomable hydro-kinetic power.',
    imageUrl: 'https://images.unsplash.com/photo-1502680390469-be75c86b636f?auto=format&fit=crop&w=1200&q=80',
    category: 'sports',
    tags: ['surfing', 'nazare', 'bigwave', 'ocean', 'adrenaline'],
    sourceUrl: 'https://unsplash.com/photos/surfer-wave'
  },
  {
    id: 'sport_wimbledon_final',
    author: 'Grand Slam Review',
    username: 'grand_slam_daily',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80',
    caption: 'Centre Court cathedral hush before the match-point serve 🎾 4 hours and 42 minutes of grass-court baseline chess.',
    imageUrl: 'https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?auto=format&fit=crop&w=1200&q=80',
    category: 'sports',
    tags: ['tennis', 'wimbledon', 'grandslam', 'centrecourt', 'sport'],
    sourceUrl: 'https://unsplash.com/photos/tennis-court'
  },
  {
    id: 'sport_freeride_powder',
    author: 'Alpine Descent',
    username: 'peak_powder',
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=400&q=80',
    caption: 'Heli-drop on an untouched Alaskan spine ridge 🏂❄️ Laying down first tracks in 4 feet of champagne powder at 45-degree pitch.',
    imageUrl: 'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?auto=format&fit=crop&w=1200&q=80',
    category: 'sports',
    tags: ['snowboard', 'skiing', 'alaska', 'powder', 'freeride'],
    sourceUrl: 'https://unsplash.com/photos/snowboarding'
  },
  {
    id: 'sport_sprint_photo_finish',
    author: 'Track & Field Wire',
    username: 'track_and_field',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80',
    caption: 'Olympic 100m final separated by 0.003 seconds at the line 🏃‍♂️💨 9.77s of explosive human biomechanics at maximum velocity.',
    imageUrl: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=1200&q=80',
    category: 'sports',
    tags: ['athletics', 'sprint', '100m', 'olympics', 'speed'],
    sourceUrl: 'https://unsplash.com/photos/track-running'
  },
  {
    id: 'sport_boxing_bell',
    author: 'Ringside Pulse',
    username: 'ringside_pulse',
    avatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=400&q=80',
    caption: 'Round 12 final seconds in a unified championship clash 🥊 Sweat flying under the arena spotlights as the final bell rings.',
    imageUrl: 'https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?auto=format&fit=crop&w=1200&q=80',
    category: 'sports',
    tags: ['boxing', 'combat', 'championship', 'ringside', 'heart'],
    sourceUrl: 'https://unsplash.com/photos/boxing-ring'
  },
  {
    id: 'sport_skate_bowl',
    author: 'Concrete Flow',
    username: 'concrete_wave',
    avatar: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=400&q=80',
    caption: 'Golden hour pool carve coping grind 🛹 Sunset back-lighting the concrete park as friends cheer every transition.',
    imageUrl: 'https://images.unsplash.com/photo-1520045884210-9b48f654b9f2?auto=format&fit=crop&w=1200&q=80',
    category: 'sports',
    tags: ['skateboarding', 'bowl', 'skate', 'street', 'sunset'],
    sourceUrl: 'https://unsplash.com/photos/skateboard-jump'
  },
  {
    id: 'sport_marathon_finish',
    author: 'Endurance Life',
    username: 'endurance_life',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
    caption: 'Crossing Boylston Street after 26.2 grueling miles 🏃‍♀️ The tears of unyielding dedication after 6 months of 5 AM training.',
    imageUrl: 'https://images.unsplash.com/photo-1452626038306-9aae5e071dd3?auto=format&fit=crop&w=1200&q=80',
    category: 'sports',
    tags: ['marathon', 'running', 'endurance', 'boston', 'finishline'],
    sourceUrl: 'https://unsplash.com/photos/marathon-runner'
  },
  {
    id: 'sport_climbing_el_capitan',
    author: 'Vertical Summit',
    username: 'vertical_summit',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80',
    caption: 'Pitch 14 on El Capitan at dawn 🧗‍♂️ 3,000 feet of sheer granite underneath the portaledge. Yosemite valley glowing below.',
    imageUrl: 'https://images.unsplash.com/photo-1522163182402-834f871fd851?auto=format&fit=crop&w=1200&q=80',
    category: 'sports',
    tags: ['climbing', 'yosemite', 'elcapitan', 'adventure', 'mountains'],
    sourceUrl: 'https://unsplash.com/photos/rock-climber'
  },

  // ==========================================
  // 5. NEWS & INNOVATION (12 distinct items)
  // ==========================================
  {
    id: 'news_green_energy_grid',
    author: 'Global Brief',
    username: 'world_news_wire',
    avatar: 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&w=400&q=80',
    caption: 'Milestone reached: Solar & wind combined supplied over 35% of continental electricity demand for the first quarter in history 🌍⚡️ Clean transition accelerating.',
    imageUrl: 'https://images.unsplash.com/photo-1509391365360-2e959784a276?auto=format&fit=crop&w=1200&q=80',
    category: 'news',
    tags: ['news', 'energy', 'climate', 'sustainability', 'solar'],
    sourceUrl: 'https://unsplash.com/photos/solar-farm'
  },
  {
    id: 'news_humanoid_robot',
    author: 'Tech Bulletin',
    username: 'tech_bulletin',
    avatar: 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&w=400&q=80',
    caption: 'Next-generation bipedal robotics system completes 2,000 continuous hours of autonomous logistics sorting without manual intervention 🤖📦',
    imageUrl: 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&w=1200&q=80',
    category: 'news',
    tags: ['tech', 'robotics', 'ai', 'automation', 'innovation'],
    sourceUrl: 'https://unsplash.com/photos/humanoid-robot'
  },
  {
    id: 'news_fusion_milestone',
    author: 'Energy Frontier',
    username: 'future_grid',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
    caption: 'Tokamak magnetic fusion reactor sustains high-confinement plasma core at 100 million °C for 48 minutes, setting a world confinement record ☀️⚡️',
    imageUrl: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1200&q=80',
    category: 'news',
    tags: ['fusion', 'cleanenergy', 'physics', 'tech', 'science'],
    sourceUrl: 'https://unsplash.com/photos/fusion-reactor'
  },
  {
    id: 'news_electric_aviation',
    author: 'Aero Vanguard',
    username: 'sky_transit',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
    caption: 'First commercial regional electric airliner completes maiden zero-emission cross-country flight using solid-state batteries ✈️🔋 Aviation enters a new era.',
    imageUrl: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?auto=format&fit=crop&w=1200&q=80',
    category: 'news',
    tags: ['aviation', 'electric', 'aerospace', 'green', 'transport'],
    sourceUrl: 'https://unsplash.com/photos/airplane-sky'
  },
  {
    id: 'news_satellite_leo',
    author: 'Orbital Dispatch',
    username: 'orbital_dispatch',
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=400&q=80',
    caption: 'Reusable rocket booster successfully executes ocean barge touchdown after deploying 48 climate monitoring micro-satellites 🚀🌊',
    imageUrl: 'https://images.unsplash.com/photo-1517976487502-57501a357597?auto=format&fit=crop&w=1200&q=80',
    category: 'news',
    tags: ['space', 'rocket', 'satellite', 'aerospace', 'dispatch'],
    sourceUrl: 'https://unsplash.com/photos/rocket-launch'
  },
  {
    id: 'news_plastic_interceptor',
    author: 'Ocean Cleanse Project',
    username: 'clean_oceans',
    avatar: 'https://images.unsplash.com/photo-1518837695005-2083093ee35b?auto=format&fit=crop&w=400&q=80',
    caption: 'Autonomous solar-powered river interceptor barrier extracts its 10-millionth kilogram of ocean-bound waste 🌊♻️ Restoring marine estuaries.',
    imageUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
    category: 'news',
    tags: ['environment', 'ocean', 'cleanup', 'sustainability', 'green'],
    sourceUrl: 'https://unsplash.com/photos/ocean-waves'
  },
  {
    id: 'news_maglev_speed_record',
    author: 'High Speed Transit',
    username: 'highspeed_transit',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80',
    caption: 'Superconducting Maglev prototype breaches 620 km/h (385 mph) in low-pressure vacuum tube test track 🚄 Connecting cities in minutes.',
    imageUrl: 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?auto=format&fit=crop&w=1200&q=80',
    category: 'news',
    tags: ['maglev', 'transit', 'train', 'engineering', 'speed'],
    sourceUrl: 'https://unsplash.com/photos/modern-train'
  },
  {
    id: 'news_vertical_farming',
    author: 'AgriTech Horizon',
    username: 'agri_tech',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80',
    caption: 'Zero-pesticide urban vertical farm utilizes 95% less water while yielding 40x produce per square meter using optimized LED spectrums 🌱🏢',
    imageUrl: 'https://images.unsplash.com/photo-1530836369250-ef72a3f5cda8?auto=format&fit=crop&w=1200&q=80',
    category: 'news',
    tags: ['agriculture', 'verticalfarm', 'foodtech', 'sustainability'],
    sourceUrl: 'https://unsplash.com/photos/hydroponics'
  },
  {
    id: 'news_desalination_solar',
    author: 'Water Security Net',
    username: 'global_water',
    avatar: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=400&q=80',
    caption: 'Graphene membrane solar desalination facility delivers 50 million gallons of drinking water daily to arid coastal regions at zero emissions 💧☀️',
    imageUrl: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1200&q=80',
    category: 'news',
    tags: ['water', 'solar', 'climate', 'innovation', 'engineering'],
    sourceUrl: 'https://unsplash.com/photos/coastal-water'
  },
  {
    id: 'news_ai_medical_scan',
    author: 'BioMed Informatics',
    username: 'med_frontier',
    avatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=400&q=80',
    caption: 'New open-access multimodal clinical neural network demonstrates 98.4% diagnostic accuracy in detecting asymptomatic early stage conditions 🩺🧠',
    imageUrl: 'https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&w=1200&q=80',
    category: 'news',
    tags: ['health', 'medtech', 'ai', 'science', 'medicine'],
    sourceUrl: 'https://unsplash.com/photos/medical-scan'
  },
  {
    id: 'news_smart_microgrid',
    author: 'Clean Watts',
    username: 'clean_watts',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80',
    caption: 'Entire island archipelago completes 365 days of 100% continuous renewable operation through smart microgrids and flow battery storage 🏝️⚡️',
    imageUrl: 'https://images.unsplash.com/photo-1466611653911-95081537e5b7?auto=format&fit=crop&w=1200&q=80',
    category: 'news',
    tags: ['microgrid', 'renewables', 'windenergy', 'island', 'green'],
    sourceUrl: 'https://unsplash.com/photos/wind-turbines'
  },
  {
    id: 'news_space_station_dock',
    author: 'Commercial Spaceflight',
    username: 'aerospace_weekly',
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=400&q=80',
    caption: 'Next-generation orbital laboratory module soft-docks with International Space Station at 28,000 km/h 🛰️ Expanding commercial research capacity.',
    imageUrl: 'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?auto=format&fit=crop&w=1200&q=80',
    category: 'news',
    tags: ['iss', 'space', 'aerospace', 'orbital', 'science'],
    sourceUrl: 'https://unsplash.com/photos/earth-orbit'
  },

  // ==========================================
  // 6. TRAVEL & PHOTOGRAPHY (12 distinct items)
  // ==========================================
  {
    id: 'travel_kyoto_morning',
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
  },
  {
    id: 'travel_santorini_caldera',
    author: 'Wanderlust Lens',
    username: 'wanderlust_lens',
    avatar: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=400&q=80',
    caption: 'Golden hour sunset over Oia blue domes and volcanic caldera 🏛️🌅 Cycladic architecture gleaming against the Aegean.',
    imageUrl: 'https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?auto=format&fit=crop&w=1200&q=80',
    category: 'photography',
    tags: ['greece', 'santorini', 'caldera', 'travel', 'sunset'],
    sourceUrl: 'https://unsplash.com/photos/santorini-oia'
  },
  {
    id: 'travel_petra_jordan',
    author: 'Ancient Voyager',
    username: 'ancient_voyager',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
    caption: 'Exiting the narrow Siq gorge to see Al-Khazneh (The Treasury) carved directly into rose-red sandstone cliffs 🏜️✨ Built 2,000 years ago.',
    imageUrl: 'https://images.unsplash.com/photo-1579606032822-44df0e107e33?auto=format&fit=crop&w=1200&q=80',
    category: 'photography',
    tags: ['jordan', 'petra', 'history', 'travel', 'ancient'],
    sourceUrl: 'https://unsplash.com/photos/petra-treasury'
  },
  {
    id: 'travel_glacier_express',
    author: 'Alpine Escapes',
    username: 'alpine_escapes',
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=400&q=80',
    caption: 'Crossing the 65-meter Landwasser Viaduct aboard the Swiss Glacier Express 🇨🇭🏔️ Pure engineering marvel through winter wonderland.',
    imageUrl: 'https://images.unsplash.com/photo-1530122037265-a5f1f91d3b99?auto=format&fit=crop&w=1200&q=80',
    category: 'photography',
    tags: ['switzerland', 'alps', 'train', 'winter', 'landscape'],
    sourceUrl: 'https://unsplash.com/photos/swiss-train'
  },
  {
    id: 'travel_banff_moraine',
    author: 'Canadian Wilds',
    username: 'canadian_wilds',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80',
    caption: 'Valley of the Ten Peaks reflecting in the mineral-turquoise glacial waters of Moraine Lake at sunrise 🌲🛶 Canadian Rockies perfection.',
    imageUrl: 'https://images.unsplash.com/photo-1503614472-8c93d56e92ce?auto=format&fit=crop&w=1200&q=80',
    category: 'photography',
    tags: ['banff', 'canada', 'nature', 'mountains', 'lake'],
    sourceUrl: 'https://unsplash.com/photos/moraine-lake'
  },
  {
    id: 'travel_marrakech_souk',
    author: 'Morocco Vibes',
    username: 'morocco_vibes',
    avatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=400&q=80',
    caption: 'Sensory overload in the spice labyrinth of Marrakech Medina 🏮✨ Saffron, cumin, terracotta lanterns, and fresh mint tea.',
    imageUrl: 'https://images.unsplash.com/photo-1539020140153-e479b8c22e70?auto=format&fit=crop&w=1200&q=80',
    category: 'photography',
    tags: ['morocco', 'marrakech', 'souk', 'culture', 'travel'],
    sourceUrl: 'https://unsplash.com/photos/morocco-bazaar'
  },
  {
    id: 'travel_iceland_ice_cave',
    author: 'Nordic Frontiers',
    username: 'nordic_frontiers',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80',
    caption: 'Walking inside the sapphire-blue crystal cavern beneath Vatnajökull glacier ❄️💙 Millennia of compressed glacial ice creating natural stained glass.',
    imageUrl: 'https://images.unsplash.com/photo-1483921020237-2ff51e8e4b22?auto=format&fit=crop&w=1200&q=80',
    category: 'photography',
    tags: ['iceland', 'glacier', 'icecave', 'winter', 'adventure'],
    sourceUrl: 'https://unsplash.com/photos/ice-cave'
  },
  {
    id: 'travel_salan_de_uyuni',
    author: 'Highland Expeditions',
    username: 'highland_expeditions',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80',
    caption: 'Where heaven meets earth: Salar de Uyuni salt flat turns into the world\'s largest mirror after seasonal rainfall 🪞🌄 10,000 sq km of infinite horizon.',
    imageUrl: 'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?auto=format&fit=crop&w=1200&q=80',
    category: 'photography',
    tags: ['bolivia', 'salardeuyuni', 'landscape', 'travel', 'reflection'],
    sourceUrl: 'https://unsplash.com/photos/salt-flats'
  },
  {
    id: 'travel_cappadocia_balloons',
    author: 'Anatolia Skies',
    username: 'anatolia_skies',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
    caption: 'Over 150 hot air balloons lifting off together across the fairy chimneys of Göreme at dawn 🎈🌅 Golden light spilling across Cappadocia.',
    imageUrl: 'https://images.unsplash.com/photo-1527838832700-5059252407fa?auto=format&fit=crop&w=1200&q=80',
    category: 'photography',
    tags: ['turkey', 'cappadocia', 'balloons', 'sunrise', 'travel'],
    sourceUrl: 'https://unsplash.com/photos/hot-air-balloons'
  },
  {
    id: 'travel_havana_classic_car',
    author: 'Caribbean Chronicle',
    username: 'havana_groove',
    avatar: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=400&q=80',
    caption: '1957 turquoise convertible cruising down the Malecón with ocean spray breaking against the seawall 🚙🌊 Timeless Havana rhythm.',
    imageUrl: 'https://images.unsplash.com/photo-1506973035872-a4ec16b8e8d9?auto=format&fit=crop&w=1200&q=80',
    category: 'photography',
    tags: ['cuba', 'havana', 'classiccar', 'vintage', 'ocean'],
    sourceUrl: 'https://unsplash.com/photos/classic-car-havana'
  }
];

// 24 Unique Stories across 6 Categories (4 per category)
const CURATED_STORIES_BANK = [
  // Entertainment
  {
    id: 'story_ent_cinema_daily',
    author: 'Cinema Chronicles',
    username: 'cinema_daily',
    avatar: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=400&q=80',
    mediaUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=800&q=80',
    category: 'entertainment'
  },
  {
    id: 'story_ent_soundwave',
    author: 'Liam Vance',
    username: 'soundwave_live',
    avatar: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=400&q=80',
    mediaUrl: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=800&q=80',
    category: 'entertainment'
  },
  {
    id: 'story_ent_vinyl_notes',
    author: 'Maya Lin',
    username: 'vinyl_notes',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
    mediaUrl: 'https://images.unsplash.com/photo-1539185441755-769473a23570?auto=format&fit=crop&w=800&q=80',
    category: 'entertainment'
  },
  {
    id: 'story_ent_broadway',
    author: 'Broadway Insider',
    username: 'broadway_stage',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
    mediaUrl: 'https://images.unsplash.com/photo-1507676184212-d03ab07a01bf?auto=format&fit=crop&w=800&q=80',
    category: 'entertainment'
  },

  // Jokes
  {
    id: 'story_joke_meme_central',
    author: 'Daily Dev Memes',
    username: 'meme_central',
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=400&q=80',
    mediaUrl: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&w=800&q=80',
    category: 'jokes'
  },
  {
    id: 'story_joke_dev_banter',
    author: 'Front-End Therapy',
    username: 'dev_banter',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
    mediaUrl: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=800&q=80',
    category: 'jokes'
  },
  {
    id: 'story_joke_goodboy',
    author: 'Remote Work Pets',
    username: 'goodboy_bytes',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80',
    mediaUrl: 'https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?auto=format&fit=crop&w=800&q=80',
    category: 'jokes'
  },
  {
    id: 'story_joke_daily_giggles',
    author: 'Office Survivalist',
    username: 'daily_giggles',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
    mediaUrl: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=800&q=80',
    category: 'jokes'
  },

  // Education
  {
    id: 'story_edu_science_daily',
    author: 'Cosmic Horizons',
    username: 'science_daily',
    avatar: 'https://images.unsplash.com/photo-1614728894747-a83421e2b9c9?auto=format&fit=crop&w=400&q=80',
    mediaUrl: 'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?auto=format&fit=crop&w=800&q=80',
    category: 'education'
  },
  {
    id: 'story_edu_ocean_discovery',
    author: 'Deep Sea Institute',
    username: 'ocean_discovery',
    avatar: 'https://images.unsplash.com/photo-1518837695005-2083093ee35b?auto=format&fit=crop&w=400&q=80',
    mediaUrl: 'https://images.unsplash.com/photo-1682687220063-4742bd7fd538?auto=format&fit=crop&w=800&q=80',
    category: 'education'
  },
  {
    id: 'story_edu_quantum_lab',
    author: 'Quantum Frontiers',
    username: 'quantum_lab',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
    mediaUrl: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?auto=format&fit=crop&w=800&q=80',
    category: 'education'
  },
  {
    id: 'story_edu_cern',
    author: 'CERN Chronicles',
    username: 'cern_chronicles',
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=400&q=80',
    mediaUrl: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=800&q=80',
    category: 'education'
  },

  // Sports
  {
    id: 'story_sport_arena',
    author: 'Stadium Pulse',
    username: 'arena_sports',
    avatar: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=400&q=80',
    mediaUrl: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=800&q=80',
    category: 'sports'
  },
  {
    id: 'story_sport_speed',
    author: 'Speed Chronicles',
    username: 'speed_chronicles',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
    mediaUrl: 'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?auto=format&fit=crop&w=800&q=80',
    category: 'sports'
  },
  {
    id: 'story_sport_court_vision',
    author: 'Court Vision',
    username: 'court_vision',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80',
    mediaUrl: 'https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=800&q=80',
    category: 'sports'
  },
  {
    id: 'story_sport_ocean_riders',
    author: 'Big Wave Society',
    username: 'ocean_riders',
    avatar: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=400&q=80',
    mediaUrl: 'https://images.unsplash.com/photo-1502680390469-be75c86b636f?auto=format&fit=crop&w=800&q=80',
    category: 'sports'
  },

  // News
  {
    id: 'story_news_world_wire',
    author: 'Global Brief',
    username: 'world_news_wire',
    avatar: 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&w=400&q=80',
    mediaUrl: 'https://images.unsplash.com/photo-1509391365360-2e959784a276?auto=format&fit=crop&w=800&q=80',
    category: 'news'
  },
  {
    id: 'story_news_tech_bulletin',
    author: 'Tech Bulletin',
    username: 'tech_bulletin',
    avatar: 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&w=400&q=80',
    mediaUrl: 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&w=800&q=80',
    category: 'news'
  },
  {
    id: 'story_news_future_grid',
    author: 'Energy Frontier',
    username: 'future_grid',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
    mediaUrl: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=800&q=80',
    category: 'news'
  },
  {
    id: 'story_news_clean_oceans',
    author: 'Ocean Cleanse Project',
    username: 'clean_oceans',
    avatar: 'https://images.unsplash.com/photo-1518837695005-2083093ee35b?auto=format&fit=crop&w=400&q=80',
    mediaUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80',
    category: 'news'
  },

  // Travel / Photography
  {
    id: 'story_travel_sophia',
    author: 'Sophia Laurent',
    username: 'sophia_wander',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
    mediaUrl: 'https://images.unsplash.com/photo-1533105079780-92b9be482077?auto=format&fit=crop&w=800&q=80',
    category: 'travel'
  },
  {
    id: 'story_travel_elena',
    author: 'Elena Rostova',
    username: 'elena_culinary',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80',
    mediaUrl: 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=800&q=80',
    category: 'travel'
  },
  {
    id: 'story_travel_liam',
    author: 'Liam Chen',
    username: 'liam_visuals',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80',
    mediaUrl: 'https://images.unsplash.com/photo-1517411032315-54ef2cb783bb?auto=format&fit=crop&w=800&q=80',
    category: 'travel'
  },
  {
    id: 'story_travel_ancient',
    author: 'Ancient Voyager',
    username: 'ancient_voyager',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
    mediaUrl: 'https://images.unsplash.com/photo-1579606032822-44df0e107e33?auto=format&fit=crop&w=800&q=80',
    category: 'travel'
  }
];

class CuratedContentProvider extends BaseFeedProvider {
  constructor(options = {}) {
    super('Unsplash', { timeoutMs: 2000, maxItems: 40, ...options });
    this.postBatchIndex = 0;
    this.storyBatchIndex = 0;
  }

  /**
   * Fetches curated posts with rotating pagination on refresh
   */
  async fetchPosts(filterCategory = null, { refresh = false } = {}) {
    const now = Date.now();

    // On explicit refresh, advance the rotation cursor so brand new posts appear
    if (refresh) {
      this.postBatchIndex = (this.postBatchIndex + 1) % 4;
    }

    // Filter by category if requested
    let pool = [...CURATED_MEDIA_BANK];
    if (filterCategory && filterCategory !== 'all') {
      const cleanCat = filterCategory.toLowerCase();
      pool = pool.filter((item) => {
        if (cleanCat === 'jokes' || cleanCat === 'humor' || cleanCat === 'joc') {
          return item.category === 'jokes';
        }
        if (cleanCat === 'education' || cleanCat === 'eduartion' || cleanCat === 'science') {
          return item.category === 'education';
        }
        if (cleanCat === 'news' || cleanCat === 'current') {
          return item.category === 'news';
        }
        if (cleanCat === 'sports' || cleanCat === 'sport') {
          return item.category === 'sports';
        }
        if (cleanCat === 'entertainment' || cleanCat === 'enterment') {
          return item.category === 'entertainment';
        }
        return item.category === cleanCat;
      });
      if (pool.length === 0) pool = [...CURATED_MEDIA_BANK];
    }

    // Determine batch slice: take a distinct subset for the current rotation
    const batchSize = filterCategory && filterCategory !== 'all' ? 6 : 18;
    const startIndex = (this.postBatchIndex * batchSize) % pool.length;

    let selectedItems = [];
    for (let i = 0; i < Math.min(batchSize, pool.length); i++) {
      selectedItems.push(pool[(startIndex + i) % pool.length]);
    }

    // If pool has more items, shuffle the selected subset for natural freshness
    selectedItems.sort(() => Math.random() - 0.5);

    return selectedItems.map((item, idx) => {
      // Dynamic rolling timestamps within the last 3-90 minutes
      const minutesAgo = (idx * 5) + Math.floor(Math.random() * 4) + 2;
      const publishedAt = new Date(now - (minutesAgo * 60000)).toISOString();

      return this.normalizePost({
        rawId: `${item.id}`,
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

  /**
   * Fetches curated active stories with rotating cohorts on refresh
   */
  async fetchStories({ refresh = false } = {}) {
    const now = Date.now();

    // On explicit refresh, advance the story rotation cursor to rotate creators
    if (refresh) {
      this.storyBatchIndex = (this.storyBatchIndex + 1) % 4;
    }

    const cohortSize = 6;
    const startIndex = (this.storyBatchIndex * cohortSize) % CURATED_STORIES_BANK.length;

    const selectedStories = [];
    for (let i = 0; i < cohortSize; i++) {
      selectedStories.push(CURATED_STORIES_BANK[(startIndex + i) % CURATED_STORIES_BANK.length]);
    }

    return selectedStories.map((item, idx) => {
      const hoursAgo = idx + 1;
      const publishedAt = new Date(now - (hoursAgo * 3600000)).toISOString();
      const expiresAt = new Date(now + ((24 - hoursAgo) * 3600000)).toISOString();

      return this.normalizeStory({
        rawId: `${item.id}`,
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
