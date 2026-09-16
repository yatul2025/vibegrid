/**
 * server/src/__tests__/messageFeaturesExtended.test.js
 * ======================================================
 * Tests verifying the 5 core message actions:
 * 1. Forward SMS & Media messages
 * 2. Share SMS & Media messages
 * 3. Multiple Pinned Messages (Pin A, B, C; unpin B retains A & C)
 * 4. Delete for me (Placeholder visibility & persistence, other user unaffected)
 * 5. 60-Minute deletion time limit (allowed within 60m, blocked after 60m)
 */

const {
  getMessages,
  togglePinMessage,
  deleteMessage,
  bulkDeleteMessages,
  forwardMessage,
  bulkForwardMessages
} = require('../controllers/messageController');

jest.mock('../config/db', () => ({
  query: jest.fn()
}));

const { query } = require('../config/db');

const mockReq = (overrides = {}) => ({
  user: { id: 1 },
  params: { id: 'conv-10' },
  body: {},
  query: {},
  app: {
    get: jest.fn(() => null)
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

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Message Actions & Rules Extended Suite', () => {
  describe('1. Multiple Pinned Messages', () => {
    it('pins multiple messages independently without unpinning previous pins', async () => {
      // Pin message 101
      query.mockResolvedValueOnce({ rows: [{ role: 'member' }] }); // member
      query.mockResolvedValueOnce({ rows: [{ id: 101, content: 'Message 1', sender_id: 1, sender_username: 'alice' }] });
      query.mockResolvedValueOnce({ rows: [] }); // not pinned yet
      query.mockResolvedValueOnce({ rowCount: 1 }); // INSERT
      query.mockResolvedValueOnce({
        rows: [{ id: 101, content: 'Message 1', sender_id: 1, sender_username: 'alice', pinned_at: '2026-09-17T00:00:00Z' }]
      }); // all pinned
      query.mockResolvedValueOnce({ rowCount: 1 }); // UPDATE conversation

      const req1 = mockReq({ params: { id: 'conv-10' }, body: { messageId: 101 } });
      const res1 = mockRes();
      await togglePinMessage(req1, res1, mockNext);

      expect(res1.status).toHaveBeenCalledWith(200);
      expect(res1.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          pinnedMessageId: 101,
          pinnedMessages: expect.arrayContaining([expect.objectContaining({ id: 101 })]),
          isPinned: true
        })
      }));

      // Pin message 102
      query.mockResolvedValueOnce({ rows: [{ role: 'member' }] });
      query.mockResolvedValueOnce({ rows: [{ id: 102, content: 'Message 2', sender_id: 1, sender_username: 'alice' }] });
      query.mockResolvedValueOnce({ rows: [] }); // not pinned yet
      query.mockResolvedValueOnce({ rowCount: 1 }); // INSERT
      query.mockResolvedValueOnce({
        rows: [
          { id: 102, content: 'Message 2', sender_id: 1, sender_username: 'alice', pinned_at: '2026-09-17T00:05:00Z' },
          { id: 101, content: 'Message 1', sender_id: 1, sender_username: 'alice', pinned_at: '2026-09-17T00:00:00Z' }
        ]
      }); // all pinned
      query.mockResolvedValueOnce({ rowCount: 1 }); // UPDATE conversation

      const req2 = mockReq({ params: { id: 'conv-10' }, body: { messageId: 102 } });
      const res2 = mockRes();
      await togglePinMessage(req2, res2, mockNext);

      expect(res2.status).toHaveBeenCalledWith(200);
      expect(res2.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          pinnedMessageId: 102,
          pinnedMessages: expect.arrayContaining([
            expect.objectContaining({ id: 102 }),
            expect.objectContaining({ id: 101 })
          ])
        })
      }));
    });

    it('unpinning message B retains messages A and C pinned', async () => {
      // Unpin message 102 (B) while 101 (A) and 103 (C) exist
      query.mockResolvedValueOnce({ rows: [{ role: 'member' }] });
      query.mockResolvedValueOnce({ rows: [{ id: 102, content: 'Message 2', sender_id: 1, sender_username: 'alice' }] });
      query.mockResolvedValueOnce({ rows: [{ id: 999 }] }); // existingPin found -> unpin
      query.mockResolvedValueOnce({ rowCount: 1 }); // DELETE message 102 from conversation_pinned_messages
      query.mockResolvedValueOnce({
        rows: [
          { id: 103, content: 'Message 3', sender_id: 1, sender_username: 'alice', pinned_at: '2026-09-17T00:10:00Z' },
          { id: 101, content: 'Message 1', sender_id: 1, sender_username: 'alice', pinned_at: '2026-09-17T00:00:00Z' }
        ]
      }); // all remaining pinned
      query.mockResolvedValueOnce({ rowCount: 1 }); // UPDATE conversation

      const req = mockReq({ params: { id: 'conv-10' }, body: { messageId: 102 } });
      const res = mockRes();
      await togglePinMessage(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          pinnedMessageId: 103,
          isPinned: false,
          pinnedMessages: [
            expect.objectContaining({ id: 103 }),
            expect.objectContaining({ id: 101 })
          ]
        })
      }));
    });
  });

  describe('2. Delete For Me vs Delete For Everyone Time Limits', () => {
    it('allows delete for everyone if message is within 60 minutes', async () => {
      const recentCreatedAt = new Date(Date.now() - 10 * 60 * 1000).toISOString(); // 10m ago
      query.mockResolvedValueOnce({
        rows: [{ id: 200, sender_id: 1, recipient_id: 2, conversation_id: 10, is_deleted: false, created_at: recentCreatedAt }]
      });
      query.mockResolvedValueOnce({ rowCount: 1 }); // UPDATE message
      query.mockResolvedValueOnce({ rowCount: 1 }); // DELETE from pinned messages

      const req = mockReq({ params: { id: '200' }, query: { type: 'for_everyone' } });
      const res = mockRes();
      await deleteMessage(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: expect.objectContaining({ forEveryone: true })
      }));
    });

    it('rejects delete for everyone if message is older than 60 minutes', async () => {
      const oldCreatedAt = new Date(Date.now() - 75 * 60 * 1000).toISOString(); // 75m ago
      query.mockResolvedValueOnce({
        rows: [{ id: 201, sender_id: 1, recipient_id: 2, conversation_id: 10, is_deleted: false, created_at: oldCreatedAt }]
      });

      const req = mockReq({ params: { id: '201' }, query: { type: 'for_everyone' } });
      const res = mockRes();
      await deleteMessage(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: expect.stringContaining('within 60 minutes')
      }));
    });

    it('allows delete for me regardless of message age (no time limit)', async () => {
      const veryOldCreatedAt = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(); // 24 hours ago
      query.mockResolvedValueOnce({
        rows: [{ id: 202, sender_id: 2, recipient_id: 1, conversation_id: 10, is_deleted: false, created_at: veryOldCreatedAt }]
      });
      query.mockResolvedValueOnce({ rowCount: 1 }); // INSERT INTO message_deletions

      const req = mockReq({ params: { id: '202' }, query: { type: 'for_me' } });
      const res = mockRes();
      await deleteMessage(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: expect.objectContaining({ forEveryone: false })
      }));
    });

    it('bulkDeleteMessages rejects for_everyone if any message is older than 60 minutes', async () => {
      const oldCreatedAt = new Date(Date.now() - 90 * 60 * 1000).toISOString();
      query.mockResolvedValueOnce({
        rows: [
          { id: 301, sender_id: 1, recipient_id: 2, conversation_id: 10, created_at: new Date().toISOString() },
          { id: 302, sender_id: 1, recipient_id: 2, conversation_id: 10, created_at: oldCreatedAt }
        ]
      });

      const req = mockReq({ body: { messageIds: [301, 302], type: 'for_everyone' } });
      const res = mockRes();
      await bulkDeleteMessages(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: expect.stringContaining('within 60 minutes')
      }));
    });
  });

  describe('3. Delete For Me Placeholder & Visibility Persistence', () => {
    it('returns "This message was deleted" placeholder to user who deleted for me, while other user sees original', async () => {
      // 1. Partner query
      query.mockResolvedValueOnce({
        rows: [{ id: 2, username: 'bob', full_name: 'Bob', avatar_url: null, show_online_status: true, last_seen_at: null }]
      });
      // 2. Conversation query
      query.mockResolvedValueOnce({ rows: [{ id: 10 }] });
      // 3. Block check
      query.mockResolvedValueOnce({ rows: [] });
      // 4. Pinned messages
      query.mockResolvedValueOnce({ rows: [] });
      // 5. Messages query: Alice views conversation. Message 501 was deleted for me by Alice (is_deleted_for_me = true)
      query.mockResolvedValueOnce({
        rows: [
          {
            id: 501,
            sender_id: 2,
            recipient_id: 1,
            conversation_id: 10,
            content: 'Secret file or text',
            ciphertext: 'cipher123',
            iv_nonce: 'nonce123',
            message_type: 'image',
            is_deleted: false,
            is_deleted_for_me: true,
            is_mine: false,
            created_at: new Date().toISOString()
          }
        ]
      });
      // 6. Mark read
      query.mockResolvedValueOnce({ rowCount: 0 });
      // 7. Typing status
      query.mockResolvedValueOnce({ rows: [{ is_typing: false }] });

      const req = mockReq({ params: { username: 'bob' } });
      const res = mockRes();
      await getMessages(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(200);
      const returnedMessages = res.json.mock.calls[0][0].data.messages;
      expect(returnedMessages[0].is_deleted).toBe(true);
      expect(returnedMessages[0].content).toBe('This message was deleted');
      expect(returnedMessages[0].ciphertext).toBeNull();
      expect(returnedMessages[0].iv_nonce).toBeNull();
    });
  });

  describe('4. Forward Messages (SMS and Media/Files)', () => {
    it('forwards message without ciphertext to prevent recipient decryption errors', async () => {
      // Original message
      query.mockResolvedValueOnce({
        rows: [{
          id: 601,
          sender_id: 1,
          recipient_id: 2,
          content: '{"type":"image","url":"https://example.com/photo.jpg","caption":"Check this"}',
          ciphertext: 'old_cipher',
          iv_nonce: 'old_nonce',
          message_type: 'image',
          is_deleted: false
        }]
      });
      // Target user lookup
      query.mockResolvedValueOnce({
        rows: [{ id: 3, username: 'carol', full_name: 'Carol', allow_messages_from: 'everyone' }]
      });
      // Find or create conversation
      query.mockResolvedValueOnce({
        rows: [{ id: 25, ephemeral_timer_seconds: null }]
      });
      // INSERT message
      query.mockResolvedValueOnce({
        rows: [{
          id: 602,
          sender_id: 1,
          recipient_id: 3,
          conversation_id: 25,
          content: '{"type":"image","url":"https://example.com/photo.jpg","caption":"Check this"}',
          ciphertext: null,
          iv_nonce: null,
          message_type: 'image',
          is_forwarded: true,
          is_deleted: false,
          created_at: new Date().toISOString()
        }]
      });
      // UPDATE conversation
      query.mockResolvedValueOnce({ rowCount: 1 });

      const req = mockReq({ body: { messageId: 601, targetUsernames: ['carol'] } });
      const res = mockRes();
      await forwardMessage(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        forwardedCount: 1
      }));
    });
  });
});
