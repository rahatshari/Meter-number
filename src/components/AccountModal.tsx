import React, { useState } from 'react';
import { User } from 'firebase/auth';
import { Customer } from '../types';
import { UserAvatar } from './UserAvatar';
import { getCleanUserEmail } from '../utils/authHelpers';
import { toBengaliNum } from '../utils/bengali';
import { formatLastBackupTimeBn } from '../utils/offlineSync';

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
  onRestoreFromCloud: () => Promise<number>;
  onSwitchAccount?: () => void;
  onLogout: () => Promise<void>;
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
  onRestoreFromCloud,
  onSwitchAccount,
  onLogout,
  onShowConfirm,
}) => {
  const [isBackingUpNow, setIsBackingUpNow] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  if (!isOpen || !currentUser) return null;

  const cleanEmail = getCleanUserEmail(currentUser);
  const displayName =
    currentUser.displayName && !currentUser.displayName.includes('+biddut')
      ? currentUser.displayName
      : cleanEmail.split('@')[0] || 'সম্মানিত ব্যবহারকারী';

  const handleSyncNowClick = () => {
    onShowConfirm(
      'ক্লাউডে ব্যাকআপ সংরক্ষণ নিশ্চিত করুন',
      `আপনার অ্যাকাউন্টে (${cleanEmail}) বর্তমান ${toBengaliNum(customers.length)} জন গ্রাহকের সকল তথ্য ক্লাউডে সিঙ্ক ও আপডেট করা হবে। আপনি কি নিশ্চিত?`,
      '✓ হ্যাঁ, সিঙ্ক করুন',
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
      await onRestoreFromCloud();
    } finally {
      setIsRestoring(false);
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

        {/* Connected Account Profile Header */}
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
          <div
            style={{
              marginTop: '6px',
              fontSize: '11.5px',
              fontWeight: 700,
              color: 'var(--md-sys-color-success)',
            }}
          >
            ✓ ক্লাউড সিঙ্ক সক্রিয়
          </div>
        </div>

        {/* Cloud Sync Details Card */}
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
            <span style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>সর্বশেষ সিঙ্ক:</span>
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
            <span style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>সিঙ্ক অবস্থা:</span>
            <strong
              style={{
                color:
                  pendingSyncCount > 0
                    ? 'var(--md-sys-color-warning)'
                    : 'var(--md-sys-color-success)',
              }}
            >
              {pendingSyncCount > 0
                ? `${toBengaliNum(pendingSyncCount)}টি পরিবর্তন আপলোড বাকি`
                : '✓ সব তথ্য সিঙ্ক করা আছে'}
            </strong>
          </div>
        </div>

        {/* Auto-Sync vs Manual Toggle */}
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
              অটো-সিঙ্ক মোড
            </div>
            <div style={{ fontSize: '11px', color: 'var(--md-sys-color-on-surface-variant)', marginTop: '2px' }}>
              {autoCloudBackupEnabled
                ? 'চালু আছে — নতুন তথ্য যোগ করলেই স্বয়ংক্রিয়ভাবে ক্লাউডে সেভ হবে'
                : 'ম্যানুয়াল — "এখনই সিঙ্ক করুন" বাটনে ক্লিক করলে সেভ হবে'}
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
              color: autoCloudBackupEnabled
                ? 'var(--md-sys-color-on-primary)'
                : 'var(--md-sys-color-on-surface-variant)',
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

        {/* Cloud Account Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button
            type="button"
            className="md3-btn-filled"
            disabled={isBackingUpNow || isSyncing}
            onClick={handleSyncNowClick}
            style={{ height: '46px', fontSize: '14px', fontWeight: 700 }}
          >
            {isBackingUpNow || isSyncing
              ? '⏳ ক্লাউডে সিঙ্ক হচ্ছে...'
              : pendingSyncCount > 0
              ? `☁️ এখনই ক্লাউডে সিঙ্ক করুন (${toBengaliNum(pendingSyncCount)}টি নতুন)`
              : '☁️ এখনই ক্লাউডে সিঙ্ক করুন'}
          </button>

          <button
            type="button"
            className="md3-btn-tonal"
            disabled={isRestoring || isSyncing}
            onClick={handleRestoreClick}
            style={{ fontWeight: 700 }}
          >
            {isRestoring
              ? '⏳ ক্লাউড থেকে তথ্য আসছে...'
              : '📥 ক্লাউড থেকে সব তথ্য অ্যাপে আনুন'}
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
              🔄 অন্য অ্যাকাউন্টে লগইন করুন
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
