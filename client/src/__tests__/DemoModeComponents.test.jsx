import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import AuthPromptModal from '../components/AuthPromptModal';
import DemoModeIndicator from '../components/DemoModeIndicator';
import { AuthProvider } from '../context/AuthContext';

// Mock useAuth
const mockUseAuth = vi.fn();
vi.mock('../context/AuthContext', async () => {
  const actual = await vi.importActual('../context/AuthContext');
  return {
    ...actual,
    useAuth: () => mockUseAuth()
  };
});

describe('AuthPromptModal Component', () => {
  it('does not render when isOpen is false', () => {
    const { container } = render(
      <AuthPromptModal
        isOpen={false}
        title="Join VibeGrid"
        subtitle="Create an account to like posts."
        onClose={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders title, subtitle, and action buttons when open', () => {
    const onSignup = vi.fn();
    const onLogin = vi.fn();
    const onClose = vi.fn();

    render(
      <AuthPromptModal
        isOpen={true}
        title="Join VibeGrid"
        subtitle="Create an account to like posts and comments."
        onNavigateToSignup={onSignup}
        onNavigateToLogin={onLogin}
        onClose={onClose}
      />
    );

    expect(screen.getByRole('dialog')).toBeDefined();
    expect(screen.getByText('Join VibeGrid')).toBeDefined();
    expect(screen.getByText('Create an account to like posts and comments.')).toBeDefined();

    // Click Create account
    fireEvent.click(screen.getByText('Create an account'));
    expect(onSignup).toHaveBeenCalled();

    // Click Log in
    fireEvent.click(screen.getByText('Log in'));
    expect(onLogin).toHaveBeenCalled();

    // Click Continue exploring
    fireEvent.click(screen.getByText('Continue exploring'));
    expect(onClose).toHaveBeenCalled();
  });

  it('closes on Escape key press', () => {
    const onClose = vi.fn();
    render(
      <AuthPromptModal
        isOpen={true}
        onClose={onClose}
      />
    );

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});

describe('DemoModeIndicator Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not render when not in demo mode', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 1, username: 'real_user' },
      isDemoMode: false
    });

    const { container } = render(<DemoModeIndicator />);
    expect(container.firstChild).toBeNull();
  });

  it('renders badge and handle when in demo mode', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 1, username: 'sophia_wander' },
      isDemoMode: true,
      startDemoSession: vi.fn(),
      logout: vi.fn()
    });

    render(<DemoModeIndicator />);
    expect(screen.getByText('DEMO MODE')).toBeDefined();
    expect(screen.getByText('@sophia_wander')).toBeDefined();
  });

  it('opens explainer modal and shows persona switcher when clicked', async () => {
    const mockStartDemo = vi.fn().mockResolvedValue({ success: true });
    mockUseAuth.mockReturnValue({
      user: { id: 1, username: 'sophia_wander' },
      isDemoMode: true,
      startDemoSession: mockStartDemo,
      logout: vi.fn()
    });

    render(<DemoModeIndicator />);

    // Click pill to open explainer modal
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /demo mode indicator/i }));
    });

    expect(screen.getByText(/You're exploring VibeGrid as @sophia_wander/i)).toBeDefined();
    expect(screen.getByText(/SWITCH DEMO PROFILE:/i)).toBeDefined();

    // Click another demo persona to switch
    const alexBtn = screen.getByText('@alex_design');
    await act(async () => {
      fireEvent.click(alexBtn);
    });

    expect(mockStartDemo).toHaveBeenCalledWith('alex_design');
  });
});
