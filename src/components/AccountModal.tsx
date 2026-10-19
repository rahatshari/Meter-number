import React from 'react';
import { User } from 'firebase/auth';

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  onSyncAllToCloud: () => Promise<void>;
  onLogout: () => Promise<void>;
}

export const AccountModal: React.FC<AccountModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onSyncAllToCloud,
  onLogout,
}) => {
  if (!isOpen || !currentUser) return null;

  return (
    <div className="md3-overlay" onClick={onClose}>
      <div className="md3-sheet" style={{ maxWidth: '420px' }} onClick={(e) => e.stopPropagation()}>
        <div className="md3-drag-handle" />

        <div style={{ textAlign: 'center', marginBottom: '16px' }}>
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: 'var(--md-sys-color-primary-container)',
              color: 'var(--md-sys-color-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '26px',
              fontWeight: 700,
              margin: '0 auto 10px',
              overflow: 'hidden',
              border: '2px solid var(--md-sys-color-primary)',
            }}
          >
            {currentUser.photoURL ? (
              <img
                src={currentUser.photoURL}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                alt="User"
              />
            ) : (
              (currentUser.displayName || currentUser.email || 'U').charAt(0).toUpperCase()
            )}
          </div>

          <h3 style={{ margin: '0 0 4px', fontSize: '18px', fontWeight: 700, color: 'var(--md-sys-color-on-surface)' }}>
            {currentUser.displayName || 'সম্মানিত ব্যবহারকারী'}
          </h3>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--md-sys-color-on-surface-variant)', wordBreak: 'break-all' }}>
            {currentUser.email || ''}
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
          ✓ <strong>অনলাইন সিঙ্ক সক্রিয়:</strong> আপনি যেকোনো মোবাইল থেকেই এই Google অ্যাকাউন্টে লগইন করে সব তথ্য তাৎক্ষণিকভাবে দেখতে ও পরিচালনা করতে পারবেন।
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
