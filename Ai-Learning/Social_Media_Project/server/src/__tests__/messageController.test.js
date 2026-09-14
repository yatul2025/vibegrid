/**
 * server/src/__tests__/messageController.test.js
 * ================================================
 * Unit tests for editMessage and deleteMessage controller functions.
 *
 * These tests mock the database `query` function and Socket.IO to test
 * the controller logic in isolation.
 */

const {
  getMessages,
  sendMessage,
  markConversationAsRead,
  editMessage,
  deleteMessage,
  toggleReaction,
  forwardMessage,
  getMessageInfo,
  toggleStarMessage,
  getStarredMessages,
  togglePinMessage,
  bulkDeleteMessages,
  bulkStarMessages,
  bulkForwardMessages,
  toggleMuteConversation,
  togglePinConversation,
  toggleArchiveConversation,
  clearConversationMessages,
  reportEntity
} = require('../controllers/messageController');

// ─── Mocks ───────────────────────────────────────────────────────────
// Mock the DB query function
jest.mock('../config/db', () => ({
  query: jest.fn()
}));

const { query } = require('../config/db');

// ─── Helpers ─────────────────────────────────────────────────────────
const mockReq = (overrides = {}) => ({
  user: { id: 1 },
  params: { id: '100' },
  body: {},
  query: {},
  app: {
    get: jest.fn(() => null) // No io by default
  },
  ...overrides
});

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const mockNext = jest.fn();

const mockIo = () => {
  const emitFn = jest.fn();
  const toFn = jest.fn(() => ({ emit: emitFn }));
  return { to: toFn, emit: emitFn, _toFn: toFn, _emitFn: emitFn };
};

beforeEach(() => {
  jest.clearAllMocks();
});

// =====================================================================
// editMessage tests
// =====================================================================
describe('editMessage', () => {
  it('should return 404 if message does not exist', async () => {
    query.mockResolvedValueOnce({ rows: [] });

    const req = mockReq({ body: { content: 'updated' } });
    const res = mockRes();
    await editMessage(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: 'Message not found.' })
    );
  });

  it('should return 403 if user is not the sender', async () => {
    query.mockResolvedValueOnce({
      rows: [{ id: 100, sender_id: 99, recipient_id: 1, conversation_id: 10, is_deleted: false, message_type: 'text' }]
    });

    const req = mockReq({ body: { content: 'updated' } });
    const res = mockRes();
    await editMessage(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'You can only edit your own messages.' })
    );
  });

  it('should return 400 if message is already deleted', async () => {
    query.mockResolvedValueOnce({
      rows: [{ id: 100, sender_id: 1, recipient_id: 2, conversation_id: 10, is_deleted: true, message_type: 'text' }]
    });

    const req = mockReq({ body: { content: 'updated' } });
    const res = mockRes();
    await editMessage(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Deleted messages cannot be edited.' })
    );
  });

  it('should return 400 if message is a call_log', async () => {
    query.mockResolvedValueOnce({
      rows: [{ id: 100, sender_id: 1, recipient_id: 2, conversation_id: 10, is_deleted: false, message_type: 'call_log' }]
    });

    const req = mockReq({ body: { content: 'updated' } });
    const res = mockRes();
    await editMessage(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Call logs cannot be edited.' })
    );
  });

  it('should return 400 if content is empty and no ciphertext', async () => {
    query.mockResolvedValueOnce({
      rows: [{ id: 100, sender_id: 1, recipient_id: 2, conversation_id: 10, is_deleted: false, message_type: 'text' }]
    });

    const req = mockReq({ body: { content: '   ' } });
    const res = mockRes();
    await editMessage(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Message content cannot be empty.' })
    );
  });

  it('should successfully edit a message and return 200', async () => {
    const updatedRow = {
      id: 100, sender_id: 1, recipient_id: 2, conversation_id: 10,
      content: 'updated text', ciphertext: 'enc', iv_nonce: 'iv',
      edited_at: '2026-09-14T00:00:00Z'
    };

    // First query: lookup the message
    query.mockResolvedValueOnce({
      rows: [{ id: 100, sender_id: 1, recipient_id: 2, conversation_id: 10, is_deleted: false, message_type: 'text' }]
    });
    // Second query: UPDATE
    query.mockResolvedValueOnce({ rows: [updatedRow] });

    const req = mockReq({ body: { content: 'updated text', ciphertext: 'enc', ivNonce: 'iv' } });
    const res = mockRes();
    await editMessage(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: { message: updatedRow }
      })
    );
  });

  it('should emit message:edit via Socket.IO when io is available', async () => {
    const updatedRow = {
      id: 100, sender_id: 1, recipient_id: 2, conversation_id: 10,
      content: 'new text', ciphertext: null, iv_nonce: null,
      edited_at: '2026-09-14T01:00:00Z'
    };

    query.mockResolvedValueOnce({
      rows: [{ id: 100, sender_id: 1, recipient_id: 2, conversation_id: 10, is_deleted: false, message_type: 'text' }]
    });
    query.mockResolvedValueOnce({ rows: [updatedRow] });

    const io = mockIo();
    const req = mockReq({
      body: { content: 'new text' },
      app: { get: jest.fn(() => io) }
    });
    const res = mockRes();
    await editMessage(req, res, mockNext);

    expect(io._toFn).toHaveBeenCalledWith('user:2');
    expect(io._emitFn).toHaveBeenCalledWith('message:edit', expect.objectContaining({
      messageId: 100,
      content: 'new text'
    }));
  });
});

