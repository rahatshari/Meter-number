import React, { useState } from 'react';
import { User } from 'firebase/auth';
import { Customer } from '../types';
import { UserAvatar } from './UserAvatar';
import { getCleanUserEmail, normalizeGmailInput } from '../utils/authHelpers';
import { toBengaliNum } from '../utils/bengali';
import { formatLastBackupTimeBn } from '../utils/offlineSync';
import { DRIVE_BACKUP_FILENAME } from '../utils/googleDriveBackup';

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  customers: Customer[];
  pendingSyncCount: number;
  isSyncing: boolean;
  lastBackupTime: string | null;
  autoCloudBackupEnabled: boolean;
  onToggleAutoCloudBackup: (enabled: boolean) => void;
  onSyncAllToCloud: () => Promise<void>;
  onRestoreFromGoogleDrive: () => Promise<number>;
  onConnectGoogleDriveWithEmail: (email: string) => Promise<number>;
  onSwitchAccount?: () => void;
  onLogout: () => Promise<void>;
  onShowToast: (msg: string) => void;
  onShowConfirm: (title: string, message: string, okText: string, onOk: () => void) => void;
}

export const AccountModal: React.FC<AccountModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  customers,
  pendingSyncCount,
  isSyncing,
  lastBackupTime,
  autoCloudBackupEnabled,
  onToggleAutoCloudBackup,
  onSyncAllToCloud,
  onRestoreFromGoogleDrive,
  onConnectGoogleDriveWithEmail,
  onLogout,
  onShowToast,
  onShowConfirm,
}) => {
  const [isBackingUpNow, setIsBackingUpNow] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [showSwitchGmailInput, setShowSwitchGmailInput] = useState(false);
  const [newGmail, setNewGmail] = useState('');
  const [isSwitching, setIsSwitching] = useState(false);

  if (!isOpen || !currentUser) return null;

  const cleanEmail = getCleanUserEmail(currentUser);
  const displayName =
    currentUser.displayName && !currentUser.displayName.includes('+biddut')
      ? currentUser.displayName
      : cleanEmail.split('@')[0] || 'সম্মানিত ব্যবহারকারী';

  const handleBackupNowClick = () => {
    onShowConfirm(
      'Google Drive-এ ব্যাকআপ সংরক্ষণ নিশ্চিত করুন',
      `আপনার সংযুক্ত Google Drive (${cleanEmail})-এর '${DRIVE_BACKUP_FILENAME}' ফাইলে বর্তমান ${toBengaliNum(customers.length)} জন গ্রাহকের সকল তথ্য ব্যাকআপ ও আপডেট করা হবে। আপনি কি নিশ্চিত?`,
      '✓ হ্যাঁ, ব্যাকআপ রাখুন',
      async () => {
        setIsBackingUpNow(true);
        try {
          await onSyncAllToCloud();
        } finally {
          setIsBackingUpNow(false);
        }
      }
    );
  };

  const handleRestoreClick = async () => {
    setIsRestoring(true);
    try {
      await onRestoreFromGoogleDrive();
    } finally {
      setIsRestoring(false);
    }
  };

  const handleSwitchGmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = normalizeGmailInput(newGmail);
    if (!clean || !clean.includes('@')) {
      onShowToast('সঠিক Gmail ঠিকানা লিখুন');
      return;
    }
    setIsSwitching(true);
    try {
      await onConnectGoogleDriveWithEmail(clean);
      setShowSwitchGmailInput(false);
      setNewGmail('');
    } finally {
      setIsSwitching(false);
    }
  };

  return (
    <div className="md3-overlay" onClick={onClose}>
      <div
        className="md3-sheet"
        style={{ maxWidth: '430px', maxHeight: '92vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-modal-title"
      >
        <div className="md3-drag-handle" />

        {/* Connected Gmail Profile Header */}
        <div style={{ textAlign: 'center', marginBottom: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px' }}>
            <UserAvatar user={currentUser} size={62} showStatusDot={true} />
          </div>

          <h3 id="account-modal-title" style={{ margin: '0 0 2px', fontSize: '17px', fontWeight: 700, color: 'var(--md-sys-color-on-surface)' }}>
            {displayName}
          </h3>
          <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--md-sys-color-on-surface-variant)', wordBreak: 'break-all' }}>
            {cleanEmail}
          </p>
          <span
            style={{
              display: 'inline-block',
              marginTop: '6px',
              padding: '3px 10px',
              borderRadius: '999px',
              fontSize: '11px',
              fontWeight: 700,
              backgroundColor: 'var(--md-sys-color-success-container)',
              color: 'var(--md-sys-color-success)',
            }}
          >
            ✓ Google Drive অ্যাক্সেস ও ব্যাকআপ সক্রিয়
          </span>
        </div>

        {/* Google Drive Backup Details Card */}
        <div
          style={{
            backgroundColor: 'var(--md-sys-color-surface)',
            border: '1px solid var(--md-sys-color-outline-variant)',
            borderRadius: '14px',
            padding: '12px 14px',
            marginBottom: '12px',
            fontSize: '12.5px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>ড্রাইভ ব্যাকআপ ফাইল:</span>
            <strong style={{ color: 'var(--md-sys-color-on-surface)', fontSize: '11.5px' }}>
              {DRIVE_BACKUP_FILENAME}
            </strong>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>সর্বশেষ ব্যাকআপ:</span>
            <strong style={{ color: 'var(--md-sys-color-on-surface)', textAlign: 'right' }}>
              {formatLastBackupTimeBn(lastBackupTime)}
            </strong>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>মোট ব্যাকআপকৃত গ্রাহক:</span>
            <strong style={{ color: 'var(--md-sys-color-primary)' }}>
              {toBengaliNum(customers.length)} জন গ্রাহক
            </strong>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>নতুন পরিবর্তন:</span>
            <strong
              style={{
                color:
                  pendingSyncCount > 0
                    ? 'var(--md-sys-color-warning)'
                    : 'var(--md-sys-color-success)',
              }}
            >
              {pendingSyncCount > 0
                ? `${toBengaliNum(pendingSyncCount)}টি নতুন তথ্য ব্যাকআপ বাকি`
                : '✓ সব তথ্য ব্যাকআপ করা আছে'}
            </strong>
          </div>
        </div>

        {/* Auto-Backup vs Manual 1-Click Backup Toggle */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px',
            padding: '10px 12px',
            borderRadius: '12px',
            backgroundColor: 'var(--md-sys-color-surface)',
            border: '1px solid var(--md-sys-color-outline-variant)',
            marginBottom: '12px',
          }}
        >
          <div>
            <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--md-sys-color-on-surface)' }}>
              ☁️ অটো-ব্যাকআপ মোড
            </div>
            <div style={{ fontSize: '11px', color: 'var(--md-sys-color-on-surface-variant)', marginTop: '2px' }}>
              {autoCloudBackupEnabled
                ? 'চালু আছে — নতুন তথ্য যোগ করলেই স্বয়ংক্রিয়ভাবে Google Drive-এ ব্যাকআপ হবে'
                : 'ম্যানুয়াল — "এখনই ব্যাকআপ রাখুন" বাটনে ক্লিক করলে ব্যাকআপ হবে'}
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={autoCloudBackupEnabled}
            onClick={() => onToggleAutoCloudBackup(!autoCloudBackupEnabled)}
            style={{
              padding: '6px 12px',
              borderRadius: '999px',
              border: '1.5px solid',
              borderColor: autoCloudBackupEnabled
                ? 'var(--md-sys-color-primary)'
                : 'var(--md-sys-color-outline)',
              backgroundColor: autoCloudBackupEnabled
                ? 'var(--md-sys-color-primary)'
                : 'var(--md-sys-color-surface-container)',
              color: autoCloudBackupEnabled ? '#FFFFFF' : 'var(--md-sys-color-on-surface-variant)',
              fontSize: '11.5px',
              fontWeight: 700,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            {autoCloudBackupEnabled ? '✓ অটো চালু' : 'ম্যানুয়াল'}
          </button>
        </div>

        {/* Inline Switch Gmail / Restore from Another Gmail Box */}
        {showSwitchGmailInput && (
          <form
            onSubmit={handleSwitchGmailSubmit}
            style={{
              padding: '12px',
              borderRadius: '12px',
              backgroundColor: 'var(--md-sys-color-surface)',
              border: '1.5px solid var(--md-sys-color-primary)',
              marginBottom: '12px',
            }}
          >
            <div className="md3-text-field" style={{ marginBottom: '8px' }}>
              <label htmlFor="account-switch-gmail">অন্য Gmail ঠিকানা বসান *</label>
              <input
                id="account-switch-gmail"
                type="text"
                inputMode="email"
                autoCapitalize="none"
                className="md3-input"
                placeholder="যেমন: example@gmail.com"
                value={newGmail}
                onChange={(e) => setNewGmail(e.target.value)}
              />
            </div>
            <button
              type="submit"
              className="md3-btn-filled"
              disabled={isSwitching}
              style={{ width: '100%', height: '42px', fontSize: '13px', fontWeight: 700 }}
            >
              {isSwitching ? '⏳ সংযুক্ত ও তথ্য লোড হচ্ছে...' : '🔓 এই Gmail যুক্ত ও সব তথ্য অ্যাপে আনুন'}
            </button>
          </form>
        )}

        {/* Primary 1-Click Backup & Restore Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button
            type="button"
            className="md3-btn-filled"
            disabled={isBackingUpNow || isSyncing}
            onClick={handleBackupNowClick}
            style={{ height: '46px', fontSize: '14px', fontWeight: 700 }}
          >
            {isBackingUpNow || isSyncing
              ? '⏳ Google Drive-এ ব্যাকআপ হচ্ছে...'
              : pendingSyncCount > 0
              ? `☁️ Google Drive-এ এখনই ব্যাকআপ রাখুন (${toBengaliNum(pendingSyncCount)}টি নতুন)`
              : '☁️ Google Drive-এ এখনই ব্যাকআপ রাখুন (Backup Now)'}
          </button>

          <button
            type="button"
            className="md3-btn-tonal"
            disabled={isRestoring || isSyncing}
            onClick={handleRestoreClick}
            style={{ fontWeight: 700 }}
          >
            {isRestoring
              ? '⏳ Google Drive থেকে তথ্য অ্যাপে আসছে...'
              : '📥 Google Drive থেকে সব তথ্য অ্যাপে আনুন (Restore)'}
          </button>

          <button
            type="button"
            className="md3-btn-outlined"
            onClick={() => setShowSwitchGmailInput(!showSwitchGmailInput)}
          >
            🔄 অন্য Gmail বসিয়ে ব্যাকআপ আনুন / পরিবর্তন করুন
          </button>

          <button
            type="button"
            className="md3-btn-outlined md3-btn-danger"
            onClick={async () => {
              await onLogout();
              onClose();
            }}
          >
            🚪 লগআউট করুন
          </button>

          <button
            type="button"
            className="md3-btn-outlined"
            style={{ borderColor: 'transparent', color: 'var(--md-sys-color-on-surface-variant)' }}
            onClick={onClose}
          >
            বন্ধ করুন
          </button>
        </div>
      </div>
    </div>
  );
};
