import React from 'react';
import { Customer } from '../types';
import { toBengaliNum, isCustomerPaidThisMonth, toEnglishNum } from '../utils/bengali';
import { CustomerCard } from './CustomerCard';

interface DashboardViewProps {
  customers: Customer[];
  onNavigateToTab: (tab: 'customers' | 'dues' | 'settings') => void;
  onAddCustomer: () => void;
  onSelectCustomer: (c: Customer) => void;
  onCopyText: (text: string, label: string) => void;
  backupPulse: boolean;
  backupPulseText: string;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  customers,
  onNavigateToTab,
  onAddCustomer,
  onSelectCustomer,
  onCopyText,
  backupPulse,
  backupPulseText,
}) => {
  const currentMonth = new Date().getFullYear() + '-' + (new Date().getMonth() + 1);

  // Exact calculations from real application data
  const totalCustomers = customers.length;
  const paidCustomers = customers.filter((c) => isCustomerPaidThisMonth(c)).length;
  const unpaidCustomers = totalCustomers - paidCustomers;

  // Due today or already overdue in the current month
  const todayDate = new Date().getDate();
  const dueTodayOrOverdue = customers.filter((c) => {
    if (isCustomerPaidThisMonth(c)) return false;
    const dueDay = parseInt(toEnglishNum(String(c.dueDate || '')), 10);
    return !isNaN(dueDay) && dueDay <= todayDate;
  }).length;

  const paidPercentage = totalCustomers > 0 ? Math.round((paidCustomers / totalCustomers) * 100) : 0;

  // Recent 3 customers preview
  const recentCustomers = customers.slice(0, 3);

  return (
    <div style={{ paddingBottom: '96px' }}>
      {/* Live Backup Feedback Banner */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: 'var(--md-sys-color-surface-container)',
          border: '1px solid var(--md-sys-color-outline-variant)',
          borderRadius: 'var(--md-shape-corner-md)',
          padding: '8px 14px',
          marginBottom: '16px',
          boxShadow: 'var(--md-elevation-1)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: 'var(--md-sys-color-success)',
              flexShrink: 0,
            }}
          />
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--md-sys-color-on-surface)' }}>
            রিয়েল-টাইম ডেটা ডিরেক্টরি
          </span>
        </div>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '3px 10px',
            borderRadius: '16px',
            fontSize: '11px',
            fontWeight: 700,
            backgroundColor: backupPulse
              ? 'var(--md-sys-color-success)'
              : 'var(--md-sys-color-primary-container)',
            color: backupPulse ? '#FFFFFF' : 'var(--md-sys-color-on-primary-container)',
            transition: 'all 0.2s',
          }}
        >
          <span>{backupPulse ? backupPulseText : 'স্বয়ংক্রিয় ব্যাকআপ সক্রিয়'}</span>
        </div>
      </div>

      {/* Material 3 KPI Summary Grid (4 Cards) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '12px',
          marginBottom: '18px',
        }}
      >
        {/* Card 1: মোট গ্রাহক */}
        <div
          className="md3-card md3-card-interactive"
          onClick={() => onNavigateToTab('customers')}
          style={{ margin: 0, padding: '16px 14px' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--md-sys-color-on-surface-variant)' }}>
              মোট গ্রাহক
            </span>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'var(--md-sys-color-primary-container)',
                color: 'var(--md-sys-color-on-primary-container)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--md-sys-color-on-surface)' }} className="tabular">
            {toBengaliNum(totalCustomers)} <span style={{ fontSize: '13px', fontWeight: 500 }}>জন</span>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--md-sys-color-on-surface-variant)', marginTop: '4px' }}>
            সম্পূর্ণ ডাটাবেজ
          </div>
        </div>

        {/* Card 2: বিল পরিশোধিত */}
        <div
          className="md3-card md3-card-interactive"
          onClick={() => onNavigateToTab('customers')}
          style={{ margin: 0, padding: '16px 14px' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--md-sys-color-success)' }}>
              বিল পরিশোধিত
            </span>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'var(--md-sys-color-success-container)',
                color: 'var(--md-sys-color-success)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--md-sys-color-success)' }} className="tabular">
            {toBengaliNum(paidCustomers)} <span style={{ fontSize: '13px', fontWeight: 500 }}>জন</span>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--md-sys-color-on-surface-variant)', marginTop: '4px' }}>
            {toBengaliNum(paidPercentage)}% সম্পন্ন
          </div>
        </div>

        {/* Card 3: বিল বকেয়া */}
        <div
          className="md3-card md3-card-interactive"
          onClick={() => onNavigateToTab('dues')}
          style={{ margin: 0, padding: '16px 14px' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--md-sys-color-warning)' }}>
              বিল বকেয়া
            </span>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'var(--md-sys-color-warning-container)',
                color: 'var(--md-sys-color-warning)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--md-sys-color-warning)' }} className="tabular">
            {toBengaliNum(unpaidCustomers)} <span style={{ fontSize: '13px', fontWeight: 500 }}>জন</span>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--md-sys-color-on-surface-variant)', marginTop: '4px' }}>
            পরিশোধ বাকি আছে
          </div>
        </div>

        {/* Card 4: চলতি মাসের বকেয়া গ্রাহক (সময় শেষ / আজকের মধ্যে) */}
        <div
          className="md3-card md3-card-interactive"
          onClick={() => onNavigateToTab('dues')}
          style={{ margin: 0, padding: '16px 14px' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--md-sys-color-error)' }}>
              জরুরি বকেয়া
            </span>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'var(--md-sys-color-error-container)',
                color: 'var(--md-sys-color-error)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--md-sys-color-error)' }} className="tabular">
            {toBengaliNum(dueTodayOrOverdue)} <span style={{ fontSize: '13px', fontWeight: 500 }}>জন</span>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--md-sys-color-on-surface-variant)', marginTop: '4px' }}>
            সময় অতিক্রান্ত বা শেষ
          </div>
        </div>
      </div>

      {/* Overdue Urgent Alert Banner */}
      {dueTodayOrOverdue > 0 && (
        <div
          style={{
            backgroundColor: 'var(--md-sys-color-error-container)',
            border: '1px solid var(--md-sys-color-error)',
            borderRadius: 'var(--md-shape-corner-md)',
            padding: '12px 16px',
            marginBottom: '18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
            <span style={{ fontSize: '20px' }}>⚠️</span>
            <div style={{ fontSize: '13px', color: 'var(--md-sys-color-on-error-container)', lineHeight: 1.4 }}>
              <strong>{toBengaliNum(dueTodayOrOverdue)} জন</strong> গ্রাহকের চলতি মাসের বিলের সময় ইতিমধ্যে শেষ হয়েছে!
            </div>
          </div>
          <button
            type="button"
            className="md3-btn-tonal"
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              width: 'auto',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
            onClick={() => onNavigateToTab('dues')}
          >
            তালিকা দেখুন
          </button>
        </div>
      )}

      {/* Quick Action Buttons Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '22px' }}>
        <button
          type="button"
          className="md3-btn-filled"
          style={{ padding: '10px 8px', fontSize: '12.5px', borderRadius: '12px' }}
          onClick={onAddCustomer}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          নতুন গ্রাহক
        </button>

        <button
          type="button"
          className="md3-btn-tonal"
          style={{ padding: '10px 8px', fontSize: '12.5px', borderRadius: '12px' }}
          onClick={() => onNavigateToTab('dues')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          বকেয়া খাতা
        </button>

        <button
          type="button"
          className="md3-btn-outlined"
          style={{ padding: '10px 8px', fontSize: '12.5px', borderRadius: '12px' }}
          onClick={() => onNavigateToTab('settings')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          ব্যাকআপ হাব
        </button>
      </div>

      {/* Recent Customers Section */}
      <div style={{ marginBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--md-sys-color-on-surface)' }}>
            সাম্প্রতিক গ্রাহকগণ
          </h2>
          <button
            type="button"
            style={{
              background: 'none',
              border: 'none',
              fontSize: '12.5px',
              fontWeight: 600,
              color: 'var(--md-sys-color-primary)',
              cursor: 'pointer',
              padding: 0,
            }}
            onClick={() => onNavigateToTab('customers')}
          >
            সব দেখুন ({toBengaliNum(totalCustomers)}) →
          </button>
        </div>

        {recentCustomers.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '30px 16px',
              backgroundColor: 'var(--md-sys-color-surface-container)',
              borderRadius: 'var(--md-shape-corner-lg)',
              border: '1px solid var(--md-sys-color-outline-variant)',
              color: 'var(--md-sys-color-on-surface-variant)',
            }}
          >
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>👤</div>
            <div style={{ fontSize: '14px', fontWeight: 600 }}>কোনো গ্রাহক যোগ করা হয়নি</div>
            <p style={{ fontSize: '12px', margin: '4px 0 12px' }}>
              নিচের "নতুন গ্রাহক" বাটনে ট্যাপ করে প্রথম গ্রাহক যোগ করুন।
            </p>
            <button
              type="button"
              className="md3-btn-filled"
              style={{ width: 'auto', padding: '8px 18px', fontSize: '13px' }}
              onClick={onAddCustomer}
            >
              + নতুন গ্রাহক যোগ করুন
            </button>
          </div>
        ) : (
          recentCustomers.map((customer, index) => (
            <CustomerCard
              key={customer.id}
              customer={customer}
              index={index}
              onSelect={onSelectCustomer}
              onCopyText={onCopyText}
            />
          ))
        )}
      </div>
    </div>
  );
};
