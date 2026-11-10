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
  const [activeTab, setActiveTab] = useState<'changes' | 'signature' | 'features'>('changes');

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

  // Parse raw release notes text into clean, structured change items
  const parseNotesToItems = (notesText: string) => {
    if (!notesText) return [];
    const lines = notesText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith('#') && !l.startsWith('---'));

    const items: Array<{ title: string; desc: string; icon: string }> = [];

    for (const line of lines) {
      const cleanLine = line.replace(/^[•\-\*]\s*/, '').trim();
      if (!cleanLine) continue;

      let icon = '⚡';
      if (cleanLine.includes('লগইন') || cleanLine.includes('ক্রোম') || cleanLine.includes('Login')) icon = '📱';
      else if (cleanLine.includes('স্প্ল্যাশ') || cleanLine.includes('লোগো') || cleanLine.includes('Splash')) icon = '🖼️';
      else if (cleanLine.includes('প্রোফাইল') || cleanLine.includes('ছবি') || cleanLine.includes('অবতার')) icon = '👤';
      else if (cleanLine.includes('সিঙ্ক') || cleanLine.includes('ক্লাউড') || cleanLine.includes('অফলাইন')) icon = '☁️';
      else if (cleanLine.includes('সিগনেচার') || cleanLine.includes('নিরাপত্তা') || cleanLine.includes('Signature')) icon = '🔒';
      else if (cleanLine.includes('ব্যাকআপ') || cleanLine.includes('এক্সপোর্ট')) icon = '💾';
      else if (cleanLine.includes('ডিজাইন') || cleanLine.includes('UI') || cleanLine.includes('থিম')) icon = '🎨';

      if (cleanLine.includes(':')) {
        const [titlePart, ...rest] = cleanLine.split(':');
        items.push({
          title: titlePart.trim(),
          desc: rest.join(':').trim(),
          icon,
        });
      } else {
        items.push({
          title: cleanLine,
          desc: '',
          icon,
        });
      }
    }

    return items;
  };

  const parsedChanges = parseNotesToItems(updateInfo.releaseNotes);

  const defaultKnownFeatures = [
    {
      icon: '📱',
      title: 'অ্যাপে সরাসরি লগইন',
      desc: 'ক্রোম ব্রাউজারে রিডাইরেক্ট না হয়ে অ্যাপের ভেতর সরাসরি জিমেইল দিয়ে সাইন-ইন।',
    },
    {
      icon: '🖼️',
      title: 'লোগো স্প্ল্যাশ স্ক্রিন',
      desc: 'অ্যাপ চালুর প্রথম মুহূর্তেই বিদ্যুৎ বিলের আসল লোগো সহ আকর্ষণীয় অ্যানিমেশন।',
    },
    {
      icon: '👤',
      title: 'প্রোফাইল ছবি ও মনোগ্রাম',
      desc: 'গুগল রেফারার পলিসি সমস্যার সমাধান এবং ছবি না থাকলেও আকর্ষণীয় মনোগ্রাম অবতার।',
    },
    {
      icon: '☁️',
      title: 'অফলাইন-ফার্স্ট অটো সিঙ্ক',
      desc: 'ইন্টারনেট ছাড়াও সব হিসাব সচল এবং নেট পেলেই ক্লাউডে স্বয়ংক্রিয় ব্যাকআপ।',
    },
    {
      icon: '🔒',
      title: 'একই সিগনেচার (Same Signature)',
      desc: 'অ্যাপ আনইনস্টল ছাড়াই সরাসরি আপডেট; গ্রাহকদের সংরক্ষিত ডেটা কখনো মুছবে না।',
    },
  ];

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

        {/* Header with official APK Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
          <div
            style={{
              width: '50px',
              height: '50px',
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
              style={{ width: '42px', height: '42px', objectFit: 'contain' }}
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
                রিলিজ নোট ও পরিবর্তনসমূহ
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
              GitHub অটো-রিলিজ ও ইন-অ্যাপ লাইভ আপডেট হাব
            </p>
          </div>
        </div>

        {/* Version Comparison Box */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '8px',
            marginBottom: '12px',
          }}
        >
          <div
            style={{
              padding: '8px 12px',
              borderRadius: '12px',
              backgroundColor: 'var(--md-sys-color-surface)',
              border: '1px solid var(--md-sys-color-outline-variant)',
            }}
          >
            <div style={{ fontSize: '10.5px', color: 'var(--md-sys-color-on-surface-variant)' }}>
              বর্তমান ইনস্টলকৃত ভার্সন
            </div>
            <div
              style={{
                fontSize: '14.5px',
                fontWeight: 700,
                color: 'var(--md-sys-color-on-surface)',
                marginTop: '1px',
              }}
            >
              v{toBengaliNum(updateInfo.currentVersion)}
            </div>
            <div style={{ fontSize: '10px', color: 'var(--md-sys-color-on-surface-variant)' }}>
              বিল্ড কোড: #{toBengaliNum(updateInfo.currentVersionCode)}
            </div>
          </div>

          <div
            style={{
              padding: '8px 12px',
              borderRadius: '12px',
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
                fontSize: '10.5px',
                color: updateInfo.hasUpdate
                  ? 'var(--md-sys-color-on-primary-container)'
                  : 'var(--md-sys-color-on-surface-variant)',
              }}
            >
              সর্বশেষ রিলিজ ভার্সন
            </div>
            <div
              style={{
                fontSize: '14.5px',
                fontWeight: 700,
                color: updateInfo.hasUpdate
                  ? 'var(--md-sys-color-primary)'
                  : 'var(--md-sys-color-success)',
                marginTop: '1px',
              }}
            >
              v{toBengaliNum(updateInfo.latestVersion)}
            </div>
            <div style={{ fontSize: '10px', color: 'var(--md-sys-color-on-surface-variant)' }}>
              {updateInfo.hasUpdate ? 'নতুন সংস্করণ উপলব্ধ' : '✓ আপনি আপ-টু-ডেট'}
            </div>
          </div>
        </div>

        {/* Tab Pills for Changelog vs Signature vs Features */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1.2fr 1fr 1fr',
            gap: '4px',
            backgroundColor: 'var(--md-sys-color-surface-container-high)',
            padding: '3px',
            borderRadius: '10px',
            marginBottom: '12px',
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('changes')}
            style={{
              padding: '6px 4px',
              border: 'none',
              borderRadius: '7px',
              fontSize: '11.5px',
              fontWeight: 700,
              backgroundColor: activeTab === 'changes' ? 'var(--md-sys-color-surface-container)' : 'transparent',
              color: activeTab === 'changes' ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-on-surface-variant)',
              boxShadow: activeTab === 'changes' ? 'var(--md-elevation-1)' : 'none',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            📋 পরিবর্তনসমূহ
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('features')}
            style={{
              padding: '6px 4px',
              border: 'none',
              borderRadius: '7px',
              fontSize: '11.5px',
              fontWeight: 700,
              backgroundColor: activeTab === 'features' ? 'var(--md-sys-color-surface-container)' : 'transparent',
              color: activeTab === 'features' ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-on-surface-variant)',
              boxShadow: activeTab === 'features' ? 'var(--md-elevation-1)' : 'none',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            ✨ ফিচারসমূহ
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('signature')}
            style={{
              padding: '6px 4px',
              border: 'none',
              borderRadius: '7px',
              fontSize: '11.5px',
              fontWeight: 700,
              backgroundColor: activeTab === 'signature' ? 'var(--md-sys-color-surface-container)' : 'transparent',
              color: activeTab === 'signature' ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-on-surface-variant)',
              boxShadow: activeTab === 'signature' ? 'var(--md-elevation-1)' : 'none',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            🔒 সিগনেচার
          </button>
        </div>

        {/* TAB 1: DETAILED CHANGELOG & RELEASE NOTES */}
        {activeTab === 'changes' && (
          <div
            style={{
              padding: '12px',
              borderRadius: '12px',
              backgroundColor: 'var(--md-sys-color-surface)',
              border: '1px solid var(--md-sys-color-outline-variant)',
              marginBottom: '14px',
              maxHeight: '170px',
              overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--md-sys-color-on-surface)' }}>
                {updateInfo.hasUpdate
                  ? `🚀 v${toBengaliNum(updateInfo.latestVersion)} আপডেটে কি কি যুক্ত হয়েছে:`
                  : `✓ v${toBengaliNum(updateInfo.currentVersion)} সংস্করণের পরিবর্তনসমূহ:`}
              </span>
              <span style={{ fontSize: '10px', color: 'var(--md-sys-color-primary)', fontWeight: 600 }}>
                {parsedChanges.length > 0 ? `${toBengaliNum(parsedChanges.length)}টি পরিবর্তন` : 'আপ-টু-ডেট'}
              </span>
            </div>

            {parsedChanges.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {parsedChanges.map((item, index) => (
                  <div
                    key={index}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '8px',
                      padding: '8px 10px',
                      borderRadius: '8px',
                      backgroundColor: 'var(--md-sys-color-surface-container-low)',
                      border: '1px solid var(--md-sys-color-outline-variant)',
                    }}
                  >
                    <span style={{ fontSize: '15px', lineHeight: 1.2, flexShrink: 0 }}>
                      {item.icon}
                    </span>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div
                        style={{
                          fontSize: '12px',
                          fontWeight: 700,
                          color: 'var(--md-sys-color-on-surface)',
                          lineHeight: 1.35,
                        }}
                      >
                        {item.title}
                      </div>
                      {item.desc && (
                        <div
                          style={{
                            fontSize: '11px',
                            color: 'var(--md-sys-color-on-surface-variant)',
                            marginTop: '2px',
                            lineHeight: 1.4,
                          }}
                        >
                          {item.desc}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: '12px', color: 'var(--md-sys-color-on-surface-variant)', lineHeight: 1.5 }}>
                {updateInfo.releaseNotes}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: APP FEATURES LIST */}
        {activeTab === 'features' && (
          <div
            style={{
              padding: '12px',
              borderRadius: '12px',
              backgroundColor: 'var(--md-sys-color-surface)',
              border: '1px solid var(--md-sys-color-outline-variant)',
              marginBottom: '14px',
              maxHeight: '170px',
              overflowY: 'auto',
            }}
          >
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--md-sys-color-on-surface)', marginBottom: '8px' }}>
              ✨ বিদ্যুৎ বিল অ্যাপের সক্রিয় সুবিধাসমূহ:
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {defaultKnownFeatures.map((f, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '8px',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    backgroundColor: 'var(--md-sys-color-surface-container-low)',
                    border: '1px solid var(--md-sys-color-outline-variant)',
                  }}
                >
                  <span style={{ fontSize: '15px', lineHeight: 1.2, flexShrink: 0 }}>
                    {f.icon}
                  </span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--md-sys-color-on-surface)' }}>
                      {f.title}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--md-sys-color-on-surface-variant)', marginTop: '2px' }}>
                      {f.desc}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: SIGNATURE & SECURITY */}
        {activeTab === 'signature' && (
          <div
            style={{
              padding: '12px',
              borderRadius: '12px',
              backgroundColor: 'var(--md-sys-color-success-container)',
              color: 'var(--md-sys-color-on-success-container)',
              fontSize: '12px',
              lineHeight: 1.45,
              marginBottom: '14px',
              border: '1px solid var(--md-sys-color-success)',
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: '4px', fontSize: '13px' }}>
              ✓ একই সিগনেচার (Same Signature) সুরক্ষিত
            </div>
            <div style={{ fontSize: '11.5px', marginBottom: '8px' }}>
              এই APK ফাইলটি একই স্থায়ী ডিজিটাল সার্টিফিকেট দিয়ে সাইন করা হয়েছে। যার ফলে:
            </div>
            <ul style={{ margin: '0 0 8px', paddingLeft: '18px', fontSize: '11.5px' }}>
              <li>পূর্বের অ্যাপ আনইনস্টল করতে হবে না।</li>
              <li>গ্রাহকের কোনো ডেটা বা হিসাব মুছে যাবে না।</li>
              <li>এক ক্লিকেই নতুন ফিচার যুক্ত হয়ে আপডেট হবে।</li>
            </ul>
            <div
              style={{
                fontSize: '10.5px',
                fontFamily: 'monospace',
                backgroundColor: 'rgba(255,255,255,0.7)',
                padding: '4px 6px',
                borderRadius: '6px',
                wordBreak: 'break-all',
              }}
            >
              SHA1: {updateInfo.signatureSha1}
            </div>
          </div>
        )}

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
              <span>নতুন APK প্যাকেজ ডাউনলোড হচ্ছে...</span>
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
            {updateInfo.hasUpdate
              ? `আপডেট ডাউনলোড করুন (v${toBengaliNum(updateInfo.latestVersion)})`
              : 'সর্বশেষ APK ডাউনলোড / রি-ইনস্টল করুন'}
          </button>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <button
              type="button"
              className="md3-btn-tonal"
              disabled={isChecking}
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
