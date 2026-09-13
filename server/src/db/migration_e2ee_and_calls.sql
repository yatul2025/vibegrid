-- ============================================================================
-- VibeGrid Real-Time E2EE Messaging & WebRTC Calling Migration
-- ============================================================================

-- 1. Extend Users Privacy Settings
ALTER TABLE users ADD COLUMN IF NOT EXISTS allow_calls_from VARCHAR(20) DEFAULT 'everyone';
ALTER TABLE users ADD COLUMN IF NOT EXISTS allow_group_add_from VARCHAR(20) DEFAULT 'everyone';

-- 2. Conversations Table
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(20) NOT NULL DEFAULT '1to1', -- '1to1', 'group'
    title VARCHAR(100),
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_conversations_type ON conversations(type);
CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations(updated_at DESC);

-- 3. Conversation Members
CREATE TABLE IF NOT EXISTS conversation_members (
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL DEFAULT 'member', -- 'admin', 'member'
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_read_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (conversation_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_conversation_members_user ON conversation_members(user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_members_conv ON conversation_members(conversation_id);

-- 4. User Devices (Multi-Device E2EE Key Identity)
CREATE TABLE IF NOT EXISTS user_devices (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_id VARCHAR(64) NOT NULL,
    identity_key_pub TEXT NOT NULL,
    signed_prekey_pub TEXT NOT NULL,
    signed_prekey_sig TEXT NOT NULL,
    signed_prekey_id INTEGER NOT NULL,
    registration_id INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, device_id)
);
CREATE INDEX IF NOT EXISTS idx_user_devices_user_id ON user_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_user_devices_device_id ON user_devices(device_id);

-- 5. E2EE One-Time Prekeys (X3DH Key Agreement Pool)
CREATE TABLE IF NOT EXISTS e2ee_prekeys (
    id SERIAL PRIMARY KEY,
    device_id INTEGER NOT NULL REFERENCES user_devices(id) ON DELETE CASCADE,
    key_id INTEGER NOT NULL,
    prekey_pub TEXT NOT NULL,
    is_consumed BOOLEAN DEFAULT FALSE,
    consumed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(device_id, key_id)
);
CREATE INDEX IF NOT EXISTS idx_e2ee_prekeys_device ON e2ee_prekeys(device_id, is_consumed);

-- 6. Blocked Users Table
CREATE TABLE IF NOT EXISTS blocked_users (
    blocker_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    blocked_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (blocker_id, blocked_id),
    CHECK (blocker_id <> blocked_id)
);
CREATE INDEX IF NOT EXISTS idx_blocked_users_blocker ON blocked_users(blocker_id);
CREATE INDEX IF NOT EXISTS idx_blocked_users_blocked ON blocked_users(blocked_id);

-- 7. WebRTC Calls Table
CREATE TABLE IF NOT EXISTS calls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
    initiator_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    call_type VARCHAR(20) NOT NULL DEFAULT 'audio', -- 'audio', 'video'
    status VARCHAR(20) NOT NULL DEFAULT 'initiated', -- 'initiated', 'ringing', 'connected', 'ended', 'rejected', 'missed', 'busy'
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP WITH TIME ZONE,
    duration_seconds INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_calls_initiator ON calls(initiator_id);
CREATE INDEX IF NOT EXISTS idx_calls_created_at ON calls(started_at DESC);

-- 8. WebRTC Call Participants Table
CREATE TABLE IF NOT EXISTS call_participants (
    id SERIAL PRIMARY KEY,
    call_id UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'invited', -- 'invited', 'ringing', 'accepted', 'rejected', 'missed', 'left'
    joined_at TIMESTAMP WITH TIME ZONE,
    left_at TIMESTAMP WITH TIME ZONE,
    duration_seconds INTEGER DEFAULT 0,
    UNIQUE(call_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_call_participants_call_id ON call_participants(call_id);
CREATE INDEX IF NOT EXISTS idx_call_participants_user_id ON call_participants(user_id);

-- 9. Message Reactions Table
CREATE TABLE IF NOT EXISTS message_reactions (
    id SERIAL PRIMARY KEY,
    message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reaction VARCHAR(32) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(message_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_message_reactions_msg ON message_reactions(message_id);

-- 10. Upgrade Messages Table for E2EE & Conversations
ALTER TABLE messages ADD COLUMN IF NOT EXISTS conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS sender_device_id VARCHAR(64);
ALTER TABLE messages ADD COLUMN IF NOT EXISTS ciphertext TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS iv_nonce TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS message_type VARCHAR(20) DEFAULT 'text';
ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to_id INTEGER REFERENCES messages(id) ON DELETE SET NULL;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id, created_at ASC);

-- 11. WebRTC Call Signals Table (Serverless Fallback)
CREATE TABLE IF NOT EXISTS call_signals (
    id SERIAL PRIMARY KEY,
    call_id UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
    from_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    to_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    signal_type VARCHAR(30) NOT NULL,
    payload JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_call_signals_poll ON call_signals(call_id, to_user_id, id);
CREATE INDEX IF NOT EXISTS idx_call_signals_created ON call_signals(created_at);

