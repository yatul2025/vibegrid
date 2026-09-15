/**
 * client/src/components/VoiceRecorder.jsx
 * =======================================
 * Audio Voice Note Recorder Component
 * 
 * Uses HTML5 MediaRecorder to capture microphone audio, tracks recording duration,
 * and passes the recorded Blob for client-side E2EE encryption and upload.
 */

import React, { useState, useEffect, useRef } from 'react';

export default function VoiceRecorder({ onAudioRecorded, onCancel }) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const secondsRef = useRef(0);

  useEffect(() => {
    let stream = null;

    async function startRecording() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });

        // Safely determine supported audio container / codec for browser compatibility (iOS Safari vs Chrome)
        let mimeType = 'audio/webm';
        if (typeof MediaRecorder.isTypeSupported === 'function') {
          if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
            mimeType = 'audio/webm;codecs=opus';
          } else if (MediaRecorder.isTypeSupported('audio/webm')) {
            mimeType = 'audio/webm';
          } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
            mimeType = 'audio/mp4';
          } else if (MediaRecorder.isTypeSupported('audio/aac')) {
            mimeType = 'audio/aac';
          } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
            mimeType = 'audio/ogg';
          }
        }

        const options = mimeType ? { mimeType } : undefined;
        let mediaRecorder;
        try {
          mediaRecorder = options ? new MediaRecorder(stream, options) : new MediaRecorder(stream);
        } catch (e) {
          mediaRecorder = new MediaRecorder(stream);
        }

        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];
        secondsRef.current = 0;

        mediaRecorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.onstop = () => {
          const finalMime = mediaRecorder.mimeType || mimeType || 'audio/webm';
          const audioBlob = new Blob(audioChunksRef.current, { type: finalMime });
          const recordedDuration = secondsRef.current > 0 ? secondsRef.current : 1;
          if (onAudioRecorded && audioBlob.size > 0) {
            onAudioRecorded(audioBlob, recordedDuration, finalMime);
          }
          // Clean up microphone stream
          stream.getTracks().forEach((track) => track.stop());
        };

        mediaRecorder.start(200);
        setIsRecording(true);
        setIsPaused(false);

        timerRef.current = setInterval(() => {
          secondsRef.current += 1;
          setRecordSeconds(secondsRef.current);
        }, 1000);
      } catch (err) {
        console.error('Microphone access denied:', err);
        alert('Could not access microphone for voice note.');
        if (onCancel) onCancel();
      }
    }

    startRecording();

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try {
          mediaRecorderRef.current.onstop = null;
          mediaRecorderRef.current.stop();
        } catch {}
      }
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const handlePauseResume = () => {
    if (!mediaRecorderRef.current) return;
    if (isPaused) {
      if (mediaRecorderRef.current.state === 'paused') {
        mediaRecorderRef.current.resume();
      }
      setIsPaused(false);
      timerRef.current = setInterval(() => {
        secondsRef.current += 1;
        setRecordSeconds(secondsRef.current);
      }, 1000);
    } else {
      if (mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.pause();
      }
      setIsPaused(true);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const handleStopAndSend = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) clearInterval(timerRef.current);
    setIsRecording(false);
  };

  const handleCancel = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      // Detach onstop handler so canceled recordings are not sent
      mediaRecorderRef.current.onstop = null;
      try {
        mediaRecorderRef.current.stop();
      } catch {}
    }
    audioChunksRef.current = [];
    if (onCancel) onCancel();
  };

  const formatTimer = (totalSecs) => {
    const mins = Math.floor(totalSecs / 60).toString().padStart(2, '0');
    const secs = (totalSecs % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };

  return (
    <div className="voice-recorder-bar">
      <div className="voice-recorder-status">
        <span className={`rec-pulse-dot ${isPaused ? 'paused' : ''}`}></span>
        <span className="rec-timer-label">{formatTimer(recordSeconds)}</span>
        
        {/* Waveform Visualizer */}
        <div className={`rec-waveform ${isPaused ? 'paused' : ''}`}>
          <span className="wave-bar bar-1"></span>
          <span className="wave-bar bar-2"></span>
          <span className="wave-bar bar-3"></span>
          <span className="wave-bar bar-4"></span>
          <span className="wave-bar bar-5"></span>
        </div>

        <span className="rec-hint">{isPaused ? 'Recording paused' : 'Recording voice note...'}</span>
      </div>

      <div className="voice-recorder-actions">
        <button
          type="button"
          className="btn-rec-action btn-rec-pause"
          onClick={handlePauseResume}
          title={isPaused ? 'Resume Recording' : 'Pause Recording'}
        >
          {isPaused ? '▶' : '⏸'}
        </button>

        <button
          type="button"
          className="btn-rec-action btn-rec-cancel"
          onClick={handleCancel}
          title="Cancel Recording"
        >
          🗑️
        </button>

        <button
          type="button"
          className="btn-rec-action btn-rec-send"
          onClick={handleStopAndSend}
          title="Send Voice Note"
        >
          ➤
        </button>
      </div>

      <style>{`
        .voice-recorder-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          padding: 8px 16px;
          background: rgba(239, 68, 68, 0.08);
          border: 1px solid rgba(239, 68, 68, 0.25);
          border-radius: 24px;
          animation: fadeIn 0.2s ease-in;
        }

        .voice-recorder-status {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .rec-pulse-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: #ef4444;
          animation: recPulse 1.2s infinite ease-in-out;
        }

        .rec-pulse-dot.paused {
          animation: none;
          background: #f59e0b;
        }

        @keyframes recPulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.4); opacity: 0.4; }
        }

        .rec-timer-label {
          font-family: monospace;
          font-weight: 700;
          font-size: 0.95rem;
          color: #ef4444;
        }

        .rec-waveform {
          display: flex;
          align-items: center;
          gap: 3px;
          height: 16px;
        }

        .wave-bar {
          width: 3px;
          background: #ef4444;
          border-radius: 3px;
          animation: wavePulse 0.8s infinite ease-in-out alternate;
        }

        .wave-bar.bar-1 { height: 8px; animation-delay: 0.1s; }
        .wave-bar.bar-2 { height: 14px; animation-delay: 0.3s; }
        .wave-bar.bar-3 { height: 18px; animation-delay: 0.5s; }
        .wave-bar.bar-4 { height: 12px; animation-delay: 0.2s; }
        .wave-bar.bar-5 { height: 6px; animation-delay: 0.4s; }

        .rec-waveform.paused .wave-bar {
          animation: none;
          background: #f59e0b;
          height: 4px;
        }

        @keyframes wavePulse {
          0% { height: 4px; }
          100% { height: 16px; }
        }

        .rec-hint {
          font-size: 0.8rem;
          color: var(--text-secondary, #64748b);
        }

        .voice-recorder-actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .btn-rec-action {
          width: 34px;
          height: 34px;
          border-radius: 50%;
          border: none;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          font-size: 13px;
          transition: transform 0.15s ease;
        }

        .btn-rec-pause {
          background: rgba(255, 255, 255, 0.1);
          color: #f1f5f9;
        }

        .btn-rec-cancel {
          background: rgba(255, 255, 255, 0.1);
          color: #ef4444;
        }

        .btn-rec-send {
          background: #6366f1;
          color: #ffffff;
        }

        .btn-rec-action:hover {
          transform: scale(1.1);
        }

        @media (max-width: 540px) {
          .voice-recorder-bar {
            padding: 6px 10px;
            gap: 6px;
          }
          .rec-hint {
            display: none;
          }
          .btn-rec-action {
            width: 30px;
            height: 30px;
            font-size: 12px;
          }
        }
      `}</style>
    </div>
  );
}
