import React from 'react';
import { NavTab } from '../types';
import { toBengaliNum } from '../utils/bengali';

interface BottomNavBarProps {
  currentTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  unpaidCount: number;
}

export const BottomNavBar: React.FC<BottomNavBarProps> = ({
  currentTab,
  onTabChange,
  unpaidCount,
}) => {
  return (
    <nav className="md3-bottom-nav">
      {/* 1. Home / Dashboard */}
      <button
        type="button"
        className={`md3-nav-item ${currentTab === 'home' ? 'active' : ''}`}
        onClick={() => onTabChange('home')}
        aria-label="হোম ড্যাশবোর্ড"
      >
        <div className="md3-nav-pill">
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill={currentTab === 'home' ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
        </div>
        <span className="md3-nav-label">হোম</span>
      </button>

      {/* 2. Customers / Directory */}
      <button
        type="button"
        className={`md3-nav-item ${currentTab === 'customers' ? 'active' : ''}`}
        onClick={() => onTabChange('customers')}
        aria-label="গ্রাহক ডিরেক্টরি"
      >
        <div className="md3-nav-pill">
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill={currentTab === 'customers' ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        </div>
        <span className="md3-nav-label">গ্রাহক</span>
      </button>

      {/* 3. Dues */}
      <button
        type="button"
        className={`md3-nav-item ${currentTab === 'dues' ? 'active' : ''}`}
        onClick={() => onTabChange('dues')}
        aria-label="বকেয়া বিল"
      >
        <div className="md3-nav-pill">
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill={currentTab === 'dues' ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {unpaidCount > 0 && (
            <span className="md3-nav-badge">{toBengaliNum(unpaidCount)}</span>
          )}
        </div>
        <span className="md3-nav-label">বকেয়া</span>
      </button>

      {/* 4. Settings */}
      <button
        type="button"
        className={`md3-nav-item ${currentTab === 'settings' ? 'active' : ''}`}
        onClick={() => onTabChange('settings')}
        aria-label="সেটিংস ও ব্যাকআপ"
      >
        <div className="md3-nav-pill">
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill={currentTab === 'settings' ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </div>
        <span className="md3-nav-label">সেটিংস</span>
      </button>
    </nav>
  );
};
