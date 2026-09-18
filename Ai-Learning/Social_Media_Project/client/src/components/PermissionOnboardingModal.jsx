/**
 * client/src/components/PermissionOnboardingModal.jsx
 * ===================================================
 * VibeGrid Guided First-Login & Cleared-Data Permission Modal
 * 
 * Features:
 * 1. Step-by-step guided flow: Welcome -> Notifications -> Microphone -> Camera -> Photos -> Summary.
 * 2. Genuinely used permissions only with transparent explanations prior to browser prompts.
 * 3. Platform-aware (handles iOS Safari tab vs iOS PWA vs Android/Desktop).
 * 4. Immediate hardware stream release after permission verification.
 * 5. Non-blocking: skipped or denied permissions still allow full app entry.
 * 6. Dual persistence: records completion in localStorage and database.
 */

import React, { useState, useEffect, useRef } from 'react';
import permissionService from '../services/permissionService';
import { getDefaultAvatar, isDefaultAvatar } from '../utils/avatar';

export default function PermissionOnboardingModal({
  user,
  isOpen = true,
  onClose,
  onComplete,
  isManualRecheck = false
}) {
  const [currentStep, setCurrentStep] = useState(1);
  const [totalSteps] = useState(6);
  const [isProcessing, setIsProcessing] = useState(false);

  // Live Permission Statuses
  const [notifStatus, setNotifStatus] = useState('default');
  const [micStatus, setMicStatus] = useState('unknown');
  const [camStatus, setCamStatus] = useState('unknown');
  const [isIosSafari, setIsIosSafari] = useState(false);
  const [statusFeedback, setStatusFeedback] = useState(null);

  const modalOpenedAtRef = useRef(Date.now());

  // Load live device status on modal open
  useEffect(() => {
    let isMounted = true;
    modalOpenedAtRef.current = Date.now();

    async function loadStatus() {
      const live = await permissionService.getLivePermissionState();
      if (!isMounted) return;
      setNotifStatus(live.notifications);
      setMicStatus(live.microphone);
      setCamStatus(live.camera);
      setIsIosSafari(live.isIosSafari);
    }
    loadStatus();
    return () => { isMounted = false; };
  }, []);

  if (!isOpen || !user) return null;

  const handleNext = () => {
    setStatusFeedback(null);
    if (currentStep < totalSteps) {
      setCurrentStep((prev) => prev + 1);
    } else {
      handleFinish();
    }
  };

  const handleSkip = () => {
    setStatusFeedback(null);
    if (currentStep < totalSteps) {
      setCurrentStep((prev) => prev + 1);
    } else {
      handleFinish();
    }
  };

  const handleFinish = async () => {
    setIsProcessing(true);
    try {
      await permissionService.markOnboardingCompleted(user.id);
    } catch (e) {
      console.warn('[Onboarding] Error marking complete:', e);
    } finally {
      setIsProcessing(false);
      if (onComplete) onComplete();
      if (onClose) onClose();
    }
  };

  const handleRequestNotifications = async () => {
    setIsProcessing(true);
    setStatusFeedback(null);
    try {
      const res = await permissionService.requestNotificationAndPush();
      if (res.granted) {
        setNotifStatus('granted');
        setStatusFeedback({ type: 'success', text: '✅ Notifications enabled! Background calls and alerts are active.' });
        setTimeout(handleNext, 900);
      } else if (res.denied) {
        setNotifStatus('denied');
        setStatusFeedback({ type: 'warn', text: '⚠️ Notifications were blocked. You can still enable them later in your browser settings.' });
      } else {
        setStatusFeedback({ type: 'info', text: 'Notifications not enabled. You can enable them anytime in Settings.' });
      }
    } catch (err) {
      setStatusFeedback({ type: 'error', text: err.message || 'Failed to request notification permission.' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRequestMicrophone = async () => {
    setIsProcessing(true);
    setStatusFeedback(null);
    try {
      const res = await permissionService.requestMicrophonePermission();
      if (res.granted) {
        setMicStatus('granted');
        setStatusFeedback({ type: 'success', text: '✅ Microphone access granted! Voice notes and audio calls are ready.' });
        setTimeout(handleNext, 900);
      } else {
        setMicStatus('denied');
        setStatusFeedback({ type: 'warn', text: '⚠️ Microphone access was denied. Voice features will be disabled until allowed in browser settings.' });
      }
    } catch (err) {
      setStatusFeedback({ type: 'error', text: err.message || 'Failed to request microphone.' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRequestCamera = async () => {
    setIsProcessing(true);
    setStatusFeedback(null);
    try {
      const res = await permissionService.requestCameraPermission();
      if (res.granted) {
        setCamStatus('granted');
        setStatusFeedback({ type: 'success', text: '✅ Camera access granted! Video calls are ready.' });
        setTimeout(handleNext, 900);
      } else {
        setCamStatus('denied');
        setStatusFeedback({ type: 'warn', text: '⚠️ Camera access was denied. Video calling will be disabled until allowed in browser settings.' });
      }
    } catch (err) {
      setStatusFeedback({ type: 'error', text: err.message || 'Failed to request camera.' });
    } finally {
      setIsProcessing(false);
    }
  };

  const displayName = user.full_name || user.username || 'Friend';
  const avatarSrc = user.avatar_url && !isDefaultAvatar(user.avatar_url)
    ? user.avatar_url
    : getDefaultAvatar(user.gender);

  return (
    <div
      className="modal-backdrop permission-onboarding-backdrop"
      onClick={(e) => {
        // Prevent accidental clicks on backdrop from closing onboarding
        if (e.target === e.currentTarget && isManualRecheck && Date.now() - modalOpenedAtRef.current >= 400) {
          if (onClose) onClose();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-label="VibeGrid Permission Setup"
    >
      <div
        className="modal-card permission-onboarding-card"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
        {/* Step Progress Header */}
        <div className="onboarding-stepper-header">
          <div className="onboarding-dots">
            {Array.from({ length: totalSteps }, (_, i) => i + 1).map((stepNum) => (
              <span
                key={stepNum}
                className={`onboarding-dot ${currentStep === stepNum ? 'active' : currentStep > stepNum ? 'completed' : ''}`}
              />
            ))}
          </div>
          <span className="onboarding-step-counter">
            Step {currentStep} of {totalSteps}
          </span>
        </div>

        {/* Dynamic Step Content */}
        <div className="onboarding-step-body">
          {/* STEP 1: WELCOME & OVERVIEW */}
          {currentStep === 1 && (
            <div className="onboarding-slide fade-in">
              <div className="onboarding-hero-icon-wrap">
                <img
                  src={avatarSrc}
                  alt={displayName}
                  className="onboarding-user-avatar"
                  onError={(e) => { e.currentTarget.src = getDefaultAvatar(user.gender); }}
                />
                <span className="onboarding-badge-sparkle">✨</span>
              </div>
              <h2 className="onboarding-title">Welcome to VibeGrid, {displayName}!</h2>
              <p className="onboarding-description">
                {isManualRecheck
                  ? 'Review and configure device permissions for background calling, voice messages, and video chats.'
                  : "Let's set up a few essentials so calls, messages, and alerts work smoothly on your device."}
              </p>

              <div className="onboarding-feature-list">
                <div className="onboarding-feature-item">
                  <span className="onboarding-feature-icon">🔔</span>
                  <div className="onboarding-feature-text">
                    <strong>Real-Time Notifications</strong>
                    <span>Ring incoming calls & alerts when VibeGrid is in the background</span>
                  </div>
                </div>
                <div className="onboarding-feature-item">
                  <span className="onboarding-feature-icon">🎙️</span>
                  <div className="onboarding-feature-text">
                    <strong>Voice Calling & Audio Notes</strong>
                    <span>Crystal-clear voice messaging and encrypted calls</span>
                  </div>
                </div>
                <div className="onboarding-feature-item">
                  <span className="onboarding-feature-icon">📹</span>
                  <div className="onboarding-feature-text">
                    <strong>HD Video Calls</strong>
                    <span>Face-to-face video chats with your friends and groups</span>
                  </div>
                </div>
                <div className="onboarding-feature-item">
                  <span className="onboarding-feature-icon">🔒</span>
                  <div className="onboarding-feature-text">
                    <strong>Privacy & Control</strong>
                    <span>Permissions are only requested when needed and stay on your device</span>
                  </div>
                </div>
              </div>

              <div className="onboarding-actions">
                <button
                  type="button"
                  className="btn-primary onboarding-main-btn"
                  onClick={handleNext}
                  data-testid="onboarding-start-btn"
                >
                  Start Setup →
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: NOTIFICATIONS */}
          {currentStep === 2 && (
            <div className="onboarding-slide fade-in">
              <div className="onboarding-hero-icon-wrap variant-notif">
                <span className="onboarding-icon">🔔</span>
              </div>
              <h2 className="onboarding-title">Push Notifications & Calls</h2>
              <p className="onboarding-description">
                Never miss an incoming voice or video call. Web Push alerts ring your device even when VibeGrid is closed or your screen is locked.
              </p>

              {isIosSafari && (
                <div className="onboarding-notice-box">
                  <strong>💡 iOS Safari Tip</strong>
                  <p>
                    Apple requires adding VibeGrid to your Home Screen to receive Web Push notifications. Tap the <strong>Share ⎕↑</strong> button in Safari and select <strong>"Add to Home Screen"</strong>.
                  </p>
                </div>
              )}

              {notifStatus === 'granted' ? (
                <div className="onboarding-status-chip granted">
                  <span>✅ Notifications are currently enabled and active</span>
                </div>
              ) : notifStatus === 'denied' ? (
                <div className="onboarding-status-chip denied">
                  <span>⚠️ Notifications are currently blocked in browser settings</span>
                </div>
              ) : null}

              {statusFeedback && (
                <div className={`onboarding-feedback-banner ${statusFeedback.type}`}>
                  {statusFeedback.text}
                </div>
              )}

              <div className="onboarding-actions">
                {notifStatus === 'granted' ? (
                  <button
                    type="button"
                    className="btn-primary onboarding-main-btn"
                    onClick={handleNext}
                  >
                    Continue →
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      className="btn-primary onboarding-main-btn"
                      onClick={handleRequestNotifications}
                      disabled={isProcessing}
                      data-testid="onboarding-enable-notif-btn"
                    >
                      {isProcessing ? 'Enabling...' : '🔔 Enable Notifications'}
                    </button>
                    <button
                      type="button"
                      className="btn-ghost onboarding-skip-btn"
                      onClick={handleSkip}
                      disabled={isProcessing}
                    >
                      Not Now
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* STEP 3: MICROPHONE */}
          {currentStep === 3 && (
            <div className="onboarding-slide fade-in">
              <div className="onboarding-hero-icon-wrap variant-mic">
                <span className="onboarding-icon">🎙️</span>
              </div>
              <h2 className="onboarding-title">Microphone Access</h2>
              <p className="onboarding-description">
                Record quick voice notes in direct messages and speak clearly on encrypted voice and video calls.
              </p>

              {micStatus === 'granted' ? (
                <div className="onboarding-status-chip granted">
                  <span>✅ Microphone access is currently granted</span>
                </div>
              ) : micStatus === 'denied' ? (
                <div className="onboarding-status-chip denied">
                  <span>⚠️ Microphone is currently blocked in browser settings</span>
                </div>
              ) : null}

              {statusFeedback && (
                <div className={`onboarding-feedback-banner ${statusFeedback.type}`}>
                  {statusFeedback.text}
                </div>
              )}

              <div className="onboarding-actions">
                {micStatus === 'granted' ? (
                  <button
                    type="button"
                    className="btn-primary onboarding-main-btn"
                    onClick={handleNext}
                  >
                    Continue →
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      className="btn-primary onboarding-main-btn"
                      onClick={handleRequestMicrophone}
                      disabled={isProcessing}
                      data-testid="onboarding-enable-mic-btn"
                    >
                      {isProcessing ? 'Checking...' : '🎙️ Enable Microphone'}
                    </button>
                    <button
                      type="button"
                      className="btn-ghost onboarding-skip-btn"
                      onClick={handleSkip}
                      disabled={isProcessing}
                    >
                      Maybe Later
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* STEP 4: CAMERA */}
          {currentStep === 4 && (
            <div className="onboarding-slide fade-in">
              <div className="onboarding-hero-icon-wrap variant-cam">
                <span className="onboarding-icon">📹</span>
              </div>
              <h2 className="onboarding-title">Camera for Video Calling</h2>
              <p className="onboarding-description">
                Jump into high-definition face-to-face video calls with your friends. Your camera is only turned on while you are in an active video call.
              </p>

              {camStatus === 'granted' ? (
                <div className="onboarding-status-chip granted">
                  <span>✅ Camera access is currently granted</span>
                </div>
              ) : camStatus === 'denied' ? (
                <div className="onboarding-status-chip denied">
                  <span>⚠️ Camera is currently blocked in browser settings</span>
                </div>
              ) : null}

              {statusFeedback && (
                <div className={`onboarding-feedback-banner ${statusFeedback.type}`}>
                  {statusFeedback.text}
                </div>
              )}

              <div className="onboarding-actions">
                {camStatus === 'granted' ? (
                  <button
                    type="button"
                    className="btn-primary onboarding-main-btn"
                    onClick={handleNext}
                  >
                    Continue →
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      className="btn-primary onboarding-main-btn"
                      onClick={handleRequestCamera}
                      disabled={isProcessing}
                      data-testid="onboarding-enable-cam-btn"
                    >
                      {isProcessing ? 'Checking...' : '📹 Enable Camera'}
                    </button>
                    <button
                      type="button"
                      className="btn-ghost onboarding-skip-btn"
                      onClick={handleSkip}
                      disabled={isProcessing}
                    >
                      Maybe Later
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* STEP 5: PHOTOS & MEDIA (EDUCATIONAL & TRANSPARENT) */}
          {currentStep === 5 && (
            <div className="onboarding-slide fade-in">
              <div className="onboarding-hero-icon-wrap variant-media">
                <span className="onboarding-icon">🖼️</span>
              </div>
              <h2 className="onboarding-title">Photos & Media Sharing</h2>
              <p className="onboarding-description">
                Share photos, videos, and stories effortlessly. VibeGrid operates with strict privacy:
              </p>

              <div className="onboarding-privacy-checklist">
                <div className="onboarding-privacy-row">
                  <span className="onboarding-check-icon">🔒</span>
                  <span><strong>On-Demand Selection:</strong> Whenever you post or send an image, your device's native photo picker opens.</span>
                </div>
                <div className="onboarding-privacy-row">
                  <span className="onboarding-check-icon">🛡️</span>
                  <span><strong>Zero Background Access:</strong> VibeGrid never reads your photo library or storage in the background.</span>
                </div>
                <div className="onboarding-privacy-row">
                  <span className="onboarding-check-icon">✨</span>
                  <span><strong>Encrypted Media:</strong> Images sent in direct messages are protected by client-side end-to-end encryption.</span>
                </div>
              </div>

              <div className="onboarding-actions">
                <button
                  type="button"
                  className="btn-primary onboarding-main-btn"
                  onClick={handleNext}
                >
                  Got It, Continue →
                </button>
              </div>
            </div>
          )}

          {/* STEP 6: SUMMARY & GET STARTED */}
          {currentStep === 6 && (
            <div className="onboarding-slide fade-in">
              <div className="onboarding-hero-icon-wrap variant-success">
                <span className="onboarding-icon">🎉</span>
              </div>
              <h2 className="onboarding-title">You're All Set!</h2>
              <p className="onboarding-description">
                Your device setup is complete. You can inspect or update these settings anytime under <strong>Settings → Notification Preferences</strong>.
              </p>

              <div className="onboarding-summary-box">
                <div className="onboarding-summary-row">
                  <span>🔔 Notifications & Calls</span>
                  <span className={`onboarding-pill ${notifStatus === 'granted' ? 'pill-green' : 'pill-muted'}`}>
                    {notifStatus === 'granted' ? 'Enabled ✅' : 'Optional'}
                  </span>
                </div>
                <div className="onboarding-summary-row">
                  <span>🎙️ Voice & Microphone</span>
                  <span className={`onboarding-pill ${micStatus === 'granted' ? 'pill-green' : 'pill-muted'}`}>
                    {micStatus === 'granted' ? 'Enabled ✅' : 'Optional'}
                  </span>
                </div>
                <div className="onboarding-summary-row">
                  <span>📹 Video Calling & Camera</span>
                  <span className={`onboarding-pill ${camStatus === 'granted' ? 'pill-green' : 'pill-muted'}`}>
                    {camStatus === 'granted' ? 'Enabled ✅' : 'Optional'}
                  </span>
                </div>
                <div className="onboarding-summary-row">
                  <span>🖼️ Native Media Picker</span>
                  <span className="onboarding-pill pill-green">
                    Ready ✅
                  </span>
                </div>
              </div>

              <div className="onboarding-actions">
                <button
                  type="button"
                  className="btn-primary onboarding-main-btn"
                  onClick={handleFinish}
                  disabled={isProcessing}
                  data-testid="onboarding-finish-btn"
                >
                  {isProcessing ? 'Finishing...' : 'Enter VibeGrid 🚀'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
