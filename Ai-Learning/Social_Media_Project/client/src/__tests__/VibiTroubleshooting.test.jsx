/**
 * client/src/__tests__/VibiTroubleshooting.test.jsx
 * ===================================================
 * Tests for Phase 8: Troubleshooting & Self-Healing
 */

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import vibiTroubleshootingService, {
  PROTECTED_STORAGE_KEYS
} from '../services/vibiTroubleshootingService';
import vibiActionRegistry from '../services/vibiActionRegistry';
import vibiOutputValidator from '../services/vibiOutputValidator';
import vibiIntentEngine from '../services/vibiIntentEngine';
import VibiTroubleshootingCard from '../components/vibi/VibiTroubleshootingCard';

describe('Phase 8 — Vibi Troubleshooting & Self-Healing', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  describe('1. Troubleshooting Service Diagnostics', () => {
    it('diagnoses message & network connectivity', async () => {
      const result = await vibiTroubleshootingService.diagnoseMessages();
      expect(result.category).toBe('messages');
      expect(['healthy', 'warning', 'error']).toContain(result.status);
      expect(result.details).toHaveProperty('online');
      expect(result.details).toHaveProperty('socketConnected');
    });

    it('diagnoses notification permissions and provides advice', async () => {
      const result = await vibiTroubleshootingService.diagnoseNotifications();
      expect(result.category).toBe('notifications');
      expect(['healthy', 'warning', 'error']).toContain(result.status);
      expect(result.details).toHaveProperty('permission');
    });

    it('diagnoses WebRTC, microphone and camera capabilities', async () => {
      const result = await vibiTroubleshootingService.diagnoseCallsAndMedia();
      expect(result.category).toBe('calls');
      expect(result.details).toHaveProperty('hasWebRTC');
      expect(result.details).toHaveProperty('hasMediaDevices');
    });

    it('diagnoses storage consumption and flags high usage', () => {
      localStorage.setItem('test_normal_key', 'hello world');
      const result = vibiTroubleshootingService.diagnoseStorage();
      expect(result.category).toBe('performance');
      expect(result.details).toHaveProperty('totalMB');
      expect(result.details).toHaveProperty('itemCount');
    });

    it('diagnoses image upload limits correctly (5MB limit & formats)', () => {
      // General guideline check without file
      const guidelines = vibiTroubleshootingService.diagnoseImageUpload();
      expect(guidelines.message).toContain('5 MB');
      expect(guidelines.message).toContain('JPEG, PNG, WebP, GIF');

      // Valid small image
      const validFile = { size: 2 * 1024 * 1024, type: 'image/jpeg' };
      const validRes = vibiTroubleshootingService.diagnoseImageUpload(validFile);
      expect(validRes.status).toBe('healthy');

      // Oversized image (> 5MB)
      const oversizedFile = { size: 6 * 1024 * 1024, type: 'image/jpeg' };
      const oversizedRes = vibiTroubleshootingService.diagnoseImageUpload(oversizedFile);
      expect(oversizedRes.status).toBe('error');
      expect(oversizedRes.message).toContain('exceeding the 5 MB limit');

      // Unsupported format
      const invalidFormatFile = { size: 1024 * 1024, type: 'application/pdf' };
      const formatRes = vibiTroubleshootingService.diagnoseImageUpload(invalidFormatFile);
      expect(formatRes.status).toBe('error');
      expect(formatRes.message).toContain('Unsupported format');
    });

    it('aggregates full system diagnostics into a health report', async () => {
      const report = await vibiTroubleshootingService.runFullDiagnostics();
      expect(report).toHaveProperty('healthy');
      expect(report).toHaveProperty('summary');
      expect(report.diagnostics).toHaveProperty('messages');
      expect(report.diagnostics).toHaveProperty('notifications');
      expect(report.diagnostics).toHaveProperty('calls');
      expect(report.diagnostics).toHaveProperty('storage');
      expect(report.diagnostics).toHaveProperty('uploads');
    });
  });

  describe('2. Safe Self-Healing: Absolute E2EE and Credentials Protection', () => {
    it('safely clears ONLY temporary cache while NEVER deleting user tokens or E2EE keys', () => {
      // Set protected credentials and keys
      localStorage.setItem('vibegrid_user', JSON.stringify({ id: 1, name: 'Alice' }));
      localStorage.setItem('vibegrid_token', 'jwt_secret_token_12345');
      localStorage.setItem('vibegrid_theme', 'dark');
      localStorage.setItem('vibegrid_vibi_preferences', JSON.stringify({ enabled: true }));
      localStorage.setItem('keyStore_identity_key', 'e2ee_private_key_do_not_delete');

      // Set clearable temporary items
      localStorage.setItem('_temp_draft_1', 'draft content');
      localStorage.setItem('_cache_feed_data', 'cached json');
      localStorage.setItem('explore_cache_posts', 'explore cache');

      // Run self-healing cache cleanup
      const result = vibiTroubleshootingService.clearTemporaryCache();
      expect(result.success).toBe(true);
      expect(result.removedCount).toBe(3);

      // Verify clearable items are removed
      expect(localStorage.getItem('_temp_draft_1')).toBeNull();
      expect(localStorage.getItem('_cache_feed_data')).toBeNull();
      expect(localStorage.getItem('explore_cache_posts')).toBeNull();

      // Verify PROTECTED items are 100% intact!
      expect(localStorage.getItem('vibegrid_user')).not.toBeNull();
      expect(localStorage.getItem('vibegrid_token')).toBe('jwt_secret_token_12345');
      expect(localStorage.getItem('vibegrid_theme')).toBe('dark');
      expect(localStorage.getItem('vibegrid_vibi_preferences')).not.toBeNull();
      expect(localStorage.getItem('keyStore_identity_key')).toBe('e2ee_private_key_do_not_delete');
    });
  });

  describe('3. Action Registry & Output Validator Whitelist', () => {
    it('whitelists all Phase 8 troubleshooting actions', () => {
      expect(vibiActionRegistry.isWhitelisted('run_diagnostics')).toBe(true);
      expect(vibiActionRegistry.isWhitelisted('reconnect_network')).toBe(true);
      expect(vibiActionRegistry.isWhitelisted('test_notification')).toBe(true);
      expect(vibiActionRegistry.isWhitelisted('clear_temporary_cache')).toBe(true);
    });

    it('validates troubleshooting actions through VibiOutputValidator', () => {
      const diagValid = vibiOutputValidator.validateAction('run_diagnostics', { category: 'messages' });
      expect(diagValid.valid).toBe(true);

      const cacheValid = vibiOutputValidator.validateAction('clear_temporary_cache', {});
      expect(cacheValid.valid).toBe(true);

      const reconnectValid = vibiOutputValidator.validateAction('reconnect_network', {});
      expect(reconnectValid.valid).toBe(true);
    });
  });

  describe('4. Natural Language Intent Detection for Self-Healing', () => {
    it('detects message loading issues and routes to diagnostics', () => {
      const match = vibiIntentEngine.detectIntent("my messages aren't loading");
      expect(match.matched).toBe(true);
      expect(match.actionId).toBe('run_diagnostics');
      expect(match.params.category).toBe('messages');
    });

    it('detects notification issues and routes to diagnostics', () => {
      const match = vibiIntentEngine.detectIntent("notifications aren't working");
      expect(match.matched).toBe(true);
      expect(match.actionId).toBe('run_diagnostics');
      expect(match.params.category).toBe('notifications');
    });

    it('detects calling and WebRTC issues and routes to diagnostics', () => {
      const match = vibiIntentEngine.detectIntent("calls aren't connecting");
      expect(match.matched).toBe(true);
      expect(match.actionId).toBe('run_diagnostics');
      expect(match.params.category).toBe('calls');
    });

    it('detects slow performance and routes to storage diagnostics', () => {
      const match = vibiIntentEngine.detectIntent('app feels slow');
      expect(match.matched).toBe(true);
      expect(match.actionId).toBe('run_diagnostics');
      expect(match.params.category).toBe('storage');
    });

    it('detects image upload issues and routes to upload diagnostics', () => {
      const match = vibiIntentEngine.detectIntent("i can't upload images");
      expect(match.matched).toBe(true);
      expect(match.actionId).toBe('run_diagnostics');
      expect(match.params.category).toBe('uploads');
    });

    it('detects clear cache and reconnect commands directly', () => {
      const matchCache = vibiIntentEngine.detectIntent('clear cache');
      expect(matchCache.matched).toBe(true);
      expect(matchCache.actionId).toBe('clear_temporary_cache');

      const matchReconnect = vibiIntentEngine.detectIntent('reconnect socket');
      expect(matchReconnect.matched).toBe(true);
      expect(matchReconnect.actionId).toBe('reconnect_network');
    });
  });

  describe('5. VibiTroubleshootingCard Component', () => {
    it('renders diagnostic items and self-healing action buttons', () => {
      const mockDiagnostics = {
        diagnostics: {
          messages: { status: 'healthy' },
          notifications: { status: 'warning' },
          calls: { status: 'healthy' },
          storage: { status: 'healthy' },
          uploads: { status: 'healthy' }
        }
      };

      const onActionComplete = vi.fn();

      render(
        <VibiTroubleshootingCard
          diagnosticData={mockDiagnostics}
          onActionComplete={onActionComplete}
        />
      );

      expect(screen.getByTestId('vibi-troubleshooting-card')).toBeInTheDocument();
      expect(screen.getByText(/System Health Diagnostics/i)).toBeInTheDocument();
      expect(screen.getByText(/Messages & Socket/i)).toBeInTheDocument();
      expect(screen.getByText(/Browser Notifications/i)).toBeInTheDocument();
      expect(screen.getByText(/Media Uploads \(5MB\)/i)).toBeInTheDocument();

      // Buttons are present
      expect(screen.getByTestId('vibi-diag-reconnect-btn')).toBeInTheDocument();
      expect(screen.getByTestId('vibi-diag-test-notif-btn')).toBeInTheDocument();
      expect(screen.getByTestId('vibi-diag-clear-cache-btn')).toBeInTheDocument();

      // Click Clean Cache button
      fireEvent.click(screen.getByTestId('vibi-diag-clear-cache-btn'));
      expect(onActionComplete).toHaveBeenCalledWith(
        'clear_temporary_cache',
        expect.objectContaining({ success: true })
      );
    });
  });
});
