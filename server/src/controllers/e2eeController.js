/**
 * server/src/controllers/e2eeController.js
 * ========================================
 * End-to-End Encryption (E2EE) PreKey Bundle Directory
 * 
 * Manages device identity keys, signed prekeys, and one-time prekey pools
 * for the X3DH key exchange protocol.
 * 
 * SECURITY NOTE:
 * The server ONLY receives and stores public keys and signatures.
 * Private keys NEVER leave the user's browser device.
 */

const { query } = require('../config/db');

/**
 * @desc    Register or update device public keys and prekey bundle
 * @route   POST /api/e2ee/keys/register
 * @access  Private (Authenticated)
 */
const registerKeys = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { deviceId, registrationId, identityKey, signedPreKey, oneTimePreKeys } = req.body;

    if (!deviceId || !registrationId || !identityKey || !signedPreKey) {
      return res.status(400).json({
        success: false,
        error: 'Missing required device cryptographic parameters.'
      });
    }

    if (!signedPreKey.keyId || !signedPreKey.publicKey || !signedPreKey.signature) {
      return res.status(400).json({
        success: false,
        error: 'Invalid signed prekey structure.'
      });
    }

    // 1. Insert or update device registry
    const deviceRes = await query(
      `INSERT INTO user_devices (
         user_id, device_id, identity_key_pub, 
         signed_prekey_pub, signed_prekey_sig, signed_prekey_id, 
         registration_id, last_seen_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id, device_id) DO UPDATE SET
         identity_key_pub = EXCLUDED.identity_key_pub,
         signed_prekey_pub = EXCLUDED.signed_prekey_pub,
         signed_prekey_sig = EXCLUDED.signed_prekey_sig,
         signed_prekey_id = EXCLUDED.signed_prekey_id,
         registration_id = EXCLUDED.registration_id,
         last_seen_at = CURRENT_TIMESTAMP
       RETURNING id`,
      [
        userId,
        deviceId,
        identityKey,
        signedPreKey.publicKey,
        signedPreKey.signature,
        signedPreKey.keyId,
        registrationId
      ]
    );

    const internalDeviceId = deviceRes.rows[0].id;

    // 2. Insert one-time prekeys pool if provided
    let prekeysCount = 0;
    if (Array.isArray(oneTimePreKeys) && oneTimePreKeys.length > 0) {
      for (const opk of oneTimePreKeys) {
        if (opk.keyId && opk.publicKey) {
          await query(
            `INSERT INTO e2ee_prekeys (device_id, key_id, prekey_pub)
             VALUES ($1, $2, $3)
             ON CONFLICT (device_id, key_id) DO UPDATE SET
               prekey_pub = EXCLUDED.prekey_pub,
               is_consumed = FALSE`,
            [internalDeviceId, opk.keyId, opk.publicKey]
          );
          prekeysCount++;
        }
      }
    }

    res.status(200).json({
      success: true,
      message: 'Cryptographic keys registered successfully.',
      data: {
        deviceId,
        prekeysUploaded: prekeysCount
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Fetch target user's prekey bundle to establish X3DH E2EE session
 * @route   GET /api/e2ee/keys/bundle/:userIdOrUsername
 * @access  Private (Authenticated)
 */
const getPreKeyBundle = async (req, res, next) => {
  try {
    const { userIdOrUsername } = req.params;

    // Resolve user ID
    let targetUserId;
    if (/^\d+$/.test(userIdOrUsername)) {
      targetUserId = Number(userIdOrUsername);
    } else {
      const uRes = await query(
        'SELECT id FROM users WHERE LOWER(username) = $1 LIMIT 1',
        [userIdOrUsername.toLowerCase().trim()]
      );
      if (uRes.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'User not found.' });
      }
      targetUserId = uRes.rows[0].id;
    }

    // Check blocked status
    const blockRes = await query(
      'SELECT 1 FROM blocked_users WHERE (blocker_id = $1 AND blocked_id = $2) OR (blocker_id = $2 AND blocked_id = $1) LIMIT 1',
      [req.user.id, targetUserId]
    );
    if (blockRes.rows.length > 0) {
      return res.status(403).json({
        success: false,
        error: 'Cannot establish session with this user.'
      });
    }

    // Fetch primary active device for target user
    const deviceRes = await query(
      `SELECT id, device_id, identity_key_pub, signed_prekey_pub, 
              signed_prekey_sig, signed_prekey_id, registration_id
       FROM user_devices
       WHERE user_id = $1
       ORDER BY last_seen_at DESC
       LIMIT 1`,
      [targetUserId]
    );

    if (deviceRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User has not registered E2EE encryption keys yet.'
      });
    }

    const device = deviceRes.rows[0];

    // Atomically claim one unused One-Time PreKey (OPK)
    const opkRes = await query(
      `UPDATE e2ee_prekeys
       SET is_consumed = TRUE, consumed_at = CURRENT_TIMESTAMP
       WHERE id = (
         SELECT id FROM e2ee_prekeys
         WHERE device_id = $1 AND is_consumed = FALSE
         ORDER BY id ASC
         LIMIT 1
       )
       RETURNING key_id, prekey_pub`,
      [device.id]
    );

    const oneTimePreKey = opkRes.rows.length > 0 ? {
      keyId: opkRes.rows[0].key_id,
      publicKey: opkRes.rows[0].prekey_pub
    } : null;

    res.status(200).json({
      success: true,
      data: {
        userId: targetUserId,
        deviceId: device.device_id,
        registrationId: device.registration_id,
        identityKey: device.identity_key_pub,
        signedPreKey: {
          keyId: device.signed_prekey_id,
          publicKey: device.signed_prekey_pub,
          signature: device.signed_prekey_sig
        },
        oneTimePreKey
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Replenish one-time prekeys when device key pool runs low
 * @route   POST /api/e2ee/keys/replenish
 * @access  Private (Authenticated)
 */
const replenishPreKeys = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { deviceId, oneTimePreKeys } = req.body;

    if (!deviceId || !Array.isArray(oneTimePreKeys) || oneTimePreKeys.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Please provide deviceId and an array of oneTimePreKeys.'
      });
    }

    const deviceRes = await query(
      'SELECT id FROM user_devices WHERE user_id = $1 AND device_id = $2 LIMIT 1',
      [userId, deviceId]
    );

    if (deviceRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Device not registered.' });
    }

    const internalDeviceId = deviceRes.rows[0].id;
    let count = 0;

    for (const opk of oneTimePreKeys) {
      if (opk.keyId && opk.publicKey) {
        await query(
          `INSERT INTO e2ee_prekeys (device_id, key_id, prekey_pub, is_consumed)
           VALUES ($1, $2, $3, FALSE)
           ON CONFLICT (device_id, key_id) DO UPDATE SET
             prekey_pub = EXCLUDED.prekey_pub,
             is_consumed = FALSE`,
          [internalDeviceId, opk.keyId, opk.publicKey]
        );
        count++;
      }
    }

    res.status(200).json({
      success: true,
      message: `Successfully replenished ${count} one-time prekeys.`
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  registerKeys,
  getPreKeyBundle,
  replenishPreKeys
};
