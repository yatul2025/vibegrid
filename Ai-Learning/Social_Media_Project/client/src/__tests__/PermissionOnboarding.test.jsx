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

    it('does NOT prompt existing completed user during normal app usage even if permissions were rejected or subscription missing', async () => {
      const user = { id: 999, username: 'cleared_user', has_completed_onboarding: true };
      vi.spyOn(permissionService, 'getLivePermissionState').mockResolvedValue({
        notifications: 'denied',
        pushSubscription: { active: false, endpoint: null },
        serviceWorker: { registered: true, scope: '/' },
        microphone: 'denied',
        camera: 'denied',
        isIosSafari: false,
        isPwaInstalled: false
      });

      const shouldShow = await permissionService.shouldShowPermissionOnboarding(user);
      expect(shouldShow).toBe(false);
      expect(localStorage.getItem('vibegrid_onboarding_999')).toBe('completed');
    });

    it('auto-heals localStorage and does NOT prompt if user has completed onboarding in DB', async () => {
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

  describe('PermissionOnboardingModal component - First Login Flow', () => {
    const mockUser = {
      id: 555,
      username: 'alice_vibe',
      full_name: 'Alice Wonder',
      avatar_url: null,
      gender: 'female',
      has_completed_onboarding: false
    };

    it('renders step 1 directly for notifications with Accept and Reject buttons', () => {
      render(
        <PermissionOnboardingModal
          user={mockUser}
          isOpen={true}
          onClose={vi.fn()}
          onComplete={vi.fn()}
        />
      );

      expect(screen.getByText(/Enable Notifications & Calls/i)).toBeInTheDocument();
      expect(screen.getByTestId('onboarding-accept-btn')).toHaveTextContent(/Accept & Enable Notifications/i);
      expect(screen.getByTestId('onboarding-reject-btn')).toHaveTextContent(/Reject \/ Skip for Now/i);
      expect(screen.getByTestId('onboarding-skip-all-btn')).toBeInTheDocument();
    });

    it('steps through notifications, microphone, camera, media, and completes onboarding via Accept', async () => {
      const onComplete = vi.fn();
      const onClose = vi.fn();
      vi.spyOn(permissionService, 'markOnboardingCompleted').mockResolvedValue(true);
      vi.spyOn(permissionService, 'requestNotificationAndPush').mockResolvedValue({ granted: true });
      vi.spyOn(permissionService, 'requestMicrophonePermission').mockResolvedValue({ granted: true });
      vi.spyOn(permissionService, 'requestCameraPermission').mockResolvedValue({ granted: true });

      render(
        <PermissionOnboardingModal
          user={mockUser}
          isOpen={true}
          onClose={onClose}
          onComplete={onComplete}
        />
      );

      // Step 1: Notifications
      expect(screen.getByText(/Enable Notifications & Calls/i)).toBeInTheDocument();
      const notifAcceptBtn = screen.getByTestId('onboarding-accept-btn');
      fireEvent.click(notifAcceptBtn);

      await waitFor(() => {
        expect(permissionService.requestNotificationAndPush).toHaveBeenCalled();
      });

      // Advance to Step 2 (Microphone) after simulated timeout
      await waitFor(() => {
        expect(screen.getByText(/Allow Microphone Access/i)).toBeInTheDocument();
      }, { timeout: 2000 });

      // Step 2: Microphone
      const micAcceptBtn = screen.getByTestId('onboarding-accept-btn');
      fireEvent.click(micAcceptBtn);

      await waitFor(() => {
        expect(permissionService.requestMicrophonePermission).toHaveBeenCalled();
      });

      // Advance to Step 3 (Camera)
      await waitFor(() => {
        expect(screen.getByText(/Allow Camera for Video Calls/i)).toBeInTheDocument();
      }, { timeout: 2000 });

      // Step 3: Camera
      const camAcceptBtn = screen.getByTestId('onboarding-accept-btn');
      fireEvent.click(camAcceptBtn);

      await waitFor(() => {
        expect(permissionService.requestCameraPermission).toHaveBeenCalled();
      });

      // Advance to Step 4 (Photos & Media)
      await waitFor(() => {
        expect(screen.getByText(/Photos & Media Privacy/i)).toBeInTheDocument();
      }, { timeout: 2000 });

      // Step 4: Continue
      fireEvent.click(screen.getByTestId('onboarding-accept-btn'));

      // Step 5: Summary & Finish
      expect(screen.getByText(/You're All Set, Alice Wonder!/i)).toBeInTheDocument();
      const finishBtn = screen.getByTestId('onboarding-finish-btn');
      expect(finishBtn).toBeInTheDocument();

      fireEvent.click(finishBtn);

      await waitFor(() => {
        expect(permissionService.markOnboardingCompleted).toHaveBeenCalledWith(555);
        expect(onComplete).toHaveBeenCalled();
        expect(onClose).toHaveBeenCalled();
      });
    });

    it('allows user to reject/skip each step without blocking progress', async () => {
      render(
        <PermissionOnboardingModal
          user={mockUser}
          isOpen={true}
          onClose={vi.fn()}
          onComplete={vi.fn()}
        />
      );

      // Step 1: Notifications -> Reject
      expect(screen.getByText(/Enable Notifications & Calls/i)).toBeInTheDocument();
      fireEvent.click(screen.getByTestId('onboarding-reject-btn'));

      // Step 2: Microphone -> Reject
      expect(screen.getByText(/Allow Microphone Access/i)).toBeInTheDocument();
      fireEvent.click(screen.getByTestId('onboarding-reject-btn'));

      // Step 3: Camera -> Reject
      expect(screen.getByText(/Allow Camera for Video Calls/i)).toBeInTheDocument();
      fireEvent.click(screen.getByTestId('onboarding-reject-btn'));

      // Step 4: Media -> Skip
      expect(screen.getByText(/Photos & Media Privacy/i)).toBeInTheDocument();
      fireEvent.click(screen.getByTestId('onboarding-reject-btn'));

      // Step 5: Summary
      expect(screen.getByText(/You're All Set, Alice Wonder!/i)).toBeInTheDocument();
      expect(screen.getByTestId('onboarding-finish-btn')).toBeInTheDocument();
    });

    it('allows user to Skip All from the header immediately', async () => {
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

      const skipAllBtn = screen.getByTestId('onboarding-skip-all-btn');
      expect(skipAllBtn).toBeInTheDocument();
      fireEvent.click(skipAllBtn);

      await waitFor(() => {
        expect(permissionService.markOnboardingCompleted).toHaveBeenCalledWith(555);
        expect(onComplete).toHaveBeenCalled();
        expect(onClose).toHaveBeenCalled();
      });
    });
  });

  describe('Permission Re-check & Setup Flow (isManualRecheck = true)', () => {
    const existingUser = {
      id: 777,
      username: 'bob_builder',
      full_name: 'Bob Builder',
      has_completed_onboarding: true
    };

    it('shows ONLY missing permissions and skips already granted ones', async () => {
      // Notifications is granted, Microphone is missing/denied, Camera is granted
      vi.spyOn(permissionService, 'getLivePermissionState').mockResolvedValue({
        notifications: 'granted',
        pushSubscription: { active: true, endpoint: 'https://push.example.com' },
        microphone: 'denied',
        camera: 'granted',
        isIosSafari: false,
        isPwaInstalled: true
      });
      vi.spyOn(permissionService, 'requestMicrophonePermission').mockResolvedValue({ granted: true });
      const onClose = vi.fn();
      const onComplete = vi.fn();

      render(
        <PermissionOnboardingModal
          user={existingUser}
          isOpen={true}
          isManualRecheck={true}
          onClose={onClose}
          onComplete={onComplete}
        />
      );

      // Should show checking or resolve to Microphone directly
      await waitFor(() => {
        expect(screen.getByText(/Allow Microphone Access/i)).toBeInTheDocument();
      });

      // Must NOT show Notifications or Camera or Media
      expect(screen.queryByText(/Enable Notifications & Calls/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Allow Camera for Video Calls/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Photos & Media Privacy/i)).not.toBeInTheDocument();

      // Step counter should show Step 1 of 1
      expect(screen.getByText(/Step 1 of 1/i)).toBeInTheDocument();

      // Handle the missing permission
      fireEvent.click(screen.getByTestId('onboarding-accept-btn'));

      await waitFor(() => {
        expect(permissionService.requestMicrophonePermission).toHaveBeenCalled();
      });

      // Once handled, finishes and returns to Settings
      await waitFor(() => {
        expect(onClose).toHaveBeenCalled();
      }, { timeout: 2000 });
    });

    it('shows All Permissions Granted when all required permissions are already active', async () => {
      vi.spyOn(permissionService, 'getLivePermissionState').mockResolvedValue({
        notifications: 'granted',
        pushSubscription: { active: true, endpoint: 'https://push.example.com' },
        microphone: 'granted',
        camera: 'granted',
        isIosSafari: false,
        isPwaInstalled: true
      });
      const onClose = vi.fn();
      const onComplete = vi.fn();

      render(
        <PermissionOnboardingModal
          user={existingUser}
          isOpen={true}
          isManualRecheck={true}
          onClose={onClose}
          onComplete={onComplete}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/All Permissions Granted!/i)).toBeInTheDocument();
      });

      expect(screen.getByText(/Done \/ Back to Settings →/i)).toBeInTheDocument();
      fireEvent.click(screen.getByTestId('onboarding-finish-btn'));

      await waitFor(() => {
        expect(onClose).toHaveBeenCalled();
        expect(onComplete).toHaveBeenCalled();
      });
    });

    it('returns to settings immediately when user clicks Close ✕ during re-check', async () => {
      vi.spyOn(permissionService, 'getLivePermissionState').mockResolvedValue({
        notifications: 'default',
        pushSubscription: { active: false, endpoint: null },
        microphone: 'unknown',
        camera: 'unknown',
        isIosSafari: false,
        isPwaInstalled: false
      });
      const onClose = vi.fn();

      render(
        <PermissionOnboardingModal
          user={existingUser}
          isOpen={true}
          isManualRecheck={true}
          onClose={onClose}
          onComplete={vi.fn()}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('onboarding-skip-all-btn')).toHaveTextContent(/Close ✕/i);
      });

      fireEvent.click(screen.getByTestId('onboarding-skip-all-btn'));

      await waitFor(() => {
        expect(onClose).toHaveBeenCalled();
      });
    });
  });
});
