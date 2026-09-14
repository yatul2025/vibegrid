/**
 * client/src/components/CallHistoryModal.jsx
 * ==========================================
 * WebRTC Call History & Activity Logs Drawer / Modal
 * 
 * Features:
 * 1. Chronological list of incoming, outgoing, and missed calls.
 * 2. Duration, timestamps, and call type indicators (Audio 📞 vs Video 📹).
 * 3. One-click "Call Back" action directly from history item.
 */

import React, { useState, useEffect } from 'react';
import apiClient from '../api/client';

export default function CallHistoryModal({ isOpen, onClose }) {
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    async function fetchCalls() {
      setLoading(true);
      try {
        const res = await apiClient.get('/calls/history');
        if (res.success && res.data?.calls && isMounted) {
          setCalls(res.data.calls);
        }
      } catch (err) {
        console.error('Failed to load call history:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchCalls();

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  const handleCallBack = (call) => {
    const targetUser = {
      id: call.peer_id || (call.is_outgoing ? call.peer_id : call.initiator_id),
      username: call.peer_username || call.initiator_username,
      avatar_url: call.peer_avatar_url || call.initiator_avatar_url
    };

    window.dispatchEvent(
      new CustomEvent('vibegrid:initiate-call', {
        detail: { targetUser, callType: call.call_type || 'audio' }
      })
    );
    onClose();
  };

  const formatDuration = (seconds) => {
    if (!seconds || seconds <= 0) return 'Missed';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  const formatCallDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card call-history-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="call-history-header-title">
            <span className="call-history-icon">📞</span>
            <h3>Call History</h3>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="call-history-body">
          {loading ? (
            <div className="call-history-loading">
              <div className="spinner-sm"></div>
              <span>Loading call logs...</span>
            </div>
          ) : calls.length === 0 ? (
            <div className="call-history-empty">
              <span className="empty-call-icon">📵</span>
              <h4>No call logs yet</h4>
              <p>Your audio and video calls will appear here.</p>
            </div>
          ) : (
            <div className="call-logs-list">
              {calls.map((c) => {
                const isMissed = c.status === 'rejected' || (!c.duration_seconds && !c.is_outgoing);
                const peerName = c.peer_username || c.initiator_username || 'User';
                const peerAvatar = c.peer_avatar_url || c.initiator_avatar_url || '/uploads/avatars/default-avatar.png';

                return (
                  <div key={c.id} className="call-log-item">
                    <img src={peerAvatar} alt={peerName} className="call-log-avatar" />

                    <div className="call-log-meta">
                      <div className="call-log-title-row">
                        <span className="call-log-name">@{peerName}</span>
                        <span className="call-log-time">{formatCallDate(c.started_at)}</span>
                      </div>

                      <div className="call-log-sub-row">
                        <span className={`call-direction-tag ${isMissed ? 'missed' : c.is_outgoing ? 'outgoing' : 'incoming'}`}>
                          {c.is_outgoing ? '↗️ Outgoing' : isMissed ? '⚠️ Missed' : '↙️ Incoming'}
                        </span>
                        <span className="call-type-tag">
                          {c.call_type === 'video' ? '📹 Video' : '📞 Audio'}
                        </span>
                        <span className="call-duration-tag">
                          {formatDuration(c.duration_seconds)}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="btn-call-back"
                      onClick={() => handleCallBack(c)}
                      title={`Call back @${peerName}`}
                    >
                      {c.call_type === 'video' ? '📹' : '📞'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>

      <style>{`
        .call-history-modal {
          max-width: 480px;
          max-height: 80vh;
        }

        .call-history-header-title {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .call-history-body {
          padding: 12px 16px;
          max-height: 55vh;
          overflow-y: auto;
        }

        .call-history-loading,
        .call-history-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px 20px;
          text-align: center;
          color: var(--text-secondary, #64748b);
        }

        .empty-call-icon {
          font-size: 2.5rem;
          margin-bottom: 10px;
        }

        .call-logs-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .call-log-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 14px;
          background: var(--bg-page, #f8fafc);
          border: 1px solid var(--border-color, #e2e8f0);
          border-radius: 12px;
          transition: background 0.15s ease;
        }

        .call-log-item:hover {
          background: var(--bg-hover, #f1f5f9);
        }

        .call-log-avatar {
          width: 42px;
          height: 42px;
          border-radius: 50%;
          object-fit: cover;
        }

        .call-log-meta {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .call-log-title-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .call-log-name {
          font-weight: 700;
          font-size: 0.9rem;
          color: var(--text-primary, #0f172a);
        }

        .call-log-time {
          font-size: 0.72rem;
          color: var(--text-secondary, #64748b);
        }

        .call-log-sub-row {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 0.75rem;
        }

        .call-direction-tag.outgoing { color: #6366f1; }
        .call-direction-tag.incoming { color: #10b981; }
        .call-direction-tag.missed { color: #ef4444; font-weight: 600; }

        .call-type-tag {
          color: var(--text-secondary, #64748b);
        }

        .call-duration-tag {
          color: var(--text-secondary, #64748b);
          font-family: monospace;
        }

        .btn-call-back {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          border: 1px solid var(--border-color, #e2e8f0);
          background: var(--card-bg, #ffffff);
          font-size: 15px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.15s ease, background 0.15s ease;
        }

        .btn-call-back:hover {
          transform: scale(1.1);
          background: #10b981;
          color: #ffffff;
        }
      `}</style>
    </div>
  );
}