// =====================================================================
// deleteMessage tests
// =====================================================================
describe('deleteMessage', () => {
  it('should return 404 if message does not exist', async () => {
    query.mockResolvedValueOnce({ rows: [] });

    const req = mockReq();
    const res = mockRes();
    await deleteMessage(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('should return 403 if user is neither sender nor recipient', async () => {
    query.mockResolvedValueOnce({
      rows: [{ id: 100, sender_id: 50, recipient_id: 60, conversation_id: 10, is_deleted: false }]
    });

    const req = mockReq();
    const res = mockRes();
    await deleteMessage(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Not authorized to delete this message.' })
    );
  });

  it('should return 403 if non-sender tries to delete for everyone', async () => {
    query.mockResolvedValueOnce({
      rows: [{ id: 100, sender_id: 50, recipient_id: 1, conversation_id: 10, is_deleted: false }]
    });

    const req = mockReq({ query: { type: 'for_everyone' } });
    const res = mockRes();
    await deleteMessage(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Only the sender can delete a message for everyone.' })
    );
  });

  it('should soft-delete for everyone when sender requests it', async () => {
    query.mockResolvedValueOnce({
      rows: [{ id: 100, sender_id: 1, recipient_id: 2, conversation_id: 10, is_deleted: false }]
    });
    query.mockResolvedValueOnce({ rowCount: 1 }); // UPDATE

    const req = mockReq({ query: { type: 'for_everyone' } });
    const res = mockRes();
    await deleteMessage(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: { messageId: 100, forEveryone: true }
      })
    );

    // Verify the UPDATE query was called with is_deleted = TRUE
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('SET is_deleted = TRUE'),
      ['100']
    );
  });

  it('should insert into message_deletions for delete-for-me', async () => {
    query.mockResolvedValueOnce({
      rows: [{ id: 100, sender_id: 1, recipient_id: 2, conversation_id: 10, is_deleted: false }]
    });
    query.mockResolvedValueOnce({ rowCount: 1 }); // INSERT

    const req = mockReq({ query: { type: 'for_me' } });
    const res = mockRes();
    await deleteMessage(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: { messageId: 100, forEveryone: false }
      })
    );

    // Verify INSERT into message_deletions
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO message_deletions'),
      ['100', 1]
    );
  });

  it('should emit message:delete via Socket.IO for delete-for-everyone', async () => {
    query.mockResolvedValueOnce({
      rows: [{ id: 100, sender_id: 1, recipient_id: 2, conversation_id: 10, is_deleted: false }]
    });
    query.mockResolvedValueOnce({ rowCount: 1 });

    const io = mockIo();
    const req = mockReq({
      query: { type: 'for_everyone' },
      app: { get: jest.fn(() => io) }
    });
    const res = mockRes();
    await deleteMessage(req, res, mockNext);

    expect(io._toFn).toHaveBeenCalledWith('user:2');
    expect(io._emitFn).toHaveBeenCalledWith('message:delete', expect.objectContaining({
      messageId: 100,
      forEveryone: true
    }));
  });

  it('should call next(error) on unexpected error', async () => {
    query.mockRejectedValueOnce(new Error('DB connection lost'));

    const req = mockReq();
    const res = mockRes();
    await deleteMessage(req, res, mockNext);

    expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
  });
});

