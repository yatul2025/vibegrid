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
import vibiContextService from '../../services/vibiContextService';
import navigationService from '../../services/navigationService';
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
  const [pendingConfirmation, setPendingConfirmation] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const isMountedRef = useRef(true);
  const responseTimerRef = useRef(null);
  const lastSendTimeRef = useRef(0);
  const isSubmittingRef = useRef(false);

  // Auto-scroll to bottom on new messages or typing state change
  useEffect(() => {
    if (typeof messagesEndRef.current?.scrollIntoView === 'function') {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isTyping, pendingConfirmation]);

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

  const handleClearConversation = () => {
    clearConversation();
    vibiContextService.clearHistory();
  };

  const handleConfirmAction = async () => {
    if (!pendingConfirmation) return;
    const { actionId, params, msgId } = pendingConfirmation;
    setPendingConfirmation(null);

    const context = typeof getContext === 'function' ? getContext(user) : {};
    const actionCallbacks = {
      onClearChat: () => handleClearConversation(),
      onOpenModal: (modal) => {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('vibegrid:open-modal', { detail: { modal } }));
        }
      },
      onToggleTheme: (theme) => {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('vibegrid:set-theme', { detail: { theme } }));
        }
      },
      onNavigate: (tab, section) => {
        if (navigationService && typeof navigationService.navigate === 'function') {
          navigationService.navigate(tab, { section });
        }
      }
    };

    try {
      const res = await vibiIntentEngine.executeAction(
        actionId,
        params || {},
        context,
        actionCallbacks,
        user?.username,
        { confirmed: true }
      );
      vibiCharacterService.success({ preferences });
      addMessage({
        sender: 'vibi',
        text: res.message || res.replyText || 'Action confirmed and executed! 🦊✨'
      });
      if (msgId && typeof updateMessage === 'function') {
        updateMessage(msgId, { actionResult: res });
      }
    } catch (err) {
      vibiCharacterService.error({ preferences });
      addMessage({
        sender: 'vibi',
        text: `Action could not be executed: ${err.message || 'Unknown error'} ⚠️`
      });
    }
  };

  const handleCancelAction = () => {
    setPendingConfirmation(null);
    vibiCharacterService.idle({ preferences });
    addMessage({
      sender: 'vibi',
      text: 'Action cancelled. 🦊'
    });
  };

  const handleSend = (textToSend = null) => {
    const prompt = (textToSend !== null ? textToSend : inputVal).trim();
    if (!prompt) return;

    // Prevent duplicate rapid submissions within 800ms
    const now = Date.now();
    if (now - lastSendTimeRef.current < 800 && prompt === lastPrompt) {
      return;
    }
    if (isTyping || isSubmittingRef.current || pendingConfirmation) {
      return;
    }
    lastSendTimeRef.current = now;
    isSubmittingRef.current = true;

    setErrorMessage(null);
    setLastPrompt(prompt);
    setInputVal('');

    // Phase 9 Security Guard: Check prompt safety before dispatching
    const safetyCheck = vibiSecurityGuard.checkPromptSafety(prompt, user?.username || 'anonymous');
    if (!safetyCheck.safe) {
      isSubmittingRef.current = false;
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
    vibiContextService.recordTurn('user', prompt);
    addMessage({
      sender: 'user',
      text: prompt,
      status: 'complete'
    });

    vibiCharacterService.think({ preferences });
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
          if (intent.isClarification) {
            vibiContextService.setLastClarification(intent.clarificationKey);
            if (intent.topic) vibiContextService.setRecentTopic(intent.topic);
          } else {
            vibiContextService.clearClarification();
            if (intent.topic) vibiContextService.setRecentTopic(intent.topic);
          }
          vibiContextService.recordTurn('vibi', intent.replyText, intent.topic || null);

          const msgObj = addMessage({
            sender: 'vibi',
            text: intent.replyText || "Action completed! 🦊✨",
            status: 'complete',
            responseType: intent.responseType || 'SHORT',
            topic: intent.topic || null,
            action: intent.actionId ? { id: intent.actionId, params: intent.params } : null
          });
          if (isMountedRef.current && setIsTyping) setIsTyping(false);

          vibiCharacterService.responding({ preferences });

          const actionCallbacks = {
            onClearChat: () => handleClearConversation(),
            onOpenModal: (modal) => {
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('vibegrid:open-modal', { detail: { modal } }));
              }
            },
            onToggleTheme: (theme) => {
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('vibegrid:set-theme', { detail: { theme } }));
              }
            },
            onNavigate: (tab, section) => {
              if (navigationService && typeof navigationService.navigate === 'function') {
                navigationService.navigate(tab, { section });
              }
            }
          };

          vibiIntentEngine.executeIntent(
            intent,
            context,
            actionCallbacks,
            user?.username
          ).then((res) => {
            if (res?.requiresConfirmation) {
              setPendingConfirmation({
                actionId: res.actionId,
                params: res.sanitizedParams,
                actionName: res.actionName,
                description: res.description,
                msgId: msgObj.id
              });
              vibiCharacterService.attentive({ preferences });
              return;
            }
            vibiCharacterService.proud({ preferences });
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
          vibiCharacterService.responding({ preferences });

          const aiResult = await vibiAiClient.sendChatMessage(prompt, {
            ...context,
            user
          });

          if (!isMountedRef.current) return;

          vibiContextService.clearClarification();
          if (aiResult.topic) vibiContextService.setRecentTopic(aiResult.topic);
          vibiContextService.recordTurn('vibi', aiResult.replyText, aiResult.topic || null);

          // If AI proposed a validated action, verify confirmation requirement
          if (aiResult.actionProposal) {
            const { id, params, pendingConfirmation: needsConfirm, actionDef } = aiResult.actionProposal;
            if (needsConfirm) {
              setPendingConfirmation({
                actionId: id,
                params,
                actionName: actionDef?.name || id,
                description: actionDef?.description || `Do you want Vibi to execute ${actionDef?.name || id}?`,
                msgId: null
              });
              vibiCharacterService.attentive({ preferences });
            } else {
              const actionCallbacks = {
                onClearChat: () => handleClearConversation(),
                onOpenModal: (modal) => {
                  if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('vibegrid:open-modal', { detail: { modal } }));
                  }
                },
                onToggleTheme: (theme) => {
                  if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('vibegrid:set-theme', { detail: { theme } }));
                  }
                },
                onNavigate: (tab, section) => {
                  if (navigationService && typeof navigationService.navigate === 'function') {
                    navigationService.navigate(tab, { section });
                  }
                }
              };
              await vibiIntentEngine.executeAction(
                id,
                params,
                context,
                actionCallbacks,
                user?.username
              );
            }
          }

          if (!isMountedRef.current) return;
          
          // Detect if AI gave an unsure / unhandled answer
          const replyLower = (aiResult.replyText || '').toLowerCase();
          const isUnsure = replyLower.includes("i'm not sure") || replyLower.includes("don't understand") || replyLower.includes("couldn't find");
          if (isUnsure) {
            vibiCharacterService.confused({ preferences });
          } else {
            vibiCharacterService.happy({ preferences });
          }

          addMessage({
            sender: 'vibi',
            text: aiResult.replyText,
            responseType: aiResult.responseType || 'NORMAL',
            topic: aiResult.topic || null,
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
        isSubmittingRef.current = false;
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
  const activeTab = currentContext?.currentTab || currentContext?.screen || 'feed';
  const activeSection = currentContext?.activeSection || null;
  const activeModal = currentContext?.activeModal || (currentContext?.subScreen !== 'none' ? currentContext?.subScreen : null);
  const screenSuggestions = vibiProactiveService.getScreenSuggestions(activeTab, activeSection, activeModal);

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
                  {!isUser && <VibiAvatar size={28} mood={msg.mood || 'happy'} className="vibi-msg-avatar" />}
                  <div className={`vibi-bubble ${isUser ? 'user-bubble' : 'vibi-bubble'}`}>
                    <p className="vibi-bubble-content">
                      {msg.text}
                      {msg.status === 'streaming' && (
                        <span className="vibi-streaming-cursor" aria-hidden="true">▍</span>
                      )}
                    </p>

                    {/* Quick Interactive Actions */}
                    {msg.actions && msg.actions.length > 0 && (
                      <div className="vibi-quick-actions-list" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                        {msg.actions.map((act, actIdx) => (
                          <button
                            key={actIdx}
                            type="button"
                            className="vibi-suggestion-pill"
                            onClick={async () => {
                              vibiCharacterService.proud({ durationMs: 2000, preferences });
                              const res = await vibiIntentEngine.executeAction(
                                act.id || act.actionId,
                                act.params || {},
                                currentContext,
                                {
                                  onClearChat: () => handleClearConversation(),
                                  onOpenModal: (modal) => {
                                    if (typeof window !== 'undefined') {
                                      window.dispatchEvent(new CustomEvent('vibegrid:open-modal', { detail: { modal } }));
                                    }
                                  },
                                  onToggleTheme: (theme) => {
                                    if (typeof window !== 'undefined') {
                                      window.dispatchEvent(new CustomEvent('vibegrid:set-theme', { detail: { theme } }));
                                    }
                                  },
                                  onNavigate: (tab, section) => {
                                    if (navigationService && typeof navigationService.navigate === 'function') {
                                      navigationService.navigate(tab, { section });
                                    }
                                  }
                                },
                                user?.username
                              );
                              if (res) {
                                addMessage({
                                  sender: 'vibi',
                                  text: res.message || res.replyText || 'Action executed successfully! 🦊'
                                });
                              }
                            }}
                          >
                            <Sparkles size={12} className="vibi-sug-icon" />
                            <span>{act.label || act.name || act.id}</span>
                          </button>
                        ))}
                      </div>
                    )}

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
                <VibiAvatar size={28} mood="thinking" className="vibi-msg-avatar" />
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

            {/* Interactive Confirmation Card (Phase 1 Reliability) */}
            {pendingConfirmation && (
              <div className="vibi-confirmation-card" data-testid="vibi-confirmation-card">
                <div className="vibi-confirmation-header">
                  <AlertCircle size={18} className="vibi-confirmation-icon" />
                  <span className="vibi-confirmation-title">Confirmation Required</span>
                </div>
                <p className="vibi-confirmation-desc">
                  {pendingConfirmation.description || `Do you want Vibi to execute "${pendingConfirmation.actionName || pendingConfirmation.actionId}"?`}
                </p>
                <div className="vibi-confirmation-buttons">
                  <button
                    type="button"
                    className="vibi-btn-confirm"
                    onClick={handleConfirmAction}
                    data-testid="vibi-confirm-btn"
                  >
                    Confirm & Execute
                  </button>
                  <button
                    type="button"
                    className="vibi-btn-cancel"
                    onClick={handleCancelAction}
                    data-testid="vibi-cancel-btn"
                  >
                    Cancel
                  </button>
                </div>
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
              onClick={handleClearConversation}
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
            disabled={isTyping || Boolean(pendingConfirmation)}
            aria-label="Message Vibi"
          />
          <button
            type="submit"
            className="vibi-send-btn"
            disabled={!inputVal.trim() || isTyping || Boolean(pendingConfirmation)}
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
