/**
 * client/src/components/vibi/VibiConversation.jsx
 * ================================================
 * VIBGRID — VIBI AI ASSISTANT: PHASE 2 UI FOUNDATION
 *
 * Conversation interface containing:
 * - Empty state with quick suggestion chips
 * - Message thread (User bubbles vs Vibi responses)
 * - Skeleton shimmer loading state (reusing VibeGrid skeleton patterns)
 * - Streaming typing cursor indicator
 * - Error message with Retry action
 * - Composer with send button and keyboard accessibility
 */

import React, { useState, useRef, useEffect, useContext } from 'react';
import { useVibiAssistant } from '../../context/VibiAssistantContext';
import AuthContext from '../../context/AuthContext';
import vibiIntentEngine from '../../services/vibiIntentEngine';
import vibiAiClient from '../../services/vibiAiClient';
import vibiActionRegistry from '../../services/vibiActionRegistry';
import vibiProactiveService from '../../services/vibiProactiveService';
import vibiSecurityGuard from '../../services/vibiSecurityGuard';
import vibiCharacterService from '../../services/vibiCharacterService';
import VibiAvatar from './VibiAvatar';
import VibiTroubleshootingCard from './VibiTroubleshootingCard';
import { Send, RefreshCw, Trash2, Sparkles, AlertCircle } from 'lucide-react';