// =====================================================================
// toggleReaction tests
// =====================================================================
describe('toggleReaction', () => {
  it('should return 400 if reaction is missing', async () => {
    const req = mockReq({ body: {} });
    const res = mockRes();
    await toggleReaction(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('should return 404 if message does not exist', async () => {
    query.mockResolvedValueOnce({ rows: [] });

    const req = mockReq({ body: { reaction: '❤️' } });
    const res = mockRes();
    await toggleReaction(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('should return 403 if user is not in conversation', async () => {
    query.mockResolvedValueOnce({
      rows: [{ id: 100, sender_id: 50, recipient_id: 60, conversation_id: 'conv-1' }]
    });

    const req = mockReq({ body: { reaction: '❤️' } });
    const res = mockRes();
    await toggleReaction(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('should add reaction if not previously reacted', async () => {
    query.mockResolvedValueOnce({
      rows: [{ id: 100, sender_id: 1, recipient_id: 2, conversation_id: 'conv-1' }]
    });
    query.mockResolvedValueOnce({ rows: [] }); // No existing reaction
    query.mockResolvedValueOnce({ rowCount: 1 }); // INSERT
    query.mockResolvedValueOnce({
      rows: [{ id: 1, user_id: 1, username: 'test', reaction: '❤️' }]
    }); // Aggregated reactions

    const req = mockReq({ body: { reaction: '❤️' } });
    const res = mockRes();
    await toggleReaction(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        action: 'added',
        reactions: expect.arrayContaining([expect.objectContaining({ reaction: '❤️' })])
      })
    );
  });

  it('should remove reaction if same reaction toggled', async () => {
    query.mockResolvedValueOnce({
      rows: [{ id: 100, sender_id: 1, recipient_id: 2, conversation_id: 'conv-1' }]
    });
    query.mockResolvedValueOnce({
      rows: [{ id: 10, reaction: '❤️' }]
    }); // Existing reaction matches
    query.mockResolvedValueOnce({ rowCount: 1 }); // DELETE
    query.mockResolvedValueOnce({ rows: [] }); // Aggregated empty

    const req = mockReq({ body: { reaction: '❤️' } });
    const res = mockRes();
    await toggleReaction(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        action: 'removed',
        reactions: []
      })
    );
  });
});

// =====================================================================
// forwardMessage tests
// =====================================================================
describe('forwardMessage', () => {
  it('should return 400 if messageId or targetUsernames missing', async () => {
    const req = mockReq({ body: { messageId: 100 } });
    const res = mockRes();
    await forwardMessage(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('should return 404 if original message is deleted or not found', async () => {
    query.mockResolvedValueOnce({ rows: [] });

    const req = mockReq({ body: { messageId: 100, targetUsernames: ['bob'] } });
    const res = mockRes();
    await forwardMessage(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('should forward message to target user with is_forwarded: true', async () => {
    // 1. Original message query
    query.mockResolvedValueOnce({
      rows: [{
        id: 100, sender_id: 1, recipient_id: 2, content: 'Hey!', ciphertext: null,
        iv_nonce: null, message_type: 'text', is_deleted: false
      }]
    });
    // 2. Target user query
    query.mockResolvedValueOnce({
      rows: [{ id: 3, username: 'bob', allow_messages_from: 'everyone' }]
    });
    // 3. Conversation lookup
    query.mockResolvedValueOnce({
      rows: [{ id: 'conv-1-3', ephemeral_timer_seconds: null }]
    });
    // 4. Message INSERT
    query.mockResolvedValueOnce({
      rows: [{
        id: 101, sender_id: 1, recipient_id: 3, conversation_id: 'conv-1-3',
        content: 'Hey!', is_forwarded: true, is_read: false
      }]
    });
    // 5. Conversation UPDATE
    query.mockResolvedValueOnce({ rowCount: 1 });

    const req = mockReq({ body: { messageId: 100, targetUsernames: ['bob'] } });
    const res = mockRes();
    await forwardMessage(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        forwardedCount: 1
      })
    );
  });
});

// =====================================================================
// getMessageInfo tests
// =====================================================================
describe('getMessageInfo', () => {
  it('should return 404 if message not found', async () => {
    query.mockResolvedValueOnce({ rows: [] });

    const req = mockReq({ params: { id: '999' } });
    const res = mockRes();
    await getMessageInfo(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('should return message info timestamps for authorized user', async () => {
    query.mockResolvedValueOnce({
      rows: [{
        id: 100, sender_id: 1, recipient_id: 2, created_at: '2026-09-14T08:00:00Z',
        delivered_at: '2026-09-14T08:01:00Z', read_at: '2026-09-14T08:02:00Z',
        is_read: true, recipient_username: 'alice', recipient_full_name: 'Alice W',
        recipient_avatar_url: '/avatar.jpg'
      }]
    });

    const req = mockReq({ params: { id: '100' } });
    const res = mockRes();
    await getMessageInfo(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          id: 100,
          isRead: true,
          deliveredAt: '2026-09-14T08:01:00Z',
          readAt: '2026-09-14T08:02:00Z'
        })
      })
    );
  });
});

// =====================================================================
// toggleStarMessage and getStarredMessages tests
// =====================================================================
describe('toggleStarMessage', () => {
  it('should star a message if not already starred', async () => {
    query.mockResolvedValueOnce({
      rows: [{ id: 100, sender_id: 1, recipient_id: 2, is_deleted: false }]
    });
    query.mockResolvedValueOnce({ rows: [] }); // Not starred
    query.mockResolvedValueOnce({ rowCount: 1 }); // INSERT

    const req = mockReq({ params: { id: '100' } });
    const res = mockRes();
    await toggleStarMessage(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: { messageId: 100, isStarred: true }
      })
    );
  });

  it('should unstar a message if already starred', async () => {
    query.mockResolvedValueOnce({
      rows: [{ id: 100, sender_id: 1, recipient_id: 2, is_deleted: false }]
    });
    query.mockResolvedValueOnce({ rows: [{ id: 5 }] }); // Already starred
    query.mockResolvedValueOnce({ rowCount: 1 }); // DELETE

    const req = mockReq({ params: { id: '100' } });
    const res = mockRes();
    await toggleStarMessage(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: { messageId: 100, isStarred: false }
      })
    );
  });
});

// =====================================================================
// togglePinMessage tests
// =====================================================================
describe('togglePinMessage', () => {
  it('should return 403 if user is not in conversation', async () => {
    query.mockResolvedValueOnce({ rows: [] });

    const req = mockReq({ params: { id: 'conv-123' }, body: { messageId: 100 } });
    const res = mockRes();
    await togglePinMessage(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('should pin message when authorized', async () => {
    query.mockResolvedValueOnce({ rows: [{ role: 'member' }] });
    query.mockResolvedValueOnce({
      rows: [{ id: 100, content: 'Meeting at 5', sender_id: 1, created_at: '2026-09-14T08:00:00Z', username: 'alice' }]
    });
    query.mockResolvedValueOnce({ rowCount: 1 }); // UPDATE conversation

    const req = mockReq({ params: { id: 'conv-123' }, body: { messageId: 100 } });
    const res = mockRes();
    await togglePinMessage(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          pinnedMessageId: 100
        })
      })
    );
  });
});

// =====================================================================
// bulkDeleteMessages tests
// =====================================================================
describe('bulkDeleteMessages', () => {
  it('should return 400 if messageIds is missing or empty', async () => {
    const req = mockReq({ body: { messageIds: [] } });
    const res = mockRes();
    await bulkDeleteMessages(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('should delete for me by recording into message_deletions', async () => {
    query.mockResolvedValue({ rowCount: 1 });

    const req = mockReq({ body: { messageIds: [101, 102], type: 'for_me' } });
    const res = mockRes();
    await bulkDeleteMessages(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        deletedCount: 2,
        forEveryone: false
      })
    );
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO message_deletions'),
      expect.any(Array)
    );
  });

  it('should return 403 when deleting for everyone if user is not sender of all messages', async () => {
    query.mockResolvedValueOnce({
      rows: [
        { id: 101, sender_id: 1, recipient_id: 2, conversation_id: 5 },
        { id: 102, sender_id: 99, recipient_id: 1, conversation_id: 5 } // unauthorized!
      ]
    });

    const req = mockReq({ body: { messageIds: [101, 102], type: 'for_everyone' } });
    const res = mockRes();
    await bulkDeleteMessages(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: 'You can only delete your own messages for everyone.'
      })
    );
  });

  it('should delete for everyone if user is sender of all messages', async () => {
    query.mockResolvedValueOnce({
      rows: [
        { id: 101, sender_id: 1, recipient_id: 2, conversation_id: 5 },
        { id: 102, sender_id: 1, recipient_id: 2, conversation_id: 5 }
      ]
    });
    query.mockResolvedValueOnce({ rowCount: 2 }); // UPDATE messages

    const req = mockReq({ body: { messageIds: [101, 102], type: 'for_everyone' } });
    const res = mockRes();
    await bulkDeleteMessages(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        deletedCount: 2,
        forEveryone: true
      })
    );
  });
});

