/**
 * server/src/db/migrate_pinned_messages.js
 * ========================================
 * Database migration for Multiple Pinned Messages:
 * 1. Creates `conversation_pinned_messages` table and unique index.
 * 2. Migrates any legacy `conversations.pinned_message_id` references.
 */

const { query } = require('../config/db');

async function migratePinnedMessages() {
  console.log('🚀 [Migration] Setting up Multiple Pinned Messages support...');

  try {
    // 1. Create conversation_pinned_messages table
    await query(`
      CREATE TABLE IF NOT EXISTS conversation_pinned_messages (
        id SERIAL PRIMARY KEY,
        conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
        pinned_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        pinned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(conversation_id, message_id)
      );
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS idx_pinned_messages_conv 
      ON conversation_pinned_messages(conversation_id);
    `);

    console.log('✅ Created / verified `conversation_pinned_messages` table and index.');

    // 2. Migrate existing single-pin references if present
    const legacyPins = await query(`
      SELECT c.id AS conversation_id, c.pinned_message_id, m.sender_id
      FROM conversations c
      JOIN messages m ON c.pinned_message_id = m.id
      WHERE c.pinned_message_id IS NOT NULL
    `);

    for (const row of legacyPins.rows) {
      await query(`
        INSERT INTO conversation_pinned_messages (conversation_id, message_id, pinned_by)
        VALUES ($1, $2, $3)
        ON CONFLICT (conversation_id, message_id) DO NOTHING
      `, [row.conversation_id, row.pinned_message_id, row.sender_id]);
    }

    if (legacyPins.rows.length > 0) {
      console.log(`✅ Migrated ${legacyPins.rows.length} legacy pinned messages.`);
    }

    console.log('🎉 [Migration] Multiple Pinned Messages migration complete.');
  } catch (err) {
    console.error('❌ [Migration Error]:', err.message);
    throw err;
  }
}

if (require.main === module) {
  migratePinnedMessages()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = migratePinnedMessages;
