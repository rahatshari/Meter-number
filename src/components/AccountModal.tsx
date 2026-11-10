import React, { useState } from 'react';
import { User } from 'firebase/auth';
import { Customer } from '../types';
import { UserAvatar } from './UserAvatar';
import { getCleanUserEmail } from '../utils/authHelpers';
import { toBengaliNum } from '../utils/bengali';
import { formatLastBackupTimeBn, shareBackupFileToGoogleDrive } from '../utils/offlineSync';

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
  onSwitchAccount?: () => void;
  onLogout: () => Promise<void>;
  onShowToast: (msg: string) => void;
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
  onSwitchAccount,
  onLogout,
  onShowToast,
}) => {
  const [isBackingUpNow, setIsBackingUpNow] = useState(false);

  if (!isOpen || !currentUser) return null;

  const cleanEmail = getCleanUserEmail(currentUser);
  const displayName =
    currentUser.displayName && !currentUser.displayName.includes('+biddut')
      ? currentUser.displayName
      : cleanEmail.split('@')[0] || 'সম্মানিত ব্যবহারকারী';

  const handleBackupNowClick = async () => {
    setIsBackingUpNow(true);
    try {
      await onSyncAllToCloud();
    } finally {
      setIsBackingUpNow(false);
    }
  };

  const handleDriveFileSave = async () => {
    const mode = await shareBackupFileToGoogleDrive(customers);
    if (mode === 'native_drive') {
      onShowToast('📂 Google Drive অ্যাপে ব্যাকআপ ফাইল সেভ করার অপশন চালু হয়েছে!');
    } else if (mode === 'web_share') {
      onShowToast('📂 Google Drive-এ ব্যাকআপ ফাইল শেয়ার সম্পন্ন হয়েছে!');
    } else {
      onShowToast('📥 Google Drive ব্যাকআপ ফাইল (.json) ডাউনলোড হয়েছে!');
    }
  };

  return (
    <div className="md3-overlay" onClick={onClose}>
      <div
        className="md3-sheet"
        style={{ maxWidth: '430px', maxHeight: '92vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="md3-drag-handle" />

        {/* Connected Gmail Profile Header */}
        <div style={{ textAlign: 'center', marginBottom: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px' }}>
            <UserAvatar user={currentUser} size={62} showStatusDot={true} />
          </div>

          <h3 style={{ margin: '0 0 2px', fontSize: '17px', fontWeight: 700, color: 'var(--md-sys-color-on-surface)' }}>
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
            ✓ ব্যাকআপ Gmail যুক্ত আছে
          </span>
        </div>

        {/* WhatsApp-Style Backup Details Card */}
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
            <span style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>সর্বশেষ ব্যাকআপ:</span>
            <strong style={{ color: 'var(--md-sys-color-on-surface)', textAlign: 'right' }}>
              {formatLastBackupTimeBn(lastBackupTime)}
            </strong>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>মোট সংরক্ষিত গ্রাহক:</span>
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
                ? 'চালু আছে — নতুন তথ্য যোগ করলেই স্বয়ংক্রিয় ব্যাকআপ হবে'
                : 'ম্যানুয়াল — "এখনই ব্যাকআপ করুন" বাটনে ক্লিক করলে ব্যাকআপ হবে'}
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

        {/* Primary 1-Click Backup Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button
            type="button"
            className="md3-btn-filled"
            disabled={isBackingUpNow || isSyncing}
            onClick={handleBackupNowClick}
            style={{ height: '46px', fontSize: '14px', fontWeight: 700 }}
          >
            {isBackingUpNow || isSyncing
              ? '⏳ ব্যাকআপ হচ্ছে...'
              : pendingSyncCount > 0
              ? `🔄 এখনই ব্যাকআপ করুন (${toBengaliNum(pendingSyncCount)}টি নতুন)`
              : '🔄 এখনই ব্যাকআপ করুন (Backup Now)'}
          </button>

          <button
            type="button"
            className="md3-btn-tonal"
            onClick={handleDriveFileSave}
          >
            📂 Google Drive অ্যাপে ব্যাকআপ ফাইল সেভ করুন
          </button>

          {onSwitchAccount && (
            <button
              type="button"
              className="md3-btn-outlined"
              onClick={() => {
                onClose();
                onSwitchAccount();
              }}
            >
              🔄 ব্যাকআপের Gmail পরিবর্তন করুন
            </button>
          )}

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

