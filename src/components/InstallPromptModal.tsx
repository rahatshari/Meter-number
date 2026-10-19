import React from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface InstallPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InstallPromptModal: React.FC<InstallPromptModalProps> = ({ isOpen, onClose }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();

  if (!isOpen) return null;

  const handleInstallClick = async () => {
    const outcome = await install();
    if (outcome === 'accepted') {
      onClose();
    }
  };

  return (
    <div className="md3-modal-backdrop" onClick={onClose}>
      <div
        className="md3-dialog max-w-sm w-full mx-4"
        onClick={(e) => e.stopPropagation()}
        style={{ padding: '24px', borderRadius: '28px' }}
      >
        <div className="flex items-center gap-3 mb-4">
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '16px',
              background: 'var(--md-sys-color-primary)',
              color: 'var(--md-sys-color-on-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: 'var(--md-elevation-2)',
              overflow: 'hidden',
              flexShrink: 0,
            }}
          >
            <img src="./pwa-192x192.png" alt="App Icon" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <div>
            <h3
              style={{
                fontSize: '19px',
                fontWeight: 700,
                color: 'var(--md-sys-color-on-surface)',
                margin: 0,
              }}
            >
              বিদ্যুৎ বিল
            </h3>
            <p
              style={{
                fontSize: '12px',
                color: 'var(--md-sys-color-on-surface-variant)',
                margin: '2px 0 0',
              }}
            >
              Google Chrome থেকে সরাসরি ইনস্টল করুন
            </p>
          </div>
        </div>

        {isInstalled ? (
          <div
            style={{
              padding: '14px',
              borderRadius: '16px',
              backgroundColor: 'var(--md-sys-color-surface-container-high)',
              fontSize: '13px',
              color: 'var(--md-sys-color-success)',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '16px',
            }}
          >
            <span>✓</span> অ্যাপটি ইতিমধ্যে আপনার ডিভাইসে ইনস্টল করা আছে!
          </div>
        ) : isInstallable ? (
          <div className="space-y-3 mb-5">
            <p style={{ fontSize: '14px', color: 'var(--md-sys-color-on-surface-variant)', margin: 0 }}>
              অ্যাপটি হোম স্ক্রিনে ইনস্টল করলে ইন্টারনেট ছাড়াই দ্রুত ও সহজে বিল পরিচালনা করতে পারবেন।
            </p>
            <button
              type="button"
              onClick={handleInstallClick}
              className="md3-btn md3-btn-filled w-full"
              style={{
                height: '48px',
                fontSize: '15px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              ইনস্টল করুন (Install Now)
            </button>
          </div>
        ) : isIOS ? (
          <div
            style={{
              padding: '14px',
              borderRadius: '16px',
              backgroundColor: 'var(--md-sys-color-surface-container-high)',
              fontSize: '13px',
              color: 'var(--md-sys-color-on-surface)',
              lineHeight: 1.5,
              marginBottom: '16px',
            }}
          >
            <strong>iPhone / iPad-এ ইনস্টল করার নিয়ম:</strong>
            <ol style={{ paddingLeft: '20px', marginTop: '6px', marginBottom: 0 }}>
              <li>Safari ব্রাউজারের নিচে <strong>Share (শেয়ার)</strong> আইকনে ট্যাপ করুন।</li>
              <li>একটু নিচে স্ক্রল করে <strong>Add to Home Screen</strong> এ ট্যাপ করুন।</li>
            </ol>
          </div>
        ) : (
          <div
            style={{
              padding: '14px',
              borderRadius: '16px',
              backgroundColor: 'var(--md-sys-color-surface-container-high)',
              fontSize: '13px',
              color: 'var(--md-sys-color-on-surface)',
              lineHeight: 1.5,
              marginBottom: '16px',
            }}
          >
            <strong>Google Chrome ব্রাউজারে ইনস্টল করার নিয়ম:</strong>
            <ol style={{ paddingLeft: '20px', marginTop: '6px', marginBottom: 0 }}>
              <li>উপরে ডানদিকের <strong>তিনটি ডট (⋮)</strong> মেনুতে ট্যাপ করুন।</li>
              <li>মেনু থেকে <strong>"ইনস্টল করুন" (Install app)</strong> বা <strong>"হোম স্ক্রিনে যোগ করুন" (Add to Home screen)</strong> সিলেক্ট করুন।</li>
            </ol>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="md3-btn md3-btn-tonal"
            style={{ height: '40px', padding: '0 20px', fontSize: '13px' }}
          >
            বন্ধ করুন
          </button>
        </div>
      </div>
    </div>
  );
};
