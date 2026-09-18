/**
 * client/src/components/group-settings/GroupSettingsModal.jsx
 * ============================================================
 * Production 10-Screen VibeGrid Group Settings Master Modal
 */

import React, { useState, useEffect, useCallback } from 'react';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import {
  X,
  ArrowLeft,
  Users,
  Search,
  UserPlus,
  Check,
  AlertCircle
} from 'lucide-react';

// Subviews
import OverviewView from './views/OverviewView';
import MembersView from './views/MembersView';
import PermissionsView from './views/PermissionsView';
import InviteShareView from './views/InviteShareView';
import GroupInfoView from './views/GroupInfoView';
import PinnedMessagesView from './views/PinnedMessagesView';
import MediaFilesView from './views/MediaFilesView';
import JoinRequestsView from './views/JoinRequestsView';
import AdminManagementView from './views/AdminManagementView';
import DisappearingMessagesView from './views/DisappearingMessagesView';
import './GroupSettingsModal.css';

const EMPTY_PINNED_MESSAGES = [];

export default function GroupSettingsModal({
  isOpen,
  onClose,
  group,
  conversationId,
  initialScreen = 'overview',
  initialAction = null,
  pinnedMessages: externalPinnedMessages = EMPTY_PINNED_MESSAGES,
  onGroupUpdated,
  onGroupDeleted,
  onGroupLeft
}) {
  const { user } = useAuth();

  // Navigation Stack
  const [screenStack, setScreenStack] = useState([initialScreen || 'overview']);
  const currentScreen = screenStack[screenStack.length - 1] || 'overview';

  // State
  const [members, setMembers] = useState([]);
  const [convDetails, setConvDetails] = useState(null);
  const [permissions, setPermissions] = useState({});
  const [inviteData, setInviteData] = useState({ code: null, url: null });
  const [joinRequests, setJoinRequests] = useState([]);
  const [mediaData, setMediaData] = useState({ photos: [], videos: [], files: [], links: [] });
  const [pinnedMessages, setPinnedMessages] = useState(externalPinnedMessages || []);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState({ message: '', type: 'info', visible: false });

  useEffect(() => {
    if (externalPinnedMessages && Array.isArray(externalPinnedMessages) && externalPinnedMessages !== pinnedMessages) {
      setPinnedMessages(externalPinnedMessages);
    }
  }, [externalPinnedMessages]);

  // Add Member Live Drawer
  const [showAddDrawer, setShowAddDrawer] = useState(false);
  const [searchMemberQuery, setSearchMemberQuery] = useState('');
  const [searchMemberResults, setSearchMemberResults] = useState([]);
  const [searchingMembers, setSearchingMembers] = useState(false);
  const [addingMemberId, setAddingMemberId] = useState(null);

  const rawId = group?.conversation_id || group?.id || group?.partner_id || conversationId || '';
  const groupId = String(rawId).replace(/^(group-|grp-)+/i, '').trim();

  // Roles
  const currentUserMember = members.find((m) => Number(m.id) === Number(user?.id));
  const creatorId = convDetails?.created_by || group?.created_by;
  const isOwner = creatorId ? Number(creatorId) === Number(user?.id) : false;
  const isAdmin = isOwner || currentUserMember?.role === 'admin' || group?.user_role === 'admin';

  const showToast = useCallback((message, type = 'info') => {
    setToast({ message, type, visible: true });
    setTimeout(() => {
      setToast((prev) => ({ ...prev, visible: false }));
    }, 3000);
  }, []);

  // Navigation Helpers
  const navigateTo = (screen) => {
    setScreenStack((prev) => [...prev, screen]);
  };

  const goBack = () => {
    setScreenStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : ['overview']));
  };

  // Reset navigation when modal opens
  useEffect(() => {
    if (isOpen) {
      setScreenStack([initialScreen || 'overview']);
      setShowAddDrawer(false);
    }
  }, [isOpen, initialScreen]);

  // Load Group Data
  const fetchGroupDetails = useCallback(async () => {
    if (!groupId) return;
    try {
      setLoading(true);
      const res = await apiClient.get(`/conversations/${groupId}/members`);
      if (res.success && res.data) {
        if (res.data.members) setMembers(res.data.members);
        if (res.data.conversation) {
          setConvDetails(res.data.conversation);
          if (res.data.conversation.permissions) {
            setPermissions(res.data.conversation.permissions);
          }
          if (res.data.conversation.invite_code) {
            setInviteData({
              code: res.data.conversation.invite_code,
              url: `/join/${res.data.conversation.invite_code}`
            });
          }
        }
      }

      // Fetch Join Requests if Admin
      try {
        const reqRes = await apiClient.get(`/conversations/${groupId}/join-requests`);
        if (reqRes.success && reqRes.data?.requests) {
          setJoinRequests(reqRes.data.requests);
        }
      } catch {}

      // Fetch Media
      try {
        const mediaRes = await apiClient.get(`/conversations/${groupId}/media`);
        if (mediaRes.success && mediaRes.data) {
          setMediaData(mediaRes.data);
        }
      } catch {}
    } catch (err) {
      console.error('Failed to load group details:', err);
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    if (isOpen && groupId) {
      fetchGroupDetails();
    }
  }, [isOpen, groupId, fetchGroupDetails]);

  // Live user search for Add Member drawer
  useEffect(() => {
    if (!showAddDrawer) return;

    if (!searchMemberQuery.trim()) {
      let active = true;
      (async () => {
        try {
          setSearchingMembers(true);
          const res = await apiClient.get('/users/suggestions');
          if (active && res.success && res.data?.suggestions) {
            const existingIds = new Set(members.map((m) => Number(m.id)));
            setSearchMemberResults(res.data.suggestions.filter((u) => !existingIds.has(Number(u.id))));
          }
        } catch {}
        finally {
          if (active) setSearchingMembers(false);
        }
      })();
      return () => { active = false; };
    }

    const timer = setTimeout(async () => {
      try {
        setSearchingMembers(true);
        const res = await apiClient.get(`/users/search?q=${encodeURIComponent(searchMemberQuery)}`);
        if (res.success && res.data?.users) {
          const existingIds = new Set(members.map((m) => Number(m.id)));
          setSearchMemberResults(res.data.users.filter((u) => !existingIds.has(Number(u.id))));
        }
      } catch (err) {
        console.error('User search error:', err);
      } finally {
        setSearchingMembers(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [showAddDrawer, searchMemberQuery, members]);

  // 1. Update Title
  const handleUpdateTitle = async (newTitle) => {
    if (!newTitle.trim() || actionLoading) return;
    try {
      setActionLoading(true);
      const res = await apiClient.put(`/conversations/${groupId}`, { title: newTitle.trim() });
      if (res.success) {
        const updatedConv = res.data?.conversation || { ...group, title: newTitle.trim(), partner_full_name: newTitle.trim() };
        setConvDetails(updatedConv);
        if (onGroupUpdated) {
          onGroupUpdated({ ...group, title: newTitle.trim(), partner_full_name: newTitle.trim() });
        }
        showToast('Group name updated.', 'success');
      }
    } catch (err) {
      showToast(err.message || 'Failed to update title', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // 2. Update Description
  const handleUpdateDescription = async (newDesc) => {
    try {
      setActionLoading(true);
      const res = await apiClient.put(`/conversations/${groupId}/info`, { description: newDesc });
      if (res.success && res.data?.conversation) {
        setConvDetails(res.data.conversation);
        showToast('Group description updated.', 'success');
      }
    } catch (err) {
      showToast(err.message || 'Failed to update description', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // 3. Add Member
  const handleAddMember = async (candidate) => {
    if (addingMemberId || !groupId) return;
    try {
      setAddingMemberId(candidate.id);
      const res = await apiClient.post(`/conversations/${groupId}/members`, {
        memberIds: [candidate.id]
      });
      if (res.success) {
        if (res.data?.members) {
          setMembers(res.data.members);
        } else {
          setMembers((prev) => [...prev, { ...candidate, role: 'member' }]);
        }
        setSearchMemberResults((prev) => prev.filter((u) => u.id !== candidate.id));
        showToast(`@${candidate.username} added to the group.`, 'success');
        if (onGroupUpdated) {
          onGroupUpdated({ ...group, member_count: members.length + 1 });
        }
      }
    } catch (err) {
      showToast(err.message || 'Failed to add member', 'error');
    } finally {
      setAddingMemberId(null);
    }
  };

  // 4. Remove Member
  const handleRemoveMember = async (targetUser) => {
    if (!groupId || actionLoading) return;
    try {
      setActionLoading(true);
      const res = await apiClient.delete(`/conversations/${groupId}/members/${targetUser.id}`);
      if (res.success) {
        setMembers((prev) => prev.filter((m) => Number(m.id) !== Number(targetUser.id)));
        showToast(`@${targetUser.username} removed.`, 'success');
        if (onGroupUpdated) {
          onGroupUpdated({ ...group, member_count: members.length - 1 });
        }
      }
    } catch (err) {
      showToast(err.message || 'Failed to remove member', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // 5. Promote to Admin
  const handlePromoteMember = async (userId) => {
    try {
      setActionLoading(true);
      const res = await apiClient.put(`/conversations/${groupId}/members/${userId}/role`, {
        role: 'admin'
      });
      if (res.success) {
        setMembers((prev) =>
          prev.map((m) => (Number(m.id) === Number(userId) ? { ...m, role: 'admin' } : m))
        );
        showToast('Member promoted to Admin.', 'success');
      }
    } catch (err) {
      showToast(err.message || 'Failed to promote member', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // 6. Demote Admin
  const handleDemoteMember = async (userId) => {
    try {
      setActionLoading(true);
      const res = await apiClient.put(`/conversations/${groupId}/members/${userId}/role`, {
        role: 'member'
      });
      if (res.success) {
        setMembers((prev) =>
          prev.map((m) => (Number(m.id) === Number(userId) ? { ...m, role: 'member' } : m))
        );
        showToast('Admin role removed.', 'success');
      }
    } catch (err) {
      showToast(err.message || 'Failed to remove admin role', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // 7. Update Permissions
  const handleUpdatePermissions = async (newPerms) => {
    try {
      setActionLoading(true);
      const res = await apiClient.put(`/conversations/${groupId}/permissions`, {
        permissions: newPerms
      });
      if (res.success && res.data?.permissions) {
        setPermissions(res.data.permissions);
        showToast('Group permissions saved.', 'success');
      }
    } catch (err) {
      showToast(err.message || 'Failed to update permissions', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // 8. Regenerate Invite Code
  const handleRegenerateInvite = async () => {
    try {
      setActionLoading(true);
      const res = await apiClient.post(`/conversations/${groupId}/invite/regenerate`);
      if (res.success && res.data?.invite_code) {
        setInviteData({
          code: res.data.invite_code,
          url: res.data.invite_url
        });
        showToast('New invite link generated!', 'success');
      }
    } catch (err) {
      showToast(err.message || 'Failed to regenerate invite', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // 9. Review Join Request
  const handleReviewJoinRequest = async (requestId, action) => {
    try {
      const res = await apiClient.post(`/conversations/${groupId}/join-requests/${requestId}/review`, {
        action
      });
      if (res.success) {
        setJoinRequests((prev) => prev.filter((r) => r.id !== requestId));
        if (action === 'approve') {
          fetchGroupDetails();
        }
      }
    } catch (err) {
      showToast(err.message || 'Failed to review request', 'error');
    }
  };

  // 10. Update Ephemeral Timer
  const handleUpdateEphemeralTimer = async (seconds) => {
    try {
      setActionLoading(true);
      const res = await apiClient.put(`/conversations/${groupId}/ephemeral`, {
        timerSeconds: seconds
      });
      if (res.success) {
        setConvDetails((prev) => ({
          ...prev,
          ephemeral_timer_seconds: seconds
        }));
      }
    } catch (err) {
      showToast(err.message || 'Failed to update disappearing messages', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // 11. Leave Group
  const handleLeaveGroup = async () => {
    if (!groupId || actionLoading) return;
    try {
      setActionLoading(true);
      const res = await apiClient.post(`/conversations/${groupId}/leave`);
      if (res.success) {
        onClose();
        if (onGroupLeft) onGroupLeft(groupId);
      }
    } catch (err) {
      showToast(err.message || 'Failed to leave group', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // 12. Delete Group
  const handleDeleteGroup = async () => {
    if (!groupId || actionLoading) return;
    try {
      setActionLoading(true);
      const res = await apiClient.delete(`/conversations/${groupId}`);
      if (res.success) {
        onClose();
        if (onGroupDeleted) onGroupDeleted(groupId);
      }
    } catch (err) {
      showToast(err.message || 'Failed to delete group', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // 13. Unpin Message
  const handleUnpinMessage = async (messageId) => {
    if (!groupId || actionLoading) return;
    try {
      setActionLoading(true);
      const res = await apiClient.post(`/messages/conv/${groupId}/pin`, {
        messageId,
        isPinned: false
      });
      if (res.success) {
        setPinnedMessages((prev) => prev.filter((m) => String(m.id) !== String(messageId)));
        showToast('Message unpinned.', 'success');
      }
    } catch (err) {
      showToast(err.message || 'Failed to unpin message', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  if (!isOpen) return null;

  // Screen Title Formatter
  const getScreenTitle = () => {
    switch (currentScreen) {
      case 'members':
        return `Members (${members.length})`;
      case 'permissions':
        return 'Group Permissions';
      case 'invite':
        return 'Invite Members';
      case 'info':
        return 'Group Info';
      case 'pinned':
        return 'Pinned Messages';
      case 'media':
        return 'Media & Files';
      case 'join_requests':
        return `Join Requests (${joinRequests.length})`;
      case 'admins':
        return 'Admin Management';
      case 'disappearing':
        return 'Disappearing Messages';
      case 'overview':
      default:
        return 'Group Details';
    }
  };

  return (
    <div
      className="group-settings-modal-overlay fixed inset-0 bg-black/80 backdrop-blur-md z-[2500] flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="group-settings-card relative w-full max-w-md max-h-[92vh] flex flex-col bg-[#0a0c10] border border-white/10 rounded-2xl shadow-2xl shadow-black overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Navigation Header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/10 bg-zinc-950/60 backdrop-blur-sm shrink-0">
          <div className="flex items-center gap-2.5">
            {currentScreen !== 'overview' ? (
              <button
                type="button"
                onClick={goBack}
                className="p-1.5 -ml-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
                title="Back"
              >
                <ArrowLeft size={18} />
              </button>
            ) : (
              <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-pink-500 via-purple-500 to-cyan-500 p-[1px] flex items-center justify-center">
                <div className="w-full h-full bg-zinc-900 rounded-[7px] flex items-center justify-center text-white font-bold text-xs">
                  V
                </div>
              </div>
            )}
            <h3 className="text-sm font-bold text-white tracking-tight truncate max-w-[240px]">
              {getScreenTitle()}
            </h3>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Status Toast Banner */}
        {toast.visible && (
          <div
            className={`px-4 py-2 text-xs font-semibold flex items-center gap-2 border-b ${
              toast.type === 'error'
                ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                : toast.type === 'success'
                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                : 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30'
            } animate-in slide-in-from-top duration-150 shrink-0`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-current" />
            <span>{toast.message}</span>
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-4 custom-scroll">
          {currentScreen === 'overview' && (
            <OverviewView
              group={group}
              members={members}
              convDetails={convDetails}
              currentUser={user}
              isAdmin={isAdmin}
              isOwner={isOwner}
              pinnedCount={pinnedMessages.length}
              joinRequestsCount={joinRequests.length}
              ephemeralTimer={convDetails?.ephemeral_timer_seconds}
              initialAction={initialAction}
              onNavigate={navigateTo}
              onUpdateTitle={handleUpdateTitle}
              onUpdateDescription={handleUpdateDescription}
              onOpenAddMember={() => setShowAddDrawer(true)}
              onLeaveGroup={handleLeaveGroup}
              onDeleteGroup={handleDeleteGroup}
              actionLoading={actionLoading}
            />
          )}

          {currentScreen === 'members' && (
            <MembersView
              members={members}
              currentUser={user}
              convDetails={convDetails}
              isAdmin={isAdmin}
              isOwner={isOwner}
              onOpenAddMember={() => setShowAddDrawer(true)}
              onRemoveMember={handleRemoveMember}
              onPromoteMember={handlePromoteMember}
              onDemoteMember={handleDemoteMember}
              actionLoading={actionLoading}
            />
          )}

          {currentScreen === 'permissions' && (
            <PermissionsView
              permissions={permissions}
              isAdmin={isAdmin}
              onUpdatePermissions={handleUpdatePermissions}
              actionLoading={actionLoading}
            />
          )}

          {currentScreen === 'invite' && (
            <InviteShareView
              group={group}
              inviteCode={inviteData.code}
              isAdmin={isAdmin}
              permissions={permissions}
              onRegenerateInvite={handleRegenerateInvite}
              onUpdatePermissions={handleUpdatePermissions}
              actionLoading={actionLoading}
              onShowToast={showToast}
            />
          )}

          {currentScreen === 'info' && (
            <GroupInfoView
              group={group}
              convDetails={convDetails}
              members={members}
              currentUser={user}
              isAdmin={isAdmin}
              isOwner={isOwner}
              onNavigate={navigateTo}
              onOpenAddMember={() => setShowAddDrawer(true)}
              onUpdateTitle={handleUpdateTitle}
              onUpdateDescription={handleUpdateDescription}
              onShowToast={showToast}
            />
          )}

          {currentScreen === 'pinned' && (
            <PinnedMessagesView
              pinnedMessages={pinnedMessages}
              isAdmin={isAdmin}
              onUnpinMessage={handleUnpinMessage}
              onCloseModal={onClose}
              onShowToast={showToast}
            />
          )}

          {currentScreen === 'media' && (
            <MediaFilesView mediaData={mediaData} />
          )}

          {currentScreen === 'join_requests' && (
            <JoinRequestsView
              requests={joinRequests}
              onReviewRequest={handleReviewJoinRequest}
              actionLoading={actionLoading}
              onShowToast={showToast}
            />
          )}

          {currentScreen === 'admins' && (
            <AdminManagementView
              members={members}
              convDetails={convDetails}
              currentUser={user}
              isOwner={isOwner}
              onPromoteMember={handlePromoteMember}
              onDemoteMember={handleDemoteMember}
              actionLoading={actionLoading}
              onShowToast={showToast}
            />
          )}

          {currentScreen === 'disappearing' && (
            <DisappearingMessagesView
              ephemeralTimer={convDetails?.ephemeral_timer_seconds}
              isAdmin={isAdmin}
              onUpdateEphemeralTimer={handleUpdateEphemeralTimer}
              actionLoading={actionLoading}
              onShowToast={showToast}
            />
          )}
        </div>

        {/* Add Member Live Drawer Slide-Over */}
        {showAddDrawer && (
          <div
            className="absolute inset-0 bg-zinc-950/95 backdrop-blur-md z-50 flex flex-col p-4 animate-in slide-in-from-bottom-5 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/10 shrink-0">
              <div className="flex items-center gap-2">
                <UserPlus size={18} className="text-emerald-400" />
                <h4 className="text-sm font-bold text-white">Add New Members</h4>
              </div>
              <button
                type="button"
                onClick={() => setShowAddDrawer(false)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            {/* Search Input */}
            <div className="relative mt-3 shrink-0">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                value={searchMemberQuery}
                onChange={(e) => setSearchMemberQuery(e.target.value)}
                placeholder="Search by username or name..."
                autoFocus
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-xs placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-emerald-400"
              />
            </div>

            {/* Result List */}
            <div className="flex-1 overflow-y-auto mt-3 space-y-2 custom-scroll">
              {searchingMembers ? (
                <p className="text-xs text-zinc-400 text-center py-6">Searching...</p>
              ) : searchMemberResults.length === 0 ? (
                <p className="text-xs text-zinc-500 text-center py-6">No matching users found.</p>
              ) : (
                searchMemberResults.map((candidate) => (
                  <div
                    key={candidate.id}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.03] border border-white/10 hover:border-white/20 transition-all text-left"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {candidate.avatar_url ? (
                        <img
                          src={candidate.avatar_url}
                          alt={candidate.full_name}
                          className="w-9 h-9 rounded-full object-cover bg-zinc-800 shrink-0"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-xs flex items-center justify-center shrink-0">
                          {(candidate.full_name || candidate.username || '?')[0]}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-white truncate">
                          {candidate.full_name || candidate.username}
                        </p>
                        <p className="text-[10px] text-zinc-400 truncate">@{candidate.username}</p>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={addingMemberId === candidate.id}
                      onClick={() => handleAddMember(candidate)}
                      className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs transition-transform hover:scale-105 shrink-0"
                    >
                      {addingMemberId === candidate.id ? 'Adding...' : 'Add'}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
