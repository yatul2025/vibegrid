import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import SettingsPage from '../pages/SettingsPage';
import { AuthProvider } from '../context/AuthContext';
import { VibiAssistantProvider, VIBI_PREFERENCES_STORAGE_KEY, DEFAULT_VIBI_PREFERENCES } from '../context/VibiAssistantContext';
import navigationService from '../services/navigationService';

describe('Vibi Assistant Settings Suite', () => {
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

  const renderWithProviders = (ui) => {
    return render(
      <AuthProvider>
        <VibiAssistantProvider>
          {ui}
        </VibiAssistantProvider>
      </AuthProvider>
    );
  };

  it('renders Vibi Assistant in settings category navigation menu', () => {
    renderWithProviders(<SettingsPage />);

    const vibiCategory = screen.getByText(/Vibi Assistant/i);
    expect(vibiCategory).toBeInTheDocument();
    expect(screen.getByText(/AI companion, controls & smart features/i)).toBeInTheDocument();
  });

  it('navigates to Vibi Assistant section when clicked from category menu', () => {
    renderWithProviders(<SettingsPage />);

    const vibiItem = screen.getByText(/AI companion, controls & smart features/i).closest('.settings-nav-item');
    act(() => {
      fireEvent.click(vibiItem);
    });

    expect(vibiItem.className).toContain('active');
    expect(screen.getByTestId('vibi-settings-section')).toBeInTheDocument();
    expect(screen.getByText(/🦊 Vibi AI Assistant/i)).toBeInTheDocument();
    expect(screen.getByText(/Enable Vibi Assistant \(Master Control\)/i)).toBeInTheDocument();
  });

  it('honors initialSection="vibi" directly', () => {
    renderWithProviders(<SettingsPage initialSection="vibi" />);

    expect(screen.getByTestId('vibi-settings-section')).toBeInTheDocument();
    expect(screen.getByTestId('vibi-master-toggle')).toBeInTheDocument();
    expect(screen.getByTestId('vibi-welcome-toggle')).toBeInTheDocument();
    expect(screen.getByTestId('vibi-fab-toggle')).toBeInTheDocument();
    expect(screen.getByTestId('vibi-suggestions-toggle')).toBeInTheDocument();
    expect(screen.getByTestId('vibi-context-toggle')).toBeInTheDocument();
    expect(screen.getByTestId('vibi-notifications-toggle')).toBeInTheDocument();
    expect(screen.getByTestId('vibi-animations-toggle')).toBeInTheDocument();
  });

  it('toggles Master Switch and disables all individual controls when Master is OFF', () => {
    renderWithProviders(<SettingsPage initialSection="vibi" />);

    const masterInput = screen.getByTestId('vibi-master-toggle').querySelector('input');
    const welcomeInput = screen.getByTestId('vibi-welcome-toggle').querySelector('input');
    const fabInput = screen.getByTestId('vibi-fab-toggle').querySelector('input');
    const controlsCard = screen.getByTestId('vibi-controls-card');

    expect(masterInput).toBeChecked();
    expect(welcomeInput).not.toBeDisabled();
    expect(fabInput).not.toBeDisabled();

    // Turn Master OFF
    act(() => {
      fireEvent.click(masterInput);
    });

    expect(masterInput).not.toBeChecked();
    expect(welcomeInput).toBeDisabled();
    expect(fabInput).toBeDisabled();
    expect(screen.getByTestId('vibi-disabled-banner')).toBeInTheDocument();
    expect(controlsCard.style.opacity).toBe('0.45');
    expect(controlsCard.style.pointerEvents).toBe('none');

    // Verify localStorage updated
    const saved = JSON.parse(localStorage.getItem(VIBI_PREFERENCES_STORAGE_KEY));
    expect(saved.enabled).toBe(false);

    // Turn Master back ON
    act(() => {
      fireEvent.click(masterInput);
    });

    expect(masterInput).toBeChecked();
    expect(welcomeInput).not.toBeDisabled();
    expect(controlsCard.style.opacity).toBe('1');
  });

  it('allows toggling individual preferences when Master is ON', () => {
    renderWithProviders(<SettingsPage initialSection="vibi" />);

    const fabInput = screen.getByTestId('vibi-fab-toggle').querySelector('input');
    expect(fabInput).toBeChecked();

    act(() => {
      fireEvent.click(fabInput);
    });

    expect(fabInput).not.toBeChecked();
    const saved = JSON.parse(localStorage.getItem(VIBI_PREFERENCES_STORAGE_KEY));
    expect(saved.floatingButton).toBe(false);
    expect(saved.enabled).toBe(true);
  });

  it('resets all preferences to defaults when clicking Reset button', () => {
    // Start with non-default preferences in localStorage
    localStorage.setItem(
      VIBI_PREFERENCES_STORAGE_KEY,
      JSON.stringify({
        enabled: false,
        welcome: false,
        floatingButton: false,
        smartSuggestions: false,
        appContext: false,
        notifications: false,
        animations: false
      })
    );

    renderWithProviders(<SettingsPage initialSection="vibi" />);

    const masterInput = screen.getByTestId('vibi-master-toggle').querySelector('input');
    expect(masterInput).not.toBeChecked();

    const resetBtn = screen.getByTestId('vibi-reset-btn');
    act(() => {
      fireEvent.click(resetBtn);
    });

    // Preferences should be reset back to true (defaults)
    expect(masterInput).toBeChecked();
    const welcomeInput = screen.getByTestId('vibi-welcome-toggle').querySelector('input');
    expect(welcomeInput).toBeChecked();

    // Toast feedback appears
    expect(screen.getByTestId('vibi-reset-toast')).toBeInTheDocument();

    const saved = JSON.parse(localStorage.getItem(VIBI_PREFERENCES_STORAGE_KEY));
    expect(saved.enabled).toBe(true);
    expect(saved.welcome).toBe(true);
    expect(saved.floatingButton).toBe(true);
  });

  it('renders gracefully without crashing even if VibiAssistantProvider is omitted', () => {
    render(
      <AuthProvider>
        <SettingsPage initialSection="vibi" />
      </AuthProvider>
    );

    expect(screen.getByTestId('vibi-settings-section')).toBeInTheDocument();
  });
});
