import React, { useState } from 'react';
import { AppUpdateInfo, triggerApkUpdateDownload } from '../utils/appUpdater';
import { toBengaliNum } from '../utils/bengali';

interface UpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  updateInfo: AppUpdateInfo;
  isChecking: boolean;
  onCheckAgain: () => Promise<void>;
  onShowToast: (msg: string) => void;
}

export const UpdateModal: React.FC<UpdateModalProps> = ({
  isOpen,
  onClose,
  updateInfo,
  isChecking,
  onCheckAgain,
  onShowToast,
}) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);

  if (!isOpen) return null;

  const handleStartUpdate = () => {
    setIsDownloading(true);
    setDownloadProgress(15);

    const step1 = setTimeout(() => setDownloadProgress(55), 350);
    const step2 = setTimeout(() => setDownloadProgress(90), 750);
    const step3 = setTimeout(() => {
      setDownloadProgress(100);
      triggerApkUpdateDownload(updateInfo.apkDownloadUrl);
      onShowToast('📥 নতুন APK ডাউনলোড শুরু হয়েছে! ডাউনলোড শেষে Install ট্যাপ করুন।');
      setTimeout(() => {
        setIsDownloading(false);
        setDownloadProgress(0);
      }, 1500);
    }, 1100);

    return () => {
      clearTimeout(step1);
      clearTimeout(step2);
      clearTimeout(step3);
    };
  };

  return (
    <div className="md3-overlay" onClick={onClose}>
      <div
        className="md3-sheet"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '420px' }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="apk-update-modal-title"
      >
        <div className="md3-drag-handle" />
        {/* Header with official APK Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <div
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '14px',
              backgroundColor: '#FFFFFF',
              border: '1.5px solid var(--md-sys-color-outline-variant)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: 'var(--md-elevation-1)',
              overflow: 'hidden',
              flexShrink: 0,
            }}
          >
            <img
              src="./icon.png"
              alt="বিদ্যুৎ বিল APK লোগো"
              style={{ width: '44px', height: '44px', objectFit: 'contain' }}
            />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <h3
                id="apk-update-modal-title"
                style={{
                  fontSize: '18px',
                  fontWeight: 700,
                  color: 'var(--md-sys-color-on-surface)',
                  margin: 0,
                }}
              >
                অ্যাপ আপডেট সেন্টার
              </h3>
              <span
                style={{
                  fontSize: '10.5px',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '999px',
                  backgroundColor: updateInfo.hasUpdate
                    ? 'var(--md-sys-color-warning-container)'
                    : 'var(--md-sys-color-success-container)',
                  color: updateInfo.hasUpdate
                    ? 'var(--md-sys-color-warning)'
                    : 'var(--md-sys-color-success)',
                }}
              >
                {updateInfo.hasUpdate ? 'নতুন আপডেট এসেছে!' : 'সর্বশেষ ভার্সন'}
              </span>
            </div>
            <p
              style={{
                fontSize: '12px',
                color: 'var(--md-sys-color-on-surface-variant)',
                margin: '2px 0 0',
              }}
            >
              GitHub অটো-রিলিজ ও ইন-অ্যাপ APK আপডেটার
            </p>
          </div>
        </div>

        {/* Version Comparison Box */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '10px',
            marginBottom: '14px',
          }}
        >
          <div
            style={{
              padding: '10px 12px',
              borderRadius: '14px',
              backgroundColor: 'var(--md-sys-color-surface)',
              border: '1px solid var(--md-sys-color-outline-variant)',
            }}
          >
            <div style={{ fontSize: '11px', color: 'var(--md-sys-color-on-surface-variant)' }}>
              বর্তমান ভার্সন
            </div>
            <div
              style={{
                fontSize: '15px',
                fontWeight: 700,
                color: 'var(--md-sys-color-on-surface)',
                marginTop: '2px',
              }}
            >
              v{toBengaliNum(updateInfo.currentVersion)}
            </div>
            <div style={{ fontSize: '10.5px', color: 'var(--md-sys-color-on-surface-variant)' }}>
              বিল্ড কোড: #{toBengaliNum(updateInfo.currentVersionCode)}
            </div>
          </div>

          <div
            style={{
              padding: '10px 12px',
              borderRadius: '14px',
              backgroundColor: updateInfo.hasUpdate
                ? 'var(--md-sys-color-primary-container)'
                : 'var(--md-sys-color-surface)',
              border: '1px solid',
              borderColor: updateInfo.hasUpdate
                ? 'var(--md-sys-color-primary)'
                : 'var(--md-sys-color-outline-variant)',
            }}
          >
            <div
              style={{
                fontSize: '11px',
                color: updateInfo.hasUpdate
                  ? 'var(--md-sys-color-on-primary-container)'
                  : 'var(--md-sys-color-on-surface-variant)',
              }}
            >
              সর্বশেষ রিলিজ ভার্সন
            </div>
            <div
              style={{
                fontSize: '15px',
                fontWeight: 700,
                color: updateInfo.hasUpdate
                  ? 'var(--md-sys-color-primary)'
                  : 'var(--md-sys-color-success)',
                marginTop: '2px',
              }}
            >
              v{toBengaliNum(updateInfo.latestVersion)}
            </div>
            <div style={{ fontSize: '10.5px', color: 'var(--md-sys-color-on-surface-variant)' }}>
              বিল্ড কোড: #{toBengaliNum(updateInfo.latestVersionCode)}
            </div>
          </div>
        </div>

        {/* Same Signature Verification Info */}
        <div
          style={{
            padding: '10px 12px',
            borderRadius: '12px',
            backgroundColor: 'var(--md-sys-color-success-container)',
            color: 'var(--md-sys-color-on-success-container)',
            fontSize: '12px',
            lineHeight: 1.45,
            marginBottom: '14px',
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: '2px' }}>
            ✓ একই সিগনেচার (Same Signature) সুরক্ষিত
          </div>
          <div style={{ fontSize: '11.5px', opacity: 0.92 }}>
            পূর্বের অ্যাপ আনইনস্টল ছাড়াই সরাসরি আপডেট হবে এবং আপনার সংরক্ষিত কোনো গ্রাহকের তথ্য মুছবে না।
          </div>
        </div>

        {/* Release Notes */}
        <div
          style={{
            padding: '12px',
            borderRadius: '12px',
            backgroundColor: 'var(--md-sys-color-surface)',
            border: '1px solid var(--md-sys-color-outline-variant)',
            marginBottom: '16px',
            maxHeight: '120px',
            overflowY: 'auto',
          }}
        >
          <div
            style={{
              fontSize: '11.5px',
              fontWeight: 700,
              color: 'var(--md-sys-color-on-surface)',
              marginBottom: '4px',
            }}
          >
            📋 রিলিজ নোট ও পরিবর্তনসমূহ:
          </div>
          <div
            style={{
              fontSize: '12px',
              color: 'var(--md-sys-color-on-surface-variant)',
              whiteSpace: 'pre-line',
              lineHeight: 1.45,
            }}
          >
            {updateInfo.releaseNotes}
          </div>
        </div>

        {/* Progress Bar during APK download */}
        {isDownloading && (
          <div style={{ marginBottom: '14px' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '12px',
                fontWeight: 600,
                marginBottom: '6px',
                color: 'var(--md-sys-color-primary)',
              }}
            >
              <span>নতুন APK প্যাকেজ প্রস্তুত হচ্ছে...</span>
              <span>{toBengaliNum(downloadProgress)}%</span>
            </div>
            <div
              style={{
                width: '100%',
                height: '8px',
                borderRadius: '999px',
                backgroundColor: 'var(--md-sys-color-surface-container-highest)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${downloadProgress}%`,
                  height: '100%',
                  backgroundColor: 'var(--md-sys-color-primary)',
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
          </div>
        )}

        {/* Primary Action Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button
            type="button"
            className="md3-btn-filled"
            disabled={isDownloading}
            onClick={handleStartUpdate}
            style={{
              height: '46px',
              fontSize: '14px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            {updateInfo.hasUpdate
              ? `এখনই আপডেট করুন (v${toBengaliNum(updateInfo.latestVersion)})`
              : 'সর্বশেষ APK ডাউনলোড / রি-ইনস্টল করুন'}
          </button>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <button
              type="button"
              className="md3-btn-tonal"
              disabled={isChecking}
              onClick={onCheckAgain}
              style={{ height: '40px', fontSize: '12.5px' }}
            >
              {isChecking ? 'চেক করা হচ্ছে...' : '🔄 আবার চেক করুন'}
            </button>

            <button
              type="button"
              className="md3-btn-outlined"
              onClick={onClose}
              style={{ height: '40px', fontSize: '12.5px' }}
            >
              বন্ধ করুন
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
