/**
 * src/config/db.js
 * ================
 * PostgreSQL Connection Pool Configuration
 * 
 * What is a Connection Pool?
 * In a web app, opening a new database connection for every incoming HTTP request is slow.
 * A "Pool" maintains a set of reusable active connections in memory, handing them out
 * to requests instantly and taking them back when finished.
 */

const { Pool } = require('pg');
const config = require('./env');

// Normalize SSL mode in connection string for pg-connection-string v3 compatibility
const dbUrl = config.databaseUrl
  ? config.databaseUrl.replace(/sslmode=(require|prefer|verify-ca)/g, 'sslmode=verify-full')
  : null;

// Configure Pool options
const poolConfig = dbUrl
  ? {
      connectionString: dbUrl,
      // SSL required for most cloud PostgreSQL providers (Neon, Supabase, Render)
      ssl: dbUrl.includes('localhost') ? false : { rejectUnauthorized: false }
    }
  : {
      host: config.db.host,
      port: config.db.port,
      user: config.db.user,
      password: config.db.password,
      database: config.db.name
    };

const pool = new Pool(poolConfig);

// Listen to pool connection events
pool.on('connect', () => {
  if (config.nodeEnv === 'development') {
    console.log('[DB] New client connected to PostgreSQL pool');
  }
});

pool.on('error', (err) => {
  console.error('[DB] Unexpected error on idle PostgreSQL client:', err.message);
});

/**
 * Reusable Query Function (Enforces Parameterized Queries)
 * @param {string} text - SQL Query with $1, $2 placeholders
 * @param {Array} params - Array of parameter values
 */
const query = async (text, params) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    if (config.nodeEnv === 'development') {
      console.log(`[DB Query] ${text} | Duration: ${duration}ms | Rows: ${res.rowCount}`);
    }
    return res;
  } catch (error) {
    console.error(`[DB Query Error] Query: "${text}" | Error: ${error.message}`);
    throw error;
  }
};

/**
 * Health Check function to test the database connection and ensure required tables exist
 */
const testConnection = async () => {
  try {
    const res = await query('SELECT NOW() as current_time, version() as pg_version');
    
    // Automatically ensure stories & notifications tables exist
    try {
      await query(`
        CREATE TABLE IF NOT EXISTS stories (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          media_url TEXT NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          expires_at TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP + INTERVAL '24 hours')
        );
        CREATE INDEX IF NOT EXISTS idx_stories_user_id ON stories(user_id);
        CREATE INDEX IF NOT EXISTS idx_stories_expires_at ON stories(expires_at);

        CREATE TABLE IF NOT EXISTS notifications (
          id SERIAL PRIMARY KEY,
          recipient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          type VARCHAR(30) NOT NULL,
          post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
          comment_text VARCHAR(200),
          is_read BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_id);
        CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

        CREATE TABLE IF NOT EXISTS messages (
          id SERIAL PRIMARY KEY,
          sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          recipient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          content TEXT NOT NULL,
          is_read BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(sender_id, recipient_id, created_at);
        CREATE INDEX IF NOT EXISTS idx_messages_recipient_unread ON messages(recipient_id, is_read);

        CREATE TABLE IF NOT EXISTS saved_posts (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(user_id, post_id)
        );
        CREATE INDEX IF NOT EXISTS idx_saved_posts_user_id ON saved_posts(user_id);
        CREATE INDEX IF NOT EXISTS idx_saved_posts_created_at ON saved_posts(created_at DESC);

        CREATE TABLE IF NOT EXISTS hashtags (
          id SERIAL PRIMARY KEY,
          name VARCHAR(50) UNIQUE NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_hashtags_name ON hashtags(LOWER(name));

        CREATE TABLE IF NOT EXISTS post_hashtags (
          post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
          hashtag_id INTEGER NOT NULL REFERENCES hashtags(id) ON DELETE CASCADE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (post_id, hashtag_id)
        );
        CREATE INDEX IF NOT EXISTS idx_post_hashtags_hashtag_id ON post_hashtags(hashtag_id);
        CREATE INDEX IF NOT EXISTS idx_post_hashtags_post_id ON post_hashtags(post_id);

        CREATE TABLE IF NOT EXISTS password_resets (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          token_hash VARCHAR(255) NOT NULL,
          otp_code VARCHAR(6),
          expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
          used BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_password_resets_user_id ON password_resets(user_id);
        CREATE INDEX IF NOT EXISTS idx_password_resets_token_hash ON password_resets(token_hash);

        CREATE TABLE IF NOT EXISTS user_sessions (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          session_id VARCHAR(64) UNIQUE NOT NULL,
          device VARCHAR(100),
          browser VARCHAR(100),
          os VARCHAR(100),
          ip_address VARCHAR(45),
          location VARCHAR(100),
          last_active TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
        CREATE INDEX IF NOT EXISTS idx_user_sessions_session_id ON user_sessions(session_id);

        CREATE TABLE IF NOT EXISTS account_verifications (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          type VARCHAR(30) NOT NULL,
          target_value VARCHAR(255) NOT NULL,
          otp_code VARCHAR(6) NOT NULL,
          expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
          attempts INTEGER DEFAULT 0,
          used BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_account_verifications_user_id ON account_verifications(user_id);
        CREATE INDEX IF NOT EXISTS idx_account_verifications_target ON account_verifications(type, target_value);

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
        CREATE INDEX IF NOT EXISTS idx_push_subs_user_id ON push_subscriptions(user_id);
        CREATE INDEX IF NOT EXISTS idx_push_subs_endpoint ON push_subscriptions(endpoint);

        ALTER TABLE users ADD COLUMN IF NOT EXISTS notif_calls BOOLEAN DEFAULT TRUE;
        UPDATE users SET notif_calls = TRUE WHERE notif_calls IS NULL;

        ALTER TABLE users ADD COLUMN IF NOT EXISTS test INTEGER DEFAULT 0;
        UPDATE users SET test = 1 WHERE id IN (1, 2, 3, 4);
        UPDATE users SET test = 0 WHERE id NOT IN (1, 2, 3, 4);

        ALTER TABLE messages ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;
        ALTER TABLE messages ADD COLUMN IF NOT EXISTS read_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;
        ALTER TABLE messages ALTER COLUMN recipient_id DROP NOT NULL;
        CREATE INDEX IF NOT EXISTS idx_messages_recipient_delivered ON messages(recipient_id, delivered_at);

        CREATE TABLE IF NOT EXISTS chat_typing (
          user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
          target_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          conversation_id INTEGER,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_chat_typing_target ON chat_typing(user_id, target_user_id, updated_at);

        CREATE TABLE IF NOT EXISTS conversation_pinned_messages (
          id SERIAL PRIMARY KEY,
          conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
          message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
          pinned_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          pinned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(conversation_id, message_id)
        );
        CREATE INDEX IF NOT EXISTS idx_pinned_messages_conv ON conversation_pinned_messages(conversation_id);
      `);
    } catch (tblErr) {
      console.warn('[DB] Table init check warning:', tblErr.message);
    }

    return {
      connected: true,
      currentTime: res.rows[0].current_time,
      version: res.rows[0].pg_version
    };
  } catch (error) {
    return {
      connected: false,
      error: error.message,
      code: error.code || 'UNKNOWN'
    };
  }
};

module.exports = {
  pool,
  query,
  testConnection
};
