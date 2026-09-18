/**
 * client/src/components/group-settings/views/JoinRequestsView.jsx
 * ==============================================================
 * Screen 8: Join Requests (Review, Approve, Reject) — Unified VibeGrid Design
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
import { JoinRequestsSkeleton } from '../../common/Skeleton';

export default function JoinRequestsView({
  requests = [],
  onReviewRequest,
  actionLoading = false,
  onShowToast,
  loading = false
}) {
  const [processingId, setProcessingId] = useState(null);

  if (loading && requests.length === 0) {
    return <JoinRequestsSkeleton count={3} />;
  }

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
    <div className="space-y-4 text-left">
      <div className="px-1 flex items-center justify-between">
        <span className="vg-section-label m-0">
          {requests.length} {requests.length === 1 ? 'PENDING REQUEST' : 'PENDING REQUESTS'}
        </span>
      </div>

      {requests.length === 0 ? (
        <div className="py-12 px-4 text-center space-y-2 vg-card-subtle">
          <div className="w-10 h-10 mx-auto rounded-xl bg-[var(--bg-page)] border border-[var(--border-color)] flex items-center justify-center text-[var(--text-muted)]">
            <UserCheck size={20} />
          </div>
          <p className="text-xs font-semibold text-[var(--text-primary)] m-0">No pending join requests</p>
          <p className="text-[11px] text-[var(--text-muted)] m-0 max-w-xs mx-auto">
            When admin approval is required, new join requests will appear here for your review.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {requests.map((req) => {
            const isBusy = processingId === req.id;
            return (
              <div
                key={req.id}
                className="flex items-center justify-between p-3.5 rounded-xl vg-card-subtle gap-3"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {req.avatar_url ? (
                    <img
                      src={req.avatar_url}
                      alt={req.full_name}
                      className="w-9 h-9 rounded-full object-cover bg-[var(--bg-page)] border border-[var(--border-color)] shrink-0"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-[var(--primary-light)] text-[var(--primary)] border border-[var(--primary)] flex items-center justify-center font-bold text-xs shrink-0">
                      {(req.full_name || req.username || '?')[0].toUpperCase()}
                    </div>
                  )}

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-[var(--text-primary)] truncate">
                        {req.full_name || req.username}
                      </span>
                      <span className="text-[10px] text-[var(--text-muted)]">{req.time || 'recently'}</span>
                    </div>
                    <p className="text-[11px] text-[var(--text-muted)] truncate m-0">@{req.username}</p>
                  </div>
                </div>

                {/* Approve / Reject Buttons */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    disabled={isBusy || actionLoading}
                    onClick={() => handleAction(req, 'approve')}
                    className="btn-primary btn-sm"
                  >
                    <Check size={14} />
                    <span>Approve</span>
                  </button>

                  <button
                    type="button"
                    disabled={isBusy || actionLoading}
                    onClick={() => handleAction(req, 'reject')}
                    className="btn-secondary btn-sm"
                  >
                    <X size={14} />
                    <span>Decline</span>
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
