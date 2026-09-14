/**
 * server/src/__tests__/messageController.test.js
 * ================================================
 * Unit tests for editMessage and deleteMessage controller functions.
 *
 * These tests mock the database `query` function and Socket.IO to test
 * the controller logic in isolation.
 */

const { editMessage, deleteMessage } = require('../controllers/messageController');

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
