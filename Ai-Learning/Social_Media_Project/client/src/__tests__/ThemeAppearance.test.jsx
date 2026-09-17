import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import App from '../App';
import SettingsPage from '../pages/SettingsPage';
import { AuthProvider } from '../context/AuthContext';
import { THEMES, getThemeById } from '../constants/themes';

describe('Theme & Appearance System', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('defines all 10 required themes in THEMES constant with valid attributes', () => {
    const expectedThemeNames = [
      'Light',
      'Dark',
      'Neon Glow',
      'Ocean Blue',
      'Forest Green',
      'Sunset Gradient',
      'Rose Pink',
      'Purple Dream',
      'AMOLED Black',
      'Pastel Light'
    ];

    expect(THEMES).toHaveLength(10);
    const themeNames = THEMES.map((t) => t.name);
    expect(themeNames).toEqual(expectedThemeNames);

    THEMES.forEach((theme) => {
      expect(theme.id).toBeDefined();
      expect(theme.name).toBeDefined();
      expect(theme.badge).toBeDefined();
      expect(theme.primary).toBeDefined();
      expect(theme.bgPage).toBeDefined();
      expect(theme.bgCard).toBeDefined();
      expect(theme.textPrimary).toBeDefined();
      expect(theme.borderColor).toBeDefined();
      expect(theme.outgoingBubble).toBeDefined();
      expect(theme.incomingBubble).toBeDefined();
      expect(theme.swatches).toBeInstanceOf(Array);
      expect(theme.swatches.length).toBeGreaterThanOrEqual(3);
    });
  });

  it('correctly retrieves themes by id with fallback', () => {
    const neon = getThemeById('neon-glow');
    expect(neon.name).toBe('Neon Glow');

    const ocean = getThemeById('ocean-blue');
    expect(ocean.name).toBe('Ocean Blue');

    const fallback = getThemeById('non-existent-theme-id');
    expect(fallback).toBeDefined();
    expect(fallback.id).toBe('dark');
  });

  it('applies stored theme from localStorage on App mount', () => {
    localStorage.setItem('vibegrid_theme', 'sunset-gradient');
    render(<App />);
    expect(document.documentElement.getAttribute('data-theme')).toBe('sunset-gradient');
  });

  it('renders all 10 theme preview cards in SettingsPage appearance section and allows switching', () => {
    localStorage.setItem('vibegrid_user', JSON.stringify({
      id: 1,
      username: 'tester',
      full_name: 'Test User'
    }));

    let currentTheme = 'dark';
    const handleThemeChange = (newTheme) => {
      currentTheme = newTheme;
    };

    const { rerender } = render(
      <AuthProvider>
        <SettingsPage
          initialSection="appearance"
          currentTheme={currentTheme}
          onThemeChange={handleThemeChange}
        />
      </AuthProvider>
    );

    // Verify all 10 theme names are rendered in the DOM
    THEMES.forEach((t) => {
      expect(screen.getAllByText(t.name).length).toBeGreaterThan(0);
    });

    // Find and click the 'Ocean Blue' theme card
    const oceanCard = screen.getByText('Ocean Blue').closest('.theme-card');
    expect(oceanCard).not.toBeNull();
    act(() => {
      fireEvent.click(oceanCard);
    });

    expect(currentTheme).toBe('ocean-blue');

    // Rerender with updated currentTheme
    rerender(
      <AuthProvider>
        <SettingsPage
          initialSection="appearance"
          currentTheme={currentTheme}
          onThemeChange={handleThemeChange}
        />
      </AuthProvider>
    );

    // Verify Active Theme indicator
    expect(screen.getByText(/Active Theme: Ocean Blue/i)).toBeDefined();
  });

  it('renders Phase 10 Live Showcase Canvas with interactive component switcher tabs', () => {
    localStorage.setItem('vibegrid_user', JSON.stringify({
      id: 1,
      username: 'tester',
      full_name: 'Test User'
    }));

    render(
      <AuthProvider>
        <SettingsPage initialSection="appearance" currentTheme="dark" />
      </AuthProvider>
    );

    // Verify canvas is present
    const canvas = screen.getByTestId('theme-showcase-canvas');
    expect(canvas).toBeInTheDocument();

    // Verify component tabs exist
    const feedTab = screen.getByRole('button', { name: /Feed Post/i });
    const chatTab = screen.getByRole('button', { name: /Direct Message/i });
    const profileTab = screen.getByRole('button', { name: /Profile Card/i });
    expect(feedTab).toBeInTheDocument();
    expect(chatTab).toBeInTheDocument();
    expect(profileTab).toBeInTheDocument();

    // Switch to Chat tab
    act(() => {
      fireEvent.click(chatTab);
    });
    expect(screen.getByPlaceholderText(/Message @alex_vibe/i)).toBeInTheDocument();

    // Switch to Profile tab
    act(() => {
      fireEvent.click(profileTab);
    });
    expect(screen.getByRole('button', { name: /Edit Profile/i })).toBeInTheDocument();
  });

  it('renders Phase 10 Smart OS Appearance Sync card with toggles', () => {
    localStorage.setItem('vibegrid_user', JSON.stringify({
      id: 1,
      username: 'tester',
      full_name: 'Test User'
    }));

    render(
      <AuthProvider>
        <SettingsPage initialSection="appearance" currentTheme="dark" />
      </AuthProvider>
    );

    const smartSyncCard = screen.getByTestId('theme-smart-sync-card');
    expect(smartSyncCard).toBeInTheDocument();

    const autoSyncToggle = screen.getByTestId('theme-auto-sync-toggle');
    expect(autoSyncToggle).toBeInTheDocument();

    const batteryOledToggle = screen.getByTestId('theme-battery-oled-toggle');
    expect(batteryOledToggle).toBeInTheDocument();
  });

  it('filters theme cards when category filter chips are clicked', () => {
    localStorage.setItem('vibegrid_user', JSON.stringify({
      id: 1,
      username: 'tester',
      full_name: 'Test User'
    }));

    render(
      <AuthProvider>
        <SettingsPage initialSection="appearance" currentTheme="dark" />
      </AuthProvider>
    );

    // Click Light & Soft filter chip
    const lightChip = screen.getByRole('button', { name: /Light & Soft/i });
    act(() => {
      fireEvent.click(lightChip);
    });

    // In Light filter: Light and Pastel Light should be present, AMOLED Black should not
    expect(screen.getByText('Light')).toBeInTheDocument();
    expect(screen.getByText('Pastel Light')).toBeInTheDocument();
    expect(screen.queryByText('AMOLED Black')).not.toBeInTheDocument();

    // Click All Themes filter chip
    const allChip = screen.getByRole('button', { name: /All Themes/i });
    act(() => {
      fireEvent.click(allChip);
    });
    expect(screen.getByText('AMOLED Black')).toBeInTheDocument();
  });
});

