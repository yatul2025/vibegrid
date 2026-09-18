import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import vibiContextService, {
  VibiContextService,
  STRICT_SECURITY_BLACKLIST,
  useVibiContext
} from '../services/vibiContextService';
import navigationService from '../services/navigationService';
import { VibiAssistantProvider, useVibiAssistant } from '../context/VibiAssistantContext';

describe('Vibi Context Engine (Read-Only) Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    navigationService.interceptors = [];
    vibiContextService.setActiveTab('feed');
    vibiContextService.clearActiveChatMetadata();
  });

  it('assembles a clean, read-only runtime context snapshot on demand', () => {
    const mockUser = {
      id: 42,
      username: 'red_panda_fan',
      full_name: 'Panda Fan',
      is_verified: true,
      email: 'private@example.com',
      password: 'super_secret_hash',
      token: 'jwt.token.secret'
    };

    vibiContextService.setActiveTab('explore');

    const context = vibiContextService.assembleContext({
      user: mockUser,
      preferences: { enabled: true, appContext: true }
    });

    expect(context.appContextEnabled).toBe(true);
    expect(context.screen).toBe('explore');
    expect(context.subScreen).toBe('none');
    expect(context.user).toEqual({
      username: 'red_panda_fan',
      displayName: 'Panda Fan',
      isVerified: true
    });
    expect(context.device).toBeDefined();
    expect(context.device.isOnline).toBe(true);

    // CRITICAL SECURITY: Sensitive user fields must NOT exist in snapshot
    expect(context.user.password).toBeUndefined();
    expect(context.user.token).toBeUndefined();
    expect(context.user.email).toBeUndefined();
  });

  it('detects active sub-screen/modal from navigationService interceptors', () => {
    navigationService.registerBackInterceptor('app_create_post', () => true, 10);

    const context = vibiContextService.assembleContext({
      user: { username: 'test' },
      preferences: { enabled: true, appContext: true }
    });

    expect(context.subScreen).toBe('app_create_post');
  });

  it('records chat metadata ONLY and strictly rejects messages or private keys', () => {
    vibiContextService.setActiveChatMetadata({
      id: 'group-101',
      name: 'Designers Team',
      type: 'group',
      // The following forbidden properties must NEVER be stored:
      messages: ['Hello', 'World'],
      content: 'Secret message',
      privateKey: 'abc123secret',
      sessionKey: 'xyz987'
    });

    const context = vibiContextService.assembleContext({
      user: { username: 'designer' },
      preferences: { enabled: true, appContext: true }
    });

    expect(context.activeChat).toEqual({
      id: 'group-101',
      name: 'Designers Team',
      type: 'group'
    });
    expect(context.activeChat.messages).toBeUndefined();
    expect(context.activeChat.content).toBeUndefined();
    expect(context.activeChat.privateKey).toBeUndefined();
    expect(context.activeChat.sessionKey).toBeUndefined();
  });

  it('enforces Master Control OFF: returns dormant state without reading context', () => {
    vibiContextService.setActiveTab('messages');

    const context = vibiContextService.assembleContext({
      user: { username: 'charlie' },
      preferences: { enabled: false, appContext: true }
    });

    expect(context.status).toBe('dormant');
    expect(context.reason).toBe('vibi_disabled');
    expect(context.screen).toBeUndefined();
    expect(context.activeChat).toBeUndefined();
  });

  it('enforces App Context Awareness OFF: returns minimal masked context when appContext=false', () => {
    vibiContextService.setActiveTab('settings');
    vibiContextService.setActiveChatMetadata({ id: 5, name: 'Secret Chat', type: 'direct' });

    const context = vibiContextService.assembleContext({
      user: { username: 'charlie' },
      preferences: { enabled: true, appContext: false }
    });

    expect(context.screen).toBe('unknown');
    expect(context.subScreen).toBe('none');
    expect(context.activeChat).toBeUndefined();
    expect(context.appContextEnabled).toBe(false);
    expect(context.user).toEqual({ username: 'charlie' });
  });

  it('strictly sanitizes and purges all blacklisted sensitive keys', () => {
    const taintedObject = {
      screen: 'feed',
      password: 'password123',
      nested: {
        token: 'secret-token',
        ciphertext: 'base64ciphertext',
        plaintext: 'base64plaintext',
        sessionKey: 'key',
        safeProperty: 'allowed'
      }
    };

    vibiContextService.sanitizeSecurityCheck(taintedObject);

    expect(taintedObject.password).toBeUndefined();
    expect(taintedObject.nested.token).toBeUndefined();
    expect(taintedObject.nested.ciphertext).toBeUndefined();
    expect(taintedObject.nested.plaintext).toBeUndefined();
    expect(taintedObject.nested.sessionKey).toBeUndefined();
    expect(taintedObject.nested.safeProperty).toBe('allowed');
  });

  it('guarantees context snapshot payload size is strictly less than 2KB', () => {
    vibiContextService.setActiveTab('feed');
    vibiContextService.setActiveChatMetadata({ id: '99', name: 'Very Long Chat Title That Exists In VibeGrid', type: 'direct' });

    const context = vibiContextService.assembleContext({
      user: { username: 'regular_user', full_name: 'Regular User Full Name', is_verified: true },
      preferences: { enabled: true, appContext: true }
    });

    const serialized = JSON.stringify(context);
    const sizeInBytes = new TextEncoder().encode(serialized).length;

    expect(sizeInBytes).toBeLessThan(2048);
    expect(sizeInBytes).toBeLessThan(500); // Standard snapshot is typically < 300 bytes
  });

  it('integrates seamlessly with useVibiAssistant().getContext()', () => {
    const wrapper = ({ children }) => (
      <VibiAssistantProvider>
        {children}
      </VibiAssistantProvider>
    );

    const { result } = renderHook(() => useVibiAssistant(), { wrapper });

    vibiContextService.setActiveTab('notifications');

    let ctx;
    act(() => {
      ctx = result.current.getContext({ username: 'alex', full_name: 'Alex Rivera' });
    });

    expect(ctx.screen).toBe('notifications');
    expect(ctx.user.username).toBe('alex');
    expect(ctx.user.displayName).toBe('Alex Rivera');
    expect(ctx.appContextEnabled).toBe(true);
  });
});
