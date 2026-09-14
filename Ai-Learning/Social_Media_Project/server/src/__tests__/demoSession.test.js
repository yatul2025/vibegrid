/**
 * server/src/__tests__/demoSession.test.js
 * ========================================
 * Demo Mode Backend Test Suite
 * 
 * Tests:
 * 1. Dedicated demo session creation (POST /api/auth/demo-session)
 * 2. Whitelist validation of demo personas
 * 3. Cryptographic demo JWT generation with restricted permissions
 * 4. AuthMiddleware enforcement:
 *    - Allows read operations for demo users
 *    - Blocks all mutating methods (POST, PUT, PATCH, DELETE) with 403 DEMO_RESTRICTED
 */

const jwt = require('jsonwebtoken');
const config = require('../config/env');

// Mock database query
jest.mock('../config/db', () => ({
  query: jest.fn()
}));

const { query } = require('../config/db');
const { createDemoSession } = require('../controllers/authController');
const { protect } = require('../middlewares/authMiddleware');

describe('Demo Mode Backend Enforcement Suite', () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      body: {},
      params: {},
      query: {},
      cookies: {},
      headers: {},
      method: 'GET'
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      cookie: jest.fn().mockReturnThis()
    };
    next = jest.fn();
  });

  describe('createDemoSession', () => {
    it('should reject invalid demo personas with 400', async () => {
      req.body = { persona: 'evil_hacker' };
      await createDemoSession(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: expect.stringContaining('Invalid demo persona')
      }));
    });

    it('should return 404 if demo persona user is not found in database', async () => {
      req.body = { persona: 'sophia_wander' };
      query.mockResolvedValueOnce({ rows: [] });

      await createDemoSession(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: expect.stringContaining('@sophia_wander not found')
      }));
    });

    it('should create demo session for valid persona, set auth cookie and return demo user', async () => {
      req.body = { persona: 'sophia_wander' };
      const mockUser = {
        id: 1,
        username: 'sophia_wander',
        email: 'sophia@example.com',
        full_name: 'Sophia Wander',
        bio: 'Travel photographer',
        avatar_url: 'https://example.com/sophia.jpg'
      };
      query.mockResolvedValueOnce({ rows: [mockUser] });

      await createDemoSession(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.cookie).toHaveBeenCalled();
      const responseData = res.json.mock.calls[0][0];
      expect(responseData.success).toBe(true);
      expect(responseData.data.user.username).toBe('sophia_wander');
      expect(responseData.data.user.is_demo_session).toBe(true);
      expect(responseData.data.user.sessionType).toBe('demo');
      expect(responseData.data.user.permissions).toEqual({
        read_demo_content: true,
        write_actions: false,
        direct_messaging_send: false,
        account_modification: false
      });
    });
  });

  describe('authMiddleware.protect Demo Mode Guard', () => {
    const signDemoToken = (userId = 1, username = 'sophia_wander') => {
      return jwt.sign(
        {
          id: userId,
          username,
          isDemoSession: true,
          sessionType: 'demo',
          permissions: {
            read_demo_content: true,
            write_actions: false,
            direct_messaging_send: false,
            account_modification: false
          }
        },
        config.jwtSecret,
        { expiresIn: '2h' }
      );
    };

    it('should allow GET requests for demo sessions', async () => {
      const demoToken = signDemoToken();
      req.cookies = { vibegrid_token: demoToken };
      req.method = 'GET';

      query.mockResolvedValueOnce({
        rows: [{
          id: 1,
          username: 'sophia_wander',
          full_name: 'Sophia Wander',
          is_deactivated: false
        }]
      });

      await protect(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user).toBeDefined();
      expect(req.user.is_demo_session).toBe(true);
      expect(req.user.sessionType).toBe('demo');
      expect(req.isDemoSession).toBe(true);
    });

    it('should reject POST mutating requests with 403 DEMO_RESTRICTED', async () => {
      const demoToken = signDemoToken();
      req.cookies = { vibegrid_token: demoToken };
      req.method = 'POST';

      await protect(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        code: 'DEMO_RESTRICTED',
        error: expect.stringContaining('restricted in Demo Mode')
      }));
    });

    it('should reject PUT mutating requests with 403 DEMO_RESTRICTED', async () => {
      const demoToken = signDemoToken();
      req.headers = { authorization: `Bearer ${demoToken}` };
      req.method = 'PUT';

      await protect(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        code: 'DEMO_RESTRICTED'
      }));
    });

    it('should reject DELETE mutating requests with 403 DEMO_RESTRICTED', async () => {
      const demoToken = signDemoToken();
      req.cookies = { vibegrid_token: demoToken };
      req.method = 'DELETE';

      await protect(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        code: 'DEMO_RESTRICTED'
      }));
    });

    it('should reject PATCH mutating requests with 403 DEMO_RESTRICTED', async () => {
      const demoToken = signDemoToken();
      req.cookies = { vibegrid_token: demoToken };
      req.method = 'PATCH';

      await protect(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        code: 'DEMO_RESTRICTED'
      }));
    });
  });
});
