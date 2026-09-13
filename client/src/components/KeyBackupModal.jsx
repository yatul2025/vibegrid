/**
 * client/src/components/KeyBackupModal.jsx
 * ========================================
 * Passphrase-Protected Cryptographic Key Backup & Restore Modal
 */

import React, { useState } from 'react';
import { exportEncryptedBackup, importEncryptedBackup } from '../services/crypto/keyBackup';
import { useAuth } from '../context/AuthContext';

export default function KeyBackupModal({ isOpen, onClose }) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('export'); // 'export' | 'restore'

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

  if (!isOpen || !user) return null;

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
          ) : (
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
      `}</style>
    </div>
  );
}
