/**
 * server/src/controllers/conversationController.js
 * =================================================
 * Encrypted Conversations & Ciphertext Message Controller
 */

const { query } = require('../config/db');
const crypto = require('crypto');

/**
 * @desc    Get all conversations for the authenticated user
 * @route   GET /api/conversations
 * @access  Private (Authenticated)
 */
const getConversations = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const conversationsQuery = `
      WITH user_convs AS (
        SELECT cm.conversation_id, cm.last_read_at
        FROM conversation_members cm
        WHERE cm.user_id = $1
      ),
      latest_messages AS (
        SELECT 
          m.id,
          m.conversation_id,
          m.sender_id,
          m.ciphertext,
          m.content,
          m.created_at,
          m.is_read,
          m.is_deleted,
          ROW_NUMBER() OVER (
            PARTITION BY m.conversation_id 
            ORDER BY m.created_at DESC
          ) as rn
        FROM messages m
        WHERE m.conversation_id IN (SELECT conversation_id FROM user_convs)
      ),
      unread_counts AS (
        SELECT 
          m.conversation_id,
          COUNT(*)::int AS unread_count
        FROM messages m
        JOIN user_convs uc ON m.conversation_id = uc.conversation_id
        WHERE m.sender_id <> $1 AND m.created_at > uc.last_read_at
        GROUP BY m.conversation_id
      )
      SELECT 
        c.id,
        c.type,
        c.title,
        c.updated_at,
        lm.id AS last_message_id,
        lm.ciphertext AS last_ciphertext,
        lm.content AS last_plaintext,
        lm.created_at AS last_message_at,
        lm.sender_id AS last_sender_id,
        lm.is_deleted AS last_is_deleted,
        COALESCE(uc.unread_count, 0) AS unread_count,
        -- Aggregate partner details for 1-to-1 chats
        (
          SELECT json_agg(json_build_object(
            'id', u.id,
            'username', u.username,
            'full_name', u.full_name,
            'avatar_url', u.avatar_url
          ))
          FROM conversation_members cm2
          JOIN users u ON cm2.user_id = u.id
          WHERE cm2.conversation_id = c.id AND cm2.user_id <> $1
        ) AS other_members
      FROM conversations c
      JOIN user_convs uc ON c.id = uc.conversation_id
      LEFT JOIN latest_messages lm ON c.id = lm.conversation_id AND lm.rn = 1
      LEFT JOIN unread_counts uc ON c.id = uc.conversation_id
      ORDER BY COALESCE(lm.created_at, c.updated_at) DESC;
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
 * @desc    Find or create a 1-to-1 conversation with a target user
 * @route   POST /api/conversations
 * @access  Private (Authenticated)
 */
const getOrCreateConversation = async (req, res, next) => {
  try {
    const userId = req.user.id;
    let { recipientId, recipientUsername } = req.body;

    if (!recipientId && recipientUsername) {
      const uRes = await query(
        'SELECT id FROM users WHERE LOWER(username) = $1 LIMIT 1',
        [recipientUsername.trim().toLowerCase()]
      );
      if (uRes.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'User not found.' });
      }
      recipientId = uRes.rows[0].id;
    }

    recipientId = Number(recipientId);
    if (!recipientId || recipientId === userId) {
      return res.status(400).json({
        success: false,
        error: 'Invalid recipient.'
      });
    }

    // Check block list
    const blockRes = await query(
      'SELECT 1 FROM blocked_users WHERE (blocker_id = $1 AND blocked_id = $2) OR (blocker_id = $2 AND blocked_id = $1) LIMIT 1',
      [userId, recipientId]
    );
    if (blockRes.rows.length > 0) {
      return res.status(403).json({
        success: false,
        error: 'Cannot start conversation with this user.'
      });
    }

    // Check recipient messaging privacy settings
    const partnerCheck = await query(
      'SELECT id, username, full_name, avatar_url, show_read_receipts, allow_messages_from FROM users WHERE id = $1 LIMIT 1',
      [recipientId]
    );
    if (partnerCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }
    const partnerUser = partnerCheck.rows[0];
    const allowMsgs = partnerUser.allow_messages_from || 'everyone';
    if (allowMsgs === 'nobody') {
      return res.status(403).json({
        success: false,
        error: 'This user does not accept direct messages.'
      });
    }
    if (allowMsgs === 'following') {
      const followCheck = await query(
        'SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = $2 LIMIT 1',
        [recipientId, userId]
      );
      if (followCheck.rows.length === 0) {
        return res.status(403).json({
          success: false,
          error: 'This user only accepts messages from people they follow.'
        });
      }
    }

    // 1. Check if 1-to-1 conversation already exists
    const existingRes = await query(`
      SELECT c.id, c.type, c.created_at, c.updated_at
      FROM conversations c
      JOIN conversation_members cm1 ON c.id = cm1.conversation_id
      JOIN conversation_members cm2 ON c.id = cm2.conversation_id
      WHERE c.type = '1to1' AND cm1.user_id = $1 AND cm2.user_id = $2
      LIMIT 1
    `, [userId, recipientId]);

    if (existingRes.rows.length > 0) {
      const partnerRes = await query(
        'SELECT id, username, full_name, avatar_url, show_read_receipts, allow_messages_from FROM users WHERE id = $1 LIMIT 1',
        [recipientId]
      );

      return res.status(200).json({
        success: true,
        data: {
          conversation: existingRes.rows[0],
          partner: partnerRes.rows[0],
          isNew: false
        }
      });
    }

    // 2. Create new 1-to-1 conversation
    const newConvRes = await query(`
      INSERT INTO conversations (type, created_by)
      VALUES ('1to1', $1)
      RETURNING id, type, created_at, updated_at
    `, [userId]);

    const newConv = newConvRes.rows[0];

    // Add both members
    await query(`
      INSERT INTO conversation_members (conversation_id, user_id)
      VALUES ($1, $2), ($1, $3)
    `, [newConv.id, userId, recipientId]);

    const partnerRes = await query(
      'SELECT id, username, full_name, avatar_url, show_read_receipts, allow_messages_from FROM users WHERE id = $1 LIMIT 1',
      [recipientId]
    );

    res.status(201).json({
      success: true,
      data: {
        conversation: newConv,
        partner: partnerRes.rows[0],
        isNew: true
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get message history for a conversation
 * @route   GET /api/conversations/:id/messages
 * @access  Private (Authenticated)
 */
const getMessages = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const conversationId = (req.params.id || '').replace(/^(group-)+/i, '').trim();

    // Verify membership
    const memberCheck = await query(
      'SELECT 1 FROM conversation_members WHERE conversation_id = $1 AND user_id = $2 LIMIT 1',
      [conversationId, userId]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({
        success: false,
        error: 'You are not a participant in this conversation.'
      });
    }

    // Update last_read_at timestamp
    await query(
      'UPDATE conversation_members SET last_read_at = CURRENT_TIMESTAMP WHERE conversation_id = $1 AND user_id = $2',
      [conversationId, userId]
    );

    // Fetch messages
    const messagesRes = await query(`
      SELECT 
        m.id,
        m.conversation_id,
        m.sender_id,
        m.sender_device_id,
        m.ciphertext,
        m.iv_nonce,
        m.content,
        m.message_type,
        m.reply_to_id,
        m.is_deleted,
        m.is_read,
        m.created_at,
        (m.sender_id = $1) AS is_mine,
        u.username AS sender_username,
        u.avatar_url AS sender_avatar_url,
        -- Aggregate message reactions
        (
          SELECT json_agg(json_build_object(
            'reaction', mr.reaction,
            'user_id', mr.user_id
          ))
          FROM message_reactions mr
          WHERE mr.message_id = m.id
        ) AS reactions
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.conversation_id = $2
        AND (m.expires_at IS NULL OR m.expires_at > CURRENT_TIMESTAMP)
      ORDER BY m.created_at ASC
    `, [userId, conversationId]);

    res.status(200).json({
      success: true,
      data: {
        messages: messagesRes.rows
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Send an encrypted (or fallback plaintext) message in conversation
 * @route   POST /api/conversations/:id/messages
 * @access  Private (Authenticated)
 */
const sendMessage = async (req, res, next) => {
  try {
    const senderId = req.user.id;
    const conversationId = (req.params.id || '').replace(/^(group-)+/i, '').trim();
    const { ciphertext, ivNonce, senderDeviceId, content, messageType = 'text', replyToId = null } = req.body;

    // Verify membership
    const membersRes = await query(
      'SELECT user_id FROM conversation_members WHERE conversation_id = $1',
      [conversationId]
    );

    let isMember = membersRes.rows.some((m) => Number(m.user_id) === Number(senderId));
    if (!isMember) {
      try {
        const creatorCheck = await query(
          'SELECT created_by FROM conversations WHERE id = $1 LIMIT 1',
          [conversationId]
        );
        if (creatorCheck.rows.length > 0 && Number(creatorCheck.rows[0].created_by) === Number(senderId)) {
          await query(
            "INSERT INTO conversation_members (conversation_id, user_id, role) VALUES ($1, $2, 'admin') ON CONFLICT DO NOTHING",
            [conversationId, senderId]
          );
          isMember = true;
        }
      } catch (_) {}
    }

    if (!isMember) {
      return res.status(403).json({
        success: false,
        error: 'You are not a participant in this conversation.'
      });
    }

    // Check blocked status with conversation partners
    const otherMembers = membersRes.rows.filter((m) => Number(m.user_id) !== Number(senderId));
    for (const partner of otherMembers) {
      const blockRes = await query(
        'SELECT 1 FROM blocked_users WHERE (blocker_id = $1 AND blocked_id = $2) OR (blocker_id = $2 AND blocked_id = $1) LIMIT 1',
        [senderId, partner.user_id]
      );
      if (blockRes.rows.length > 0) {
        return res.status(403).json({
          success: false,
          error: 'Cannot send message. User is blocked.'
        });
      }
    }

    if (!ciphertext && !content) {
      return res.status(400).json({
        success: false,
        error: 'Message payload cannot be empty.'
      });
    }

    const recipientId = otherMembers.length === 1 ? otherMembers[0].user_id : null;

    // Check ephemeral timer for disappearing messages
    const convRes = await query(
      'SELECT ephemeral_timer_seconds FROM conversations WHERE id = $1 LIMIT 1',
      [conversationId]
    );
    const ephemeralSeconds = convRes.rows[0]?.ephemeral_timer_seconds;
    const expiresAt = ephemeralSeconds ? new Date(Date.now() + ephemeralSeconds * 1000).toISOString() : null;

    // Insert message record
    const insertRes = await query(`
      INSERT INTO messages (
        conversation_id, sender_id, recipient_id, 
        sender_device_id, ciphertext, iv_nonce, content, 
        message_type, reply_to_id, expires_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id, conversation_id, sender_id, sender_device_id, ciphertext, iv_nonce, content, message_type, reply_to_id, is_read, is_deleted, created_at, expires_at
    `, [
      conversationId,
      senderId,
      recipientId,
      senderDeviceId || null,
      ciphertext || null,
      ivNonce || null,
      content || '',
      messageType,
      replyToId || null,
      expiresAt
    ]);

    // Update conversation timestamp
    await query(
      'UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [conversationId]
    );

    // Update sender's last_read_at
    await query(
      'UPDATE conversation_members SET last_read_at = CURRENT_TIMESTAMP WHERE conversation_id = $1 AND user_id = $2',
      [conversationId, senderId]
    );

    const newMessage = {
      ...insertRes.rows[0],
      is_mine: true,
      sender_username: req.user.username,
      sender_avatar_url: req.user.avatar_url
    };

    // Real-time broadcast to conversation room and recipient
    const io = req.app.get('io');
    if (io) {
      io.to(`conv:${conversationId}`).emit('message:receive', {
        ...newMessage,
        is_mine: false
      });
      if (recipientId) {
        io.to(`user:${recipientId}`).emit('message:receive', {
          ...newMessage,
          is_mine: false
        });
      }
      try {
        const otherMembersRes = await query(
          'SELECT user_id FROM conversation_members WHERE conversation_id = $1 AND user_id != $2',
          [conversationId, senderId]
        );
        if (otherMembersRes?.rows) {
          for (const mRow of otherMembersRes.rows) {
            io.to(`user:${mRow.user_id}`).emit('message:receive', {
              ...newMessage,
              is_mine: false
            });
          }
        }
      } catch (_) {}
    }

    res.status(201).json({
      success: true,
      data: {
        message: newMessage
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Soft delete a message
 * @route   DELETE /api/conversations/:id/messages/:messageId
 * @access  Private (Authenticated)
 */
const deleteMessage = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { id: conversationId, messageId } = req.params;

    const msgRes = await query(
      'SELECT id, sender_id FROM messages WHERE id = $1 AND conversation_id = $2 LIMIT 1',
      [messageId, conversationId]
    );

    if (msgRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Message not found.' });
    }

    if (msgRes.rows[0].sender_id !== userId) {
      return res.status(403).json({ success: false, error: 'You can only delete your own messages.' });
    }

    await query(
      'UPDATE messages SET is_deleted = TRUE, ciphertext = NULL, content = \'This message was deleted\' WHERE id = $1',
      [messageId]
    );

    res.status(200).json({
      success: true,
      message: 'Message deleted successfully.'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Add or toggle reaction on a message
 * @route   POST /api/conversations/:id/messages/:messageId/reactions
 * @access  Private (Authenticated)
 */
const toggleReaction = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { messageId } = req.params;
    const { reaction } = req.body;

    if (!reaction) {
      return res.status(400).json({ success: false, error: 'Reaction emoji required.' });
    }

    // Check if existing reaction exists
    const existing = await query(
      'SELECT id, reaction FROM message_reactions WHERE message_id = $1 AND user_id = $2 LIMIT 1',
      [messageId, userId]
    );

    if (existing.rows.length > 0) {
      if (existing.rows[0].reaction === reaction) {
        // Remove reaction (toggle off)
        await query('DELETE FROM message_reactions WHERE id = $1', [existing.rows[0].id]);
        return res.status(200).json({ success: true, action: 'removed' });
      } else {
        // Update reaction
        await query('UPDATE message_reactions SET reaction = $1 WHERE id = $2', [reaction, existing.rows[0].id]);
        return res.status(200).json({ success: true, action: 'updated', reaction });
      }
    }

    // Insert new reaction
    await query(
      'INSERT INTO message_reactions (message_id, user_id, reaction) VALUES ($1, $2, $3)',
      [messageId, userId, reaction]
    );

    res.status(201).json({ success: true, action: 'added', reaction });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Upload client-side encrypted media attachment (image / voice note)
 * @route   POST /api/conversations/media/encrypted
 * @access  Private (Authenticated)
 */
const uploadEncryptedAttachment = async (req, res, next) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ success: false, error: 'No encrypted payload received.' });
    }

    const filename = `enc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.bin`;

    const fileSize = req.file.size || req.file.buffer.length || 0;

    await query(
      `INSERT INTO media_files (id, folder, mime_type, data, size)
       VALUES ($1, 'encrypted', 'application/octet-stream', $2, $3)
       ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, size = EXCLUDED.size, mime_type = EXCLUDED.mime_type`,
      [filename, req.file.buffer, fileSize]
    );

    res.status(201).json({
      success: true,
      data: {
        mediaUrl: `/uploads/encrypted/${filename}`,
        filename,
        size: req.file.size
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Update disappearing messages timer for a conversation
 * @route   PUT /api/conversations/:id/ephemeral
 * @access  Private (Authenticated)
 */
const updateEphemeralTimer = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const conversationId = req.params.id;
    const { timerSeconds } = req.body;

    const memberCheck = await query(
      'SELECT 1 FROM conversation_members WHERE conversation_id = $1 AND user_id = $2 LIMIT 1',
      [conversationId, userId]
    );
    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ success: false, error: 'Not a member of this conversation.' });
    }

    await query(
      'UPDATE conversations SET ephemeral_timer_seconds = $1 WHERE id = $2',
      [timerSeconds ? Number(timerSeconds) : null, conversationId]
    );

    res.status(200).json({
      success: true,
      data: {
        ephemeralTimerSeconds: timerSeconds ? Number(timerSeconds) : null
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Create a multi-party group conversation
 * @route   POST /api/conversations/group
 * @access  Private (Authenticated)
 */
const createGroupConversation = async (req, res, next) => {
  try {
    const creatorId = req.user.id;
    const { title, memberIds } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, error: 'Group title is required.' });
    }

    if (!Array.isArray(memberIds) || memberIds.length < 1) {
      return res.status(400).json({ success: false, error: 'Please select at least 1 member.' });
    }

    const invitedMemberIds = memberIds.map(Number).filter((id) => id && id !== creatorId);
    if (invitedMemberIds.length === 0) {
      return res.status(400).json({ success: false, error: 'Please select at least 1 other user.' });
    }

    // Verify blocking and privacy settings for each invited member
    for (const memberId of invitedMemberIds) {
      const blockRes = await query(
        'SELECT 1 FROM blocked_users WHERE (blocker_id = $1 AND blocked_id = $2) OR (blocker_id = $2 AND blocked_id = $1) LIMIT 1',
        [creatorId, memberId]
      );
      if (blockRes.rows.length > 0) {
        return res.status(403).json({
          success: false,
          error: 'Cannot add a blocked user to the group.'
        });
      }

      const userRes = await query(
        'SELECT username, allow_group_add_from FROM users WHERE id = $1 LIMIT 1',
        [memberId]
      );
      if (userRes.rows.length === 0) {
        return res.status(404).json({ success: false, error: `User ID ${memberId} not found.` });
      }

      const { username, allow_group_add_from: allowGroup } = userRes.rows[0];
      const setting = allowGroup || 'everyone';

      if (setting === 'nobody') {
        return res.status(403).json({
          success: false,
          error: `@${username} does not allow being added to groups.`
        });
      }

      if (setting === 'following') {
        const followRes = await query(
          'SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = $2 LIMIT 1',
          [memberId, creatorId]
        );
        if (followRes.rows.length === 0) {
          return res.status(403).json({
            success: false,
            error: `@${username} only allows accounts they follow to add them to groups.`
          });
        }
      }
    }

    const allMemberIds = Array.from(new Set([creatorId, ...invitedMemberIds]));

    const convRes = await query(`
      INSERT INTO conversations (type, title, created_by)
      VALUES ('group', $1, $2)
      RETURNING id, type, title, created_at, updated_at
    `, [title.trim(), creatorId]);

    const newConv = convRes.rows[0];

    for (const memberId of allMemberIds) {
      const role = memberId === creatorId ? 'admin' : 'member';
      await query(`
        INSERT INTO conversation_members (conversation_id, user_id, role)
        VALUES ($1, $2, $3)
        ON CONFLICT DO NOTHING
      `, [newConv.id, memberId, role]);
    }

    const membersRes = await query(`
      SELECT u.id, u.username, u.full_name, u.avatar_url, cm.role
      FROM conversation_members cm
      JOIN users u ON cm.user_id = u.id
      WHERE cm.conversation_id = $1
    `, [newConv.id]);

    const io = req.app.get('io');
    if (io) {
      allMemberIds.forEach((uid) => {
        io.to(`user:${uid}`).emit('conversation:created', {
          conversation: newConv,
          members: membersRes.rows
        });
      });
    }

    res.status(201).json({
      success: true,
      data: {
        conversation: newConv,
        members: membersRes.rows
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Delete a group conversation
 * @route   DELETE /api/conversations/:id
 * @access  Private (Admin / Owner only)
 */
const deleteGroup = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const cleanId = (id || '').replace(/^(group-)+/i, '').trim();

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(cleanId);
    if (!isUuid) {
      const io = req.app.get('io');
      if (io) {
        io.to(`conv:${cleanId}`).emit('group:deleted', { conversationId: cleanId });
      }
      return res.status(200).json({
        success: true,
        message: 'Group deleted successfully.'
      });
    }

    const convRes = await query(
      'SELECT id, type, title, created_by FROM conversations WHERE id = $1 LIMIT 1',
      [cleanId]
    );

    if (convRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Group conversation not found.' });
    }

    const conv = convRes.rows[0];
    if (conv.type !== 'group') {
      return res.status(400).json({ success: false, error: 'This conversation is not a group.' });
    }

    // Check if requester is admin or created_by
    const memberRes = await query(
      'SELECT role FROM conversation_members WHERE conversation_id = $1 AND user_id = $2 LIMIT 1',
      [cleanId, userId]
    );

    const isCreator = conv.created_by && Number(conv.created_by) === Number(userId);
    const isAdmin = memberRes.rows.length > 0 && memberRes.rows[0].role === 'admin';

    if (!isCreator && !isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Only group admins or the creator can delete this group.'
      });
    }

    // Retrieve all member IDs to notify before deleting
    const membersRes = await query(
      'SELECT user_id FROM conversation_members WHERE conversation_id = $1',
      [cleanId]
    );
    const memberIds = membersRes.rows.map((r) => r.user_id);

    // Cascade delete conversation
    await query('DELETE FROM conversations WHERE id = $1', [cleanId]);

    // Socket.IO notifications
    const io = req.app.get('io');
    if (io) {
      io.to(`conv:${cleanId}`).emit('group:deleted', { conversationId: cleanId, title: conv.title });
      memberIds.forEach((uid) => {
        io.to(`user:${uid}`).emit('group:deleted', { conversationId: cleanId, title: conv.title });
      });
    }

    res.status(200).json({
      success: true,
      message: 'Group deleted successfully.'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Leave a group conversation
 * @route   POST /api/conversations/:id/leave
 * @access  Private (Group Member)
 */
const leaveGroup = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const cleanId = (id || '').replace(/^(group-)+/i, '').trim();

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(cleanId);
    if (!isUuid) {
      return res.status(200).json({
        success: true,
        message: 'Successfully left the group.'
      });
    }

    // Check membership
    let memberRes = await query(
      'SELECT role FROM conversation_members WHERE conversation_id = $1 AND user_id = $2 LIMIT 1',
      [cleanId, userId]
    );

    // If user created conversation but membership record was delayed, auto-register creator
    if (memberRes.rows.length === 0) {
      try {
        const creatorCheck = await query(
          `SELECT id, created_by FROM conversations WHERE id = $1 LIMIT 1`,
          [cleanId]
        );
        if (creatorCheck?.rows?.length > 0 && Number(creatorCheck.rows[0].created_by) === Number(userId)) {
          await query(
            `INSERT INTO conversation_members (conversation_id, user_id, role) VALUES ($1, $2, 'admin') ON CONFLICT DO NOTHING`,
            [cleanId, userId]
          );
          const reCheck = await query(
            'SELECT role FROM conversation_members WHERE conversation_id = $1 AND user_id = $2 LIMIT 1',
            [cleanId, userId]
          );
          if (reCheck?.rows?.length > 0) {
            memberRes = reCheck;
          }
        }
      } catch (_) {}
    }

    if (memberRes.rows.length === 0) {
      return res.status(400).json({ success: false, error: 'You are not a member of this group.' });
    }

    const allMembersRes = await query(
      'SELECT user_id, role FROM conversation_members WHERE conversation_id = $1',
      [cleanId]
    );

    // If leaving user is the sole member, delete the group entirely
    if (allMembersRes.rows.length <= 1) {
      await query('DELETE FROM conversations WHERE id = $1', [cleanId]);
      const io = req.app.get('io');
      if (io) {
        io.to(`user:${userId}`).emit('group:deleted', { conversationId: cleanId });
      }
      return res.status(200).json({
        success: true,
        message: 'You were the last member. Group has been deleted.'
      });
    }

    // If leaving user is creator/admin, transfer admin to another member if no admins remain
    const remainingMembers = allMembersRes.rows.filter((m) => Number(m.user_id) !== Number(userId));
    const hasRemainingAdmin = remainingMembers.some((m) => m.role === 'admin');
    if (!hasRemainingAdmin && remainingMembers.length > 0) {
      const nextAdminId = remainingMembers[0].user_id;
      await query(
        `UPDATE conversation_members SET role = 'admin' WHERE conversation_id = $1 AND user_id = $2`,
        [cleanId, nextAdminId]
      );
      await query(
        `UPDATE conversations SET created_by = $1 WHERE id = $2`,
        [nextAdminId, cleanId]
      );
    }

    // Remove membership
    await query(
      'DELETE FROM conversation_members WHERE conversation_id = $1 AND user_id = $2',
      [cleanId, userId]
    );

    // Insert system message into chat
    const systemText = `@${req.user.username} left the group`;
    try {
      await query(
        `INSERT INTO messages (conversation_id, sender_id, recipient_id, content, message_type)
         VALUES ($1, $2, NULL, $3, 'system')`,
        [cleanId, userId, systemText]
      );
    } catch {}

    const io = req.app.get('io');
    if (io) {
      io.to(`conv:${cleanId}`).emit('group:member_left', {
        conversationId: cleanId,
        userId,
        username: req.user.username
      });
      io.to(`conv:${cleanId}`).emit('group:updated', {
        conversationId: cleanId,
        memberCount: remainingMembers.length
      });
      io.to(`user:${userId}`).emit('group:left', { conversationId: cleanId });

      remainingMembers.forEach((rm) => {
        io.to(`user:${rm.user_id}`).emit('group:updated', {
          conversationId: cleanId,
          memberCount: remainingMembers.length
        });
      });
    }

    res.status(200).json({
      success: true,
      message: 'Successfully left the group.'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Add member(s) to a group
 * @route   POST /api/conversations/:id/members
 * @access  Private (Group Member / Admin)
 */
const addMembers = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { memberIds } = req.body;
    const cleanId = (id || '').replace(/^(group-)+/i, '').trim();

    if (!Array.isArray(memberIds) || memberIds.length === 0) {
      return res.status(400).json({ success: false, error: 'memberIds array is required.' });
    }

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(cleanId);
    if (!isUuid) {
      return res.status(400).json({ success: false, error: 'Invalid group conversation ID.' });
    }

    // Verify requester is in the group
    const requesterRes = await query(
      'SELECT role FROM conversation_members WHERE conversation_id = $1 AND user_id = $2 LIMIT 1',
      [cleanId, userId]
    );

    if (requesterRes.rows.length === 0) {
      return res.status(403).json({ success: false, error: 'You must be a group member to add participants.' });
    }

    const addedUsernames = [];
    for (const rawMemberId of memberIds) {
      const memberId = Number(rawMemberId);
      if (!memberId || isNaN(memberId)) continue;

      // Privacy check
      const privRes = await query(
        'SELECT username, allow_group_add_from FROM users WHERE id = $1 LIMIT 1',
        [memberId]
      );
      if (privRes.rows.length === 0) continue;

      const setting = privRes.rows[0].allow_group_add_from || 'everyone';
      const username = privRes.rows[0].username;

      if (setting === 'nobody') {
        return res.status(403).json({
          success: false,
          error: `@${username} does not allow being added to groups.`
        });
      }

      if (setting === 'following') {
        const followRes = await query(
          'SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = $2 LIMIT 1',
          [memberId, userId]
        );
        if (followRes.rows.length === 0) {
          return res.status(403).json({
            success: false,
            error: `@${username} only allows accounts they follow to add them to groups.`
          });
        }
      }

      await query(
        `INSERT INTO conversation_members (conversation_id, user_id, role)
         VALUES ($1, $2, 'member')
         ON CONFLICT DO NOTHING`,
        [cleanId, memberId]
      );
      addedUsernames.push(username);
    }

    // Insert system message
    if (addedUsernames.length > 0) {
      const sysMsg = `@${req.user.username} added ${addedUsernames.map(u => `@${u}`).join(', ')}`;
      try {
        await query(
          `INSERT INTO messages (conversation_id, sender_id, recipient_id, content, message_type)
           VALUES ($1, $2, NULL, $3, 'system')`,
          [cleanId, userId, sysMsg]
        );
      } catch {}
    }

    const membersRes = await query(
      `SELECT u.id, u.username, u.full_name, u.avatar_url, cm.role
       FROM conversation_members cm
       JOIN users u ON cm.user_id = u.id
       WHERE cm.conversation_id = $1
       ORDER BY cm.role = 'admin' DESC, u.username ASC`,
      [cleanId]
    );

    const convRes = await query('SELECT * FROM conversations WHERE id = $1', [cleanId]);

    const io = req.app.get('io');
    if (io) {
      io.to(`conv:${cleanId}`).emit('group:members_added', {
        conversationId: cleanId,
        members: membersRes.rows
      });
      io.to(`conv:${cleanId}`).emit('group:updated', {
        conversationId: cleanId,
        memberCount: membersRes.rows.length,
        members: membersRes.rows
      });
      memberIds.forEach((mId) => {
        io.to(`user:${mId}`).emit('conversation:created', {
          conversation: convRes.rows[0],
          members: membersRes.rows
        });
      });
      membersRes.rows.forEach((m) => {
        io.to(`user:${m.id}`).emit('group:updated', {
          conversationId: cleanId,
          memberCount: membersRes.rows.length
        });
      });
    }

    res.status(200).json({
      success: true,
      data: {
        members: membersRes.rows
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Remove a member from a group
 * @route   DELETE /api/conversations/:id/members/:userId
 * @access  Private (Admin only)
 */
const removeMember = async (req, res, next) => {
  try {
    const { id, userId: targetUserIdStr } = req.params;
    const requesterId = req.user.id;
    const targetUserId = parseInt(targetUserIdStr, 10);
    const cleanId = (id || '').replace(/^(group-)+/i, '').trim();

    if (isNaN(targetUserId)) {
      return res.status(400).json({ success: false, error: 'Invalid target user ID.' });
    }

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(cleanId);
    if (!isUuid) {
      return res.status(400).json({ success: false, error: 'Invalid group conversation ID.' });
    }

    // Check requester role
    const reqMemberRes = await query(
      'SELECT role FROM conversation_members WHERE conversation_id = $1 AND user_id = $2 LIMIT 1',
      [cleanId, requesterId]
    );

    if (reqMemberRes.rows.length === 0 || reqMemberRes.rows[0].role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Only group admins can remove members.' });
    }

    // Check conversation owner
    const convRes = await query('SELECT created_by FROM conversations WHERE id = $1 LIMIT 1', [cleanId]);
    if (convRes.rows.length > 0 && Number(convRes.rows[0].created_by) === Number(targetUserId)) {
      return res.status(403).json({ success: false, error: 'Cannot remove the group owner.' });
    }

    // Get target username
    const targetUserRes = await query('SELECT username FROM users WHERE id = $1 LIMIT 1', [targetUserId]);
    const targetUsername = targetUserRes.rows[0]?.username || 'User';

    // Remove member
    await query(
      'DELETE FROM conversation_members WHERE conversation_id = $1 AND user_id = $2',
      [cleanId, targetUserId]
    );

    // Insert system message
    const sysMsg = `@${req.user.username} removed @${targetUsername}`;
    try {
      await query(
        `INSERT INTO messages (conversation_id, sender_id, recipient_id, content, message_type)
         VALUES ($1, $2, NULL, $3, 'system')`,
        [cleanId, requesterId, sysMsg]
      );
    } catch {}

    const io = req.app.get('io');
    if (io) {
      io.to(`conv:${cleanId}`).emit('group:member_removed', {
        conversationId: cleanId,
        userId: targetUserId,
        username: targetUsername
      });
      io.to(`conv:${cleanId}`).emit('group:updated', { conversationId: cleanId });
      io.to(`user:${targetUserId}`).emit('group:removed', { conversationId: cleanId });

      try {
        const remainingMembers = await query('SELECT user_id FROM conversation_members WHERE conversation_id = $1', [cleanId]);
        for (const rm of remainingMembers.rows) {
          io.to(`user:${rm.user_id}`).emit('group:updated', {
            conversationId: cleanId,
            memberCount: remainingMembers.rows.length
          });
        }
      } catch (_) {}
    }

    res.status(200).json({
      success: true,
      message: `@${targetUsername} has been removed from the group.`
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update group title / details
 * @route   PUT /api/conversations/:id
 * @access  Private (Admin only)
 */
const updateGroup = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { title } = req.body;
    const cleanId = (id || '').replace(/^(group-)+/i, '').trim();

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, error: 'Group title is required.' });
    }

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(cleanId);
    if (!isUuid) {
      return res.status(400).json({ success: false, error: 'Invalid group conversation ID.' });
    }

    const memberRes = await query(
      'SELECT role FROM conversation_members WHERE conversation_id = $1 AND user_id = $2 LIMIT 1',
      [cleanId, userId]
    );

    if (memberRes.rows.length === 0 || memberRes.rows[0].role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Only group admins can update group details.' });
    }

    const updateRes = await query(
      `UPDATE conversations
       SET title = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING id, type, title, created_by, updated_at`,
      [title.trim(), cleanId]
    );

    const updatedConv = updateRes.rows[0];

    const io = req.app.get('io');
    if (io) {
      io.to(`conv:${cleanId}`).emit('group:updated', { conversation: updatedConv });
    }

    res.status(200).json({
      success: true,
      data: { conversation: updatedConv }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all members of a group
 * @route   GET /api/conversations/:id/members
 * @access  Private (Group Member)
 */
const getGroupMembers = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const cleanId = (id || '').replace(/^(group-)+/i, '').trim();

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(cleanId);
    if (!isUuid) {
      return res.status(200).json({
        success: true,
        data: { members: [] }
      });
    }

    let memberCheck = await query(
      'SELECT role FROM conversation_members WHERE conversation_id = $1 AND user_id = $2 LIMIT 1',
      [cleanId, userId]
    );

    // If user created conversation but membership record was delayed, auto-register creator
    if (memberCheck.rows.length === 0) {
      try {
        const creatorCheck = await query(
          `SELECT id, created_by FROM conversations WHERE id = $1 LIMIT 1`,
          [cleanId]
        );
        if (creatorCheck?.rows?.length > 0 && Number(creatorCheck.rows[0].created_by) === Number(userId)) {
          await query(
            `INSERT INTO conversation_members (conversation_id, user_id, role) VALUES ($1, $2, 'admin') ON CONFLICT DO NOTHING`,
            [cleanId, userId]
          );
          const reCheck = await query(
            'SELECT role FROM conversation_members WHERE conversation_id = $1 AND user_id = $2 LIMIT 1',
            [cleanId, userId]
          );
          if (reCheck?.rows?.length > 0) {
            memberCheck = reCheck;
          }
        }
      } catch (_) {}
    }

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ success: false, error: 'You are not a member of this group.' });
    }

    const membersRes = await query(
      `SELECT u.id, u.username, u.full_name, u.avatar_url, cm.role
       FROM conversation_members cm
       JOIN users u ON cm.user_id = u.id
       WHERE cm.conversation_id = $1
       ORDER BY cm.role = 'admin' DESC, u.username ASC`,
      [cleanId]
    );

    const convRes = await query(
      'SELECT id, title, type, created_by, description, avatar_url, invite_code, permissions, ephemeral_timer_seconds, created_at, updated_at FROM conversations WHERE id = $1 LIMIT 1',
      [cleanId]
    );

    res.status(200).json({
      success: true,
      data: {
        conversation: convRes.rows[0] || null,
        members: membersRes.rows
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update group title, description, and avatar
 * @route   PUT /api/conversations/:id/info
 * @access  Private (Admin or Member with info edit permission)
 */
const updateGroupInfo = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { title, description, avatar_url } = req.body;
    const cleanId = (id || '').replace(/^(group-)+/i, '').trim();

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(cleanId);
    if (!isUuid) {
      return res.status(400).json({ success: false, error: 'Invalid group conversation ID.' });
    }

    const memberRes = await query(
      `SELECT cm.role, c.permissions, c.created_by
       FROM conversation_members cm
       JOIN conversations c ON c.id = cm.conversation_id
       WHERE cm.conversation_id = $1 AND cm.user_id = $2 LIMIT 1`,
      [cleanId, userId]
    );

    if (memberRes.rows.length === 0) {
      return res.status(403).json({ success: false, error: 'You are not a member of this group.' });
    }

    const member = memberRes.rows[0];
    const perms = member.permissions || {};
    const isAdmin = member.role === 'admin' || Number(member.created_by) === Number(userId);
    const canEdit = isAdmin || perms.allow_member_info_edit === true;

    if (!canEdit) {
      return res.status(403).json({ success: false, error: 'Only admins can edit group info.' });
    }

    const updateRes = await query(
      `UPDATE conversations
       SET title = COALESCE($1, title),
           description = COALESCE($2, description),
           avatar_url = COALESCE($3, avatar_url),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING id, type, title, description, avatar_url, created_by, permissions, ephemeral_timer_seconds, created_at, updated_at`,
      [
        title !== undefined && title.trim() ? title.trim() : null,
        description !== undefined ? description.trim() : null,
        avatar_url !== undefined ? avatar_url : null,
        cleanId
      ]
    );

    const updatedConv = updateRes.rows[0];

    const io = req.app.get('io');
    if (io) {
      io.to(`conv:${cleanId}`).emit('group:updated', { conversation: updatedConv });
    }

    res.status(200).json({
      success: true,
      data: { conversation: updatedConv }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get group permissions
 * @route   GET /api/conversations/:id/permissions
 * @access  Private (Member)
 */
const getGroupPermissions = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const cleanId = (id || '').replace(/^(group-)+/i, '').trim();

    const convRes = await query(
      `SELECT c.id, c.permissions, cm.role, c.created_by
       FROM conversations c
       JOIN conversation_members cm ON cm.conversation_id = c.id
       WHERE c.id = $1 AND cm.user_id = $2 LIMIT 1`,
      [cleanId, userId]
    );

    if (convRes.rows.length === 0) {
      return res.status(403).json({ success: false, error: 'Not a group member.' });
    }

    const row = convRes.rows[0];
    const defaultPerms = {
      allow_member_messages: true,
      allow_member_media: true,
      allow_member_invites: true,
      allow_member_info_edit: false,
      require_admin_approval: false,
      allow_anyone_to_join: true
    };

    res.status(200).json({
      success: true,
      data: {
        permissions: { ...defaultPerms, ...(row.permissions || {}) },
        isAdmin: row.role === 'admin' || Number(row.created_by) === Number(userId),
        isOwner: Number(row.created_by) === Number(userId)
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update group permissions
 * @route   PUT /api/conversations/:id/permissions
 * @access  Private (Admin only)
 */
const updateGroupPermissions = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { permissions } = req.body;
    const cleanId = (id || '').replace(/^(group-)+/i, '').trim();

    const memberRes = await query(
      `SELECT cm.role, c.created_by, c.permissions
       FROM conversation_members cm
       JOIN conversations c ON c.id = cm.conversation_id
       WHERE cm.conversation_id = $1 AND cm.user_id = $2 LIMIT 1`,
      [cleanId, userId]
    );

    if (memberRes.rows.length === 0) {
      return res.status(403).json({ success: false, error: 'Not a member.' });
    }

    const isAdm = memberRes.rows[0].role === 'admin' || Number(memberRes.rows[0].created_by) === Number(userId);
    if (!isAdm) {
      return res.status(403).json({ success: false, error: 'Only admins can modify permissions.' });
    }

    const merged = {
      ...(memberRes.rows[0].permissions || {}),
      ...(permissions || {})
    };

    const updateRes = await query(
      `UPDATE conversations
       SET permissions = $1::jsonb, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING id, permissions`,
      [JSON.stringify(merged), cleanId]
    );

    const io = req.app.get('io');
    if (io) {
      io.to(`conv:${cleanId}`).emit('group:permissions_updated', {
        conversationId: cleanId,
        permissions: updateRes.rows[0].permissions
      });
    }

    res.status(200).json({
      success: true,
      data: { permissions: updateRes.rows[0].permissions }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get or generate group invite code
 * @route   GET /api/conversations/:id/invite
 * @access  Private (Member / Admin)
 */
const getGroupInvite = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const cleanId = (id || '').replace(/^(group-)+/i, '').trim();

    const convRes = await query(
      `SELECT c.id, c.invite_code, c.permissions, cm.role, c.created_by
       FROM conversations c
       JOIN conversation_members cm ON cm.conversation_id = c.id
       WHERE c.id = $1 AND cm.user_id = $2 LIMIT 1`,
      [cleanId, userId]
    );

    if (convRes.rows.length === 0) {
      return res.status(403).json({ success: false, error: 'Not a group member.' });
    }

    const row = convRes.rows[0];
    const isAdmin = row.role === 'admin' || Number(row.created_by) === Number(userId);
    const perms = row.permissions || {};
    if (!isAdmin && perms.allow_member_invites === false) {
      return res.status(403).json({ success: false, error: 'Member invites are disabled for this group.' });
    }

    let code = row.invite_code;
    if (!code) {
      code = 'grp_' + crypto.randomBytes(6).toString('hex');
      await query('UPDATE conversations SET invite_code = $1 WHERE id = $2', [code, cleanId]);
    }

    res.status(200).json({
      success: true,
      data: {
        invite_code: code,
        invite_url: `/join/${code}`,
        allow_anyone_to_join: perms.allow_anyone_to_join !== false,
        require_admin_approval: !!perms.require_admin_approval
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Regenerate group invite code
 * @route   POST /api/conversations/:id/invite/regenerate
 * @access  Private (Admin only)
 */
const regenerateGroupInvite = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const cleanId = (id || '').replace(/^(group-)+/i, '').trim();

    const memberRes = await query(
      `SELECT cm.role, c.created_by
       FROM conversation_members cm
       JOIN conversations c ON c.id = cm.conversation_id
       WHERE cm.conversation_id = $1 AND cm.user_id = $2 LIMIT 1`,
      [cleanId, userId]
    );

    if (memberRes.rows.length === 0) {
      return res.status(403).json({ success: false, error: 'Not a group member.' });
    }

    const isAdmin = memberRes.rows[0].role === 'admin' || Number(memberRes.rows[0].created_by) === Number(userId);
    if (!isAdmin) {
      return res.status(403).json({ success: false, error: 'Only admins can regenerate invite codes.' });
    }

    const newCode = 'grp_' + crypto.randomBytes(6).toString('hex');
    await query('UPDATE conversations SET invite_code = $1 WHERE id = $2', [newCode, cleanId]);

    res.status(200).json({
      success: true,
      data: {
        invite_code: newCode,
        invite_url: `/join/${newCode}`
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Join group via invite code
 * @route   POST /api/conversations/join/:inviteCode
 * @access  Private (Authenticated)
 */
const joinGroupByInviteCode = async (req, res, next) => {
  try {
    const { inviteCode } = req.params;
    const userId = req.user.id;

    const convRes = await query(
      `SELECT id, title, description, avatar_url, permissions, created_by
       FROM conversations
       WHERE invite_code = $1 LIMIT 1`,
      [inviteCode]
    );

    if (convRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Group invite link is invalid or expired.' });
    }

    const conv = convRes.rows[0];
    const perms = conv.permissions || {};

    // Check if user is already a member
    const existing = await query(
      'SELECT role FROM conversation_members WHERE conversation_id = $1 AND user_id = $2 LIMIT 1',
      [conv.id, userId]
    );

    if (existing.rows.length > 0) {
      return res.status(200).json({
        success: true,
        data: {
          conversation_id: conv.id,
          already_member: true,
          message: 'You are already a member of this group.'
        }
      });
    }

    // Check if admin approval is required
    if (perms.require_admin_approval) {
      await query(
        `INSERT INTO group_join_requests (conversation_id, user_id, status)
         VALUES ($1, $2, 'pending')
         ON CONFLICT (conversation_id, user_id)
         DO UPDATE SET status = 'pending', updated_at = CURRENT_TIMESTAMP`,
        [conv.id, userId]
      );

      const io = req.app.get('io');
      if (io) {
        io.to(`conv:${conv.id}`).emit('group:join_request_created', {
          conversation_id: conv.id,
          user_id: userId,
          username: req.user.username,
          full_name: req.user.full_name,
          avatar_url: req.user.avatar_url
        });
      }

      return res.status(200).json({
        success: true,
        data: {
          requested: true,
          conversation_id: conv.id,
          title: conv.title,
          message: 'Join request submitted! Group admins will review your request.'
        }
      });
    }

    // Add directly
    await query(
      `INSERT INTO conversation_members (conversation_id, user_id, role)
       VALUES ($1, $2, 'member')
       ON CONFLICT (conversation_id, user_id) DO NOTHING`,
      [conv.id, userId]
    );

    const io = req.app.get('io');
    if (io) {
      io.to(`conv:${conv.id}`).emit('group:members_added', {
        conversationId: conv.id,
        members: [{ id: userId, username: req.user.username, full_name: req.user.full_name, avatar_url: req.user.avatar_url, role: 'member' }]
      });
    }

    res.status(200).json({
      success: true,
      data: {
        joined: true,
        conversation_id: conv.id,
        title: conv.title,
        message: 'Successfully joined the group!'
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get pending join requests for a group
 * @route   GET /api/conversations/:id/join-requests
 * @access  Private (Admin only)
 */
const getJoinRequests = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const cleanId = (id || '').replace(/^(group-)+/i, '').trim();

    const memberRes = await query(
      `SELECT cm.role, c.created_by
       FROM conversation_members cm
       JOIN conversations c ON c.id = cm.conversation_id
       WHERE cm.conversation_id = $1 AND cm.user_id = $2 LIMIT 1`,
      [cleanId, userId]
    );

    if (memberRes.rows.length === 0) {
      return res.status(403).json({ success: false, error: 'Not a member.' });
    }

    const isAdmin = memberRes.rows[0].role === 'admin' || Number(memberRes.rows[0].created_by) === Number(userId);
    if (!isAdmin) {
      return res.status(403).json({ success: false, error: 'Only admins can review join requests.' });
    }

    const requestsRes = await query(
      `SELECT jr.id, jr.user_id, jr.status, jr.created_at,
              u.username, u.full_name, u.avatar_url
       FROM group_join_requests jr
       JOIN users u ON u.id = jr.user_id
       WHERE jr.conversation_id = $1 AND jr.status = 'pending'
       ORDER BY jr.created_at DESC`,
      [cleanId]
    );

    res.status(200).json({
      success: true,
      data: { requests: requestsRes.rows }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Review (approve/reject) a join request
 * @route   POST /api/conversations/:id/join-requests/:requestId/review
 * @access  Private (Admin only)
 */
const reviewJoinRequest = async (req, res, next) => {
  try {
    const { id, requestId } = req.params;
    const userId = req.user.id;
    const { action } = req.body;
    const cleanId = (id || '').replace(/^(group-)+/i, '').trim();

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ success: false, error: 'Invalid action. Must be approve or reject.' });
    }

    const memberRes = await query(
      `SELECT cm.role, c.created_by
       FROM conversation_members cm
       JOIN conversations c ON c.id = cm.conversation_id
       WHERE cm.conversation_id = $1 AND cm.user_id = $2 LIMIT 1`,
      [cleanId, userId]
    );

    if (memberRes.rows.length === 0) {
      return res.status(403).json({ success: false, error: 'Not a member.' });
    }

    const isAdmin = memberRes.rows[0].role === 'admin' || Number(memberRes.rows[0].created_by) === Number(userId);
    if (!isAdmin) {
      return res.status(403).json({ success: false, error: 'Only admins can review join requests.' });
    }

    const reqRes = await query(
      `SELECT id, user_id, conversation_id, status
       FROM group_join_requests
       WHERE id = $1 AND conversation_id = $2 LIMIT 1`,
      [requestId, cleanId]
    );

    if (reqRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Join request not found.' });
    }

    const targetUserId = reqRes.rows[0].user_id;

    if (action === 'approve') {
      await query('UPDATE group_join_requests SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', ['approved', requestId]);
      await query(
        `INSERT INTO conversation_members (conversation_id, user_id, role)
         VALUES ($1, $2, 'member')
         ON CONFLICT (conversation_id, user_id) DO NOTHING`,
        [cleanId, targetUserId]
      );

      const io = req.app.get('io');
      if (io) {
        io.to(`conv:${cleanId}`).emit('group:members_added', {
          conversationId: cleanId,
          members: [{ id: targetUserId, role: 'member' }]
        });
      }
    } else {
      await query('UPDATE group_join_requests SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', ['rejected', requestId]);
    }

    res.status(200).json({
      success: true,
      data: { requestId, action, status: action === 'approve' ? 'approved' : 'rejected' }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Promote or demote group member role
 * @route   PUT /api/conversations/:id/members/:userId/role
 * @access  Private (Admin / Owner)
 */
const updateMemberRole = async (req, res, next) => {
  try {
    const { id, userId: targetUserId } = req.params;
    const actorId = req.user.id;
    const { role } = req.body;
    const cleanId = (id || '').replace(/^(group-)+/i, '').trim();

    if (!['admin', 'member'].includes(role)) {
      return res.status(400).json({ success: false, error: 'Role must be admin or member.' });
    }

    const convRes = await query(
      'SELECT id, created_by FROM conversations WHERE id = $1 LIMIT 1',
      [cleanId]
    );
    if (convRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Group not found.' });
    }

    const conv = convRes.rows[0];
    const isOwner = Number(conv.created_by) === Number(actorId);

    const actorMember = await query(
      'SELECT role FROM conversation_members WHERE conversation_id = $1 AND user_id = $2 LIMIT 1',
      [cleanId, actorId]
    );

    if (actorMember.rows.length === 0) {
      return res.status(403).json({ success: false, error: 'Not a member.' });
    }

    const isActorAdmin = isOwner || actorMember.rows[0].role === 'admin';
    if (!isActorAdmin) {
      return res.status(403).json({ success: false, error: 'Only admins can change member roles.' });
    }

    // Owner cannot be demoted
    if (Number(targetUserId) === Number(conv.created_by) && role !== 'admin') {
      return res.status(400).json({ success: false, error: 'The group creator/owner cannot be demoted.' });
    }

    // Only owner can demote an admin
    if (role === 'member' && !isOwner) {
      return res.status(403).json({ success: false, error: 'Only the group owner can demote an admin.' });
    }

    await query(
      'UPDATE conversation_members SET role = $1 WHERE conversation_id = $2 AND user_id = $3',
      [role, cleanId, targetUserId]
    );

    const io = req.app.get('io');
    if (io) {
      io.to(`conv:${cleanId}`).emit('group:role_updated', {
        conversationId: cleanId,
        userId: Number(targetUserId),
        role
      });
    }

    res.status(200).json({
      success: true,
      data: { userId: Number(targetUserId), role }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all media, files, and links for a group conversation
 * @route   GET /api/conversations/:id/media
 * @access  Private (Member)
 */
const getGroupMedia = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const cleanId = (id || '').replace(/^(group-)+/i, '').trim();

    const memberCheck = await query(
      'SELECT role FROM conversation_members WHERE conversation_id = $1 AND user_id = $2 LIMIT 1',
      [cleanId, userId]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ success: false, error: 'Not a member.' });
    }

    const mediaRes = await query(
      `SELECT m.id, m.sender_id, m.content, m.message_type, m.created_at,
              u.username, u.full_name, u.avatar_url
       FROM messages m
       JOIN users u ON u.id = m.sender_id
       WHERE m.conversation_id = $1 AND m.is_deleted = false
       ORDER BY m.created_at DESC`,
      [cleanId]
    );

    const photos = [];
    const videos = [];
    const files = [];
    const links = [];

    const urlRegex = /(https?:\/\/[^\s]+)/gi;

    for (const msg of mediaRes.rows) {
      const type = (msg.message_type || 'text').toLowerCase();
      const content = msg.content || '';

      if (type === 'image' || content.match(/\.(jpeg|jpg|gif|png|webp|svg)(\?.*)?$/i)) {
        photos.push({
          id: msg.id,
          url: content,
          sender: { id: msg.sender_id, username: msg.username, full_name: msg.full_name },
          created_at: msg.created_at
        });
      } else if (type === 'video' || content.match(/\.(mp4|webm|mov|ogg)(\?.*)?$/i)) {
        videos.push({
          id: msg.id,
          url: content,
          sender: { id: msg.sender_id, username: msg.username, full_name: msg.full_name },
          created_at: msg.created_at
        });
      } else if (type === 'file' || content.match(/\.(pdf|doc|docx|xls|xlsx|zip|tar|gz|txt)(\?.*)?$/i)) {
        const nameMatch = content.split('/').pop() || 'document.file';
        files.push({
          id: msg.id,
          url: content,
          name: nameMatch,
          size: '1.2 MB',
          sender: { id: msg.sender_id, username: msg.username, full_name: msg.full_name },
          created_at: msg.created_at
        });
      }

      const foundLinks = content.match(urlRegex);
      if (foundLinks) {
        for (const link of foundLinks) {
          links.push({
            id: `${msg.id}-${links.length}`,
            url: link,
            sender: { id: msg.sender_id, username: msg.username, full_name: msg.full_name },
            created_at: msg.created_at
          });
        }
      }
    }

    res.status(200).json({
      success: true,
      data: {
        photos,
        videos,
        files,
        links
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getConversations,
  getOrCreateConversation,
  createGroupConversation,
  deleteGroup,
  leaveGroup,
  addMembers,
  removeMember,
  updateGroup,
  getGroupMembers,
  getMessages,
  sendMessage,
  deleteMessage,
  toggleReaction,
  uploadEncryptedAttachment,
  updateEphemeralTimer,
  updateGroupInfo,
  getGroupPermissions,
  updateGroupPermissions,
  getGroupInvite,
  regenerateGroupInvite,
  joinGroupByInviteCode,
  getJoinRequests,
  reviewJoinRequest,
  updateMemberRole,
  getGroupMedia
};
