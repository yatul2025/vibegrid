/**
 * server/src/db/migrate_phase1.js
 * ===============================
 * Phase 1 Migration:
 * 1. Add `edited_at` column to messages table.
 * 2. Add `is_forwarded` column to messages table.
 * 3. Create `message_deletions` table for "Delete for me" functionality.
 */

const { query } = require('../config/db');

async function migratePhase1() {
  console.log('🚀 [Migration] Running Phase 1 database migration...');

  try {
    // 1. Add edited_at column to messages
    await query(`
      ALTER TABLE messages 
      ADD COLUMN IF NOT EXISTS edited_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;
    `);
    console.log('✅ Added `edited_at` column to messages.');

    // 2. Add is_forwarded column to messages
    await query(`
      ALTER TABLE messages 
      ADD COLUMN IF NOT EXISTS is_forwarded BOOLEAN DEFAULT FALSE;
    `);
    console.log('✅ Added `is_forwarded` column to messages.');

    // 3. Create message_deletions table
    await query(`
      CREATE TABLE IF NOT EXISTS message_deletions (
        id SERIAL PRIMARY KEY,
        message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        deleted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(message_id, user_id)
      );
    `);
    console.log('✅ Created `message_deletions` table.');

    // 4. Create index on message_deletions
    await query(`
      CREATE INDEX IF NOT EXISTS idx_message_deletions_user 
      ON message_deletions(user_id, message_id);
    `);
    console.log('✅ Created index on `message_deletions`.');

    console.log('🎉 [Migration] Phase 1 database migration completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ [Migration] Phase 1 migration failed:', err);
    process.exit(1);
  }
}

migratePhase1();
