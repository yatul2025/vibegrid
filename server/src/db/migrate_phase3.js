/**
 * server/src/db/migrate_phase3.js
 * ===============================
 * Database migration for Phase 3:
 * 1. Add `last_seen_at` column to `users` table.
 */

const { query } = require('../config/db');

async function migratePhase3() {
  console.log('🚀 [Migration] Running Phase 3 Presence & Status migration...');

  try {
    // 1. Add last_seen_at to users table
    await query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
    `);
    console.log('✅ Added `last_seen_at` to `users` table.');

    console.log('🎉 Phase 3 migration finished successfully.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Phase 3 migration failed:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  migratePhase3();
}

module.exports = { migratePhase3 };
