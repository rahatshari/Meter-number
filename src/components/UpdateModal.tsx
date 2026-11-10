import React, { useState } from 'react';
import {
  AppUpdateInfo,
  cleanChangelogItems,
  triggerApkUpdateDownload,
} from '../utils/appUpdater';
import { toBengaliNum } from '../utils/bengali';

interface UpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  updateInfo: AppUpdateInfo;
  isChecking: boolean;
  autoUpdateEnabled: boolean;
  onToggleAutoUpdate: (enabled: boolean) => void;
  onCheckAgain: () => Promise<void>;
  onShowToast: (msg: string) => void;
}

export const UpdateModal: React.FC<UpdateModalProps> = ({
  isOpen,
  onClose,
  updateInfo,
  isChecking,
  autoUpdateEnabled,
  onToggleAutoUpdate,
  onCheckAgain,
  onShowToast,
}) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadStatusText, setDownloadStatusText] = useState('APK ডাউনলোড হচ্ছে...');

  if (!isOpen) return null;

  const handleStartUpdate = () => {
    setIsDownloading(true);
    setDownloadProgress(10);
    setDownloadStatusText('নতুন আপডেট ডাউনলোড হচ্ছে...');

    triggerApkUpdateDownload(updateInfo.apkDownloadUrl, (pct, status, errorMsg) => {
      setDownloadProgress(pct);
      if (status === 'downloading') {
        setDownloadStatusText('নতুন আপডেট ডাউনলোড হচ্ছে...');
      } else if (status === 'installing') {
        setDownloadStatusText('ডাউনলোড সম্পন্ন! ইনস্টলার খোলা হচ্ছে...');
      } else if (status === 'done') {
        setDownloadStatusText('ডাউনলোড সম্পন্ন! এখন Install ট্যাপ করুন।');
        onShowToast('📥 নতুন আপডেট ডাউনলোড হয়েছে! এখন Install বাটনে ট্যাপ করুন।');
        setTimeout(() => {
          setIsDownloading(false);
          setDownloadProgress(0);
        }, 1800);
      } else if (status === 'error') {
        setIsDownloading(false);
        setDownloadProgress(0);
        onShowToast(
          errorMsg
            ? `আপডেট ডাউনলোডে সমস্যা: ${errorMsg}`
            : 'ডাউনলোডে সমস্যা হয়েছে, পুনরায় চেষ্টা করুন।'
        );
      }
    });
  };

  const changeItems = cleanChangelogItems(updateInfo.releaseNotes);

  return (
    <div className="md3-overlay" onClick={onClose}>
      <div
        className="md3-sheet"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '440px' }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="apk-update-modal-title"
      >
        <div className="md3-drag-handle" />

        {/* Header with official App Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
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
              alt="বিদ্যুৎ বিল লোগো"
              style={{ width: '40px', height: '40px', objectFit: 'contain' }}
            />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <h3
                id="apk-update-modal-title"
                style={{
                  fontSize: '17px',
                  fontWeight: 700,
                  color: 'var(--md-sys-color-on-surface)',
                  margin: 0,
                }}
              >
                অ্যাপ আপডেট ও পরিবর্তনসমূহ
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
                {updateInfo.hasUpdate ? 'নতুন আপডেট প্রস্তুত!' : 'সর্বশেষ ভার্সন'}
              </span>
            </div>
            <p
              style={{
                fontSize: '11.5px',
                color: 'var(--md-sys-color-on-surface-variant)',
                margin: '2px 0 0',
              }}
            >
              বর্তমান ভার্সন: v{toBengaliNum(updateInfo.currentVersion)} · নতুন ভার্সন: v
              {toBengaliNum(updateInfo.latestVersion)}
            </p>
          </div>
        </div>

        {/* Auto-Update On / Off Switch Card */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px',
            padding: '10px 12px',
            borderRadius: '12px',
            backgroundColor: 'var(--md-sys-color-surface-container)',
            border: '1px solid var(--md-sys-color-outline-variant)',
            marginBottom: '12px',
          }}
        >
          <div>
            <div
              style={{
                fontSize: '13px',
                fontWeight: 700,
                color: 'var(--md-sys-color-on-surface)',
              }}
            >
              🔄 অটো-আপডেট সিস্টেম
            </div>
            <div
              style={{
                fontSize: '11px',
                color: 'var(--md-sys-color-on-surface-variant)',
                marginTop: '1px',
              }}
            >
              {autoUpdateEnabled
                ? 'চালু আছে — নতুন আপডেট এলে স্বয়ংক্রিয়ভাবে জানাবে'
                : 'বন্ধ আছে — নিজে চেক না করলে আপডেট পপআপ আসবে না'}
            </div>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={autoUpdateEnabled}
            onClick={() => onToggleAutoUpdate(!autoUpdateEnabled)}
            style={{
              padding: '6px 12px',
              borderRadius: '999px',
              border: '1.5px solid',
              borderColor: autoUpdateEnabled
                ? 'var(--md-sys-color-primary)'
                : 'var(--md-sys-color-outline)',
              backgroundColor: autoUpdateEnabled
                ? 'var(--md-sys-color-primary)'
                : 'var(--md-sys-color-surface)',
              color: autoUpdateEnabled ? '#FFFFFF' : 'var(--md-sys-color-on-surface-variant)',
              fontSize: '11.5px',
              fontWeight: 700,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              transition: 'all 0.15s ease',
            }}
          >
            {autoUpdateEnabled ? '✓ চালু আছে' : 'বন্ধ আছে'}
          </button>
        </div>

        {/* SINGLE CLEAN CHANGELOG SECTION ("পরিবর্তনসমূহ") */}
        <div
          style={{
            padding: '12px',
            borderRadius: '12px',
            backgroundColor: 'var(--md-sys-color-surface)',
            border: '1px solid var(--md-sys-color-outline-variant)',
            marginBottom: '14px',
            maxHeight: '190px',
            overflowY: 'auto',
          }}
        >
          <div
            style={{
              fontSize: '12.5px',
              fontWeight: 700,
              color: 'var(--md-sys-color-on-surface)',
              marginBottom: '8px',
            }}
          >
            📋 পরিবর্তনসমূহ (v{toBengaliNum(updateInfo.latestVersion)}):
          </div>

          {changeItems.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {changeItems.map((line, index) => (
                <div
                  key={index}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '8px',
                    padding: '7px 10px',
                    borderRadius: '8px',
                    backgroundColor: 'var(--md-sys-color-surface-container-low)',
                    border: '1px solid var(--md-sys-color-outline-variant)',
                    fontSize: '12px',
                    color: 'var(--md-sys-color-on-surface)',
                    lineHeight: 1.4,
                  }}
                >
                  <span style={{ color: 'var(--md-sys-color-primary)', fontWeight: 700 }}>•</span>
                  <span style={{ flex: 1 }}>{line}</span>
                </div>
              ))}
            </div>
          ) : (
            <div
              style={{
                fontSize: '12px',
                color: 'var(--md-sys-color-on-surface-variant)',
                lineHeight: 1.5,
              }}
            >
              • অ্যাপের পারফরম্যান্স ও আপডেট সিস্টেম উন্নত করা হয়েছে।
            </div>
          )}
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
              <span>{downloadStatusText}</span>
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
                  transition: 'width 0.25s ease',
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
              fontSize: '13.5px',
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
            {isDownloading
              ? `ডাউনলোড হচ্ছে (${toBengaliNum(downloadProgress)}%)...`
              : updateInfo.hasUpdate
              ? `এখনই আপডেট করুন (v${toBengaliNum(updateInfo.latestVersion)})`
              : 'সর্বশেষ APK ডাউনলোড ও ইনস্টল করুন'}
          </button>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <button
              type="button"
              className="md3-btn-tonal"
              disabled={isChecking || isDownloading}
              onClick={onCheckAgain}
              style={{ height: '40px', fontSize: '12px' }}
            >
              {isChecking ? 'চেক হচ্ছে...' : '🔄 আবার চেক করুন'}
            </button>

            <button
              type="button"
              className="md3-btn-outlined"
              onClick={onClose}
              style={{ height: '40px', fontSize: '12px' }}
            >
              বন্ধ করুন
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
