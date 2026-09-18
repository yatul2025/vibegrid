/**
 * server/src/__tests__/groupController.test.js
 * ==============================================
 * Unit tests for Group Conversation Lifecycle:
 * - deleteGroup
 * - leaveGroup
 * - addMembers
 * - removeMember
 * - updateGroup
 * - getGroupMembers
 */

const {
  deleteGroup,
  leaveGroup,
  addMembers,
  removeMember,
  updateGroup,
  getGroupMembers,
  joinGroupByInviteCode,
  getGroupMedia
} = require('../controllers/conversationController');

jest.mock('../config/db', () => ({
  query: jest.fn()
}));

const { query } = require('../config/db');

const mockReq = (overrides = {}) => ({
  user: { id: 1, username: 'testuser' },
  params: { id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d' },
  body: {},
  query: {},
  app: {
    get: jest.fn().mockReturnValue({
      to: jest.fn().mockReturnThis(),
      emit: jest.fn()
    })
  },
  ...overrides
});

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const mockNext = () => jest.fn();

describe('Group Controller Lifecycle Suite', () => {
  const validUuid = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';

  beforeEach(() => {
    jest.clearAllMocks();
    query.mockReset();
  });

  describe('deleteGroup', () => {
    it('should return 404 if group is not found', async () => {
      query.mockResolvedValueOnce({ rows: [] }); // conv check
      const req = mockReq();
      const res = mockRes();
      const next = mockNext();

      await deleteGroup(req, res, next);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
    });

    it('should return 400 if conversation is not a group', async () => {
      query.mockResolvedValueOnce({ rows: [{ id: validUuid, type: '1to1', title: null, created_by: 1 }] });
      const req = mockReq();
      const res = mockRes();
      const next = mockNext();

      await deleteGroup(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'This conversation is not a group.' }));
    });

    it('should return 403 if requester is not admin or creator', async () => {
      query.mockResolvedValueOnce({ rows: [{ id: validUuid, type: 'group', title: 'Test Group', created_by: 99 }] });
      query.mockResolvedValueOnce({ rows: [{ role: 'member' }] }); // requester is only member
      const req = mockReq({ user: { id: 1 } });
      const res = mockRes();
      const next = mockNext();

      await deleteGroup(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
    });

    it('should successfully delete group if requester is creator', async () => {
      query.mockResolvedValueOnce({ rows: [{ id: validUuid, type: 'group', title: 'Test Group', created_by: 1 }] });
      query.mockResolvedValueOnce({ rows: [{ role: 'admin' }] });
      query.mockResolvedValueOnce({ rows: [{ user_id: 1 }, { user_id: 2 }] }); // members to notify
      query.mockResolvedValueOnce({ rowCount: 1 }); // DELETE query

      const req = mockReq({ user: { id: 1, username: 'adminuser' } });
      const res = mockRes();
      const next = mockNext();

      await deleteGroup(req, res, next);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
      expect(query).toHaveBeenCalledWith('DELETE FROM conversations WHERE id = $1', [validUuid]);
    });
  });

  describe('leaveGroup', () => {
    it('should return 400 if user is not a member', async () => {
      query.mockResolvedValueOnce({ rows: [] }); // membership check
      const req = mockReq();
      const res = mockRes();
      const next = mockNext();

      await leaveGroup(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'You are not a member of this group.' }));
    });

    it('should delete conversation if the leaving user is the last member', async () => {
      query.mockResolvedValueOnce({ rows: [{ role: 'admin' }] }); // membership
      query.mockResolvedValueOnce({ rows: [{ user_id: 1, role: 'admin' }] }); // all members
      query.mockResolvedValueOnce({ rowCount: 1 }); // delete conv

      const req = mockReq();
      const res = mockRes();
      const next = mockNext();

      await leaveGroup(req, res, next);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(query).toHaveBeenCalledWith('DELETE FROM conversations WHERE id = $1', [validUuid]);
    });

    it('should remove membership and promote new admin if leaving user was the sole admin', async () => {
      query.mockResolvedValueOnce({ rows: [{ role: 'admin' }] }); // membership
      query.mockResolvedValueOnce({
        rows: [
          { user_id: 1, role: 'admin' },
          { user_id: 2, role: 'member' }
        ]
      }); // all members
      query.mockResolvedValueOnce({ rowCount: 1 }); // promote user 2 to admin
      query.mockResolvedValueOnce({ rowCount: 1 }); // update conversations created_by
      query.mockResolvedValueOnce({ rowCount: 1 }); // delete membership user 1
      query.mockResolvedValueOnce({ rowCount: 1 }); // insert system message

      const req = mockReq({ user: { id: 1, username: 'leaver' } });
      const res = mockRes();
      const next = mockNext();

      await leaveGroup(req, res, next);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
      expect(query).toHaveBeenCalledWith(
        'DELETE FROM conversation_members WHERE conversation_id = $1 AND user_id = $2',
        [validUuid, 1]
      );
    });
  });

  describe('addMembers', () => {
    it('should return 400 if memberIds array is missing or empty', async () => {
      const req = mockReq({ body: { memberIds: [] } });
      const res = mockRes();
      const next = mockNext();

      await addMembers(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'memberIds array is required.' }));
    });

    it('should return 403 if requester is not in the group', async () => {
      query.mockResolvedValueOnce({ rows: [] }); // requester membership check
      const req = mockReq({ body: { memberIds: [2] } });
      const res = mockRes();
      const next = mockNext();

      await addMembers(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should add valid members and return updated member list', async () => {
      query.mockResolvedValueOnce({ rows: [{ role: 'member' }] }); // requester check
      query.mockResolvedValueOnce({ rows: [{ username: 'newuser', allow_group_add_from: 'everyone' }] }); // privacy check
      query.mockResolvedValueOnce({ rowCount: 1 }); // insert member
      query.mockResolvedValueOnce({ rowCount: 1 }); // insert sys message
      query.mockResolvedValueOnce({
        rows: [
          { id: 1, username: 'testuser', role: 'admin' },
          { id: 2, username: 'newuser', role: 'member' }
        ]
      }); // members res
      query.mockResolvedValueOnce({ rows: [{ id: validUuid, title: 'Cool Group' }] }); // conv res

      const req = mockReq({ body: { memberIds: [2] } });
      const res = mockRes();
      const next = mockNext();

      await addMembers(req, res, next);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: expect.objectContaining({ members: expect.any(Array) })
      }));
    });
  });

  describe('removeMember', () => {
    it('should return 403 if requester is not an admin', async () => {
      query.mockResolvedValueOnce({ rows: [{ role: 'member' }] }); // requester check
      const req = mockReq({ params: { id: validUuid, userId: '2' } });
      const res = mockRes();
      const next = mockNext();

      await removeMember(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should return 403 if target is the conversation creator/owner', async () => {
      query.mockResolvedValueOnce({ rows: [{ role: 'admin' }] }); // requester check
      query.mockResolvedValueOnce({ rows: [{ created_by: 2 }] }); // conv owner is user 2
      const req = mockReq({ params: { id: validUuid, userId: '2' } });
      const res = mockRes();
      const next = mockNext();

      await removeMember(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Cannot remove the group owner.' }));
    });

    it('should successfully remove member when authorized', async () => {
      query.mockResolvedValueOnce({ rows: [{ role: 'admin' }] }); // requester check
      query.mockResolvedValueOnce({ rows: [{ created_by: 1 }] }); // conv owner is requester
      query.mockResolvedValueOnce({ rows: [{ username: 'badactor' }] }); // target username
      query.mockResolvedValueOnce({ rowCount: 1 }); // delete membership
      query.mockResolvedValueOnce({ rowCount: 1 }); // insert sys message

      const req = mockReq({ params: { id: validUuid, userId: '2' } });
      const res = mockRes();
      const next = mockNext();

      await removeMember(req, res, next);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
      expect(query).toHaveBeenCalledWith(
        'DELETE FROM conversation_members WHERE conversation_id = $1 AND user_id = $2',
        [validUuid, 2]
      );
    });
  });

  describe('updateGroup', () => {
    it('should return 400 if title is empty', async () => {
      const req = mockReq({ body: { title: '   ' } });
      const res = mockRes();
      const next = mockNext();

      await updateGroup(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 403 if requester is not admin', async () => {
      query.mockResolvedValueOnce({ rows: [{ role: 'member' }] });
      const req = mockReq({ body: { title: 'New Group Name' } });
      const res = mockRes();
      const next = mockNext();

      await updateGroup(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should successfully update group title', async () => {
      query.mockResolvedValueOnce({ rows: [{ role: 'admin' }] });
      query.mockResolvedValueOnce({
        rows: [{ id: validUuid, type: 'group', title: 'New Group Name', created_by: 1 }]
      });

      const req = mockReq({ body: { title: 'New Group Name' } });
      const res = mockRes();
      const next = mockNext();

      await updateGroup(req, res, next);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          conversation: expect.objectContaining({ title: 'New Group Name' })
        })
      }));
    });
  });

  describe('joinGroupByInviteCode', () => {
    it('should return 404 if invite code is invalid', async () => {
      query.mockResolvedValueOnce({ rows: [] });
      const req = mockReq({ params: { inviteCode: 'invalidcode' } });
      const res = mockRes();
      const next = mockNext();

      await joinGroupByInviteCode(req, res, next);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
    });

    it('should return already member if user is already in the group', async () => {
      query.mockResolvedValueOnce({ rows: [{ id: validUuid, title: 'Test Group', permissions: {} }] });
      query.mockResolvedValueOnce({ rows: [{ role: 'member' }] });

      const req = mockReq({ params: { inviteCode: 'validcode' } });
      const res = mockRes();
      const next = mockNext();

      await joinGroupByInviteCode(req, res, next);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: expect.objectContaining({ already_member: true })
      }));
    });

    it('should create join request if admin approval is required', async () => {
      query.mockResolvedValueOnce({
        rows: [{ id: validUuid, title: 'Approval Group', permissions: { require_admin_approval: true } }]
      });
      query.mockResolvedValueOnce({ rows: [] }); // Not a member yet
      query.mockResolvedValueOnce({ rowCount: 1 }); // INSERT into group_join_requests

      const req = mockReq({ params: { inviteCode: 'approvalcode' } });
      const res = mockRes();
      const next = mockNext();

      await joinGroupByInviteCode(req, res, next);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: expect.objectContaining({ requested: true })
      }));
    });

    it('should join directly if no approval required', async () => {
      query.mockResolvedValueOnce({
        rows: [{ id: validUuid, title: 'Open Group', permissions: { require_admin_approval: false } }]
      });
      query.mockResolvedValueOnce({ rows: [] }); // Not a member yet
      query.mockResolvedValueOnce({ rowCount: 1 }); // INSERT into conversation_members

      const req = mockReq({ params: { inviteCode: 'opencode' } });
      const res = mockRes();
      const next = mockNext();

      await joinGroupByInviteCode(req, res, next);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: expect.objectContaining({ joined: true, conversation_id: validUuid })
      }));
    });
  });

  describe('getGroupMedia', () => {
    it('should return 403 if requester is not a group member', async () => {
      query.mockResolvedValueOnce({ rows: [] }); // memberCheck
      const req = mockReq({ params: { id: validUuid } });
      const res = mockRes();
      const next = mockNext();

      await getGroupMedia(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should categorize messages into photos, videos, files, and links', async () => {
      query.mockResolvedValueOnce({ rows: [{ role: 'member' }] }); // memberCheck
      query.mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            sender_id: 1,
            content: 'https://cdn.example.com/photo.jpg',
            message_type: 'image',
            created_at: new Date().toISOString(),
            username: 'alice',
            full_name: 'Alice',
            avatar_url: null
          },
          {
            id: 2,
            sender_id: 2,
            content: 'Check https://vibegrid.app and https://github.com',
            message_type: 'text',
            created_at: new Date().toISOString(),
            username: 'bob',
            full_name: 'Bob',
            avatar_url: null
          }
        ]
      });

      const req = mockReq({ params: { id: validUuid } });
      const res = mockRes();
      const next = mockNext();

      await getGroupMedia(req, res, next);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          photos: expect.arrayContaining([expect.objectContaining({ id: 1 })]),
          links: expect.arrayContaining([
            expect.objectContaining({ url: 'https://vibegrid.app' }),
            expect.objectContaining({ url: 'https://github.com' })
          ])
        })
      }));
    });
  });
});