// =====================================================================
// bulkStarMessages tests
// =====================================================================
describe('bulkStarMessages', () => {
  it('should return 400 if messageIds is missing', async () => {
    const req = mockReq({ body: {} });
    const res = mockRes();
    await bulkStarMessages(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('should star multiple messages', async () => {
    query.mockResolvedValue({ rowCount: 1 });

    const req = mockReq({ body: { messageIds: [201, 202], isStarred: true } });
    const res = mockRes();
    await bulkStarMessages(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        modifiedCount: 2,
        isStarred: true
      })
    );
  });

  it('should unstar multiple messages', async () => {
    query.mockResolvedValue({ rowCount: 2 });

    const req = mockReq({ body: { messageIds: [201, 202], isStarred: false } });
    const res = mockRes();
    await bulkStarMessages(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        modifiedCount: 2,
        isStarred: false
      })
    );
  });
});

// =====================================================================
// bulkForwardMessages tests
// =====================================================================
describe('bulkForwardMessages', () => {
  it('should return 400 if messageIds or targetUsernames is missing', async () => {
    const req = mockReq({ body: { messageIds: [] } });
    const res = mockRes();
    await bulkForwardMessages(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('should return 404 if no valid messages found to forward', async () => {
    query.mockResolvedValueOnce({ rows: [] });

    const req = mockReq({ body: { messageIds: [999], targetUsernames: ['bob'] } });
    const res = mockRes();
    await bulkForwardMessages(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('should forward multiple messages to target users', async () => {
    query.mockResolvedValueOnce({
      rows: [
        { id: 1, sender_id: 1, recipient_id: 2, content: 'First forwarded' },
        { id: 2, sender_id: 1, recipient_id: 2, content: 'Second forwarded' }
      ]
    });
    // Target user query for 'bob'
    query.mockResolvedValueOnce({ rows: [{ id: 3, username: 'bob' }] });
    // Conversation check
    query.mockResolvedValueOnce({ rows: [{ id: 50 }] });
    // First message insert
    query.mockResolvedValueOnce({ rows: [{ id: 1001, content: 'First forwarded', is_forwarded: true }] });
    // Second message insert
    query.mockResolvedValueOnce({ rows: [{ id: 1002, content: 'Second forwarded', is_forwarded: true }] });
    // Update conversation timestamp
    query.mockResolvedValueOnce({ rowCount: 1 });

    const req = mockReq({ body: { messageIds: [1, 2], targetUsernames: ['bob'] } });
    const res = mockRes();
    await bulkForwardMessages(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        forwardedCount: 2
      })
    );
  });
});

// =====================================================================
// Phase 3: Presence, Status & Read Receipt tests
// =====================================================================
describe('Phase 3: Presence & Read Receipt Tests', () => {
  it('should return last_seen_at when partner allows online status', async () => {
    // 1. Partner query
    query.mockResolvedValueOnce({
      rows: [
        {
          id: 2,
          username: 'bob',
          full_name: 'Bob',
          avatar_url: null,
          show_online_status: true,
          last_seen_at: '2026-09-14T08:15:00Z',
          show_read_receipts: true
        }
      ]
    });
    // 2. Conversation query
    query.mockResolvedValueOnce({ rows: [{ id: 10 }] });
    // 2b. Block query
    query.mockResolvedValueOnce({ rows: [] });
    // 3. Messages query
    query.mockResolvedValueOnce({ rows: [] });
    // 4. Mark read query
    query.mockResolvedValueOnce({ rowCount: 0 });

    const req = mockReq({ params: { username: 'bob' } });
    const res = mockRes();
    await getMessages(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          partner: expect.objectContaining({
            username: 'bob',
            last_seen_at: '2026-09-14T08:15:00Z'
          })
        })
      })
    );
  });

  it('should mask last_seen_at to null when partner disabled online status', async () => {
    // 1. Partner query with show_online_status = false
    query.mockResolvedValueOnce({
      rows: [
        {
          id: 2,
          username: 'private_bob',
          full_name: 'Bob',
          avatar_url: null,
          show_online_status: false,
          last_seen_at: '2026-09-14T08:15:00Z',
          show_read_receipts: true
        }
      ]
    });
    // 2. Conversation query
    query.mockResolvedValueOnce({ rows: [{ id: 10 }] });
    // 2b. Block query
    query.mockResolvedValueOnce({ rows: [] });
    // 3. Messages query
    query.mockResolvedValueOnce({ rows: [] });
    // 4. Mark read query
    query.mockResolvedValueOnce({ rowCount: 0 });

    const req = mockReq({ params: { username: 'private_bob' } });
    const res = mockRes();
    await getMessages(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          partner: expect.objectContaining({
            username: 'private_bob',
            last_seen_at: null
          })
        })
      })
    );
  });

  it('should emit message:read_receipt via Socket.IO when marking conversation as read', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 2 }] }); // userRes
    query.mockResolvedValueOnce({ rowCount: 1 }); // UPDATE messages

    const mockIoInstance = mockIo();
    const req = mockReq({
      params: { username: 'alice' },
      app: { get: jest.fn(() => mockIoInstance) }
    });
    const res = mockRes();
    await markConversationAsRead(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(mockIoInstance.to).toHaveBeenCalledWith('user:2');
    expect(mockIoInstance._emitFn).toHaveBeenCalledWith(
      'message:read_receipt',
      expect.objectContaining({
        readerId: 1,
        readAt: expect.any(String)
      })
    );
  });
});

