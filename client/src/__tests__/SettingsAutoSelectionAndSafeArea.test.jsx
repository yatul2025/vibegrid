import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import SettingsPage from '../pages/SettingsPage';
import { AuthProvider } from '../context/AuthContext';
import navigationService from '../services/navigationService';

describe('Settings Auto-Selection and Navigation Fixes', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    navigationService.interceptors = [];
    navigationService.routeListener = null;

    localStorage.setItem(
      'vibegrid_user',
      JSON.stringify({
        id: 1,
        username: 'tester',
        full_name: 'Test User'
      })
    );
  });

  it('renders Settings with NO section auto-selected by default', () => {
    render(
      <AuthProvider>
        <SettingsPage />
      </AuthProvider>
    );

    // Should render empty selection placeholder on desktop
    expect(screen.getByText(/Select a category from the menu to manage your account details/i)).toBeInTheDocument();

    // Privacy & Permissions item should not have active class
    const privacyItem = screen.getByText(/Privacy & Permissions/i).closest('.settings-nav-item');
    expect(privacyItem.className).not.toContain('active');

    // And its header should NOT be in document
    expect(screen.queryByText(/Account Privacy & Visibility/i)).not.toBeInTheDocument();
  });

  it('only highlights and displays a section when the user explicitly clicks it', () => {
    render(
      <AuthProvider>
        <SettingsPage />
      </AuthProvider>
    );

    // Click Privacy & Permissions
    const privacyItem = screen.getByText(/Account privacy, DMs & comments/i).closest('.settings-nav-item');
    act(() => {
      fireEvent.click(privacyItem);
    });

    // Now Privacy section should be active
    expect(privacyItem.className).toContain('active');
    expect(screen.getByText(/Control who can see your media, send you messages, comment, and see your activity/i)).toBeInTheDocument();
  });

  it('honors initialSection if explicitly provided (e.g. from direct deep-link or edit profile)', () => {
    render(
      <AuthProvider>
        <SettingsPage initialSection="privacy" />
      </AuthProvider>
    );

    // When explicitly passed, privacy should be active
    const privacyItem = screen.getByText(/Account privacy, DMs & comments/i).closest('.settings-nav-item');
    expect(privacyItem.className).toContain('active');
    expect(screen.getByText(/Control who can see your media, send you messages, comment, and see your activity/i)).toBeInTheDocument();
  });

  it('resets section selection back to null when navigating back to menu', () => {
    render(
      <AuthProvider>
        <SettingsPage initialSection="notifications" />
      </AuthProvider>
    );

    // Initial section is notifications
    const notifItem = screen.getByText(/Push, sound FX & email/i).closest('.settings-nav-item');
    expect(notifItem.className).toContain('active');

    // Simulate clicking back or popstate handler
    const interceptor = navigationService.interceptors.find((i) => i.id === 'settings_mobile_section');
    if (interceptor) {
      act(() => {
        interceptor.handler();
      });
    }
  });
});