export default function VibiConversation() {
  const authContext = useContext(AuthContext);
  const user = authContext?.user || null;
  const {
    messages,
    setMessages,
    isTyping,
    setIsTyping,
    addMessage,
    updateMessage,
    clearConversation,
    preferences,
    getContext,
    characterState = 'idle'
  } = useVibiAssistant();

  const [inputVal, setInputVal] = useState('');
  const [errorMessage, setErrorMessage] = useState(null);
  const [lastPrompt, setLastPrompt] = useState('');
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const isMountedRef = useRef(true);
  const responseTimerRef = useRef(null);

  // Auto-scroll to bottom on new messages or typing state change
  useEffect(() => {
    if (typeof messagesEndRef.current?.scrollIntoView === 'function') {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isTyping]);

  // Focus input when opened and cleanup timers on unmount
  useEffect(() => {
    isMountedRef.current = true;
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 150);
    return () => {
      isMountedRef.current = false;
      clearTimeout(timer);
      if (responseTimerRef.current) {
        clearTimeout(responseTimerRef.current);
      }
    };
  }, []);

  // Phase 9 Privacy Hardening: Auto-prune local conversation items older than 30 days
  useEffect(() => {
    if (messages && messages.length > 0 && typeof setMessages === 'function') {
      const { prunedMessages, prunedCount } = vibiSecurityGuard.pruneOldConversations(messages, 30);
      if (prunedCount > 0) {
        setMessages(prunedMessages);
      }
    }
  }, []);

  const handleSend = (textToSend = null) => {
    const prompt = (textToSend !== null ? textToSend : inputVal).trim();
    if (!prompt) return;

    setErrorMessage(null);
    setLastPrompt(prompt);
    setInputVal('');

    // Phase 9 Security Guard: Check prompt safety before dispatching
    const safetyCheck = vibiSecurityGuard.checkPromptSafety(prompt, user?.username || 'anonymous');
    if (!safetyCheck.safe) {
      addMessage({
        sender: 'user',
        text: prompt,
        status: 'complete'
      });
      addMessage({
        sender: 'vibi',
        text: safetyCheck.friendlyReply || "I'm Vibi, your VibeGrid assistant! I can only help with VibeGrid navigation, settings, and features. I cannot override system safety guidelines, execute code, or disclose private credentials. 🦊🛡️",
        status: 'complete'
      });
      return;
    }

    // Add user message to conversation
    addMessage({
      sender: 'user',
      text: prompt,
      status: 'complete'
    });

    vibiCharacterService.listen({ preferences });
    if (setIsTyping) setIsTyping(true);

    if (responseTimerRef.current) {
      clearTimeout(responseTimerRef.current);
    }

    responseTimerRef.current = setTimeout(async () => {
      try {
        if (!isMountedRef.current) return;
        const context = typeof getContext === 'function' ? getContext(user) : {};
        const intent = vibiIntentEngine.detectIntent(prompt, context);

        if (intent.matched) {
          if (!isMountedRef.current) return;
          const msgObj = addMessage({
            sender: 'vibi',
            text: intent.replyText || "Action completed! 🦊✨",
            status: 'complete',
            action: intent.actionId ? { id: intent.actionId, params: intent.params } : null
          });
          if (isMountedRef.current && setIsTyping) setIsTyping(false);

          vibiIntentEngine.executeIntent(
            intent,
            context,
            {
              onClearChat: () => clearConversation()
            },
            user?.username
          ).then((res) => {
            vibiCharacterService.celebrate({ preferences });
            if (res && isMountedRef.current && typeof updateMessage === 'function') {
              updateMessage(msgObj.id, { actionResult: res });
            }
          }).catch((err) => {
            vibiCharacterService.concerned({ preferences });
            console.error('[Vibi] Failed executing matched action:', err);
          });
          return;
        } else {
          // Complex / Conversational query: Route to AI Engine
          const aiResult = await vibiAiClient.sendChatMessage(prompt, {
            ...context,
            user
          });

          if (!isMountedRef.current) return;

          // If AI proposed a validated action, execute it safely
          if (aiResult.actionProposal) {
            const { id, params } = aiResult.actionProposal;
            await vibiIntentEngine.executeAction(
              id,
              params,
              context,
              { onClearChat: () => clearConversation() },
              user?.username
            );
          }

          if (!isMountedRef.current) return;
          vibiCharacterService.happy({ preferences });
          addMessage({
            sender: 'vibi',
            text: aiResult.replyText,
            status: 'complete'
          });
        }
      } catch (err) {
        vibiCharacterService.concerned({ preferences });
        if (isMountedRef.current) {
          setErrorMessage(err.message || 'Something went wrong processing your request.');
          addMessage({
            sender: 'vibi',
            text: `Oops! I couldn't complete that: ${err.message || 'Unknown error'}. 🦊⚠️`,
            status: 'error'
          });
        }
      } finally {
        if (isMountedRef.current && setIsTyping) {
          setIsTyping(false);
        }
      }
    }, 250);
  };

  const handleRetry = () => {
    if (lastPrompt) {
      setErrorMessage(null);
      handleSend(lastPrompt);
    }
  };

  const handleSuggestionClick = (prompt) => {
    handleSend(prompt);
  };

  const currentContext = typeof getContext === 'function' ? getContext(user) : {};
  const activeTab = currentContext?.currentTab || 'feed';
  const screenSuggestions = vibiProactiveService.getScreenSuggestions(activeTab);

  return (
    <div className="vibi-conversation-container" data-testid="vibi-conversation">
      {/* Messages Scroll Area */}
      <div className="vibi-messages-viewport" role="log" aria-live="polite">
        {messages.length === 0 ? (
          <div className="vibi-empty-thread" data-testid="vibi-empty-thread">
            <VibiAvatar size={64} mood={characterState} withStatusDot={true} />
            <h3 className="vibi-empty-thread-title">Hi, I'm Vibi! 🦊</h3>
            <p className="vibi-empty-thread-subtitle">
              Your native VibeGrid AI companion. Ask me questions, navigate anywhere, or explore features!
            </p>

            {preferences.smartSuggestions && (
              <div className="vibi-suggestion-grid">
                {screenSuggestions.map((sug, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className="vibi-suggestion-pill"
                    onClick={() => handleSuggestionClick(sug.prompt)}
                  >
                    <Sparkles size={12} className="vibi-sug-icon" />
                    <span>{sug.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="vibi-messages-list">
            {messages.map((msg) => {
              const isUser = msg.sender === 'user';
              return (
                <div
                  key={msg.id}
                  className={`vibi-message-row ${isUser ? 'user-row' : 'vibi-row'}`}
                  data-testid={`vibi-message-${msg.id}`}
                >
                  {!isUser && <VibiAvatar size={28} className="vibi-msg-avatar" />}
                  <div className={`vibi-bubble ${isUser ? 'user-bubble' : 'vibi-bubble'}`}>
                    <p className="vibi-bubble-content">
                      {msg.text}
                      {msg.status === 'streaming' && (
                        <span className="vibi-streaming-cursor" aria-hidden="true">▍</span>
                      )}
                    </p>
                    {msg.action?.id === 'run_diagnostics' && (
                      <VibiTroubleshootingCard
                        diagnosticData={msg.actionResult}
                        onActionComplete={(actionId, res) => {
                          addMessage({
                            sender: 'vibi',
                            text: res.message || 'Action executed successfully! 🦊'
                          });
                        }}
                      />
                    )}
                    <span className="vibi-bubble-timestamp">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              );
            })}

            {/* Shimmer Skeleton Loading State when isTyping */}
            {isTyping && (
              <div className="vibi-message-row vibi-row loading-row" data-testid="vibi-loading-state">
                <VibiAvatar size={28} className="vibi-msg-avatar" />
                <div className="vibi-bubble vibi-bubble vibi-loading-bubble">
                  <div className="vg-skeleton-line shimmer" style={{ width: '140px', height: '12px', marginBottom: '6px' }} />
                  <div className="vg-skeleton-line shimmer" style={{ width: '90px', height: '12px' }} />
                </div>
              </div>
            )}

            {/* Error & Retry State */}
            {errorMessage && (
              <div className="vibi-error-banner" role="alert" data-testid="vibi-error-state">
                <AlertCircle size={16} className="vibi-error-icon" />
                <span className="vibi-error-text">{errorMessage}</span>
                <button type="button" className="vibi-retry-btn" onClick={handleRetry}>
                  <RefreshCw size={13} />
                  <span>Retry</span>
                </button>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Footer Controls & Composer */}
      <div className="vibi-composer-wrapper">
        {messages.length > 0 && (
          <div className="vibi-thread-actions-bar">
            <button
              type="button"
              className="vibi-clear-thread-btn"
              onClick={clearConversation}
              title="Clear conversation"
              aria-label="Clear conversation history"
            >
              <Trash2 size={13} />
              <span>Clear Chat</span>
            </button>
          </div>
        )}

        <form
          className="vibi-input-form"
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
        >
          <input
            ref={inputRef}
            type="text"
            className="vibi-text-input"
            placeholder="Ask Vibi anything..."
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            disabled={isTyping}
            aria-label="Message Vibi"
          />
          <button
            type="submit"
            className="vibi-send-btn"
            disabled={!inputVal.trim() || isTyping}
            aria-label="Send message"
            data-testid="vibi-send-btn"
          >
            <Send size={16} />
          </button>
        </form>
      </div>
    </div>
  );
}
