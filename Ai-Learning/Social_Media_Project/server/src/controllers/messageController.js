/**
 * src/controllers/messageController.js
 * ====================================
 * Direct Messaging (DMs) Controller
 * 
 * Features:
 * 1. getConversations: Retrieves list of conversation threads with previews, timestamps, and unread counts.
 * 2. getMessages: Retrieves full chronological chat stream with reply quotes, edit timestamps, and soft-delete state.
 * 3. sendMessage: Sends a 1-on-1 private message with optional reply_to_id.
 * 4. editMessage: Allows the message author to edit their message with authorization and real-time broadcast.
 * 5. deleteMessage: Supports "Delete for me" (message_deletions table) and "Delete for everyone" (soft delete).
 * 6. markConversationAsRead: Clears unread flags for a conversation.
 * 7. getUnreadMessagesCount: Returns total unread messages count for navbar notification badge.
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
          m.is_deleted,
          CASE WHEN m.sender_id = $1 THEN m.recipient_id ELSE m.sender_id END AS partner_id,
          ROW_NUMBER() OVER (
            PARTITION BY (CASE WHEN m.sender_id = $1 THEN m.recipient_id ELSE m.sender_id END)
            ORDER BY m.created_at DESC
          ) as rn
        FROM messages m
        WHERE (m.sender_id = $1 OR m.recipient_id = $1)
          AND (m.expires_at IS NULL OR m.expires_at > CURRENT_TIMESTAMP)
          AND m.id NOT IN (SELECT message_id FROM message_deletions WHERE user_id = $1)
      ),
      unread_counts AS (
        SELECT 
          m.sender_id AS partner_id,
          COUNT(*)::int AS unread_count
        FROM messages m
        WHERE m.recipient_id = $1 AND m.is_read = FALSE
          AND (m.expires_at IS NULL OR m.expires_at > CURRENT_TIMESTAMP)
          AND m.id NOT IN (SELECT message_id FROM message_deletions WHERE user_id = $1)
        GROUP BY m.sender_id
      )
      SELECT 
        rm.id,
        CASE WHEN rm.is_deleted THEN 'This message was deleted' ELSE rm.content END AS last_message,
        CASE WHEN rm.is_deleted THEN NULL ELSE rm.ciphertext END AS last_ciphertext,
        CASE WHEN rm.is_deleted THEN NULL ELSE rm.iv_nonce END AS last_iv_nonce,
        rm.conversation_id,
        rm.created_at AS last_message_at,
        rm.sender_id AS last_sender_id,
        rm.is_deleted AS last_is_deleted,
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

    // 2. Query messages between users (excluding expired ephemeral messages and messages deleted for this user)
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
        m.message_type,
        m.reply_to_id,
        m.is_read,
        m.is_deleted,
        m.is_forwarded,
        m.edited_at,
        m.created_at,
        (m.sender_id = $1) AS is_mine,
        rm.id AS reply_id,
        rm.sender_id AS reply_sender_id,
        rmu.username AS reply_sender_username,
        rm.content AS reply_content,
        rm.ciphertext AS reply_ciphertext,
        rm.iv_nonce AS reply_iv_nonce,
        rm.is_deleted AS reply_is_deleted
      FROM messages m
      LEFT JOIN messages rm ON m.reply_to_id = rm.id
      LEFT JOIN users rmu ON rm.sender_id = rmu.id
      WHERE ((m.sender_id = $1 AND m.recipient_id = $2)
          OR (m.sender_id = $2 AND m.recipient_id = $1))
         AND (m.expires_at IS NULL OR m.expires_at > CURRENT_TIMESTAMP)
         AND m.id NOT IN (SELECT message_id FROM message_deletions WHERE user_id = $1)
      ORDER BY m.created_at ASC
    `;

    const messagesRes = await query(messagesQuery, [userId, partner.id]);

    // 3. Mark incoming messages as read
    await query(
      'UPDATE messages SET is_read = TRUE WHERE sender_id = $1 AND recipient_id = $2 AND is_read = FALSE',
      [partner.id, userId]
    );

    // 4. Format messages and resolve quoted replies
    const formattedMessages = messagesRes.rows.map((msg) => {
      let reply_to_message = null;
      if (msg.reply_to_id) {
        if (msg.reply_id) {
          reply_to_message = {
            id: msg.reply_id,
            sender_id: msg.reply_sender_id,
            sender_username: msg.reply_sender_username,
            content: msg.reply_is_deleted ? 'Original message was deleted' : msg.reply_content,
            ciphertext: msg.reply_is_deleted ? null : msg.reply_ciphertext,
            iv_nonce: msg.reply_is_deleted ? null : msg.reply_iv_nonce,
            is_deleted: Boolean(msg.reply_is_deleted)
          };
        } else {
          reply_to_message = {
            id: msg.reply_to_id,
            content: 'Original message was deleted',
            is_deleted: true
          };
        }
      }

      return {
        id: msg.id,
        sender_id: msg.sender_id,
        recipient_id: msg.recipient_id,
        conversation_id: msg.conversation_id,
        content: msg.is_deleted ? 'This message was deleted' : msg.content,
        ciphertext: msg.is_deleted ? null : msg.ciphertext,
        iv_nonce: msg.is_deleted ? null : msg.iv_nonce,
        sender_device_id: msg.sender_device_id,
        message_type: msg.message_type || 'text',
        reply_to_id: msg.reply_to_id,
        reply_to_message,
        is_read: (partner.show_read_receipts === false && msg.is_mine) ? false : msg.is_read,
        is_deleted: Boolean(msg.is_deleted),
        is_forwarded: Boolean(msg.is_forwarded),
        edited_at: msg.edited_at,
        created_at: msg.created_at,
        is_mine: msg.is_mine
      };
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
    const { content, ciphertext, ivNonce, senderDeviceId, replyToId } = req.body;
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

    // Validate reply_to_id if provided
    let validatedReplyToId = null;
    let replyToMessage = null;

    if (replyToId) {
      const replyRes = await query(`
        SELECT rm.id, rm.sender_id, rmu.username AS sender_username, rm.content, rm.ciphertext, rm.iv_nonce, rm.is_deleted
        FROM messages rm
        JOIN users rmu ON rm.sender_id = rmu.id
        WHERE rm.id = $1 AND ((rm.sender_id = $2 AND rm.recipient_id = $3) OR (rm.sender_id = $3 AND rm.recipient_id = $2))
        LIMIT 1
      `, [replyToId, senderId, recipient.id]);

      if (replyRes.rows.length > 0) {
        const r = replyRes.rows[0];
        validatedReplyToId = r.id;
        replyToMessage = {
          id: r.id,
          sender_id: r.sender_id,
          sender_username: r.sender_username,
          content: r.is_deleted ? 'Original message was deleted' : r.content,
          ciphertext: r.is_deleted ? null : r.ciphertext,
          iv_nonce: r.is_deleted ? null : r.iv_nonce,
          is_deleted: Boolean(r.is_deleted)
        };
      }
    }

    // 4. Insert message
    const insertQuery = `
      INSERT INTO messages (sender_id, recipient_id, conversation_id, content, ciphertext, iv_nonce, sender_device_id, reply_to_id, expires_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id, sender_id, recipient_id, conversation_id, content, ciphertext, iv_nonce, sender_device_id, message_type, reply_to_id, is_read, is_deleted, is_forwarded, edited_at, created_at
    `;

    const result = await query(insertQuery, [
      senderId,
      recipient.id,
      conversationId,
      cleanContent,
      ciphertext || null,
      ivNonce || null,
      senderDeviceId || null,
      validatedReplyToId,
      expiresAt
    ]);

    const newMessage = {
      ...result.rows[0],
      is_mine: true,
      reply_to_message: replyToMessage
    };

    // Update conversation timestamp
    await query('UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = $1', [conversationId]);

    // Real-time broadcast to recipient and conversation room
    const io = req.app.get('io');
    if (io) {
      io.to(`user:${recipient.id}`).emit('message:receive', {
        ...newMessage,
        is_mine: false
      });
      if (conversationId) {
        io.to(`conv:${conversationId}`).emit('message:receive', {
          ...newMessage,
          is_mine: false
        });
      }
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
 * @desc    Edit a sent text message
 * @route   PUT /api/messages/msg/:id/edit
 * @access  Private (Authenticated)
 */
