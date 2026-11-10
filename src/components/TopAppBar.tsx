import React from 'react';
import { User } from 'firebase/auth';
import { ThemeMode } from '../types';
import { toBengaliNum } from '../utils/bengali';
import { UserAvatar } from './UserAvatar';

interface TopAppBarProps {
  currentUser: User | null;
  themeMode: ThemeMode;
  isOnline: boolean;
  pendingSyncCount: number;
  isSyncing: boolean;
  hasUpdate: boolean;
  appVersion: string;
  onToggleTheme: () => void;
  onOpenAccount: () => void;
  onSearchClick: () => void;
  onOpenUpdateModal: () => void;
}

export const TopAppBar: React.FC<TopAppBarProps> = ({
  currentUser,
  themeMode,
  isOnline,
  pendingSyncCount,
  isSyncing,
  hasUpdate,
  appVersion,
  onToggleTheme,
  onOpenAccount,
  onSearchClick,
  onOpenUpdateModal,
}) => {
  const getSubtitleStatus = () => {
    if (!isOnline) {
      return pendingSyncCount > 0
        ? `অফলাইন · ${toBengaliNum(pendingSyncCount)}টি কাজ অটো-আপলোডের অপেক্ষায়`
        : 'অফলাইন মোড · ইন্টারনেট ছাড়াই সচল';
    }
    if (isSyncing || pendingSyncCount > 0) {
      return `অটো-আপলোড হচ্ছে (${toBengaliNum(pendingSyncCount)}টি)...`;
    }
    if (currentUser) {
      return 'অনলাইন · স্বয়ংক্রিয় ক্লাউড সিঙ্ক সক্রিয়';
    }
    return `অফলাইন-ফার্স্ট · v${toBengaliNum(appVersion)}`;
  };

  return (
    <header className="md3-top-app-bar">
      <div className="flex items-center gap-3 min-w-0">
        <div
          style={{
            width: '38px',
            height: '38px',
            borderRadius: '11px',
            backgroundColor: '#FFFFFF',
            border: '1px solid var(--md-sys-color-outline-variant)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            boxShadow: 'var(--md-elevation-1)',
            overflow: 'hidden',
          }}
        >
          <img
            src="./icon.png"
            alt="বিদ্যুৎ বিল লোগো"
            style={{ width: '32px', height: '32px', objectFit: 'contain' }}
          />
        </div>
        <div className="min-w-0">
          <h1
            style={{
              margin: 0,
              fontSize: '17px',
              fontWeight: 700,
              color: 'var(--md-sys-color-on-surface)',
              letterSpacing: '-0.2px',
              lineHeight: 1.2,
              whiteSpace: 'nowrap',
            }}
          >
            বিদ্যুৎ বিল
          </h1>
          <div
            style={{
              fontSize: '11px',
              color: !isOnline
                ? 'var(--md-sys-color-warning)'
                : 'var(--md-sys-color-on-surface-variant)',
              fontWeight: !isOnline ? 600 : 400,
              lineHeight: 1.25,
            }}
            className="truncate"
          >
            {getSubtitleStatus()}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          className="md3-icon-btn"
          onClick={onSearchClick}
          title="খুঁজুন"
          aria-label="খুঁজুন"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </button>

        <button
          type="button"
          className="md3-icon-btn relative"
          onClick={onOpenUpdateModal}
          title="অ্যাপ আপডেট চেক করুন"
          aria-label="অ্যাপ আপডেট সেন্টার"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
            <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
            <path d="M16 16h5v5" />
          </svg>
          {hasUpdate && (
            <span
              style={{
                position: 'absolute',
                top: '5px',
                right: '5px',
                width: '9px',
                height: '9px',
                borderRadius: '50%',
                backgroundColor: 'var(--md-sys-color-error)',
                border: '1.5px solid var(--md-sys-color-surface)',
              }}
            />
          )}
        </button>

        <button
          type="button"
          className="md3-icon-btn"
          onClick={onToggleTheme}
          title={themeMode === 'dark' ? 'লাইট মোড চালু করুন' : 'ডার্ক মোড চালু করুন'}
          aria-label="থিম পরিবর্তন"
        >
          {themeMode === 'dark' ? (
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="5" />
              <line x1="12" y1="1" x2="12" y2="3" />
              <line x1="12" y1="21" x2="12" y2="23" />
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
              <line x1="1" y1="12" x2="3" y2="12" />
              <line x1="21" y1="12" x2="23" y2="12" />
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </svg>
          ) : (
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          )}
        </button>

        <button
          type="button"
          className="md3-icon-btn md3-tonal-icon-btn p-0"
          onClick={onOpenAccount}
          title="অ্যাকাউন্ট ও ব্যাকআপ"
          aria-label="অ্যাকাউন্ট"
          style={{ width: '38px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <UserAvatar user={currentUser} size={34} showStatusDot={true} />
        </button>
      </div>
    </header>
  );
};
