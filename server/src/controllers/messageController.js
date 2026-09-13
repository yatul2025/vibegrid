/**
 * src/controllers/messageController.js
 * ====================================
 * Direct Messaging (DMs) Controller
 * 
 * Features:
 * 1. getConversations: Retrieves list of conversation threads with previews, timestamps, and unread counts.
 * 2. getMessages: Retrieves full chronological chat stream between two users and auto-marks incoming messages read.
 * 3. sendMessage: Sends a 1-on-1 private message with validation and sanitation.
 * 4. markConversationAsRead: Clears unread flags for a conversation.
 * 5. getUnreadMessagesCount: Returns total unread messages count for navbar notification badge.
 */

const { query } = require('../config/db');

/**
 * @desc    Get all conversations for the current user
 * @route   GET /api/messages/conversations
 * @access  Private (Authenticated)
 */
const getConversations = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const conversationsQuery = `
      WITH ranked_messages AS (
        SELECT 
          m.id,
          m.content,
          m.ciphertext,
          m.iv_nonce,
          m.conversation_id,
          m.created_at,
          m.sender_id,
          m.recipient_id,
          m.is_read,
          CASE WHEN m.sender_id = $1 THEN m.recipient_id ELSE m.sender_id END AS partner_id,
          ROW_NUMBER() OVER (
            PARTITION BY (CASE WHEN m.sender_id = $1 THEN m.recipient_id ELSE m.sender_id END)
            ORDER BY m.created_at DESC
          ) as rn
        FROM messages m
        WHERE (m.sender_id = $1 OR m.recipient_id = $1)
          AND (m.expires_at IS NULL OR m.expires_at > CURRENT_TIMESTAMP)
      ),
      unread_counts AS (
        SELECT 
          m.sender_id AS partner_id,
          COUNT(*)::int AS unread_count
        FROM messages m
        WHERE m.recipient_id = $1 AND m.is_read = FALSE
          AND (m.expires_at IS NULL OR m.expires_at > CURRENT_TIMESTAMP)
        GROUP BY m.sender_id
      )
      SELECT 
        rm.id,
        rm.content AS last_message,
        rm.ciphertext AS last_ciphertext,
        rm.iv_nonce AS last_iv_nonce,
        rm.conversation_id,
        rm.created_at AS last_message_at,
        rm.sender_id AS last_sender_id,
        u.id AS partner_id,
        u.username AS partner_username,
        u.full_name AS partner_full_name,
        u.avatar_url AS partner_avatar_url,
        COALESCE(uc.unread_count, 0) AS unread_count
      FROM ranked_messages rm
      JOIN users u ON rm.partner_id = u.id
      LEFT JOIN unread_counts uc ON rm.partner_id = uc.partner_id
      WHERE rm.rn = 1
      ORDER BY rm.created_at DESC;
    `;

    const result = await query(conversationsQuery, [userId]);

    res.status(200).json({
      success: true,
      data: {
        conversations: result.rows
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get direct message history with a specific user
 * @route   GET /api/messages/:username
 * @access  Private (Authenticated)
 */
const getMessages = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { username } = req.params;
    const cleanUsername = username.trim().toLowerCase();

    // 1. Resolve partner user
    const partnerRes = await query(
      'SELECT id, username, full_name, avatar_url, show_read_receipts, allow_messages_from FROM users WHERE LOWER(username) = $1 LIMIT 1',
      [cleanUsername]
    );

    if (partnerRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: `User @${cleanUsername} not found.`
      });
    }

    const partner = partnerRes.rows[0];

    // Find or create conversation for this 1to1 pair
    let conversationId = null;
    let ephemeralTimerSeconds = null;

    const convRes = await query(`
      SELECT c.id, c.ephemeral_timer_seconds
      FROM conversations c
      JOIN conversation_members cm1 ON c.id = cm1.conversation_id AND cm1.user_id = $1
      JOIN conversation_members cm2 ON c.id = cm2.conversation_id AND cm2.user_id = $2
      WHERE c.type = '1to1'
      LIMIT 1
    `, [userId, partner.id]);

    if (convRes.rows.length > 0) {
      conversationId = convRes.rows[0].id;
      ephemeralTimerSeconds = convRes.rows[0].ephemeral_timer_seconds;
    } else {
      const newConv = await query(`INSERT INTO conversations (type) VALUES ('1to1') RETURNING id`);
      conversationId = newConv.rows[0].id;
      await query(
        `INSERT INTO conversation_members (conversation_id, user_id) VALUES ($1, $2), ($1, $3) ON CONFLICT DO NOTHING`,
        [conversationId, userId, partner.id]
      );
    }

    // 2. Query messages between users (excluding expired ephemeral messages)
    const messagesQuery = `
      SELECT 
        m.id,
        m.sender_id,
        m.recipient_id,
        m.conversation_id,
        m.content,
        m.ciphertext,
        m.iv_nonce,
        m.sender_device_id,
        m.is_read,
        m.created_at,
        (m.sender_id = $1) AS is_mine
      FROM messages m
      WHERE ((m.sender_id = $1 AND m.recipient_id = $2)
          OR (m.sender_id = $2 AND m.recipient_id = $1))
         AND (m.expires_at IS NULL OR m.expires_at > CURRENT_TIMESTAMP)
      ORDER BY m.created_at ASC
    `;

    const messagesRes = await query(messagesQuery, [userId, partner.id]);

    // 3. Mark incoming messages as read
    await query(
      'UPDATE messages SET is_read = TRUE WHERE sender_id = $1 AND recipient_id = $2 AND is_read = FALSE',
      [partner.id, userId]
    );

    // Privacy safeguard: If partner disabled read receipts, mask is_read for my messages
    const formattedMessages = messagesRes.rows.map((msg) => {
      if (partner.show_read_receipts === false && msg.is_mine) {
        return { ...msg, is_read: false };
      }
      return msg;
    });

    res.status(200).json({
      success: true,
      data: {
        partner,
        conversationId,
        ephemeralTimerSeconds,
        messages: formattedMessages
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Send a direct message to a user
 * @route   POST /api/messages/:username
 * @access  Private (Authenticated)
 */
const sendMessage = async (req, res, next) => {
  try {
    const senderId = req.user.id;
    const { username } = req.params;
    const { content, ciphertext, ivNonce, senderDeviceId } = req.body;
    const cleanUsername = username.trim().toLowerCase();

    // 1. Resolve partner user with privacy settings
    const userRes = await query(
      'SELECT id, username, full_name, avatar_url, allow_messages_from FROM users WHERE LOWER(username) = $1 LIMIT 1',
      [cleanUsername]
    );

    if (userRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: `User @${cleanUsername} not found.`
      });
    }

    const recipient = userRes.rows[0];

    // 2. Prevent messaging oneself
    if (recipient.id === senderId) {
      return res.status(400).json({
        success: false,
        error: 'You cannot send messages to yourself.'
      });
    }

    // Privacy authorization: Enforce recipient's messaging permissions
    const allowMessages = recipient.allow_messages_from || 'everyone';
    if (allowMessages === 'nobody') {
      return res.status(403).json({
        success: false,
        error: 'This user does not accept direct messages.'
      });
    }
    if (allowMessages === 'following') {
      const followCheck = await query(
        'SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = $2 LIMIT 1',
        [recipient.id, senderId]
      );
      if (followCheck.rows.length === 0) {
        return res.status(403).json({
          success: false,
          error: 'This user only accepts direct messages from accounts they follow.'
        });
      }
    }

    // 3. Validate message content
    const cleanContent = (content && typeof content === 'string')
      ? content.trim().slice(0, 10000)
      : (ciphertext ? '[Encrypted Message]' : '');

    if (!cleanContent && !ciphertext) {
      return res.status(400).json({
        success: false,
        error: 'Message content cannot be empty.'
      });
    }

    // Find or create conversation for this 1to1 pair
    let conversationId = null;
    let ephemeralSeconds = null;

    const convRes = await query(`
      SELECT c.id, c.ephemeral_timer_seconds
      FROM conversations c
      JOIN conversation_members cm1 ON c.id = cm1.conversation_id AND cm1.user_id = $1
      JOIN conversation_members cm2 ON c.id = cm2.conversation_id AND cm2.user_id = $2
      WHERE c.type = '1to1'
      LIMIT 1
    `, [senderId, recipient.id]);

    if (convRes.rows.length > 0) {
      conversationId = convRes.rows[0].id;
      ephemeralSeconds = convRes.rows[0].ephemeral_timer_seconds;
    } else {
      const newConv = await query(`INSERT INTO conversations (type) VALUES ('1to1') RETURNING id`);
      conversationId = newConv.rows[0].id;
      await query(
        `INSERT INTO conversation_members (conversation_id, user_id) VALUES ($1, $2), ($1, $3) ON CONFLICT DO NOTHING`,
        [conversationId, senderId, recipient.id]
      );
    }

    const expiresAt = ephemeralSeconds ? new Date(Date.now() + ephemeralSeconds * 1000).toISOString() : null;

    // 4. Insert message
    const insertQuery = `
      INSERT INTO messages (sender_id, recipient_id, conversation_id, content, ciphertext, iv_nonce, sender_device_id, expires_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, sender_id, recipient_id, conversation_id, content, ciphertext, iv_nonce, sender_device_id, is_read, created_at
    `;

    const result = await query(insertQuery, [
      senderId,
      recipient.id,
      conversationId,
      cleanContent,
      ciphertext || null,
      ivNonce || null,
      senderDeviceId || null,
      expiresAt
    ]);

    const newMessage = {
      ...result.rows[0],
      is_mine: true
    };

    // Update conversation timestamp
    await query('UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = $1', [conversationId]);

    // Real-time broadcast to recipient
    const io = req.app.get('io');
    if (io) {
      io.to(`user:${recipient.id}`).emit('message:receive', {
        ...newMessage,
        is_mine: false
      });
    }

    res.status(201).json({
      success: true,
      data: {
        message: newMessage,
        recipient,
        conversationId
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Mark conversation as read
 * @route   PUT /api/messages/:username/read
 * @access  Private (Authenticated)
 */
const markConversationAsRead = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { username } = req.params;
    const cleanUsername = username.trim().toLowerCase();

    const userRes = await query(
      'SELECT id FROM users WHERE LOWER(username) = $1 LIMIT 1',
      [cleanUsername]
    );

    if (userRes.rows.length > 0) {
      await query(
        'UPDATE messages SET is_read = TRUE WHERE sender_id = $1 AND recipient_id = $2 AND is_read = FALSE',
        [userRes.rows[0].id, userId]
      );
    }

    res.status(200).json({
      success: true,
      message: 'Messages marked as read.'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get total unread messages count for navbar badge
 * @route   GET /api/messages/unread-count
 * @access  Private (Authenticated)
 */
const getUnreadMessagesCount = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const countQuery = `
      SELECT COUNT(*)::int AS count
      FROM messages
      WHERE recipient_id = $1 AND is_read = FALSE
    `;

    const result = await query(countQuery, [userId]);
    const unreadCount = result.rows[0].count;

    res.status(200).json({
      success: true,
      data: {
        unreadCount
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getConversations,
  getMessages,
  sendMessage,
  markConversationAsRead,
  getUnreadMessagesCount
};
