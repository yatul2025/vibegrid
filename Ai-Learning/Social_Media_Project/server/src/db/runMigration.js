/**
 * server/src/db/runMigration.js
 * ==============================
 * Migration Runner for E2EE Messaging, Conversations & Calling
 */

const fs = require('fs');
const path = require('path');
const { query } = require('../config/db');

async function run() {
  console.log('🚀 Starting E2EE & Calling Database Migration...');

  try {
    // 1. Read and execute DDL script
    const sqlPath = path.join(__dirname, 'migration_e2ee_and_calls.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');

    console.log('⚡ Executing DDL statements...');
    await query(sqlContent);
    console.log('✅ Schema migration executed successfully!');

    // 2. Backfill existing legacy messages into conversations
    console.log('🔄 Checking for legacy messages needing conversation backfill...');
    const legacyCheck = await query(`
      SELECT DISTINCT 
        LEAST(sender_id, recipient_id) AS user1, 
        GREATEST(sender_id, recipient_id) AS user2
      FROM messages
      WHERE conversation_id IS NULL AND sender_id IS NOT NULL AND recipient_id IS NOT NULL
    `);

    if (legacyCheck.rows.length > 0) {
      console.log(`Found ${legacyCheck.rows.length} distinct 1-on-1 pairs to backfill.`);

      for (const pair of legacyCheck.rows) {
        const { user1, user2 } = pair;

        // Check if conversation already exists for this pair
        const existingConv = await query(`
          SELECT cm1.conversation_id
          FROM conversation_members cm1
          JOIN conversation_members cm2 ON cm1.conversation_id = cm2.conversation_id
          JOIN conversations c ON c.id = cm1.conversation_id
          WHERE cm1.user_id = $1 AND cm2.user_id = $2 AND c.type = '1to1'
          LIMIT 1
        `, [user1, user2]);

        let convId;
        if (existingConv.rows.length > 0) {
          convId = existingConv.rows[0].conversation_id;
        } else {
          // Create new 1to1 conversation
          const newConv = await query(`
            INSERT INTO conversations (type)
            VALUES ('1to1')
            RETURNING id
          `);
          convId = newConv.rows[0].id;

          // Add members
          await query(`
            INSERT INTO conversation_members (conversation_id, user_id)
            VALUES ($1, $2), ($1, $3)
            ON CONFLICT DO NOTHING
          `, [convId, user1, user2]);
        }

        // Link legacy messages to this conversation
        const updateRes = await query(`
          UPDATE messages
          SET conversation_id = $1
          WHERE conversation_id IS NULL
            AND ((sender_id = $2 AND recipient_id = $3) OR (sender_id = $3 AND recipient_id = $2))
        `, [convId, user1, user2]);

        console.log(`  -> Pair (${user1}, ${user2}): linked ${updateRes.rowCount} messages to conversation ${convId}`);
      }
      console.log('✅ Legacy messages backfilled successfully!');
    } else {
      console.log('ℹ️ No unlinked messages found. Backfill not needed.');
    }

    console.log('🎉 Migration completed with zero errors!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  }
}

run();
