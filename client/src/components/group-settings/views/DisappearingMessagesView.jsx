/**
 * client/src/components/group-settings/views/DisappearingMessagesView.jsx
 * ======================================================================
 * Screen 10: Disappearing Messages (Self-Destruct Timers)
 */

import React, { useState } from 'react';
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
      if (onShowToast) onShowToast('Failed to update ephemeral timer', 'error');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200 text-left">
      {/* Circular Timer Visual Graphic */}
      <div className="flex flex-col items-center text-center pt-2 space-y-3">
        <div className="relative w-36 h-36 flex items-center justify-center">
          {/* Animated Glowing Ring Graphic */}
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            {/* Background Circle */}
            <circle
              cx="50"
              cy="50"
              r="42"
              fill="transparent"
              stroke="rgba(255, 255, 255, 0.08)"
              strokeWidth="6"
            />
            {/* Active Accent Arc */}
            <circle
              cx="50"
              cy="50"
              r="42"
              fill="transparent"
              stroke="url(#timer-grad)"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray="264"
              strokeDashoffset={selectedTimer ? '80' : '264'}
              className="transition-all duration-700 ease-out"
            />
            <defs>
              <linearGradient id="timer-grad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#06b6d4" />
                <stop offset="100%" stopColor="#10b981" />
              </linearGradient>
            </defs>
          </svg>

          {/* Center Hourglass Icon */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${selectedTimer ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-zinc-500'} transition-colors`}>
              <Hourglass size={24} className={selectedTimer ? 'animate-pulse' : ''} />
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-bold text-white tracking-tight">
            {currentOption.title}
          </h3>
          <p className="text-xs text-zinc-400 mt-1 max-w-xs">
            New messages will disappear from this chat after the selected duration.
          </p>
        </div>
      </div>

      {/* Radio Options List */}
      <div className="space-y-2">
        {timerOptions.map((opt) => {
          const isSelected = selectedTimer === opt.seconds;
          return (
            <div
              key={opt.id}
              onClick={() => handleSelect(opt.seconds)}
              className={`flex items-center justify-between p-3.5 rounded-xl border transition-all cursor-pointer ${
                isSelected
                  ? 'bg-emerald-500/10 border-emerald-500/40 text-white'
                  : 'bg-white/[0.03] border-white/10 hover:border-white/20 text-zinc-300'
              } ${!isAdmin ? 'opacity-70' : ''}`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${
                    isSelected
                      ? 'border-emerald-400 bg-emerald-500 text-black'
                      : 'border-white/30 bg-transparent'
                  }`}
                >
                  {isSelected && <div className="w-2 h-2 rounded-full bg-black" />}
                </div>
                <span className="text-xs font-semibold">{opt.label}</span>
              </div>

              {isSelected && (
                <Check size={16} className="text-emerald-400 shrink-0" />
              )}
            </div>
          );
        })}
      </div>

      {/* Footer Subtext */}
      <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/10 text-zinc-400 text-[11px] leading-relaxed">
        <p>
          <span className="text-zinc-200 font-semibold">Note:</span> Anyone in the chat can still export or screenshot messages while they are visible. This setting applies to all members of the group.
        </p>
      </div>
    </div>
  );
}
