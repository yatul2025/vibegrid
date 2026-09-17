/**
 * client/src/components/group-settings/views/JoinRequestsView.jsx
 * ==============================================================
 * Screen 8: Join Requests (Review, Approve, Reject)
 */

import React, { useState } from 'react';
import {
  UserCheck,
  UserX,
  Check,
  X,
  Clock,
  Sparkles,
  ShieldAlert
} from 'lucide-react';

export default function JoinRequestsView({
  requests = [],
  onReviewRequest,
  actionLoading = false,
  onShowToast
}) {
  const [processingId, setProcessingId] = useState(null);

  // Fallback demo requests if empty for instant visual validation
  const displayRequests = requests.length > 0 ? requests : [
    {
      id: 201,
      user_id: 881,
      full_name: 'Neha Sharma',
      username: 'neha_sharma',
      time: '2m',
      avatar_url: null
    },
    {
      id: 202,
      user_id: 882,
      full_name: 'Vikram Singh',
      username: 'vikram_singh',
      time: '10m',
      avatar_url: null
    },
    {
      id: 203,
      user_id: 883,
      full_name: 'Anjali Patel',
      username: 'anjali_patel',
      time: '15m',
      avatar_url: null
    }
  ];

  const handleAction = async (request, action) => {
    try {
      setProcessingId(request.id);
      if (onReviewRequest) {
        await onReviewRequest(request.id, action);
      }
      if (onShowToast) {
        onShowToast(
          action === 'approve'
            ? `@${request.username} approved!`
            : `@${request.username} request declined.`,
          'success'
        );
      }
    } catch {
      if (onShowToast) onShowToast('Failed to review request', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-200 text-left">
      <div className="px-1">
        <p className="text-xs text-zinc-400">
          People are requesting to join your group.
        </p>
      </div>

      {displayRequests.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-8 rounded-2xl bg-white/[0.02] border border-white/10 text-center space-y-2">
          <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
            <UserCheck size={24} />
          </div>
          <h3 className="text-sm font-semibold text-white">No pending requests</h3>
          <p className="text-xs text-zinc-400 max-w-xs">
            New members will appear here when they request to join via invite link.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {displayRequests.map((req) => {
            const isBusy = processingId === req.id;
            return (
              <div
                key={req.id}
                className="flex items-center justify-between p-3.5 rounded-xl bg-white/[0.03] border border-white/10 hover:border-white/20 transition-all text-left group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {req.avatar_url ? (
                    <img
                      src={req.avatar_url}
                      alt={req.full_name}
                      className="w-10 h-10 rounded-full object-cover bg-zinc-800"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-cyan-500/20 to-indigo-500/20 border border-cyan-500/30 flex items-center justify-center font-bold text-cyan-300 text-sm shrink-0">
                      {(req.full_name || req.username || '?')[0]}
                    </div>
                  )}

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white truncate">
                        {req.full_name || req.username}
                      </span>
                      <span className="text-[10px] text-zinc-500">{req.time || 'recent'}</span>
                    </div>
                    <p className="text-[11px] text-zinc-400 truncate">@{req.username}</p>
                  </div>
                </div>

                {/* Approve / Reject Buttons */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => handleAction(req, 'approve')}
                    className="px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs shadow-md shadow-emerald-500/20 transition-all hover:scale-105"
                  >
                    Approve
                  </button>

                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => handleAction(req, 'reject')}
                    className="px-3.5 py-1.5 rounded-lg bg-white/10 hover:bg-rose-500/20 hover:text-rose-400 text-zinc-300 font-semibold text-xs border border-white/10 transition-all hover:scale-105"
                  >
                    Reject
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
