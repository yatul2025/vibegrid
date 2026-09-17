import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import SpringToggle from '../components/SpringToggle';

describe('SpringToggle Component (Phase 8 Option 1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders correctly with default unchecked state', () => {
    render(<SpringToggle aria-label="Test Switch" />);
    const toggle = screen.getByRole('switch', { name: 'Test Switch' });
    expect(toggle).toBeInTheDocument();
    expect(toggle).not.toBeChecked();
    expect(toggle).toHaveAttribute('aria-checked', 'false');
  });

  it('renders checked when checked prop is true', () => {
    render(<SpringToggle checked={true} aria-label="Active Switch" />);
    const toggle = screen.getByRole('switch', { name: 'Active Switch' });
    expect(toggle).toBeChecked();
    expect(toggle).toHaveAttribute('aria-checked', 'true');
  });

  it('fires onChange callback and triggers haptic vibration on change', () => {
    const handleChange = vi.fn();
    const vibrateMock = vi.fn();
    navigator.vibrate = vibrateMock;

    render(<SpringToggle checked={false} onChange={handleChange} aria-label="Toggle with Haptic" />);
    const toggle = screen.getByRole('switch', { name: 'Toggle with Haptic' });
    
    fireEvent.click(toggle);
    expect(handleChange).toHaveBeenCalledTimes(1);
    expect(vibrateMock).toHaveBeenCalledWith(15);
  });

  it('does not trigger onChange or haptics when disabled', () => {
    const handleChange = vi.fn();
    const vibrateMock = vi.fn();
    navigator.vibrate = vibrateMock;

    render(<SpringToggle disabled={true} onChange={handleChange} aria-label="Disabled Switch" />);
    const toggle = screen.getByRole('switch', { name: 'Disabled Switch' });
    
    expect(toggle).toBeDisabled();
    fireEvent.click(toggle);
    expect(handleChange).not.toHaveBeenCalled();
    expect(vibrateMock).not.toHaveBeenCalled();
  });

  it('has spring-switch-toggle and spring-switch-slider CSS classes for fluid spring animations', () => {
    const { container } = render(<SpringToggle checked={true} aria-label="Animated Switch" />);
    const label = container.querySelector('.spring-switch-toggle');
    const slider = container.querySelector('.spring-switch-slider');
    const glow = container.querySelector('.spring-slider-track-glow');
    const thumb = container.querySelector('.spring-slider-thumb');

    expect(label).toBeInTheDocument();
    expect(label).toHaveClass('is-checked');
    expect(slider).toBeInTheDocument();
    expect(glow).toBeInTheDocument();
    expect(thumb).toBeInTheDocument();
  });
});
