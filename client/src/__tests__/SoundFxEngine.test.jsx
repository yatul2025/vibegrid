import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import soundFx, { SOUND_PACKS } from '../services/soundFxService';
import SettingsPage from '../pages/SettingsPage';
import { AuthProvider } from '../context/AuthContext';

// Mock apiClient
vi.mock('../api/client', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ success: true, data: { notifications: {} } }),
    post: vi.fn().mockResolvedValue({ success: true }),
    put: vi.fn().mockResolvedValue({ success: true }),
    delete: vi.fn().mockResolvedValue({ success: true })
  }
}));

// Mock pushNotificationService
vi.mock('../services/pushNotificationService', () => ({
  default: {
    getNotificationPermission: vi.fn().mockReturnValue('default'),
    getExistingSubscription: vi.fn().mockResolvedValue(null),
    subscribeToPushNotifications: vi.fn().mockResolvedValue({}),
    unsubscribeFromPushNotifications: vi.fn().mockResolvedValue(true),
    sendTestNotification: vi.fn().mockResolvedValue(true),
    getPushDiagnostics: vi.fn().mockResolvedValue({}),
    syncPushSubscription: vi.fn().mockResolvedValue(true)
  }
}));

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

describe('SoundFxService Core (Phase 9 Web Audio Engine)', () => {
  beforeEach(() => {
    localStorage.clear();
    soundFx.setEnabled(true);
    soundFx.setPack('modern');
    soundFx.setVolume(0.7);
  });

  it('exports all 5 distinct sound packs with correct metadata', () => {
    expect(SOUND_PACKS).toHaveLength(5);
    const packIds = SOUND_PACKS.map((p) => p.id);
    expect(packIds).toEqual(['modern', 'kalimba', 'retro', 'cyber', 'minimal']);
  });

  it('initializes with default settings and persists changes to localStorage', () => {
    expect(soundFx.isEnabled()).toBe(true);
    expect(soundFx.getPack()).toBe('modern');
    expect(soundFx.getVolume()).toBe(0.7);

    // Toggle mute
    soundFx.setEnabled(false);
    expect(soundFx.isEnabled()).toBe(false);
    expect(localStorage.getItem('vibegrid_sound_enabled')).toBe('false');

    // Switch pack
    soundFx.setPack('kalimba');
    expect(soundFx.getPack()).toBe('kalimba');
    expect(localStorage.getItem('vibegrid_sound_pack')).toBe('kalimba');

    // Adjust volume
    soundFx.setVolume(0.45);
    expect(soundFx.getVolume()).toBe(0.45);
    expect(localStorage.getItem('vibegrid_sound_volume')).toBe('0.45');
  });

  it('clamps volume safely between 0.0 and 1.0', () => {
    soundFx.setVolume(1.8);
    expect(soundFx.getVolume()).toBe(1.0);

    soundFx.setVolume(-0.5);
    expect(soundFx.getVolume()).toBe(0.0);
  });

  it('ignores invalid pack identifiers', () => {
    soundFx.setPack('modern');
    soundFx.setPack('unknown_alien_pack');
    expect(soundFx.getPack()).toBe('modern');
  });

  it('notifies subscribers immediately on subscription and state mutations', () => {
    const subscriber = vi.fn();
    const unsub = soundFx.subscribe(subscriber);

    // Initial state delivered upon subscribe
    expect(subscriber).toHaveBeenCalledWith({
      enabled: true,
      pack: 'modern',
      volume: 0.7,
      clickEnabled: true
    });

    // Mutation triggers subscriber
    soundFx.setPack('cyber');
    expect(subscriber).toHaveBeenLastCalledWith({
      enabled: true,
      pack: 'cyber',
      volume: 0.7,
      clickEnabled: true
    });

    unsub();
    soundFx.setPack('retro');
    // Not called again after unsubscribe
    expect(subscriber).not.toHaveBeenCalledWith(expect.objectContaining({ pack: 'retro' }));
  });

  it('toggles and persists click sounds setting', () => {
    expect(soundFx.isClickSoundEnabled()).toBe(true);
    soundFx.setClickSoundEnabled(false);
    expect(soundFx.isClickSoundEnabled()).toBe(false);
    expect(localStorage.getItem('vibegrid_sound_click_enabled')).toBe('false');

    soundFx.toggleClickSound();
    expect(soundFx.isClickSoundEnabled()).toBe(true);
    expect(localStorage.getItem('vibegrid_sound_click_enabled')).toBe('true');
  });

  it('plays all sound events across all 5 sound packs without throwing errors', () => {
    const events = ['click', 'like', 'send', 'receive', 'reaction', 'toggle', 'celebration', 'refresh'];
    const packs = ['modern', 'kalimba', 'retro', 'cyber', 'minimal'];

    packs.forEach((packId) => {
      events.forEach((eventType) => {
        expect(() => {
          soundFx.play(eventType, packId);
        }).not.toThrow();
      });
    });
  });
});

