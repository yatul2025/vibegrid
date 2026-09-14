/**
 * server/src/db/migrate_phase1_advanced.js
 * ========================================
 * Database migration for Phase 1 advanced messaging features:
 * 1. Ensure `message_reactions` table exists with index.
 * 2. Create `message_stars` table for Star / Save messages.
 * 3. Add `pinned_message_id` to `conversations` table.
 * 4. Add `delivered_at` and `read_at` columns to `messages` table.
 */

const { query } = require('../config/db');

async function migratePhase1Advanced() {
  console.log('🚀 [Migration] Running Phase 1 Advanced messaging migration...');

  try {
    // 1. Ensure message_reactions table exists
    await query(`
      CREATE TABLE IF NOT EXISTS message_reactions (
        id SERIAL PRIMARY KEY,
        message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        reaction VARCHAR(32) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(message_id, user_id)
      );
    `);
    await query(`
      CREATE INDEX IF NOT EXISTS idx_message_reactions_msg 
      ON message_reactions(message_id);
    `);
    console.log('✅ Created / verified `message_reactions` table.');

    // 2. Create message_stars table
    await query(`
      CREATE TABLE IF NOT EXISTS message_stars (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, message_id)
      );
    `);
    await query(`
      CREATE INDEX IF NOT EXISTS idx_message_stars_user 
      ON message_stars(user_id);
    `);
    console.log('✅ Created / verified `message_stars` table.');

    // 3. Add pinned_message_id to conversations table
    await query(`
      ALTER TABLE conversations 
      ADD COLUMN IF NOT EXISTS pinned_message_id INTEGER REFERENCES messages(id) ON DELETE SET NULL;
    `);
    console.log('✅ Added `pinned_message_id` to `conversations`.');

    // 4. Add delivered_at and read_at to messages table
    await query(`
      ALTER TABLE messages 
      ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;
    `);
    await query(`
      ALTER TABLE messages 
      ADD COLUMN IF NOT EXISTS read_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;
    `);
    console.log('✅ Added `delivered_at` and `read_at` to `messages`.');

    console.log('🎉 [Migration] Phase 1 Advanced migration completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ [Migration] Phase 1 Advanced migration failed:', err);
    process.exit(1);
  }
}

migratePhase1Advanced();
