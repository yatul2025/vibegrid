import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import permissionService from '../services/permissionService';
import PermissionOnboardingModal from '../components/PermissionOnboardingModal';

describe('Permission Onboarding & Live State Validation', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  describe('permissionService.shouldShowPermissionOnboarding', () => {
    it('returns false if no user is provided', async () => {
      const shouldShow = await permissionService.shouldShowPermissionOnboarding(null);
      expect(shouldShow).toBe(false);
    });

    it('returns false for demo personas', async () => {
      const demoUser = { id: 10, username: 'sophia_wander', is_demo_session: true };
      const shouldShow = await permissionService.shouldShowPermissionOnboarding(demoUser);
      expect(shouldShow).toBe(false);
    });

    it('returns false if dismissed in current session', async () => {
      const user = { id: 123, username: 'newuser', has_completed_onboarding: false };
      sessionStorage.setItem('vg_onboarding_dismissed_123', 'true');
      const shouldShow = await permissionService.shouldShowPermissionOnboarding(user);
      expect(shouldShow).toBe(false);
    });

    it('returns true for brand new user with has_completed_onboarding = false', async () => {
      const newUser = { id: 456, username: 'freshuser', has_completed_onboarding: false };
      const shouldShow = await permissionService.shouldShowPermissionOnboarding(newUser);
      expect(shouldShow).toBe(true);
    });

    it('returns false for existing user with localStorage completed flag', async () => {
      const user = { id: 789, username: 'existinguser', has_completed_onboarding: true };
      localStorage.setItem('vibegrid_onboarding_789', 'completed');
      const shouldShow = await permissionService.shouldShowPermissionOnboarding(user);
      expect(shouldShow).toBe(false);
    });

    it('detects cleared site data and prompts when push subscription is missing', async () => {
      const user = { id: 999, username: 'cleared_user', has_completed_onboarding: true };
      // No localStorage flag present (simulating cleared site data)
      vi.spyOn(permissionService, 'getLivePermissionState').mockResolvedValue({
        notifications: 'default',
        pushSubscription: { active: false, endpoint: null },
        serviceWorker: { registered: true, scope: '/' },
        microphone: 'unknown',
        camera: 'unknown',
        isIosSafari: false,
        isPwaInstalled: false
      });

      const shouldShow = await permissionService.shouldShowPermissionOnboarding(user);
      expect(shouldShow).toBe(true);
    });

    it('auto-heals localStorage and does NOT prompt if permissions and subscription are already valid', async () => {
      const user = { id: 1000, username: 'valid_user', has_completed_onboarding: true };
      vi.spyOn(permissionService, 'getLivePermissionState').mockResolvedValue({
        notifications: 'granted',
        pushSubscription: { active: true, endpoint: 'https://push.example.com' },
        serviceWorker: { registered: true, scope: '/' },
        microphone: 'granted',
        camera: 'granted',
        isIosSafari: false,
        isPwaInstalled: true
      });

      const shouldShow = await permissionService.shouldShowPermissionOnboarding(user);
      expect(shouldShow).toBe(false);
      expect(localStorage.getItem('vibegrid_onboarding_1000')).toBe('completed');
    });
  });

  describe('PermissionOnboardingModal component', () => {
    const mockUser = {
      id: 555,
      username: 'alice_vibe',
      full_name: 'Alice Wonder',
      avatar_url: null,
      gender: 'female',
      has_completed_onboarding: false
    };

    it('renders step 1 with personalized greeting and feature highlights', () => {
      render(
        <PermissionOnboardingModal
          user={mockUser}
          isOpen={true}
          onClose={vi.fn()}
          onComplete={vi.fn()}
        />
      );

      expect(screen.getByText(/Welcome to VibeGrid, Alice Wonder!/i)).toBeInTheDocument();
      expect(screen.getByText(/Real-Time Notifications/i)).toBeInTheDocument();
      expect(screen.getByText(/Voice Calling & Audio Notes/i)).toBeInTheDocument();
      expect(screen.getByText(/HD Video Calls/i)).toBeInTheDocument();
      expect(screen.getByTestId('onboarding-start-btn')).toBeInTheDocument();
    });

    it('steps through notifications, microphone, camera, and completes onboarding', async () => {
      const onComplete = vi.fn();
      const onClose = vi.fn();
      vi.spyOn(permissionService, 'markOnboardingCompleted').mockResolvedValue(true);

      render(
        <PermissionOnboardingModal
          user={mockUser}
          isOpen={true}
          onClose={onClose}
          onComplete={onComplete}
        />
      );

      // Step 1 -> Click Start Setup
      fireEvent.click(screen.getByTestId('onboarding-start-btn'));

      // Step 2: Notifications
      expect(screen.getByText(/Push Notifications & Calls/i)).toBeInTheDocument();
      expect(screen.getByTestId('onboarding-enable-notif-btn')).toBeInTheDocument();
      fireEvent.click(screen.getByText('Not Now'));

      // Step 3: Microphone
      expect(screen.getByText(/Microphone Access/i)).toBeInTheDocument();
      expect(screen.getByTestId('onboarding-enable-mic-btn')).toBeInTheDocument();
      fireEvent.click(screen.getByText('Maybe Later'));

      // Step 4: Camera
      expect(screen.getByText(/Camera for Video Calling/i)).toBeInTheDocument();
      expect(screen.getByTestId('onboarding-enable-cam-btn')).toBeInTheDocument();
      fireEvent.click(screen.getByText('Maybe Later'));

      // Step 5: Photos & Media
      expect(screen.getByText(/Photos & Media Sharing/i)).toBeInTheDocument();
      fireEvent.click(screen.getByText(/Got It, Continue →/i));

      // Step 6: Summary & Finish
      expect(screen.getByText(/You're All Set!/i)).toBeInTheDocument();
      const finishBtn = screen.getByTestId('onboarding-finish-btn');
      expect(finishBtn).toBeInTheDocument();

      fireEvent.click(finishBtn);

      await waitFor(() => {
        expect(permissionService.markOnboardingCompleted).toHaveBeenCalledWith(555);
        expect(onComplete).toHaveBeenCalled();
        expect(onClose).toHaveBeenCalled();
      });
    });

    it('gracefully handles skipping permissions without blocking', async () => {
      const onComplete = vi.fn();

      render(
        <PermissionOnboardingModal
          user={mockUser}
          isOpen={true}
          onClose={vi.fn()}
          onComplete={onComplete}
        />
      );

      fireEvent.click(screen.getByTestId('onboarding-start-btn'));
      expect(screen.getByText('Not Now')).toBeInTheDocument();
      fireEvent.click(screen.getByText('Not Now'));
      expect(screen.getByText(/Microphone Access/i)).toBeInTheDocument();
    });
  });
});
