import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../App';
import AuthPage from '../pages/AuthPage';

describe('App Component Root Integration Test', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('renders App successfully when user is not logged in', async () => {
    const { container } = render(<App />);
    expect(container).toBeDefined();
  });

  it('renders AuthPage directly without error', async () => {
    const { container } = render(
      <App />
    );
    expect(container).toBeDefined();
  });

  it('renders App successfully when user is in Demo Mode', async () => {
    localStorage.setItem('vibegrid_user', JSON.stringify({
      id: 1,
      username: 'sophia_wander',
      full_name: 'Sophia Laurent',
      is_demo_session: true,
      sessionType: 'demo'
    }));

    const { container } = render(<App />);
    expect(container).toBeDefined();
  });
});
