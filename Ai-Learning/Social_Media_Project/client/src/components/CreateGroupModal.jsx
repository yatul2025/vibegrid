/**
 * client/src/components/CreateGroupModal.jsx
 * ==========================================
 * Multi-Party Encrypted Group Creation Modal
 * 
 * Features:
 * 1. Multi-contact selector with live search.
 * 2. Group title and icon.
 * 3. Distributes initial Sender Keys to all participants upon creation.
 */

import React, { useState, useEffect } from 'react';
import apiClient from '../api/client';
import { useAuth } from '../context/AuthContext';
import senderKeysService from '../services/crypto/senderKeys';

export default function CreateGroupModal({ isOpen, onClose, onGroupCreated }) {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setSearching(true);
        const res = await apiClient.get(`/users/search?q=${encodeURIComponent(searchQuery)}`);
        if (res.success && res.data?.users) {
          setSearchResults(
            res.data.users.filter(
              (u) => u.id !== user?.id && !selectedMembers.some((m) => m.id === u.id)
            )
          );
        }
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery, user?.id, selectedMembers]);

  const handleAddMember = (candidate) => {
    setSelectedMembers((prev) => [...prev, candidate]);
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleRemoveMember = (memberId) => {
    setSelectedMembers((prev) => prev.filter((m) => m.id !== memberId));
  };

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!title.trim() || selectedMembers.length === 0 || submitting) return;

    try {
      setSubmitting(true);
      const memberIds = selectedMembers.map((m) => m.id);

      const res = await apiClient.post('/conversations/group', {
        title: title.trim(),
        memberIds
      });

      if (res.success && res.data?.conversation) {
        const group = res.data.conversation;

        // Initialize and distribute local Sender Key for this group
        try {
          await senderKeysService.createDistributionEnvelopes(
            group.id,
            user.id,
            memberIds
          );
        } catch (cryptoErr) {
          console.warn('Sender key initialization warning:', cryptoErr);
        }

        if (onGroupCreated) {
          onGroupCreated(group);
        }
        onClose();
      }
    } catch (err) {
      alert(err.message || 'Failed to create group.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card create-group-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>New Encrypted Group</h3>
          <button type="button" className="modal-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <form onSubmit={handleCreateGroup}>
          <div className="create-group-body">
            <div className="form-group">
              <label htmlFor="group-title-input">Group Name</label>
              <input
                id="group-title-input"
                type="text"
                placeholder="e.g. Design Team, Friends, Study Circle"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={60}
                required
                className="group-title-input"
                autoFocus
              />
            </div>

            {/* Selected Member Chips */}
            {selectedMembers.length > 0 && (
              <div className="selected-members-chips">
                {selectedMembers.map((m) => (
                  <span key={m.id} className="member-chip">
                    @{m.username}
                    <button
                      type="button"
                      onClick={() => handleRemoveMember(m.id)}
                      className="btn-remove-chip"
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Search Input for Members */}
            <div className="form-group">
              <label htmlFor="member-search-input">Add Participants ({selectedMembers.length})</label>
              <input
                id="member-search-input"
                type="text"
                placeholder="Search by username or name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="member-search-input"
              />
            </div>

            {/* Search Results List */}
            <div className="member-search-results">
              {searching ? (
                <div className="search-loading">Searching...</div>
              ) : (
                searchResults.map((u) => (
                  <div
                    key={u.id}
                    className="member-result-item"
                    onClick={() => handleAddMember(u)}
                  >
                    <img
                      src={u.avatar_url || '/uploads/avatars/default-avatar.png'}
                      alt={u.username}
                      className="member-result-avatar"
                    />
                    <div className="member-result-info">
                      <span className="member-result-username">@{u.username}</span>
                      {u.full_name && (
                        <span className="member-result-fullname">{u.full_name}</span>
                      )}
                    </div>
                    <span className="btn-add-tag">+ Add</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={!title.trim() || selectedMembers.length === 0 || submitting}
            >
              {submitting ? 'Creating Group...' : 'Create Encrypted Group'}
            </button>
          </div>
        </form>
      </div>

      <style>{`
        .create-group-modal {
          max-width: 460px;
        }

        .create-group-body {
          padding: 16px 20px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .group-title-input,
        .member-search-input {
          width: 100%;
          padding: 10px 14px;
          border-radius: 10px;
          border: 1px solid var(--border-color, #e2e8f0);
          background: var(--bg-page, #f8fafc);
          color: var(--text-primary, #0f172a);
          font-size: 0.92rem;
          outline: none;
        }

        .selected-members-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          max-height: 90px;
          overflow-y: auto;
        }

        .member-chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: rgba(99, 102, 241, 0.12);
          color: #6366f1;
          font-weight: 600;
          font-size: 0.8rem;
          padding: 4px 10px;
          border-radius: 16px;
        }

        .btn-remove-chip {
          background: none;
          border: none;
          color: #6366f1;
          cursor: pointer;
          font-size: 11px;
        }

        .member-search-results {
          max-height: 180px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .member-result-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 12px;
          border-radius: 8px;
          cursor: pointer;
          transition: background 0.15s ease;
        }

        .member-result-item:hover {
          background: var(--bg-hover, #f1f5f9);
        }

        .member-result-avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          object-fit: cover;
        }

        .member-result-info {
          flex: 1;
          display: flex;
          flex-direction: column;
        }

        .member-result-username {
          font-weight: 700;
          font-size: 0.86rem;
        }

        .member-result-fullname {
          font-size: 0.74rem;
          color: var(--text-secondary, #64748b);
        }

        .btn-add-tag {
          font-size: 0.78rem;
          color: #6366f1;
          font-weight: 700;
        }
      `}</style>
    </div>
  );
}
