const { query } = require('../config/db');

async function migrate() {
  console.log('--- Migrating Disappearing Messages Columns ---');
  try {
    await query(`
      ALTER TABLE conversations 
      ADD COLUMN IF NOT EXISTS ephemeral_timer_seconds INT DEFAULT NULL;
    `);
    console.log('✅ Added ephemeral_timer_seconds to conversations');

    await query(`
      ALTER TABLE messages 
      ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;
    `);
    console.log('✅ Added expires_at to messages');

    console.log('✅ Migration complete!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  }
}

migrate();