describe('SettingsPage Sound FX UI (Phase 9 Option 6)', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('vibegrid_token', 'mock_token');
    localStorage.setItem('vibegrid_user', JSON.stringify({
      id: 1,
      username: 'tester',
      full_name: 'Test User'
    }));
    soundFx.setEnabled(true);
    soundFx.setPack('modern');
    soundFx.setVolume(0.8);
  });

  it('renders the In-App Sound Effects card with toggle and active status pill', async () => {
    render(
      <AuthProvider>
        <SettingsPage initialSection="notifications" />
      </AuthProvider>
    );

    const soundCard = await screen.findByTestId('sound-fx-settings-card');
    expect(soundCard).toBeInTheDocument();
    expect(screen.getByText('In-App Sound Effects & Web Audio FX')).toBeInTheDocument();
    expect(screen.getByText('Audio Active')).toBeInTheDocument();

    const toggle = screen.getByTestId('sound-fx-toggle');
    expect(toggle).toBeInTheDocument();
  });

  it('displays all 5 sound packs and allows selecting and previewing them', async () => {
    const playSpy = vi.spyOn(soundFx, 'play');

    render(
      <AuthProvider>
        <SettingsPage initialSection="notifications" />
      </AuthProvider>
    );

    await screen.findByTestId('sound-fx-settings-card');

    // Check all 5 packs exist
    expect(screen.getByTestId('sound-pack-modern')).toBeInTheDocument();
    expect(screen.getByTestId('sound-pack-kalimba')).toBeInTheDocument();
    expect(screen.getByTestId('sound-pack-retro')).toBeInTheDocument();
    expect(screen.getByTestId('sound-pack-cyber')).toBeInTheDocument();
    expect(screen.getByTestId('sound-pack-minimal')).toBeInTheDocument();

    // Select Kalimba
    const kalimbaCard = screen.getByTestId('sound-pack-kalimba');
    fireEvent.click(kalimbaCard);

    expect(soundFx.getPack()).toBe('kalimba');
    expect(playSpy).toHaveBeenCalledWith('like', 'kalimba');

    playSpy.mockRestore();
  });

  it('adjusts volume via slider and triggers test celebration chime', async () => {
    const playSpy = vi.spyOn(soundFx, 'play');

    render(
      <AuthProvider>
        <SettingsPage initialSection="notifications" />
      </AuthProvider>
    );

    await screen.findByTestId('sound-fx-settings-card');

    const slider = screen.getByTestId('sound-volume-slider');
    expect(slider).toBeInTheDocument();

    // Change volume
    fireEvent.change(slider, { target: { value: '50' } });
    expect(soundFx.getVolume()).toBe(0.5);

    // Trigger test sound
    const testBtn = screen.getByTestId('sound-test-btn');
    fireEvent.click(testBtn);
    expect(playSpy).toHaveBeenCalledWith('celebration');

    playSpy.mockRestore();
  });

  it('hides sound pack choices when master sound toggle is muted', async () => {
    render(
      <AuthProvider>
        <SettingsPage initialSection="notifications" />
      </AuthProvider>
    );

    await screen.findByTestId('sound-fx-settings-card');

    const toggle = screen.getByTestId('sound-fx-toggle');
    const input = toggle.querySelector('input[type="checkbox"]');
    
    act(() => {
      fireEvent.click(input);
    });

    expect(soundFx.isEnabled()).toBe(false);
    expect(screen.getByText('Muted')).toBeInTheDocument();
    expect(screen.queryByTestId('sound-pack-modern')).not.toBeInTheDocument();
  });

  it('renders UI click sound toggle and allows switching it on and off', async () => {
    render(
      <AuthProvider>
        <SettingsPage initialSection="notifications" />
      </AuthProvider>
    );

    await screen.findByTestId('sound-fx-settings-card');
    const clickToggle = screen.getByTestId('sound-click-toggle');
    expect(clickToggle).toBeInTheDocument();

    const input = clickToggle.querySelector('input[type="checkbox"]');
    expect(input.checked).toBe(true);

    act(() => {
      fireEvent.click(input);
    });

    expect(soundFx.isClickSoundEnabled()).toBe(false);
  });

  it('triggers interactive soundboard preview buttons for Chat Message, Toggle, and UI Click', async () => {
    const playSpy = vi.spyOn(soundFx, 'play');

    render(
      <AuthProvider>
        <SettingsPage initialSection="notifications" />
      </AuthProvider>
    );

    await screen.findByTestId('sound-fx-settings-card');

    // Test Chat Message button
    const chatBtn = screen.getByRole('button', { name: /Chat Message/i });
    fireEvent.click(chatBtn);
    expect(playSpy).toHaveBeenCalledWith('receive');

    // Test Toggle Switch button
    const toggleBtn = screen.getByRole('button', { name: /Toggle Switch/i });
    fireEvent.click(toggleBtn);
    expect(playSpy).toHaveBeenCalledWith('toggle');

    // Test UI Click button
    const clickBtn = screen.getByRole('button', { name: /UI Click/i });
    fireEvent.click(clickBtn);
    expect(playSpy).toHaveBeenCalledWith('click');

    playSpy.mockRestore();
  });
});

