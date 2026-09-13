/**
 * client/src/components/SafetyNumberModal.jsx
 * ===========================================
 * Signal-Style Cryptographic Safety Number Verification Modal
 * 
 * Allows users to compare 60-digit fingerprints with contact to verify
 * that no Man-in-the-Middle (MITM) or key tampering exists.
 */

import React, { useState, useEffect } from 'react';
import apiClient from '../api/client';
import keyStore from '../services/crypto/keyStore';
import { computeSafetyNumber } from '../services/crypto/mediaCrypto';

export default function SafetyNumberModal({ isOpen, onClose, peerUser, myUserId, onVerificationChanged }) {
  const [loading, setLoading] = useState(true);
  const [formattedNumber, setFormattedNumber] = useState('');
  const [isVerified, setIsVerified] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen || !peerUser || !myUserId) return;

    let isMounted = true;

    async function loadSafetyNumber() {
      setLoading(true);
      setError('');
      try {
        // 1. Get my identity key
        const myIdentity = await keyStore.getDeviceIdentity(myUserId);
        if (!myIdentity || !myIdentity.identityPublicKey) {
          throw new Error('Your cryptographic identity is not initialized yet.');
        }

        // 2. Fetch peer's bundle from server
        const bundleRes = await apiClient.get(`/e2ee/keys/bundle/${peerUser.id}`);
        if (!bundleRes.success || !bundleRes.data?.identityKey) {
          throw new Error(`@${peerUser.username} has not published E2EE encryption keys yet.`);
        }

        // 3. Compute deterministic 60-digit safety number
        const { formatted } = await computeSafetyNumber(
          myIdentity.identityPublicKey,
          bundleRes.data.identityKey
        );

        // 4. Check if already marked verified
        const verified = await keyStore.isPeerVerified(myUserId, peerUser.id);

        if (isMounted) {
          setFormattedNumber(formatted);
          setIsVerified(verified);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || 'Failed to generate safety number.');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadSafetyNumber();

    return () => {
      isMounted = false;
    };
  }, [isOpen, peerUser, myUserId]);

  const handleToggleVerified = async () => {
    const nextVal = !isVerified;
    await keyStore.setPeerVerified(myUserId, peerUser.id, nextVal);
    setIsVerified(nextVal);
    if (onVerificationChanged) {
      onVerificationChanged(nextVal);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card safety-number-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="safety-modal-title">
            <span className="safety-modal-shield">🛡️</span>
            <h3>Verify Safety Number</h3>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="safety-number-content">
          <p className="safety-desc">
            To verify the end-to-end encryption with <strong>@{peerUser?.username}</strong>,
            compare the numbers below with their device. Both devices must display identical digits.
          </p>

          {loading ? (
            <div className="safety-loading">
              <div className="spinner-sm"></div>
              <span>Computing cryptographic fingerprint...</span>
            </div>
          ) : error ? (
            <div className="safety-error-box">
              <p>⚠️ {error}</p>
            </div>
          ) : (
            <>
              {/* 12 Blocks of 5 Digits Display */}
              <div className="safety-fingerprint-grid">
                {formattedNumber.split(' ').map((block, idx) => (
                  <span key={idx} className="fingerprint-block">
                    {block}
                  </span>
                ))}
              </div>

              {/* Verified Toggle */}
              <div className="safety-verify-row">
                <div className="verify-toggle-text">
                  <strong>Mark as Verified</strong>
                  <span>Confirmation that public identity keys match securely</span>
                </div>
                <button
                  type="button"
                  className={`btn-verify-toggle ${isVerified ? 'verified' : 'unverified'}`}
                  onClick={handleToggleVerified}
                >
                  {isVerified ? '✓ Verified' : 'Mark Verified'}
                </button>
              </div>
            </>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>

      <style>{`
        .safety-number-modal {
          max-width: 480px;
          border-radius: 18px;
        }

        .safety-modal-title {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .safety-modal-shield {
          font-size: 1.4rem;
        }

        .safety-number-content {
          padding: 16px 20px;
        }

        .safety-desc {
          font-size: 0.86rem;
          color: var(--text-secondary, #64748b);
          line-height: 1.5;
          margin-bottom: 20px;
        }

        .safety-loading {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          padding: 30px 0;
          color: var(--text-secondary, #64748b);
        }

        .safety-error-box {
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
          border-radius: 10px;
          padding: 14px;
          color: #ef4444;
          font-size: 0.88rem;
        }

        .safety-fingerprint-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
          background: var(--bg-page, #f8fafc);
          padding: 18px;
          border-radius: 12px;
          border: 1px solid var(--border-color, #e2e8f0);
          margin-bottom: 24px;
          text-align: center;
        }

        .fingerprint-block {
          font-family: 'Courier New', Courier, monospace;
          font-size: 1.05rem;
          font-weight: 700;
          letter-spacing: 1.5px;
          color: var(--text-primary, #0f172a);
        }

        .safety-verify-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          border-radius: 12px;
          background: var(--card-bg, #ffffff);
          border: 1px solid var(--border-color, #e2e8f0);
        }

        .verify-toggle-text {
          display: flex;
          flex-direction: column;
          font-size: 0.88rem;
        }

        .verify-toggle-text span {
          font-size: 0.74rem;
          color: var(--text-secondary, #64748b);
          margin-top: 2px;
        }

        .btn-verify-toggle {
          padding: 7px 16px;
          border-radius: 20px;
          font-size: 0.84rem;
          font-weight: 700;
          cursor: pointer;
          border: none;
          transition: background 0.15s ease, transform 0.15s ease;
        }

        .btn-verify-toggle.unverified {
          background: var(--bg-hover, #e2e8f0);
          color: var(--text-primary, #0f172a);
        }

        .btn-verify-toggle.verified {
          background: #10b981;
          color: #ffffff;
        }

        .btn-verify-toggle:hover {
          transform: scale(1.04);
        }
      `}</style>
    </div>
  );
}
