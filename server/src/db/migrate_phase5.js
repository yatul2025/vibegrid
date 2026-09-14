/**
 * server/src/db/migrate_phase5.js
 * ===============================
 * Database migration for Phase 5:
 * 1. Add `is_muted`, `muted_until`, `is_pinned`, and `is_archived` to `conversation_members` table.
 * 2. Create `reports` table for reporting users/conversations/messages.
 * 3. Add indexing on `conversation_members` for efficient inbox querying.
 */

const { query } = require('../config/db');

async function migratePhase5() {
  console.log('🚀 [Migration] Running Phase 5 Conversation Controls migration...');

  try {
    // 1. Add conversation controls columns to conversation_members
    await query(`
      ALTER TABLE conversation_members 
      ADD COLUMN IF NOT EXISTS is_muted BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS muted_until TIMESTAMP WITH TIME ZONE NULL,
      ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;
    `);
    console.log('✅ Added `is_muted`, `muted_until`, `is_pinned`, `is_archived` to `conversation_members`.');

    // 2. Create reports table
    await query(`
      CREATE TABLE IF NOT EXISTS reports (
        id SERIAL PRIMARY KEY,
        reporter_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        reported_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
        message_id INTEGER REFERENCES messages(id) ON DELETE SET NULL,
        reason VARCHAR(255) NOT NULL,
        details TEXT,
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Created `reports` table.');

    // 3. Add composite index on conversation_members for inbox sorting & filtering
    await query(`
      CREATE INDEX IF NOT EXISTS idx_cm_user_pin_archived
      ON conversation_members(user_id, is_archived, is_pinned);
    `);
    console.log('✅ Created index `idx_cm_user_pin_archived`.');

    console.log('🎉 Phase 5 migration finished successfully.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Phase 5 migration failed:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  migratePhase5();
}

module.exports = { migratePhase5 };
