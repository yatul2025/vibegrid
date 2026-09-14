/**
 * client/src/components/KeyBackupModal.jsx
 * ========================================
 * Passphrase-Protected Cryptographic Key Backup & Restore Modal
 */

import React, { useState, useEffect } from 'react';
import { exportEncryptedBackup, importEncryptedBackup } from '../services/crypto/keyBackup';
import { useAuth } from '../context/AuthContext';
import apiClient from '../api/client';
import keyStore from '../services/crypto/keyStore';

export default function KeyBackupModal({ isOpen, onClose }) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('export'); // 'export' | 'restore' | 'devices'

  // Devices State (Phase 6)
  const [devices, setDevices] = useState([]);
  const [currentDeviceId, setCurrentDeviceId] = useState(null);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [revokingDeviceId, setRevokingDeviceId] = useState(null);

  // Export State
  const [exportPassphrase, setExportPassphrase] = useState('');
  const [confirmPassphrase, setConfirmPassphrase] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);

  // Restore State
  const [restorePassphrase, setRestorePassphrase] = useState('');
  const [backupFileContent, setBackupFileContent] = useState(null);
  const [fileName, setFileName] = useState('');
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreSuccess, setRestoreSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleExport = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setExportSuccess(false);

    if (exportPassphrase.length < 8) {
      setErrorMsg('Passphrase must be at least 8 characters.');
      return;
    }

    if (exportPassphrase !== confirmPassphrase) {
      setErrorMsg('Passphrases do not match.');
      return;
    }

    try {
      setIsExporting(true);
      const backupJson = await exportEncryptedBackup(user.id, exportPassphrase);

      // Trigger automatic file download
      const blob = new Blob([backupJson], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vibegrid-keys-${user.username}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setExportSuccess(true);
      setExportPassphrase('');
      setConfirmPassphrase('');
    } catch (err) {
      setErrorMsg(err.message || 'Failed to export backup.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileChange = (e) => {
    setErrorMsg('');
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      setBackupFileContent(evt.target.result);
    };
    reader.readAsText(file);
  };

  const handleRestore = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setRestoreSuccess(false);

    if (!backupFileContent) {
      setErrorMsg('Please select a backup file.');
      return;
    }

    if (!restorePassphrase) {
      setErrorMsg('Please enter your backup passphrase.');
      return;
    }

    try {
      setIsRestoring(true);
      await importEncryptedBackup(user.id, restorePassphrase, backupFileContent);
      setRestoreSuccess(true);
      setRestorePassphrase('');
      setBackupFileContent(null);
      setFileName('');
    } catch (err) {
      setErrorMsg(err.message || 'Failed to restore backup.');
    } finally {
      setIsRestoring(false);
    }
  };

  const fetchDevices = async () => {
    if (!user) return;
    try {
      setLoadingDevices(true);
      const identity = await keyStore.getDeviceIdentity(user.id);
      if (identity?.deviceId) {
        setCurrentDeviceId(identity.deviceId);
      }
      const res = await apiClient.get('/e2ee/devices');
      if (res.success && res.data?.devices) {
        setDevices(res.data.devices);
      }
    } catch (err) {
      console.warn('Failed to load devices:', err);
    } finally {
      setLoadingDevices(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'devices' && isOpen) {
      fetchDevices();
    }
  }, [activeTab, isOpen]);

  const handleRevokeDevice = async (deviceId) => {
    if (!window.confirm('Are you sure you want to revoke this device? It will no longer be able to receive encrypted messages.')) {
      return;
    }
    try {
      setRevokingDeviceId(deviceId);
      const res = await apiClient.delete(`/e2ee/devices/${deviceId}`);
      if (res.success) {
        setDevices((prev) => prev.filter((d) => d.device_id !== deviceId));
      }
    } catch (err) {
      alert(err.message || 'Failed to revoke device.');
    } finally {
      setRevokingDeviceId(null);
    }
  };

  if (!isOpen || !user) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card key-backup-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="key-backup-header-title">
            <span className="key-backup-icon">🔐</span>
            <h3>E2EE Keys Backup</h3>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="key-backup-tabs">
          <button
            type="button"
            className={`key-tab-btn ${activeTab === 'export' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('export');
              setErrorMsg('');
            }}
          >
            Export Backup
          </button>
          <button
            type="button"
            className={`key-tab-btn ${activeTab === 'restore' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('restore');
              setErrorMsg('');
            }}
          >
            Restore Keys
          </button>
          <button
            type="button"
            className={`key-tab-btn ${activeTab === 'devices' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('devices');
              setErrorMsg('');
            }}
          >
            Linked Devices
          </button>
        </div>

        <div className="key-backup-body">
          {errorMsg && (
            <div className="key-backup-alert error">
              <span>⚠️ {errorMsg}</span>
            </div>
          )}

          {exportSuccess && (
            <div className="key-backup-alert success">
              <span>✅ Encrypted backup downloaded! Store it in a safe place.</span>
            </div>
          )}

          {restoreSuccess && (
            <div className="key-backup-alert success">
              <span>✅ Keys restored successfully! Your identity is active on this device.</span>
            </div>
          )}

          {activeTab === 'export' ? (
            <form onSubmit={handleExport} className="key-backup-form">
              <p className="key-backup-desc">
                Your private encryption keys never leave this browser. Set a strong passphrase to
                encrypt and download a backup file. You can use it to restore your chat history on new devices.
              </p>

              <div className="form-group">
                <label>Backup Passphrase (Min. 8 characters)</label>
                <input
                  type="password"
                  value={exportPassphrase}
                  onChange={(e) => setExportPassphrase(e.target.value)}
                  placeholder="Enter a strong passphrase..."
                  required
                  className="key-input"
                />
              </div>

              <div className="form-group">
                <label>Confirm Passphrase</label>
                <input
                  type="password"
                  value={confirmPassphrase}
                  onChange={(e) => setConfirmPassphrase(e.target.value)}
                  placeholder="Confirm passphrase..."
                  required
                  className="key-input"
                />
              </div>

              <button
                type="submit"
                className="btn-primary btn-backup-action"
                disabled={isExporting}
              >
                {isExporting ? 'Encrypting Keys (PBKDF2)...' : '⬇️ Download Encrypted Backup'}
              </button>
            </form>
          ) : activeTab === 'restore' ? (
            <form onSubmit={handleRestore} className="key-backup-form">
              <p className="key-backup-desc">
                Select your previously exported <code>.json</code> keys backup file and enter the passphrase
                you created when backing up.
              </p>

              <div className="form-group">
                <label>Backup File</label>
                <input
                  type="file"
                  accept=".json,.txt"
                  onChange={handleFileChange}
                  className="key-file-input"
                />
                {fileName && <span className="selected-file-label">Selected: {fileName}</span>}
              </div>

              <div className="form-group">
                <label>Backup Passphrase</label>
                <input
                  type="password"
                  value={restorePassphrase}
                  onChange={(e) => setRestorePassphrase(e.target.value)}
                  placeholder="Enter passphrase used for backup..."
                  required
                  className="key-input"
                />
              </div>

              <button
                type="submit"
                className="btn-primary btn-backup-action"
                disabled={isRestoring || !backupFileContent}
              >
                {isRestoring ? 'Decrypting Keys...' : '🔓 Decrypt & Restore Keys'}
              </button>
            </form>
          ) : (
            <div className="devices-manager-pane">
              <p className="key-backup-desc">
                These devices have registered public keys for your account. You can revoke older or lost devices anytime.
              </p>
              {loadingDevices ? (
                <div className="devices-loading">Loading registered devices...</div>
              ) : devices.length === 0 ? (
                <div className="devices-empty">No active registered devices found.</div>
              ) : (
                <div className="devices-list">
                  {devices.map((d) => {
                    const isCurrent = currentDeviceId && d.device_id === currentDeviceId;
                    return (
                      <div key={d.device_id} className={`device-card ${isCurrent ? 'current' : ''}`}>
                        <div className="device-info">
                          <div className="device-title-row">
                            <span className="device-id-code">
                              🖥️ {d.device_id.slice(0, 18)}...
                            </span>
                            {isCurrent && (
                              <span className="device-badge-current">This Device</span>
                            )}
                          </div>
                          <span className="device-meta">
                            Registered: {new Date(d.created_at).toLocaleDateString([], { dateStyle: 'medium' })}
                          </span>
                          <span className="device-meta">
                            Last active: {new Date(d.last_seen_at).toLocaleDateString([], { dateStyle: 'medium' })}
                          </span>
                        </div>
                        {!isCurrent && (
                          <button
                            type="button"
                            className="btn-revoke-device"
                            onClick={() => handleRevokeDevice(d.device_id)}
                            disabled={revokingDeviceId === d.device_id}
                          >
                            {revokingDeviceId === d.device_id ? 'Revoking...' : 'Revoke'}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>

      <style>{`
        .key-backup-modal {
          max-width: 480px;
        }

        .key-backup-header-title {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .key-backup-tabs {
          display: flex;
          border-bottom: 1px solid var(--border-color, #e2e8f0);
        }

        .key-tab-btn {
          flex: 1;
          padding: 12px;
          border: none;
          background: none;
          font-weight: 700;
          font-size: 0.88rem;
          color: var(--text-secondary, #64748b);
          cursor: pointer;
          border-bottom: 2px solid transparent;
          transition: all 0.15s ease;
        }

        .key-tab-btn.active {
          color: #6366f1;
          border-bottom-color: #6366f1;
        }

        .key-backup-body {
          padding: 18px 20px;
        }

        .key-backup-desc {
          font-size: 0.84rem;
          color: var(--text-secondary, #64748b);
          line-height: 1.5;
          margin-bottom: 16px;
        }

        .key-backup-form {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .key-input {
          width: 100%;
          padding: 10px 14px;
          border-radius: 10px;
          border: 1px solid var(--border-color, #e2e8f0);
          background: var(--bg-page, #f8fafc);
          color: var(--text-primary, #0f172a);
          font-size: 0.92rem;
          outline: none;
        }

        .key-file-input {
          width: 100%;
          font-size: 0.85rem;
        }

        .selected-file-label {
          display: block;
          margin-top: 4px;
          font-size: 0.78rem;
          color: #10b981;
        }

        .btn-backup-action {
          width: 100%;
          margin-top: 6px;
          padding: 11px;
        }

        .key-backup-alert {
          padding: 10px 14px;
          border-radius: 10px;
          margin-bottom: 14px;
          font-size: 0.84rem;
        }

        .key-backup-alert.error {
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
          color: #ef4444;
        }

        .key-backup-alert.success {
          background: rgba(16, 185, 129, 0.12);
          border: 1px solid rgba(16, 185, 129, 0.3);
          color: #10b981;
        }

        /* Phase 6: Devices Manager Pane */
        .devices-manager-pane {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .devices-loading,
        .devices-empty {
          text-align: center;
          padding: 24px 0;
          color: var(--text-secondary, #94a3b8);
          font-size: 0.85rem;
        }

        .devices-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
          max-height: 280px;
          overflow-y: auto;
        }

        .device-card {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 14px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 10px;
          transition: all 0.15s ease;
        }

        .device-card.current {
          border-color: rgba(99, 102, 241, 0.35);
          background: rgba(99, 102, 241, 0.06);
        }

        .device-info {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .device-title-row {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .device-id-code {
          font-family: monospace;
          font-weight: 600;
          font-size: 0.84rem;
          color: var(--text-primary, #f1f5f9);
        }

        .device-badge-current {
          font-size: 0.7rem;
          padding: 1px 6px;
          border-radius: 4px;
          background: rgba(16, 185, 129, 0.15);
          color: #10b981;
          font-weight: 600;
        }

        .device-meta {
          font-size: 0.74rem;
          color: var(--text-secondary, #94a3b8);
        }

        .btn-revoke-device {
          padding: 5px 10px;
          font-size: 0.76rem;
          font-weight: 600;
          border-radius: 6px;
          background: rgba(239, 68, 68, 0.15);
          border: 1px solid rgba(239, 68, 68, 0.3);
          color: #f87171;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .btn-revoke-device:hover:not(:disabled) {
          background: #ef4444;
          color: #ffffff;
        }
      `}</style>
    </div>
  );
}
