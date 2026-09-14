/**
 * server/src/__tests__/engagementExternal.test.js
 * ===============================================
 * Verifies that engagement on external discovery posts (Likes & Comments)
 * works seamlessly via CacheManager without executing PostgreSQL queries.
 */

const { toggleLike, getComments, addComment, deleteComment } = require('../controllers/engagementController');
const cacheManager = require('../services/cache/CacheManager');

describe('External Posts Engagement Suite (Zero-DB Cache-backed)', () => {
  const externalPostId = 'ext_joke_coffee_test_123';
  const testUser = {
    id: 999,
    username: 'test_commenter',
    full_name: 'Test Commenter',
    avatar_url: 'https://example.com/avatar.jpg'
  };

  beforeEach(async () => {
    await cacheManager.flush();
  });

  it('should toggle like on external post using cache without DB errors', async () => {
    const req = {
      params: { id: externalPostId },
      user: testUser
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    const next = jest.fn();

    // 1. First Like
    await toggleLike(req, res, next);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          postId: externalPostId,
          liked: true,
          likes_count: 1
        })
      })
    );

    // 2. Second Like (Unlike)
    await toggleLike(req, res, next);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          postId: externalPostId,
          liked: false,
          likes_count: 0
        })
      })
    );
  });

  it('should return empty comments list for new external post without error', async () => {
    const req = {
      params: { id: externalPostId },
      user: testUser
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    const next = jest.fn();

    await getComments(req, res, next);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: {
        comments: [],
        total: 0
      }
    });
  });

  it('should add comment to external post and retrieve it', async () => {
    const addReq = {
      params: { id: externalPostId },
      user: testUser,
      body: { comment_text: 'Hilarious joke! ☕️😂' }
    };
    const addRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    const next = jest.fn();

    await addComment(addReq, addRes, next);
    expect(addRes.status).toHaveBeenCalledWith(201);
    const addedComment = addRes.json.mock.calls[0][0].data.comment;
    expect(addedComment).toBeDefined();
    expect(addedComment.comment_text).toBe('Hilarious joke! ☕️😂');
    expect(addedComment.username).toBe(testUser.username);

    // Verify getComments returns the comment
    const getReq = { params: { id: externalPostId }, user: testUser };
    const getRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    await getComments(getReq, getRes, next);
    expect(getRes.status).toHaveBeenCalledWith(200);
    expect(getRes.json.mock.calls[0][0].data.comments.length).toBe(1);
    expect(getRes.json.mock.calls[0][0].data.comments[0].id).toBe(addedComment.id);

    // Delete comment
    const delReq = { params: { commentId: addedComment.id }, user: testUser };
    const delRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    await deleteComment(delReq, delRes, next);
    expect(delRes.status).toHaveBeenCalledWith(200);
    expect(delRes.json.mock.calls[0][0].data.comments_count).toBe(0);
  });
});
