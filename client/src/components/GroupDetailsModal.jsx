/**
 * client/src/components/GroupDetailsModal.jsx
 * ===========================================
 * Group Info, Member Management, Settings, Leave & Delete Group Modal
 */

import React, { useState, useEffect } from 'react';
import apiClient from '../api/client';
import { useAuth } from '../context/AuthContext';
import {
  X,
  Users,
  UserPlus,
  UserMinus,
  Trash2,
  LogOut,
  Edit2,
  Check,
  Search,
  Shield,
  Crown,
  AlertTriangle
} from 'lucide-react';

export default function GroupDetailsModal({
  isOpen,
  onClose,
  group,
  onGroupUpdated,
  onGroupDeleted,
  onGroupLeft
}) {
  const { user } = useAuth();
  const [members, setMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [savingTitle, setSavingTitle] = useState(false);

  // Add members drawer
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [addingMemberId, setAddingMemberId] = useState(null);

  // Confirmations
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState({ text: '', type: '' });

  const groupId = group?.id || (group?.conversation_id ? String(group.conversation_id).replace(/^group-/, '') : null);

  // Determine current user role
  const currentUserMember = members.find((m) => Number(m.id) === Number(user?.id));
  const isCreator = group?.created_by ? Number(group.created_by) === Number(user?.id) : false;
  const isAdmin = isCreator || currentUserMember?.role === 'admin';

  // Load members whenever modal opens
  useEffect(() => {
    if (!isOpen || !groupId) return;

    setNewTitle(group?.title || group?.partner_full_name || 'Group Chat');
    setIsEditingTitle(false);
    setShowAddMembers(false);
    setConfirmLeave(false);
    setConfirmDelete(false);
    setStatusMessage({ text: '', type: '' });

    const fetchMembers = async () => {
      try {
        setLoadingMembers(true);
        const res = await apiClient.get(`/conversations/${groupId}/members`);
        if (res.success && res.data?.members) {
          setMembers(res.data.members);
        } else if (Array.isArray(group?.members) && group.members.length > 0) {
          setMembers(group.members);
        }
      } catch (err) {
        // Fallback to members array from activePartner if API fails
        if (Array.isArray(group?.members) && group.members.length > 0) {
          setMembers(group.members);
        }
      } finally {
        setLoadingMembers(false);
      }
    };

    fetchMembers();
  }, [isOpen, groupId]);

  // Live user search for adding members
  useEffect(() => {
    if (!showAddMembers) return;

    if (!searchQuery.trim()) {
      let active = true;
      (async () => {
        try {
          setSearchingUsers(true);
          const res = await apiClient.get('/users/suggestions');
          if (active && res.success && res.data?.suggestions) {
            const existingIds = new Set(members.map((m) => Number(m.id)));
            setSearchResults(res.data.suggestions.filter((u) => !existingIds.has(Number(u.id))));
          }
        } catch {}
        finally {
          if (active) setSearchingUsers(false);
        }
      })();
      return () => { active = false; };
    }

    const timer = setTimeout(async () => {
      try {
        setSearchingUsers(true);
        const res = await apiClient.get(`/users/search?q=${encodeURIComponent(searchQuery)}`);
        if (res.success && res.data?.users) {
          const existingIds = new Set(members.map((m) => Number(m.id)));
          setSearchResults(res.data.users.filter((u) => !existingIds.has(Number(u.id))));
        }
      } catch (err) {
        console.error('Search users error:', err);
      } finally {
        setSearchingUsers(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [showAddMembers, searchQuery, members]);

  // Save Title
  const handleSaveTitle = async () => {
    if (!newTitle.trim() || savingTitle) return;
    try {
      setSavingTitle(true);
      const res = await apiClient.put(`/conversations/${groupId}`, { title: newTitle.trim() });
      if (res.success) {
        setIsEditingTitle(false);
        setStatusMessage({ text: 'Group name updated.', type: 'success' });
        if (onGroupUpdated) {
          onGroupUpdated({ ...group, title: newTitle.trim(), partner_full_name: newTitle.trim() });
        }
      } else {
        throw new Error(res.error || 'Failed to update title');
      }
    } catch (err) {
      setStatusMessage({ text: err.message || 'Failed to update title', type: 'error' });
    } finally {
      setSavingTitle(false);
    }
  };

  // Add Member
  const handleAddMember = async (candidate) => {
    if (addingMemberId || !groupId) return;
    try {
      setAddingMemberId(candidate.id);
      const res = await apiClient.post(`/conversations/${groupId}/members`, {
        memberIds: [candidate.id]
      });
      if (res.success && res.data?.members) {
        setMembers(res.data.members);
        setStatusMessage({ text: `@${candidate.username} added to the group.`, type: 'success' });
        setSearchResults((prev) => prev.filter((u) => u.id !== candidate.id));
      } else {
        throw new Error(res.error || 'Failed to add member');
      }
    } catch (err) {
      setStatusMessage({ text: err.message || 'Failed to add member', type: 'error' });
    } finally {
      setAddingMemberId(null);
    }
  };

  // Remove Member
  const handleRemoveMember = async (targetUser) => {
    if (!groupId || actionLoading) return;
    const confirmed = window.confirm(`Remove @${targetUser.username} from this group?`);
    if (!confirmed) return;

    try {
      setActionLoading(true);
      const res = await apiClient.delete(`/conversations/${groupId}/members/${targetUser.id}`);
      if (res.success) {
        setMembers((prev) => prev.filter((m) => Number(m.id) !== Number(targetUser.id)));
        setStatusMessage({ text: `@${targetUser.username} removed.`, type: 'success' });
      } else {
        throw new Error(res.error || 'Failed to remove member');
      }
    } catch (err) {
      setStatusMessage({ text: err.message || 'Failed to remove member', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  // Leave Group
  const handleLeaveGroup = async () => {
    if (!groupId || actionLoading) return;
    try {
      setActionLoading(true);
      const res = await apiClient.post(`/conversations/${groupId}/leave`);
      if (res.success) {
        // Remove from local cache
        try {
          const cacheKey = `vg_local_groups_${user?.id || 'guest'}`;
          const existing = JSON.parse(localStorage.getItem(cacheKey) || '[]');
          localStorage.setItem(cacheKey, JSON.stringify(existing.filter((g) => g.id !== groupId)));
        } catch {}

        onClose();
        if (onGroupLeft) onGroupLeft(groupId);
      } else {
        throw new Error(res.error || 'Failed to leave group');
      }
    } catch (err) {
      setStatusMessage({ text: err.message || 'Failed to leave group', type: 'error' });
      setActionLoading(false);
    }
  };

  // Delete Group
  const handleDeleteGroup = async () => {
    if (!groupId || actionLoading) return;
    try {
      setActionLoading(true);
      const res = await apiClient.delete(`/conversations/${groupId}`);
      if (res.success) {
        // Remove from local cache
        try {
          const cacheKey = `vg_local_groups_${user?.id || 'guest'}`;
          const existing = JSON.parse(localStorage.getItem(cacheKey) || '[]');
          localStorage.setItem(cacheKey, JSON.stringify(existing.filter((g) => g.id !== groupId)));
        } catch {}

        onClose();
        if (onGroupDeleted) onGroupDeleted(groupId);
      } else {
        throw new Error(res.error || 'Failed to delete group');
      }
    } catch (err) {
      setStatusMessage({ text: err.message || 'Failed to delete group', type: 'error' });
      setActionLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose} style={{ zIndex: 1200 }}>
      <div
        className="modal-card group-details-modal"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '480px',
          width: '95%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          borderRadius: '16px'
        }}
      >
        {/* Header */}
        <div className="modal-header" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color, rgba(255,255,255,0.1))' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users size={20} style={{ color: 'var(--primary, #7c3aed)' }} />
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>Group Details</h3>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close modal">
            <X size={20} />
          </button>
        </div>

        {/* Status Toast */}
        {statusMessage.text && (
          <div
            style={{
              padding: '8px 16px',
              fontSize: '0.85rem',
              backgroundColor: statusMessage.type === 'error' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(34, 197, 94, 0.15)',
              color: statusMessage.type === 'error' ? '#ef4444' : '#22c55e',
              borderBottom: '1px solid currentColor'
            }}
          >
            {statusMessage.text}
          </div>
        )}

        {/* Scrollable Content */}
        <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
          {/* Group Profile Header */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '20px' }}>
            <div
              style={{
                width: '72px',
                height: '72px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #7c3aed, #ec4899)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.8rem',
                color: '#fff',
                marginBottom: '12px',
                boxShadow: '0 4px 14px rgba(124, 58, 237, 0.35)'
              }}
            >
              <Users size={36} />
            </div>

            {/* Editable Title */}
            {isEditingTitle ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', maxWidth: '300px' }}>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  maxLength={60}
                  autoFocus
                  style={{
                    flex: 1,
                    padding: '6px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--primary, #7c3aed)',
                    background: 'var(--bg-secondary, rgba(255,255,255,0.05))',
                    color: 'inherit',
                    fontSize: '1rem',
                    textAlign: 'center'
                  }}
                />
                <button
                  type="button"
                  onClick={handleSaveTitle}
                  disabled={savingTitle || !newTitle.trim()}
                  style={{
                    background: 'var(--primary, #7c3aed)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '6px 10px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  <Check size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditingTitle(false)}
                  style={{
                    background: 'transparent',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '8px',
                    padding: '6px 10px',
                    cursor: 'pointer'
                  }}
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700 }}>
                  {group?.title || group?.partner_full_name || 'Group Chat'}
                </h2>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => setIsEditingTitle(true)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-secondary, #9ca3af)',
                      cursor: 'pointer',
                      padding: '4px'
                    }}
                    title="Edit group name"
                  >
                    <Edit2 size={16} />
                  </button>
                )}
              </div>
            )}

            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary, #9ca3af)', marginTop: '4px' }}>
              {members.length} {members.length === 1 ? 'member' : 'members'}
            </div>
          </div>

          {/* Members List Section */}
          <div style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-secondary, #9ca3af)' }}>
                MEMBERS ({members.length})
              </h4>
              <button
                type="button"
                onClick={() => setShowAddMembers(!showAddMembers)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--primary, #7c3aed)',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <UserPlus size={15} />
                {showAddMembers ? 'Close Search' : 'Add Members'}
              </button>
            </div>

            {/* Add Member Drawer */}
            {showAddMembers && (
              <div
                style={{
                  background: 'var(--bg-secondary, rgba(255,255,255,0.03))',
                  padding: '12px',
                  borderRadius: '12px',
                  border: '1px solid var(--border-color, rgba(255,255,255,0.1))',
                  marginBottom: '16px'
                }}
              >
                <div style={{ position: 'relative', marginBottom: '10px' }}>
                  <Search size={16} style={{ position: 'absolute', left: '10px', top: '10px', color: '#9ca3af' }} />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search users to add..."
                    style={{
                      width: '100%',
                      padding: '8px 12px 8px 34px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color, rgba(255,255,255,0.15))',
                      background: 'var(--bg-primary, #000)',
                      color: 'inherit',
                      fontSize: '0.9rem',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                {searchingUsers ? (
                  <div style={{ textAlign: 'center', padding: '12px', fontSize: '0.85rem', color: '#9ca3af' }}>
                    Searching...
                  </div>
                ) : searchResults.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '12px', fontSize: '0.85rem', color: '#9ca3af' }}>
                    {searchQuery ? 'No matching users found.' : 'Search for users to add.'}
                  </div>
                ) : (
                  <div style={{ maxHeight: '160px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {searchResults.map((candidate) => (
                      <div
                        key={candidate.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '6px 8px',
                          borderRadius: '8px',
                          background: 'rgba(255,255,255,0.02)'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <img
                            src={candidate.avatar_url || '/uploads/avatars/default-avatar.png'}
                            alt=""
                            style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover' }}
                            onError={(e) => { e.target.src = '/uploads/avatars/default-avatar.png'; }}
                          />
                          <div>
                            <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{candidate.full_name || candidate.username}</div>
                            <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>@{candidate.username}</div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleAddMember(candidate)}
                          disabled={addingMemberId === candidate.id}
                          style={{
                            background: 'var(--primary, #7c3aed)',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '6px',
                            padding: '4px 10px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                        >
                          {addingMemberId === candidate.id ? 'Adding...' : 'Add'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Member List */}
            {loadingMembers ? (
              <div style={{ textAlign: 'center', padding: '20px', color: '#9ca3af', fontSize: '0.9rem' }}>
                Loading participants...
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {members.map((member) => {
                  const isMe = Number(member.id) === Number(user?.id);
                  const isMemberAdmin = member.role === 'admin' || (group?.created_by && Number(group.created_by) === Number(member.id));

                  return (
                    <div
                      key={member.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        borderRadius: '10px',
                        background: 'var(--bg-secondary, rgba(255,255,255,0.03))',
                        border: '1px solid var(--border-color, rgba(255,255,255,0.05))'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <img
                          src={member.avatar_url || '/uploads/avatars/default-avatar.png'}
                          alt=""
                          style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' }}
                          onError={(e) => { e.target.src = '/uploads/avatars/default-avatar.png'; }}
                        />
                        <div>
                          <div style={{ fontSize: '0.9rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span>{member.full_name || member.username}</span>
                            {isMe && (
                              <span style={{ fontSize: '0.7rem', color: '#9ca3af', fontWeight: 400 }}>(You)</span>
                            )}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #9ca3af)' }}>
                            @{member.username}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {isMemberAdmin && (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '2px 8px',
                              borderRadius: '12px',
                              fontSize: '0.7rem',
                              fontWeight: 600,
                              background: 'rgba(124, 58, 237, 0.15)',
                              color: '#a78bfa',
                              border: '1px solid rgba(124, 58, 237, 0.3)'
                            }}
                          >
                            <Crown size={12} />
                            Admin
                          </span>
                        )}

                        {isAdmin && !isMe && !isMemberAdmin && (
                          <button
                            type="button"
                            onClick={() => handleRemoveMember(member)}
                            disabled={actionLoading}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#ef4444',
                              cursor: 'pointer',
                              padding: '4px',
                              display: 'flex',
                              alignItems: 'center'
                            }}
                            title={`Remove @${member.username}`}
                          >
                            <UserMinus size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Danger Zone / Actions */}
          <div style={{ borderTop: '1px solid var(--border-color, rgba(255,255,255,0.1))', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {/* Leave Group Action */}
            {confirmLeave ? (
              <div
                style={{
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: '10px',
                  padding: '12px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ef4444', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 600 }}>
                  <AlertTriangle size={18} />
                  Leave this group?
                </div>
                <div style={{ fontSize: '0.8rem', color: '#9ca3af', marginBottom: '12px' }}>
                  You will no longer receive updates or messages from this conversation.
                </div>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={() => setConfirmLeave(false)}
                    style={{
                      background: 'transparent',
                      border: '1px solid rgba(255,255,255,0.2)',
                      color: 'inherit',
                      padding: '6px 12px',
                      borderRadius: '6px',
                      fontSize: '0.8rem',
                      cursor: 'pointer'
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleLeaveGroup}
                    disabled={actionLoading}
                    style={{
                      background: '#ef4444',
                      border: 'none',
                      color: '#fff',
                      padding: '6px 14px',
                      borderRadius: '6px',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    {actionLoading ? 'Leaving...' : 'Confirm Leave'}
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmLeave(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  background: 'var(--bg-secondary, rgba(255,255,255,0.03))',
                  border: '1px solid var(--border-color, rgba(255,255,255,0.1))',
                  color: '#f87171',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                <LogOut size={18} />
                Leave Group
              </button>
            )}

            {/* Delete Group Action (Admin only) */}
            {isAdmin && (
              confirmDelete ? (
                <div
                  style={{
                    background: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid #ef4444',
                    borderRadius: '10px',
                    padding: '12px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ef4444', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 700 }}>
                    <Trash2 size={18} />
                    Permanently Delete Group?
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#d1d5db', marginBottom: '12px' }}>
                    This action cannot be undone. All messages and media in this group will be deleted for everyone.
                  </div>
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      style={{
                        background: 'transparent',
                        border: '1px solid rgba(255,255,255,0.2)',
                        color: 'inherit',
                        padding: '6px 12px',
                        borderRadius: '6px',
                        fontSize: '0.8rem',
                        cursor: 'pointer'
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleDeleteGroup}
                      disabled={actionLoading}
                      style={{
                        background: '#dc2626',
                        border: 'none',
                        color: '#fff',
                        padding: '6px 14px',
                        borderRadius: '6px',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      {actionLoading ? 'Deleting...' : 'Delete Forever'}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    background: 'rgba(239, 68, 68, 0.08)',
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                    color: '#ef4444',
                    fontSize: '0.9rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  <Trash2 size={18} />
                  Delete Group
                </button>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
