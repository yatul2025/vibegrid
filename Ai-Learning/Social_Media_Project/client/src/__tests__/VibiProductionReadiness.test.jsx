/**
 * client/src/__tests__/VibiProductionReadiness.test.jsx
 * =======================================================
 * Tests for Phase 10: Production Readiness, Performance & Grand Polish
 */

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import vibiAiClient from '../services/vibiAiClient';
import vibiAuditLog, { MAX_AUDIT_ENTRIES } from '../services/vibiAuditLog';
import vibiSecurityGuard from '../services/vibiSecurityGuard';
import VibiPanel from '../components/vibi/VibiPanel';
import VibiLauncher from '../components/vibi/VibiLauncher';
import VibiHeaderEntry from '../components/vibi/VibiHeaderEntry';
import { VibiAssistantProvider, useVibiAssistant } from '../context/VibiAssistantContext';
import AuthContext from '../context/AuthContext';
import { apiClient } from '../api/client';

describe('Phase 10 — Vibi Production Readiness, Performance & Grand Polish', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vibiAuditLog.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  describe('1. PWA & Offline Resilience', () => {
    it('provides instant client-side offline fallback when network request fails', async () => {
      vi.spyOn(apiClient, 'post').mockRejectedValue(new Error('Network disconnected (offline)'));

      const res = await vibiAiClient.sendChatMessage('Where is the settings page?');
      expect(res.provider).toBe('client_offline_fallback');
      expect(res.isFallback).toBe(true);
      expect(res.replyText).toContain('Settings');
      expect(res.actionProposal).toEqual({ id: 'navigate', params: { tab: 'settings' } });
    });

    it('provides offline diagnostic self-healing routing when disconnected', async () => {
      vi.spyOn(apiClient, 'post').mockRejectedValue(new Error('Failed to fetch'));

      const res = await vibiAiClient.sendChatMessage('My messages are stuck and app is slow, please troubleshoot');
      expect(res.provider).toBe('client_offline_fallback');
      expect(res.isFallback).toBe(true);
      expect(res.actionProposal).toEqual({ id: 'run_diagnostics', params: {} });
    });

    it('provides offline theme navigation routing', async () => {
      vi.spyOn(apiClient, 'post').mockRejectedValue(new Error('Network error'));

      const res = await vibiAiClient.sendChatMessage('How to switch to dark theme?');
      expect(res.provider).toBe('client_offline_fallback');
      expect(res.actionProposal?.id).toBe('navigate');
      expect(res.actionProposal?.params?.section).toBe('appearance');
    });
  });

  describe('2. Accessibility & Modal Keyboard Management', () => {
    function TestApp() {
      const { openAssistant } = useVibiAssistant();
      return (
        <div>
          <button onClick={() => openAssistant()}>Open Vibi Panel</button>
          <VibiPanel />
        </div>
      );
    }

    it('renders with standard ARIA dialog roles and accessibility labels', () => {
      render(
        <AuthContext.Provider value={{ user: { username: 'testuser' } }}>
          <VibiAssistantProvider>
            <TestApp />
          </VibiAssistantProvider>
        </AuthContext.Provider>
      );

      fireEvent.click(screen.getByText('Open Vibi Panel'));

      const panel = screen.getByRole('dialog');
      expect(panel).toBeInTheDocument();
      expect(panel).toHaveAttribute('aria-modal', 'true');
      expect(panel).toHaveAttribute('aria-label', 'Vibi AI Assistant Panel');
      expect(screen.getByLabelText('Close Vibi assistant')).toBeInTheDocument();
      expect(screen.getByLabelText('Minimize Vibi assistant')).toBeInTheDocument();
    });

    it('dismisses modal on Escape key press for accessibility', async () => {
      render(
        <AuthContext.Provider value={{ user: { username: 'testuser' } }}>
          <VibiAssistantProvider>
            <TestApp />
          </VibiAssistantProvider>
        </AuthContext.Provider>
      );

      fireEvent.click(screen.getByText('Open Vibi Panel'));
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      // Press Escape
      fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });

    it('dismisses modal when clicking the mobile backdrop', async () => {
      render(
        <AuthContext.Provider value={{ user: { username: 'testuser' } }}>
          <VibiAssistantProvider>
            <TestApp />
          </VibiAssistantProvider>
        </AuthContext.Provider>
      );

      fireEvent.click(screen.getByText('Open Vibi Panel'));
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      const backdrop = screen.getByTestId('vibi-panel-backdrop');
      fireEvent.click(backdrop);

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });
  });

  describe('3. Production Bounded Memory & Storage Footprint', () => {
    it('enforces ring-buffer bound on audit log storage (max 50 entries)', () => {
      for (let i = 0; i < 70; i++) {
        vibiAuditLog.logAction({
          actionId: `action_${i}`,
          category: 'ui',
          status: 'success'
        });
      }

      const logs = vibiAuditLog.getLogs(100);
      expect(logs.length).toBeLessThanOrEqual(MAX_AUDIT_ENTRIES);
      expect(logs.length).toBe(50);
    });

    it('safely handles empty storage or corrupt JSON without throwing', () => {
      localStorage.setItem('vibegrid_vibi_audit_log', '{ corrupted json ...');
      expect(() => vibiAuditLog.getLogs()).not.toThrow();
      expect(vibiAuditLog.getLogs()).toEqual([]);
    });
  });

  describe('4. Master Switch Production Enforcement (Master OFF Rule)', () => {
    function MasterToggleApp() {
      const { updatePreferences, openAssistant } = useVibiAssistant();
      return (
        <div>
          <button onClick={() => openAssistant()}>Open Vibi</button>
          <button onClick={() => updatePreferences({ enabled: false })}>Turn Vibi OFF</button>
          <button onClick={() => updatePreferences({ floatingButton: false })}>Turn FAB OFF</button>
          <VibiPanel />
          <VibiLauncher />
          <VibiHeaderEntry />
        </div>
      );
    }

    it('unmounts all Vibi components immediately when Master switch is turned OFF', async () => {
      render(
        <AuthContext.Provider value={{ user: { username: 'testuser' } }}>
          <VibiAssistantProvider>
            <MasterToggleApp />
          </VibiAssistantProvider>
        </AuthContext.Provider>
      );

      // Verify header entry and FAB are initially present
      expect(screen.getByTestId('vibi-header-entry')).toBeInTheDocument();
      expect(screen.getByTestId('vibi-launcher-fab')).toBeInTheDocument();

      // Open panel
      fireEvent.click(screen.getByText('Open Vibi'));
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      // Turn Master OFF
      fireEvent.click(screen.getByText('Turn Vibi OFF'));

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(screen.queryByTestId('vibi-header-entry')).not.toBeInTheDocument();
        expect(screen.queryByTestId('vibi-launcher-fab')).not.toBeInTheDocument();
      });
    });

    it('hides FAB when floatingButton preference is false without affecting header entry', async () => {
      render(
        <AuthContext.Provider value={{ user: { username: 'testuser' } }}>
          <VibiAssistantProvider>
            <MasterToggleApp />
          </VibiAssistantProvider>
        </AuthContext.Provider>
      );

      expect(screen.getByTestId('vibi-launcher-fab')).toBeInTheDocument();
      expect(screen.getByTestId('vibi-header-entry')).toBeInTheDocument();

      fireEvent.click(screen.getByText('Turn FAB OFF'));

      await waitFor(() => {
        expect(screen.queryByTestId('vibi-launcher-fab')).not.toBeInTheDocument();
        expect(screen.getByTestId('vibi-header-entry')).toBeInTheDocument();
      });
    });
  });
});
