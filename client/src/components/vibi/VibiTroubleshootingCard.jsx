/**
 * client/src/components/vibi/VibiTroubleshootingCard.jsx
 * ========================================================
 * VIBGRID — VIBI AI ASSISTANT: PHASE 8 TROUBLESHOOTING & SELF-HEALING
 *
 * Interactive Diagnostic & Self-Healing Card.
 * - Displays system health checklist across Messages, Notifications, WebRTC, and Storage.
 * - Offers one-click self-healing repair actions.
 * - Respects the absolute safety rule: NEVER clears IndexedDB or user encryption keys!
 */

import React, { useState } from 'react';
import {
  Wrench,
  Wifi,
  Bell,
  Phone,
  HardDrive,
  Image,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  XCircle
} from 'lucide-react';
import vibiIntentEngine from '../../services/vibiIntentEngine';
import vibiTroubleshootingService from '../../services/vibiTroubleshootingService';

export default function VibiTroubleshootingCard({ diagnosticData, onActionComplete }) {
  const [runningAction, setRunningAction] = useState(null);
  const [actionFeedback, setActionFeedback] = useState(null);

  const getStatusIcon = (status) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle size={15} className="vibi-diag-status-icon healthy" />;
      case 'warning':
        return <AlertTriangle size={15} className="vibi-diag-status-icon warning" />;
      case 'error':
        return <XCircle size={15} className="vibi-diag-status-icon error" />;
      default:
        return <CheckCircle size={15} className="vibi-diag-status-icon neutral" />;
    }
  };

  const handleReconnect = async () => {
    setRunningAction('reconnect');
    setActionFeedback(null);
    try {
      const res = vibiTroubleshootingService.reconnectNetwork();
      setActionFeedback(res.message);
      if (typeof onActionComplete === 'function') {
        onActionComplete('reconnect_network', res);
      }
    } finally {
      setRunningAction(null);
    }
  };

  const handleTestNotification = async () => {
    setRunningAction('notification');
    setActionFeedback(null);
    try {
      const res = await vibiTroubleshootingService.sendTestNotification();
      setActionFeedback(res.message);
      if (typeof onActionComplete === 'function') {
        onActionComplete('test_notification', res);
      }
    } finally {
      setRunningAction(null);
    }
  };

  const handleClearCache = async () => {
    setRunningAction('cache');
    setActionFeedback(null);
    try {
      const res = vibiTroubleshootingService.clearTemporaryCache();
      setActionFeedback(res.message);
      if (typeof onActionComplete === 'function') {
        onActionComplete('clear_temporary_cache', res);
      }
    } finally {
      setRunningAction(null);
    }
  };

  const items = diagnosticData?.diagnostics || {};

  return (
    <div className="vibi-troubleshooting-card" data-testid="vibi-troubleshooting-card">
      <div className="vibi-diag-header">
        <span className="vibi-diag-title">
          <Wrench size={14} />
          System Health Diagnostics
        </span>
        <span className="vibi-diag-badge">Self-Healing</span>
      </div>

      <div className="vibi-diag-checklist">
        {/* Messages / Realtime */}
        <div className="vibi-diag-item">
          <div className="vibi-diag-item-left">
            <Wifi size={14} className="vibi-diag-item-icon" />
            <span className="vibi-diag-item-name">Messages & Socket</span>
          </div>
          <div className="vibi-diag-item-right">
            {getStatusIcon(items.messages?.status || 'healthy')}
          </div>
        </div>

        {/* Notifications */}
        <div className="vibi-diag-item">
          <div className="vibi-diag-item-left">
            <Bell size={14} className="vibi-diag-item-icon" />
            <span className="vibi-diag-item-name">Browser Notifications</span>
          </div>
          <div className="vibi-diag-item-right">
            {getStatusIcon(items.notifications?.status || 'healthy')}
          </div>
        </div>

        {/* WebRTC / Calls */}
        <div className="vibi-diag-item">
          <div className="vibi-diag-item-left">
            <Phone size={14} className="vibi-diag-item-icon" />
            <span className="vibi-diag-item-name">WebRTC & Call Devices</span>
          </div>
          <div className="vibi-diag-item-right">
            {getStatusIcon(items.calls?.status || 'healthy')}
          </div>
        </div>

        {/* Storage / Cache */}
        <div className="vibi-diag-item">
          <div className="vibi-diag-item-left">
            <HardDrive size={14} className="vibi-diag-item-icon" />
            <span className="vibi-diag-item-name">Temporary Storage</span>
          </div>
          <div className="vibi-diag-item-right">
            {getStatusIcon(items.storage?.status || 'healthy')}
          </div>
        </div>

        {/* Image Upload Limits */}
        <div className="vibi-diag-item">
          <div className="vibi-diag-item-left">
            <Image size={14} className="vibi-diag-item-icon" />
            <span className="vibi-diag-item-name">Media Uploads (5MB)</span>
          </div>
          <div className="vibi-diag-item-right">
            {getStatusIcon(items.uploads?.status || 'healthy')}
          </div>
        </div>
      </div>

      {actionFeedback && (
        <div className="vibi-diag-feedback" role="alert">
          {actionFeedback}
        </div>
      )}

      {/* One-click Self-Healing Actions */}
      <div className="vibi-diag-actions">
        <button
          type="button"
          className="vibi-diag-btn"
          onClick={handleReconnect}
          disabled={runningAction === 'reconnect'}
          data-testid="vibi-diag-reconnect-btn"
        >
          <RefreshCw size={12} className={runningAction === 'reconnect' ? 'spinning' : ''} />
          Reconnect
        </button>

        <button
          type="button"
          className="vibi-diag-btn"
          onClick={handleTestNotification}
          disabled={runningAction === 'notification'}
          data-testid="vibi-diag-test-notif-btn"
        >
          <Bell size={12} />
          Test Notification
        </button>

        <button
          type="button"
          className="vibi-diag-btn"
          onClick={handleClearCache}
          disabled={runningAction === 'cache'}
          data-testid="vibi-diag-clear-cache-btn"
        >
          <HardDrive size={12} />
          Clean Cache
        </button>
      </div>
    </div>
  );
}