// =====================================================================
// Phase 5: Conversation Controls & Reports Tests
// =====================================================================
describe('Phase 5: Conversation Controls & Reports', () => {
  describe('toggleMuteConversation', () => {
    it('should return 403 if user is not in conversation', async () => {
      query.mockResolvedValueOnce({ rows: [] }); // memberCheck empty
      const req = mockReq({ params: { id: 'conv-1' }, body: { isMuted: true } });
      const res = mockRes();
      await toggleMuteConversation(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should update mute status and optional duration', async () => {
      query.mockResolvedValueOnce({ rows: [{ exists: 1 }] }); // memberCheck
      query.mockResolvedValueOnce({ rowCount: 1 }); // UPDATE

      const req = mockReq({ params: { id: 'conv-1' }, body: { isMuted: true, durationHours: 8 } });
      const res = mockRes();
      await toggleMuteConversation(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            conversationId: 'conv-1',
            isMuted: true,
            mutedUntil: expect.any(String)
          })
        })
      );
    });
  });

  describe('togglePinConversation', () => {
    it('should return 403 if user is not in conversation', async () => {
      query.mockResolvedValueOnce({ rows: [] });
      const req = mockReq({ params: { id: 'conv-1' }, body: { isPinned: true } });
      const res = mockRes();
      await togglePinConversation(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should successfully update pinned status', async () => {
      query.mockResolvedValueOnce({ rows: [{ is_pinned: false }] });
      query.mockResolvedValueOnce({ rowCount: 1 });

      const req = mockReq({ params: { id: 'conv-1' }, body: { isPinned: true } });
      const res = mockRes();
      await togglePinConversation(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            conversationId: 'conv-1',
            isPinned: true
          })
        })
      );
    });
  });

  describe('toggleArchiveConversation', () => {
    it('should return 403 if user is not in conversation', async () => {
      query.mockResolvedValueOnce({ rows: [] });
      const req = mockReq({ params: { id: 'conv-1' }, body: { isArchived: true } });
      const res = mockRes();
      await toggleArchiveConversation(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should successfully toggle archive status', async () => {
      query.mockResolvedValueOnce({ rows: [{ is_archived: false }] });
      query.mockResolvedValueOnce({ rowCount: 1 });

      const req = mockReq({ params: { id: 'conv-1' }, body: { isArchived: true } });
      const res = mockRes();
      await toggleArchiveConversation(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            conversationId: 'conv-1',
            isArchived: true
          })
        })
      );
    });
  });

  describe('clearConversationMessages', () => {
    it('should return 403 if user is not in conversation', async () => {
      query.mockResolvedValueOnce({ rows: [] });
      const req = mockReq({ params: { id: 'conv-1' } });
      const res = mockRes();
      await clearConversationMessages(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should successfully clear conversation messages for user', async () => {
      query.mockResolvedValueOnce({ rows: [{ exists: 1 }] }); // memberCheck
      query.mockResolvedValueOnce({ rowCount: 5 }); // INSERT INTO message_deletions

      const req = mockReq({ params: { id: 'conv-1' } });
      const res = mockRes();
      await clearConversationMessages(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Conversation messages cleared successfully.'
        })
      );
    });
  });

  describe('reportEntity', () => {
    it('should return 400 if reason is missing', async () => {
      const req = mockReq({ body: { reason: '' } });
      const res = mockRes();
      await reportEntity(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should record report and return 201', async () => {
      query.mockResolvedValueOnce({
        rows: [{
          id: 1,
          reporter_id: 1,
          reported_user_id: 2,
          reason: 'Spam',
          details: 'Sending spam links',
          status: 'pending'
        }]
      });

      const req = mockReq({
        body: {
          reportedUserId: 2,
          reason: 'Spam',
          details: 'Sending spam links'
        }
      });
      const res = mockRes();
      await reportEntity(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            report: expect.objectContaining({
              id: 1,
              reason: 'Spam'
            })
          })
        })
      );
    });
  });
});



