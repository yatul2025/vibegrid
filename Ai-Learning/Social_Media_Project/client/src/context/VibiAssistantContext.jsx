/**
 * client/src/context/VibiAssistantContext.jsx
 * ============================================
 * VIBGRID — VIBI AI ASSISTANT: PHASE 1 CORE FOUNDATION
 *
 * Provides:
 * - VibiAssistantContext & useVibiAssistant hook
 * - Vibi State Manager (isOpen, isMinimized, mode, messages, isTyping, activeAction)
 * - Vibi Preferences Manager (Master enabled toggle & individual options with persistence)
 * - Vibi Session Lifecycle (open/close/minimize/toggle)
 * - Safe navigationService back-interceptor integration (priority 25)
 * - Master OFF enforcement (Vibi OFF means Vibi OFF ONLY)
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import navigationService from '../services/navigationService';
import vibiContextService from '../services/vibiContextService';
import vibiProactiveService from '../services/vibiProactiveService';
import vibiCharacterService, { VIBI_STATES } from '../services/vibiCharacterService';

export const VIBI_PREFERENCES_STORAGE_KEY = 'vibegrid_vibi_preferences';

export const DEFAULT_VIBI_PREFERENCES = Object.freeze({
  enabled: true,          // Master Control: Vibi Assistant ON/OFF
  welcome: true,          // Vibi Welcome Experience ON/OFF
  floatingButton: true,   // Vibi Floating Action Button (FAB) ON/OFF
  smartSuggestions: true, // Smart Contextual Suggestions ON/OFF
  appContext: true,       // App Context Reading ON/OFF
  notifications: true,    // Vibi Specific Notifications ON/OFF
  animations: true,       // Vibi Animations & Delight Effects ON/OFF
});

const VibiAssistantContext = createContext(null);

export function VibiAssistantProvider({ children }) {
  // 1. Preferences with safe localStorage hydration
  const [preferences, setPreferences] = useState(() => {
    try {
      const stored = localStorage.getItem(VIBI_PREFERENCES_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return { ...DEFAULT_VIBI_PREFERENCES, ...parsed };
      }
    } catch (e) {
      console.warn('[VibiContext] Failed to parse stored preferences, using defaults', e);
    }
    return DEFAULT_VIBI_PREFERENCES;
  });

  // 2. Session & UI State
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [mode, setMode] = useState('chat'); // 'chat' | 'suggestions' | 'help'
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [activeAction, setActiveAction] = useState(null);
  const [activeSuggestion, setActiveSuggestion] = useState(null);
  const [characterState, setCharacterState] = useState(() => vibiCharacterService.getState());

  const preferencesRef = useRef(preferences);
  useEffect(() => {
    preferencesRef.current = preferences;
  }, [preferences]);

  // Sync character state updates from character service
  useEffect(() => {
    const unsub = vibiCharacterService.subscribe((state) => {
      setCharacterState(state);
    });
    return unsub;
  }, []);

  // Initialize ambient character activity watchers and system event listeners
  useEffect(() => {
    if (!preferences.enabled || preferences.animations === false) {
      vibiCharacterService.idle();
      return;
    }
    const cleanup = vibiCharacterService.initActivityWatchers(preferences);
    return cleanup;
  }, [preferences.enabled, preferences.animations, preferences.welcome]);

  // Transition character state automatically when AI is typing
  const prevTypingRef = useRef(isTyping);
  useEffect(() => {
    if (isTyping) {
      vibiCharacterService.think({ preferences: preferencesRef.current });
    } else if (prevTypingRef.current && !isTyping) {
      vibiCharacterService.happy({ durationMs: 1600, preferences: preferencesRef.current });
    }
    prevTypingRef.current = isTyping;
  }, [isTyping]);

  // Sync preference updates across browser tabs/windows
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === VIBI_PREFERENCES_STORAGE_KEY && e.newValue) {
        try {
          const updated = JSON.parse(e.newValue);
          setPreferences((prev) => ({ ...prev, ...updated }));
        } catch {
          // ignore corrupted data from another tab
        }
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // MASTER OFF RULE: If master switch or suggestions is turned OFF, immediately clean up
  useEffect(() => {
    if (!preferences.enabled) {
      setIsOpen(false);
      setIsMinimized(false);
      setIsTyping(false);
      setActiveAction(null);
      setActiveSuggestion(null);
      vibiCharacterService.idle();
    } else if (!preferences.smartSuggestions) {
      setActiveSuggestion(null);
    }
  }, [preferences.enabled, preferences.smartSuggestions]);

  // Update preferences helper
  const updatePreferences = useCallback((partial) => {
    setPreferences((prev) => {
      const next = { ...prev, ...partial };
      try {
        localStorage.setItem(VIBI_PREFERENCES_STORAGE_KEY, JSON.stringify(next));
      } catch (err) {
        console.warn('[VibiContext] Failed to persist preferences', err);
      }
      return next;
    });
  }, []);

  // Reset preferences helper
  const resetPreferences = useCallback(() => {
    try {
      localStorage.setItem(VIBI_PREFERENCES_STORAGE_KEY, JSON.stringify(DEFAULT_VIBI_PREFERENCES));
    } catch (err) {
      console.warn('[VibiContext] Failed to reset preferences', err);
    }
    setPreferences(DEFAULT_VIBI_PREFERENCES);
  }, []);

  // Trigger character reaction helper
  const triggerReaction = useCallback((state, options = {}) => {
    return vibiCharacterService.setState(state, {
      preferences: preferencesRef.current,
      ...options
    });
  }, []);

  // Close assistant
  const closeAssistant = useCallback(() => {
    setIsOpen(false);
    setIsMinimized(false);
    setActiveAction(null);
    vibiCharacterService.idle();
  }, []);

  // Open assistant
  const openAssistant = useCallback(({ mode: targetMode = 'chat', initialPrompt = null } = {}) => {
    if (!preferencesRef.current.enabled) {
      console.info('[VibiContext] Vibi is currently disabled by user preferences');
      return false;
    }
    setMode(targetMode);
    setIsMinimized(false);
    setIsOpen(true);
    setActiveSuggestion(null);

    if (preferencesRef.current.animations !== false) {
      vibiCharacterService.welcome({ force: true, preferences: preferencesRef.current });
    }

    if (initialPrompt && typeof initialPrompt === 'string' && initialPrompt.trim()) {
      setMessages((prev) => [
        ...prev,
        {
          id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          sender: 'user',
          text: initialPrompt.trim(),
          timestamp: Date.now(),
          status: 'complete',
          action: null
        }
      ]);
    }
    return true;
  }, []);

  // Minimize assistant to dock/bubble
  const minimizeAssistant = useCallback(() => {
    setIsMinimized(true);
  }, []);

  // Restore assistant from minimized state
  const restoreAssistant = useCallback(() => {
    setIsMinimized(false);
    setIsOpen(true);
  }, []);

  // Toggle assistant state
  const toggleAssistant = useCallback(() => {
    if (isOpen) {
      closeAssistant();
    } else {
      openAssistant();
    }
  }, [isOpen, closeAssistant, openAssistant]);

  // Clear conversation history
  const clearConversation = useCallback(() => {
    setMessages([]);
    setIsTyping(false);
    setActiveAction(null);
  }, []);

  // Add a message into the conversation state
  const addMessage = useCallback(({ sender = 'vibi', text, action = null, status = 'complete', ...rest }) => {
    const newMessage = {
      id: `${sender}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      sender,
      text,
      timestamp: Date.now(),
      status,
      action,
      ...rest
    };
    setMessages((prev) => [...prev, newMessage]);
    return newMessage;
  }, []);

  // Update a message in conversation state
  const updateMessage = useCallback((id, partial) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, ...partial } : m))
    );
  }, []);

  // 3. Navigation Interceptor: Dismiss on Android / Browser back button or Escape
  useEffect(() => {
    if (!isOpen || isMinimized) return;

    const unregister = navigationService.registerBackInterceptor('vibi-assistant-panel', () => {
      closeAssistant();
      return true; // handled
    }, 25); // Priority 25: Closes before navigating away from tabs

    return () => {
      if (typeof unregister === 'function') unregister();
    };
  }, [isOpen, isMinimized, closeAssistant]);

  // 4. Keyboard Escape key dismiss
  useEffect(() => {
    if (!isOpen || isMinimized) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        closeAssistant();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isMinimized, closeAssistant]);

  // 5. Context Engine Integration (Phase 4)
  const getContext = useCallback((user) => {
    return vibiContextService.assembleContext({
      user,
      preferences: preferencesRef.current
    });
  }, []);

  // 6. Proactive Suggestions (Phase 7)
  const dismissSuggestion = useCallback((id) => {
    vibiProactiveService.dismissHint(id);
    setActiveSuggestion(null);
  }, []);

  const acceptSuggestion = useCallback((suggestion) => {
    if (!suggestion) return;
    vibiProactiveService.recordEngaged();
    setActiveSuggestion(null);

    if (suggestion.action) {
      const { id, params } = suggestion.action;
      if (id === 'navigate' && params?.tab) {
        navigationService.navigate(params.tab, { section: params.section || null });
      }
    } else if (suggestion.prompt) {
      openAssistant({ initialPrompt: suggestion.prompt });
    } else {
      openAssistant();
    }
  }, [openAssistant]);

  const triggerSuggestion = useCallback((suggestion) => {
    if (!preferencesRef.current.enabled || !preferencesRef.current.smartSuggestions) {
      return false;
    }
    vibiProactiveService.recordShown(suggestion?.id);
    setActiveSuggestion(suggestion);
    return true;
  }, []);

  const evaluateSuggestions = useCallback((contextOverride = {}) => {
    if (!preferencesRef.current.enabled || !preferencesRef.current.smartSuggestions) {
      setActiveSuggestion(null);
      return null;
    }
    const snapshot = {
      ...vibiContextService.getContextSnapshot(),
      ...contextOverride
    };
    const hint = vibiProactiveService.evaluateProactiveHint(snapshot, preferencesRef.current);
    if (hint) {
      vibiProactiveService.recordShown(hint.id);
      setActiveSuggestion(hint);
    }
    return hint;
  }, []);

  const value = useMemo(() => ({
    // State
    isEnabled: preferences.enabled,
    preferences,
    isOpen,
    isMinimized,
    mode,
    messages,
    isTyping,
    activeAction,
    activeSuggestion,
    characterState,

    // Actions & Handlers
    openAssistant,
    closeAssistant,
    minimizeAssistant,
    restoreAssistant,
    toggleAssistant,
    updatePreferences,
    resetPreferences,
    clearConversation,
    addMessage,
    updateMessage,
    setMessages,
    setIsTyping,
    setActiveAction,
    setMode,
    getContext,
    dismissSuggestion,
    acceptSuggestion,
    triggerSuggestion,
    evaluateSuggestions,
    triggerReaction,
    setCharacterState
  }), [
    preferences,
    isOpen,
    isMinimized,
    mode,
    messages,
    isTyping,
    activeAction,
    activeSuggestion,
    characterState,
    openAssistant,
    closeAssistant,
    minimizeAssistant,
    restoreAssistant,
    toggleAssistant,
    updatePreferences,
    resetPreferences,
    clearConversation,
    addMessage,
    updateMessage,
    getContext,
    dismissSuggestion,
    acceptSuggestion,
    triggerSuggestion,
    evaluateSuggestions,
    triggerReaction
  ]);

  return (
    <VibiAssistantContext.Provider value={value}>
      {children}
    </VibiAssistantContext.Provider>
  );
}

export function useVibiAssistant() {
  const context = useContext(VibiAssistantContext);
  if (!context) {
    // Return safe fallback object if used outside provider so app doesn't crash
    return {
      isEnabled: true,
      preferences: DEFAULT_VIBI_PREFERENCES,
      isOpen: false,
      isMinimized: false,
      mode: 'chat',
      messages: [],
      isTyping: false,
      activeAction: null,
      activeSuggestion: null,
      characterState: 'idle',
      openAssistant: () => false,
      closeAssistant: () => {},
      minimizeAssistant: () => {},
      restoreAssistant: () => {},
      toggleAssistant: () => {},
      updatePreferences: () => {},
      resetPreferences: () => {},
      clearConversation: () => {},
      addMessage: () => null,
      updateMessage: () => {},
      setMessages: () => {},
      setIsTyping: () => {},
      setActiveAction: () => {},
      setMode: () => {},
      getContext: () => ({ status: 'dormant', reason: 'no_provider', appContextEnabled: false }),
      dismissSuggestion: () => {},
      acceptSuggestion: () => {},
      triggerSuggestion: () => false,
      evaluateSuggestions: () => null,
      triggerReaction: () => false,
      setCharacterState: () => {}
    };
  }
  return context;
}

export default VibiAssistantContext;
