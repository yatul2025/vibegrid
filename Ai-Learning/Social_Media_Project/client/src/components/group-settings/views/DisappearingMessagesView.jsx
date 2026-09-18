/**
 * client/src/components/group-settings/views/DisappearingMessagesView.jsx
 * ======================================================================
 * Screen 10: Disappearing Messages — Unified VibeGrid Design
 */

import React, { useState, useEffect } from 'react';
import {
  Clock,
  Check,
  Hourglass,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';

export default function DisappearingMessagesView({
  ephemeralTimer = null,
  isAdmin = false,
  onUpdateEphemeralTimer,
  actionLoading = false,
  onShowToast
}) {
  const [selectedTimer, setSelectedTimer] = useState(ephemeralTimer);

  useEffect(() => {
    setSelectedTimer(ephemeralTimer ?? null);
  }, [ephemeralTimer]);

  const timerOptions = [
    { id: 'off', label: 'Off', seconds: null, title: 'Messages will not disappear' },
    { id: '24h', label: '24 hours', seconds: 86400, title: 'Messages will disappear after 24 hours' },
    { id: '7d', label: '7 days', seconds: 604800, title: 'Messages will disappear after 7 days' },
    { id: '30d', label: '30 days', seconds: 2592000, title: 'Messages will disappear after 30 days' }
  ];

  const currentOption =
    timerOptions.find((o) => o.seconds === selectedTimer) || timerOptions[0];

  const handleSelect = async (seconds) => {
    if (!isAdmin) {
      if (onShowToast) onShowToast('Only admins can change disappearing message settings.', 'error');
      return;
    }
    setSelectedTimer(seconds);
    try {
      if (onUpdateEphemeralTimer) {
        await onUpdateEphemeralTimer(seconds);
      }
      if (onShowToast) {
        onShowToast(
          seconds
            ? `Disappearing messages set to ${timerOptions.find((o) => o.seconds === seconds)?.label}.`
            : 'Disappearing messages turned off.',
          'success'
        );
      }
    } catch {
      if (onShowToast) onShowToast('Failed to update disappearing messages', 'error');
    }
  };

  return (
    <div className="space-y-5 text-left">
      {/* 1. Circular Timer Graphic with VibeGrid Theme Colors */}
      <div className="flex flex-col items-center text-center pt-2 space-y-2">
        <div className="relative w-32 h-32 flex items-center justify-center">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r="40"
              fill="transparent"
              stroke="var(--border-color)"
              strokeWidth="5"
            />
            <circle
              cx="50"
              cy="50"
              r="40"
              fill="transparent"
              stroke="var(--primary)"
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray="251"
              strokeDashoffset={selectedTimer ? '75' : '251'}
              className="transition-all duration-500 ease-out"
            />
          </svg>

          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className={`w-11 h-11 rounded-full flex items-center justify-center ${selectedTimer ? 'bg-[var(--primary-light)] text-[var(--primary)]' : 'bg-[var(--bg-page)] text-[var(--text-muted)]'} transition-colors border border-[var(--border-color)]`}>
              <Hourglass size={20} className={selectedTimer ? 'animate-pulse' : ''} />
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-bold text-[var(--text-primary)] m-0">
            {currentOption.title}
          </h3>
          <p className="text-xs text-[var(--text-muted)] mt-1 mb-0 max-w-xs">
            When enabled, newly sent messages vanish from this group after the duration expires.
          </p>
        </div>
      </div>

      {/* 2. Radio Options List */}
      <div className="vg-card-subtle divide-y divide-[var(--border-color)]">
        {timerOptions.map((opt) => {
          const isSelected = selectedTimer === opt.seconds;
          return (
            <div
              key={opt.id}
              onClick={() => handleSelect(opt.seconds)}
              className={`flex items-center justify-between p-3.5 transition-all cursor-pointer hover:bg-[var(--bg-card)] ${
                !isAdmin ? 'opacity-60 cursor-not-allowed' : ''
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${
                    isSelected
                      ? 'border-[var(--primary)] bg-[var(--primary)]'
                      : 'border-[var(--border-color)] bg-transparent'
                  }`}
                >
                  {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>
                <span className={`text-xs font-semibold ${isSelected ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>
                  {opt.label}
                </span>
              </div>

              {isSelected && (
                <Check size={16} className="text-[var(--primary)] shrink-0" />
              )}
            </div>
          );
        })}
      </div>

      {/* 3. Footer Subtext */}
      <div className="p-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-muted)] text-[11px] leading-relaxed">
        <span className="text-[var(--text-primary)] font-semibold">Note:</span> Participants can still forward or save messages before they expire. This setting applies to all members in this group.
      </div>
    </div>
  );
}
