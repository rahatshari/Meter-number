import React from 'react';
import { User } from 'firebase/auth';
import { ThemeMode } from '../types';

interface TopAppBarProps {
  currentUser: User | null;
  themeMode: ThemeMode;
  onToggleTheme: () => void;
  onOpenAccount: () => void;
  onSearchClick: () => void;
  onOpenInstall: () => void;
}

export const TopAppBar: React.FC<TopAppBarProps> = ({
  currentUser,
  themeMode,
  onToggleTheme,
  onOpenAccount,
  onSearchClick,
  onOpenInstall,
}) => {
  return (
    <header className="md3-top-app-bar">
      <div className="flex items-center gap-3 min-w-0">
        <div
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            background: 'var(--md-sys-color-primary)',
            color: 'var(--md-sys-color-on-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            boxShadow: 'var(--md-elevation-1)',
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
          </svg>
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
            }}
            className="truncate"
          >
            বিদ্যুৎ বিল
          </h1>
          <div
            style={{
              fontSize: '11px',
              color: 'var(--md-sys-color-on-surface-variant)',
              lineHeight: 1.2,
            }}
          >
            {currentUser ? 'ক্লাউড সিঙ্ক সক্রিয়' : 'অফলাইন মোড'}
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
          className="md3-icon-btn"
          onClick={onOpenInstall}
          title="অ্যাপ ইনস্টল করুন (Install App)"
          aria-label="অ্যাপ ইনস্টল করুন"
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
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
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
          className="md3-icon-btn md3-tonal-icon-btn relative overflow-hidden"
          onClick={onOpenAccount}
          title="অ্যাকাউন্ট ও ব্যাকআপ"
          aria-label="অ্যাকাউন্ট"
        >
          {currentUser?.photoURL ? (
            <img
              src={currentUser.photoURL}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              alt="User"
            />
          ) : (
            <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--md-sys-color-primary)' }}>
              {currentUser
                ? (currentUser.displayName || currentUser.email || 'U').charAt(0).toUpperCase()
                : '👤'}
            </span>
          )}
          {currentUser && (
            <span
              style={{
                position: 'absolute',
                top: '3px',
                right: '3px',
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: 'var(--md-sys-color-success)',
                border: '1.5px solid var(--md-sys-color-surface)',
              }}
            />
          )}
        </button>
      </div>
    </header>
  );
};
