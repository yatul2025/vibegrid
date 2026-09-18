import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import accountSuggestionService from '../services/accountSuggestionService';
import AuthPage from '../pages/AuthPage';
import { AuthProvider, useAuth } from '../context/AuthContext';
import apiClient from '../api/client';

describe('Remembered Login Account Suggestion System', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  describe('accountSuggestionService storage and security isolation', () => {
    it('saves only non-sensitive account metadata and NEVER stores passwords or secrets', () => {
      const user = {
        id: 101,
        username: 'alice_w',
        full_name: 'Alice Wonder',
        avatar_url: 'https://example.com/avatar.jpg',
        gender: 'female',
        password: 'SUPER_SECRET_PASSWORD',
        token: 'JWT_SECRET_TOKEN'
      };

      accountSuggestionService.saveRememberedAccount(user, 'alice_w');

      const accounts = accountSuggestionService.getRememberedAccounts();
      expect(accounts).toHaveLength(1);
      const saved = accounts[0];
      expect(saved.id).toBe(101);
      expect(saved.username).toBe('alice_w');
      expect(saved.fullName).toBe('Alice Wonder');
      expect(saved.avatarUrl).toBe('https://example.com/avatar.jpg');
      expect(saved.gender).toBe('female');

      // Crucial Security Test: NO password or token in storage
      expect(saved.password).toBeUndefined();
      expect(saved.token).toBeUndefined();

      const raw = localStorage.getItem('vibegrid_remembered_accounts');
      expect(raw).not.toContain('SUPER_SECRET_PASSWORD');
      expect(raw).not.toContain('JWT_SECRET_TOKEN');
    });

    it('does not save demo persona sessions', () => {
      const demoUser = {
        id: 99,
        username: 'sophia_wander',
        full_name: 'Sophia Wander',
        is_demo_session: true
      };

      accountSuggestionService.saveRememberedAccount(demoUser);
      expect(accountSuggestionService.getRememberedAccounts()).toHaveLength(0);
    });

    it('supports multiple accounts and sorts most recently used first', () => {
      const user1 = { id: 1, username: 'user_one', full_name: 'User One' };
      const user2 = { id: 2, username: 'user_two', full_name: 'User Two' };
      const user3 = { id: 3, username: 'user_three', full_name: 'User Three' };

      accountSuggestionService.saveRememberedAccount(user1);
      accountSuggestionService.saveRememberedAccount(user2);
      accountSuggestionService.saveRememberedAccount(user3);

      const accounts = accountSuggestionService.getRememberedAccounts();
      expect(accounts).toHaveLength(3);
      expect(accounts[0].username).toBe('user_three');
      expect(accounts[1].username).toBe('user_two');
      expect(accounts[2].username).toBe('user_one');

      // Re-using user_one moves it to the front
      accountSuggestionService.saveRememberedAccount(user1);
      const reordered = accountSuggestionService.getRememberedAccounts();
      expect(reordered).toHaveLength(3);
      expect(reordered[0].username).toBe('user_one');
    });

    it('allows removing an individual remembered account', () => {
      accountSuggestionService.saveRememberedAccount({ id: 1, username: 'atul' });
      accountSuggestionService.saveRememberedAccount({ id: 2, username: 'bob' });

      expect(accountSuggestionService.getRememberedAccounts()).toHaveLength(2);

      const remaining = accountSuggestionService.removeRememberedAccount('atul');
      expect(remaining).toHaveLength(1);
      expect(remaining[0].username).toBe('bob');
    });

    it('clearing session storage does NOT automatically log in and remembered data cannot restore session', () => {
      // Setup: user has remembered accounts but NO active session (vibegrid_user is empty)
      accountSuggestionService.saveRememberedAccount({ id: 50, username: 'charlie' });
      expect(localStorage.getItem('vibegrid_user')).toBeNull();

      // Session is not restored
      expect(localStorage.getItem('vibegrid_remembered_accounts')).not.toBeNull();
      expect(localStorage.getItem('vibegrid_user')).toBeNull();
    });
  });

  describe('AuthPage login suggestions UI and authentication flow', () => {
    beforeEach(() => {
      accountSuggestionService.saveRememberedAccount({
        id: 10,
        username: 'atul_y',
        full_name: 'Atul Yadav',
        avatar_url: null,
        gender: 'male'
      });
      accountSuggestionService.saveRememberedAccount({
        id: 20,
        username: 'priya_s',
        full_name: 'Priya Sharma',
        avatar_url: null,
        gender: 'female'
      });
    });

    it('renders login suggestions for all remembered accounts', () => {
      render(
        <AuthProvider>
          <AuthPage initialTab="login" />
        </AuthProvider>
      );

      expect(screen.getByTestId('login-suggestions')).toBeInTheDocument();
      expect(screen.getByText('Recent Accounts')).toBeInTheDocument();
      expect(screen.getByText('Priya Sharma')).toBeInTheDocument();
      expect(screen.getByText('@priya_s')).toBeInTheDocument();
      expect(screen.getByText('Atul Yadav')).toBeInTheDocument();
      expect(screen.getByText('@atul_y')).toBeInTheDocument();
    });

    it('selecting a suggestion pre-fills the identifier, focuses password, and NEVER auto-logs in', async () => {
      render(
        <AuthProvider>
          <AuthPage initialTab="login" />
        </AuthProvider>
      );

      const priyaCard = screen.getByTestId('account-suggestion-priya_s');
      fireEvent.click(priyaCard);

      // Selected account banner appears
      expect(screen.getByTestId('selected-account-banner')).toBeInTheDocument();
      expect(screen.getByText(/Logging in as @priya_s|Log in as @priya_s/i)).toBeInTheDocument();

      // Password input is empty and requires user input
      const passwordInput = screen.getByLabelText(/Password/i);
      expect(passwordInput.value).toBe('');

      // Submit button is disabled because password has NOT been entered
      const submitBtn = screen.getByRole('button', { name: /Log in as @priya_s/i });
      expect(submitBtn).toBeDisabled();
    });

    it('allows entering password and logging in after selecting a suggested account', async () => {
      vi.spyOn(apiClient, 'post').mockResolvedValue({
        success: true,
        data: {
          user: { id: 20, username: 'priya_s', full_name: 'Priya Sharma' }
        }
      });

      render(
        <AuthProvider>
          <AuthPage initialTab="login" />
        </AuthProvider>
      );

      // Click Priya's suggestion
      fireEvent.click(screen.getByTestId('account-suggestion-priya_s'));

      // Enter password
      const passwordInput = screen.getByLabelText(/Password/i);
      fireEvent.change(passwordInput, { target: { value: 'SecretPriya123!' } });

      const submitBtn = screen.getByRole('button', { name: /Log in as @priya_s/i });
      expect(submitBtn).not.toBeDisabled();

      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(apiClient.post).toHaveBeenCalledWith('/auth/login', {
          identifier: 'priya_s',
          password: 'SecretPriya123!',
          isDemoAccess: false
        });
      });
    });

    it('allows switching away from a selected account back to manual input', () => {
      render(
        <AuthProvider>
          <AuthPage initialTab="login" />
        </AuthProvider>
      );

      // Select Priya
      fireEvent.click(screen.getByTestId('account-suggestion-priya_s'));
      expect(screen.getByTestId('selected-account-banner')).toBeInTheDocument();

      // Click Switch
      const switchBtn = screen.getByTestId('switch-account-btn');
      fireEvent.click(switchBtn);

      // Back to suggestions list and full manual identifier input
      expect(screen.queryByTestId('selected-account-banner')).not.toBeInTheDocument();
      expect(screen.getByPlaceholderText(/Mobile number, username or email/i)).toBeInTheDocument();
    });

    it('allows removing an account from the suggestions list', () => {
      render(
        <AuthProvider>
          <AuthPage initialTab="login" />
        </AuthProvider>
      );

      expect(screen.getByText('@priya_s')).toBeInTheDocument();
      const removeBtn = screen.getByTestId('remove-suggestion-priya_s');
      fireEvent.click(removeBtn);

      // Priya is removed
      expect(screen.queryByText('@priya_s')).not.toBeInTheDocument();
      // Atul still remains
      expect(screen.getByText('@atul_y')).toBeInTheDocument();
    });

    it('renders normal login without suggestions when no accounts are remembered', () => {
      localStorage.clear();

      render(
        <AuthProvider>
          <AuthPage initialTab="login" />
        </AuthProvider>
      );

      expect(screen.queryByTestId('login-suggestions')).not.toBeInTheDocument();
      expect(screen.getByPlaceholderText(/Mobile number, username or email/i)).toBeInTheDocument();
    });
  });
});
