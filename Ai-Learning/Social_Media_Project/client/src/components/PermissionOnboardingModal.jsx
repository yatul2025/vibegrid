/**
 * client/src/components/PermissionOnboardingModal.jsx
 * ===================================================
 * VibeGrid Guided First-Login & Cleared-Data Permission Modal
 * 
 * Features:
 * 1. Requests permissions one-by-one (Notifications -> Microphone -> Camera -> Media -> Finish).
 * 2. Prominent Accept / Allow and Reject / Skip buttons visible on every step.
 * 3. Never cuts off buttons on mobile; fixed scrollable container with sticky actions.
 * 4. "Skip All ✕" button in header so users are never trapped.
 * 5. Immediate hardware stream release after permission verification.
 * 6. Non-blocking: skipped or denied permissions still allow full app entry.
 */

import React, { useState, useEffect, useRef } from 'react';
import permissionService from '../services/permissionService';

export default function PermissionOnboardingModal({
  user,
  isOpen = true,
  onClose,
  onComplete,
  isManualRecheck = false
}) {
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 5;
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
        setTimeout(handleNext, 800);
      } else if (res.denied) {
        setNotifStatus('denied');
        setStatusFeedback({ type: 'warn', text: '⚠️ Notifications were blocked. You can still enable them later in browser settings.' });
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
        setTimeout(handleNext, 800);
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
        setTimeout(handleNext, 800);
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

  return (
    <div
      className="modal-backdrop permission-onboarding-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget && Date.now() - modalOpenedAtRef.current >= 400) {
          handleFinish();
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
        {/* Header with Stepper Dots, Counter, and Quick Skip All Button */}
        <div className="onboarding-stepper-header">
          <div className="onboarding-dots">
            {Array.from({ length: totalSteps }, (_, i) => i + 1).map((stepNum) => (
              <span
                key={stepNum}
                className={`onboarding-dot ${currentStep === stepNum ? 'active' : currentStep > stepNum ? 'completed' : ''}`}
              />
            ))}
          </div>
          <div className="onboarding-header-right">
            <span className="onboarding-step-counter">
              Step {currentStep} of {totalSteps}
            </span>
            <button
              type="button"
              className="onboarding-skip-all-btn"
              onClick={handleFinish}
              title="Skip permission setup and enter app"
              data-testid="onboarding-skip-all-btn"
            >
              Skip All ✕
            </button>
          </div>
        </div>

        {/* Scrollable Step Body */}
        <div className="onboarding-step-body">
          {/* STEP 1: NOTIFICATIONS & CALLS */}
          {currentStep === 1 && (
            <div className="onboarding-slide fade-in">
              <div className="onboarding-hero-icon-wrap variant-notif">
                <span className="onboarding-icon">🔔</span>
              </div>
              <h2 className="onboarding-title">Enable Notifications & Calls</h2>
              <p className="onboarding-description">
                Ring incoming voice/video calls and receive instant alerts for direct messages even when VibeGrid is closed or your screen is locked.
              </p>

              {isIosSafari && (
                <div className="onboarding-notice-box">
                  <strong>💡 iOS Safari Tip</strong>
                  <p>
                    Apple requires adding VibeGrid to your Home Screen to receive Web Push. Tap the <strong>Share ⎕↑</strong> icon in Safari and select <strong>"Add to Home Screen"</strong>.
                  </p>
                </div>
              )}

              {notifStatus === 'granted' ? (
                <div className="onboarding-status-chip granted">
                  <span>✅ Notifications are enabled on this device</span>
                </div>
              ) : notifStatus === 'denied' ? (
                <div className="onboarding-status-chip denied">
                  <span>⚠️ Blocked in browser settings. You can enable them anytime.</span>
                </div>
              ) : null}

              {statusFeedback && (
                <div className={`onboarding-feedback-banner ${statusFeedback.type}`}>
                  {statusFeedback.text}
                </div>
              )}
            </div>
          )}

          {/* STEP 2: MICROPHONE */}
          {currentStep === 2 && (
            <div className="onboarding-slide fade-in">
              <div className="onboarding-hero-icon-wrap variant-mic">
                <span className="onboarding-icon">🎙️</span>
              </div>
              <h2 className="onboarding-title">Allow Microphone Access</h2>
              <p className="onboarding-description">
                Record quick voice notes in direct messages and speak clearly on encrypted voice & video calls. Microphone is only active when speaking.
              </p>

              {micStatus === 'granted' ? (
                <div className="onboarding-status-chip granted">
                  <span>✅ Microphone access is currently granted</span>
                </div>
              ) : micStatus === 'denied' ? (
                <div className="onboarding-status-chip denied">
                  <span>⚠️ Microphone is blocked in browser settings</span>
                </div>
              ) : null}

              {statusFeedback && (
                <div className={`onboarding-feedback-banner ${statusFeedback.type}`}>
                  {statusFeedback.text}
                </div>
              )}
            </div>
          )}

          {/* STEP 3: CAMERA */}
          {currentStep === 3 && (
            <div className="onboarding-slide fade-in">
              <div className="onboarding-hero-icon-wrap variant-cam">
                <span className="onboarding-icon">📹</span>
              </div>
              <h2 className="onboarding-title">Allow Camera for Video Calls</h2>
              <p className="onboarding-description">
                Connect face-to-face with friends in 1-on-1 and group video calls. Your camera is only turned on while you are in an active video call.
              </p>

              {camStatus === 'granted' ? (
                <div className="onboarding-status-chip granted">
                  <span>✅ Camera access is currently granted</span>
                </div>
              ) : camStatus === 'denied' ? (
                <div className="onboarding-status-chip denied">
                  <span>⚠️ Camera is blocked in browser settings</span>
                </div>
              ) : null}

              {statusFeedback && (
                <div className={`onboarding-feedback-banner ${statusFeedback.type}`}>
                  {statusFeedback.text}
                </div>
              )}
            </div>
          )}

          {/* STEP 4: PHOTOS & MEDIA (EDUCATIONAL & TRANSPARENT) */}
          {currentStep === 4 && (
            <div className="onboarding-slide fade-in">
              <div className="onboarding-hero-icon-wrap variant-media">
                <span className="onboarding-icon">🖼️</span>
              </div>
              <h2 className="onboarding-title">Photos & Media Privacy</h2>
              <p className="onboarding-description">
                Share photos, videos, and stories with total privacy control:
              </p>

              <div className="onboarding-privacy-checklist">
                <div className="onboarding-privacy-row">
                  <span className="onboarding-check-icon">🔒</span>
                  <span><strong>On-Demand Selection:</strong> Whenever you upload, your device's native photo picker opens.</span>
                </div>
                <div className="onboarding-privacy-row">
                  <span className="onboarding-check-icon">🛡️</span>
                  <span><strong>Zero Background Access:</strong> VibeGrid never reads your photo library or storage in the background.</span>
                </div>
                <div className="onboarding-privacy-row">
                  <span className="onboarding-check-icon">✨</span>
                  <span><strong>Encrypted Media:</strong> Images sent in direct messages are protected by end-to-end encryption.</span>
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: SUMMARY & GET STARTED */}
          {currentStep === 5 && (
            <div className="onboarding-slide fade-in">
              <div className="onboarding-hero-icon-wrap variant-success">
                <span className="onboarding-icon">🎉</span>
              </div>
              <h2 className="onboarding-title">You're All Set, {displayName}!</h2>
              <p className="onboarding-description">
                Your permissions are configured. You can inspect or modify these settings anytime in <strong>Settings → Notification Preferences</strong>.
              </p>

              <div className="onboarding-summary-box">
                <div className="onboarding-summary-row">
                  <span>🔔 Notifications & Calls</span>
                  <span className={`onboarding-pill ${notifStatus === 'granted' ? 'pill-green' : 'pill-muted'}`}>
                    {notifStatus === 'granted' ? 'Enabled ✅' : 'Optional / Off'}
                  </span>
                </div>
                <div className="onboarding-summary-row">
                  <span>🎙️ Voice & Microphone</span>
                  <span className={`onboarding-pill ${micStatus === 'granted' ? 'pill-green' : 'pill-muted'}`}>
                    {micStatus === 'granted' ? 'Enabled ✅' : 'Optional / Off'}
                  </span>
                </div>
                <div className="onboarding-summary-row">
                  <span>📹 Video Calling & Camera</span>
                  <span className={`onboarding-pill ${camStatus === 'granted' ? 'pill-green' : 'pill-muted'}`}>
                    {camStatus === 'granted' ? 'Enabled ✅' : 'Optional / Off'}
                  </span>
                </div>
                <div className="onboarding-summary-row">
                  <span>🖼️ Native Media Picker</span>
                  <span className="onboarding-pill pill-green">
                    Ready ✅
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ALWAYS VISIBLE BOTTOM ACTIONS */}
        <div className="onboarding-actions">
          {currentStep === 1 && (
            <>
              {notifStatus === 'granted' ? (
                <button
                  type="button"
                  className="btn-primary onboarding-main-btn"
                  onClick={handleNext}
                  data-testid="onboarding-next-btn"
                >
                  Next: Microphone →
                </button>
              ) : (
                <button
                  type="button"
                  className="btn-primary onboarding-main-btn"
                  onClick={handleRequestNotifications}
                  disabled={isProcessing}
                  data-testid="onboarding-accept-btn"
                >
                  {isProcessing ? 'Enabling...' : '✅ Accept & Enable Notifications'}
                </button>
              )}
              <button
                type="button"
                className="btn-secondary onboarding-skip-btn"
                onClick={handleSkip}
                disabled={isProcessing}
                data-testid="onboarding-reject-btn"
              >
                Reject / Skip for Now
              </button>
            </>
          )}

          {currentStep === 2 && (
            <>
              {micStatus === 'granted' ? (
                <button
                  type="button"
                  className="btn-primary onboarding-main-btn"
                  onClick={handleNext}
                  data-testid="onboarding-next-btn"
                >
                  Next: Camera →
                </button>
              ) : (
                <button
                  type="button"
                  className="btn-primary onboarding-main-btn"
                  onClick={handleRequestMicrophone}
                  disabled={isProcessing}
                  data-testid="onboarding-accept-btn"
                >
                  {isProcessing ? 'Checking...' : '✅ Accept & Allow Microphone'}
                </button>
              )}
              <button
                type="button"
                className="btn-secondary onboarding-skip-btn"
                onClick={handleSkip}
                disabled={isProcessing}
                data-testid="onboarding-reject-btn"
              >
                Reject / Skip for Now
              </button>
            </>
          )}

          {currentStep === 3 && (
            <>
              {camStatus === 'granted' ? (
                <button
                  type="button"
                  className="btn-primary onboarding-main-btn"
                  onClick={handleNext}
                  data-testid="onboarding-next-btn"
                >
                  Next: Media Sharing →
                </button>
              ) : (
                <button
                  type="button"
                  className="btn-primary onboarding-main-btn"
                  onClick={handleRequestCamera}
                  disabled={isProcessing}
                  data-testid="onboarding-accept-btn"
                >
                  {isProcessing ? 'Checking...' : '✅ Accept & Allow Camera'}
                </button>
              )}
              <button
                type="button"
                className="btn-secondary onboarding-skip-btn"
                onClick={handleSkip}
                disabled={isProcessing}
                data-testid="onboarding-reject-btn"
              >
                Reject / Skip for Now
              </button>
            </>
          )}

          {currentStep === 4 && (
            <>
              <button
                type="button"
                className="btn-primary onboarding-main-btn"
                onClick={handleNext}
                data-testid="onboarding-accept-btn"
              >
                Got It, Continue →
              </button>
              <button
                type="button"
                className="btn-secondary onboarding-skip-btn"
                onClick={handleSkip}
                data-testid="onboarding-reject-btn"
              >
                Skip
              </button>
            </>
          )}

          {currentStep === 5 && (
            <button
              type="button"
              className="btn-primary onboarding-main-btn"
              onClick={handleFinish}
              disabled={isProcessing}
              data-testid="onboarding-finish-btn"
            >
              {isProcessing ? 'Finishing...' : 'Enter VibeGrid 🚀'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
