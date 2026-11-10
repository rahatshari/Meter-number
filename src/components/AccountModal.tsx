import React from 'react';
import { User } from 'firebase/auth';
import { UserAvatar } from './UserAvatar';
import { getCleanUserEmail } from '../utils/authHelpers';

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  onSyncAllToCloud: () => Promise<void>;
  onSwitchAccount?: () => void;
  onLogout: () => Promise<void>;
}

export const AccountModal: React.FC<AccountModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onSyncAllToCloud,
  onSwitchAccount,
  onLogout,
}) => {
  if (!isOpen || !currentUser) return null;

  const cleanEmail = getCleanUserEmail(currentUser);
  const displayName =
    currentUser.displayName && !currentUser.displayName.includes('+biddut')
      ? currentUser.displayName
      : cleanEmail.split('@')[0] || 'সম্মানিত ব্যবহারকারী';

  return (
    <div className="md3-overlay" onClick={onClose}>
      <div className="md3-sheet" style={{ maxWidth: '420px' }} onClick={(e) => e.stopPropagation()}>
        <div className="md3-drag-handle" />

        <div style={{ textAlign: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '10px' }}>
            <UserAvatar user={currentUser} size={68} showStatusDot={true} />
          </div>

          <h3 style={{ margin: '0 0 4px', fontSize: '18px', fontWeight: 700, color: 'var(--md-sys-color-on-surface)' }}>
            {displayName}
          </h3>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--md-sys-color-on-surface-variant)', wordBreak: 'break-all' }}>
            {cleanEmail}
          </p>
        </div>

        <div
          style={{
            backgroundColor: 'var(--md-sys-color-success-container)',
            color: 'var(--md-sys-color-on-success-container)',
            borderRadius: 'var(--md-shape-corner-md)',
            padding: '12px',
            fontSize: '12.5px',
            lineHeight: 1.5,
            marginBottom: '16px',
            border: '1px solid var(--md-sys-color-success)',
          }}
        >
          ✓ <strong>ফায়ারবেস ক্লাউড সিঙ্ক সক্রিয়:</strong> আপনার সকল গ্রাহক ও বিলের তথ্য সরাসরি Google Firebase ক্লাউডে সংরক্ষিত হচ্ছে।
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button
            type="button"
            className="md3-btn-tonal"
            onClick={async () => {
              await onSyncAllToCloud();
            }}
          >
            ☁️ ক্লাউডে ডাটা রি-সিঙ্ক করুন
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
              🔄 অন্য Gmail অ্যাকাউন্ট দিয়ে লগইন করুন
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
