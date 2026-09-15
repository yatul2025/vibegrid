/**
 * server/src/db/migrate_push_subscriptions.js
 * ============================================
 * Creates the push_subscriptions table and ensures users table
 * has notif_calls preference column for Web Push notification routing.
 */

const { query } = require('../config/db');

async function migratePushSubscriptions() {
  console.log('🔄 Checking / applying Push Subscriptions DB schema...');
  try {
    // 1. Create push_subscriptions table
    await query(`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        endpoint TEXT NOT NULL,
        p256dh TEXT NOT NULL,
        auth TEXT NOT NULL,
        user_agent TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, endpoint)
      );
    `);

    // 2. Indexes
    await query(`
      CREATE INDEX IF NOT EXISTS idx_push_subs_user_id ON push_subscriptions(user_id);
      CREATE INDEX IF NOT EXISTS idx_push_subs_endpoint ON push_subscriptions(endpoint);
    `);

    // 3. Ensure users table has notif_calls column
    await query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS notif_calls BOOLEAN DEFAULT TRUE;
    `);

    console.log('✅ Push Subscriptions DB schema initialized successfully.');
    return true;
  } catch (err) {
    console.error('⚠️ [Push Migration Error]:', err.message);
    return false;
  }
}

module.exports = { migratePushSubscriptions };

if (require.main === module) {
  migratePushSubscriptions().then(() => process.exit(0));
}