const editMessage = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { content, ciphertext, ivNonce } = req.body;

    const msgRes = await query(
      `SELECT id, sender_id, recipient_id, conversation_id, message_type, is_deleted 
       FROM messages WHERE id = $1 LIMIT 1`,
      [id]
    );

    if (msgRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Message not found.' });
    }

    const msg = msgRes.rows[0];

    // Authorization: only message sender can edit
    if (Number(msg.sender_id) !== Number(userId)) {
      return res.status(403).json({ success: false, error: 'You can only edit your own messages.' });
    }

    if (msg.is_deleted) {
      return res.status(400).json({ success: false, error: 'Deleted messages cannot be edited.' });
    }

    if (msg.message_type === 'call_log') {
      return res.status(400).json({ success: false, error: 'Call logs cannot be edited.' });
    }

    const cleanContent = (content && typeof content === 'string')
      ? content.trim().slice(0, 10000)
      : '';

    if (!cleanContent && !ciphertext) {
      return res.status(400).json({ success: false, error: 'Message content cannot be empty.' });
    }

    const updateRes = await query(
      `UPDATE messages 
       SET content = $1, ciphertext = $2, iv_nonce = $3, edited_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING id, sender_id, recipient_id, conversation_id, content, ciphertext, iv_nonce, edited_at`,
      [cleanContent, ciphertext || null, ivNonce || null, id]
    );

    const updatedMsg = updateRes.rows[0];

    // Real-time broadcast to recipient and conversation room
    const io = req.app.get('io');
    if (io) {
      const payload = {
        messageId: Number(updatedMsg.id),
        conversationId: updatedMsg.conversation_id,
        content: updatedMsg.content,
        ciphertext: updatedMsg.ciphertext,
        ivNonce: updatedMsg.iv_nonce,
        editedAt: updatedMsg.edited_at
      };
      if (updatedMsg.recipient_id) {
        io.to(`user:${updatedMsg.recipient_id}`).emit('message:edit', payload);
      }
      if (updatedMsg.conversation_id) {
        io.to(`conv:${updatedMsg.conversation_id}`).emit('message:edit', payload);
      }
    }

    res.status(200).json({
      success: true,
      data: {
        message: updatedMsg
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete a message ("Delete for me" or "Delete for everyone")
 * @route   DELETE /api/messages/msg/:id
 * @access  Private (Authenticated)
 */
const deleteMessage = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const type = req.query.type || req.body.type || 'for_everyone';

    const msgRes = await query(
      `SELECT id, sender_id, recipient_id, conversation_id, is_deleted 
       FROM messages WHERE id = $1 LIMIT 1`,
      [id]
    );

    if (msgRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Message not found.' });
    }

    const msg = msgRes.rows[0];
    const isSender = Number(msg.sender_id) === Number(userId);
    const isRecipient = Number(msg.recipient_id) === Number(userId);

    if (!isSender && !isRecipient) {
      return res.status(403).json({ success: false, error: 'Not authorized to delete this message.' });
    }

    const io = req.app.get('io');

    if (type === 'for_everyone') {
      if (!isSender) {
        return res.status(403).json({ success: false, error: 'Only the sender can delete a message for everyone.' });
      }

      await query(
        `UPDATE messages 
         SET is_deleted = TRUE, content = 'This message was deleted', ciphertext = NULL, iv_nonce = NULL 
         WHERE id = $1`,
        [id]
      );

      if (io) {
        const payload = {
          messageId: Number(msg.id),
          conversationId: msg.conversation_id,
          forEveryone: true,
          content: 'This message was deleted'
        };
        if (msg.recipient_id) {
          io.to(`user:${msg.recipient_id}`).emit('message:delete', payload);
        }
        if (msg.conversation_id) {
          io.to(`conv:${msg.conversation_id}`).emit('message:delete', payload);
        }
      }

      return res.status(200).json({
        success: true,
        message: 'Message deleted for everyone.',
        data: { messageId: Number(msg.id), forEveryone: true }
      });
    } else {
      // Delete for me
      await query(
        `INSERT INTO message_deletions (message_id, user_id) 
         VALUES ($1, $2) 
         ON CONFLICT (message_id, user_id) DO NOTHING`,
        [id, userId]
      );

      return res.status(200).json({
        success: true,
        message: 'Message deleted for you.',
        data: { messageId: Number(msg.id), forEveryone: false }
      });
    }
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
        AND id NOT IN (SELECT message_id FROM message_deletions WHERE user_id = $1)
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
  editMessage,
  deleteMessage,
  markConversationAsRead,
  getUnreadMessagesCount
};
