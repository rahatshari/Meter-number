import React, { useState, useRef } from 'react';
import { Customer } from '../types';
import {
  toBengaliNum,
  isCustomerPaidThisMonth,
  getCountdownStatus,
} from '../utils/bengali';

interface CustomerCardProps {
  customer: Customer;
  index: number;
  onSelect: (customer: Customer) => void;
  onCopyText: (text: string, label: string) => void;
}

export const CustomerCard: React.FC<CustomerCardProps> = ({
  customer,
  index,
  onSelect,
  onCopyText,
}) => {
  const isPaid = isCustomerPaidThisMonth(customer);
  const countdown = getCountdownStatus(customer.dueDate, isPaid);

  const [copiedMobile, setCopiedMobile] = useState(false);
  const [copiedSms, setCopiedSms] = useState(false);

  const pressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCopyMobile = (e: React.MouseEvent) => {
    e.stopPropagation();
    onCopyText(customer.mobile, 'মোবাইল নম্বর');
    setCopiedMobile(true);
    setTimeout(() => setCopiedMobile(false), 1500);
  };

  const handleCopySms = (e: React.MouseEvent) => {
    e.stopPropagation();
    onCopyText(customer.sms, 'SMS একাউন্ট / মিটার নং');
    setCopiedSms(true);
    setTimeout(() => setCopiedSms(false), 1500);
  };

  const startPress = () => {
    pressTimerRef.current = setTimeout(() => {
      onSelect(customer);
    }, 500);
  };

  const cancelPress = () => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  };

  return (
    <div
      className="md3-card md3-card-interactive"
      style={{
        borderColor: isPaid ? 'rgba(5, 150, 105, 0.35)' : 'var(--md-sys-color-outline-variant)',
      }}
      onClick={() => onSelect(customer)}
      onMouseDown={startPress}
      onMouseUp={cancelPress}
      onMouseLeave={cancelPress}
      onTouchStart={startPress}
      onTouchEnd={cancelPress}
      onTouchMove={cancelPress}
    >
      {/* Header: Serial & Name */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '13px',
              fontWeight: 700,
              backgroundColor: isPaid ? 'var(--md-sys-color-success-container)' : 'var(--md-sys-color-primary-container)',
              color: isPaid ? 'var(--md-sys-color-success)' : 'var(--md-sys-color-primary)',
              flexShrink: 0,
            }}
            className="tabular"
          >
            {isPaid ? '✓' : toBengaliNum(index + 1)}
          </div>
          <div style={{ fontSize: '16.5px', fontWeight: 700, color: 'var(--md-sys-color-on-surface)' }} className="truncate">
            {customer.name}
          </div>
        </div>

        {/* Status Chip */}
        <span
          style={{
            fontSize: '11px',
            fontWeight: 700,
            padding: '3px 8px',
            borderRadius: '12px',
            backgroundColor: isPaid ? 'var(--md-sys-color-success-container)' : 'var(--md-sys-color-warning-container)',
            color: isPaid ? 'var(--md-sys-color-success)' : 'var(--md-sys-color-warning)',
            flexShrink: 0,
          }}
        >
          {isPaid ? 'পরিশোধিত' : 'বকেয়া'}
        </span>
      </div>

      {/* Details (Father, Mother, Address) */}
      <div
        style={{
          fontSize: '12.5px',
          color: 'var(--md-sys-color-on-surface-variant)',
          backgroundColor: 'var(--md-sys-color-surface)',
          padding: '8px 12px',
          borderRadius: '10px',
          marginBottom: '10px',
          lineHeight: 1.6,
          border: '1px solid var(--md-sys-color-outline-variant)',
        }}
      >
        <div style={{ display: 'flex', gap: '6px' }}>
          <strong style={{ color: 'var(--md-sys-color-on-surface)', minWidth: '42px' }}>পিতা:</strong>
          <span>{customer.father || '-'}</span>
        </div>
        {customer.mother && (
          <div style={{ display: 'flex', gap: '6px' }}>
            <strong style={{ color: 'var(--md-sys-color-on-surface)', minWidth: '42px' }}>মাতা:</strong>
            <span>{customer.mother}</span>
          </div>
        )}
        <div style={{ display: 'flex', gap: '6px' }}>
          <strong style={{ color: 'var(--md-sys-color-on-surface)', minWidth: '42px' }}>ঠিকানা:</strong>
          <span>{customer.address || '-'}</span>
        </div>
      </div>

      {/* Material 3 Due Countdown Banner */}
      {countdown && (
        <div
          style={{
            padding: '8px 12px',
            borderRadius: '10px',
            fontSize: '12px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '10px',
            backgroundColor:
              countdown.type === 'paid'
                ? 'var(--md-sys-color-success-container)'
                : countdown.type === 'over'
                ? 'var(--md-sys-color-error-container)'
                : countdown.type === 'warning'
                ? 'var(--md-sys-color-warning-container)'
                : 'var(--md-sys-color-success-container)',
            color:
              countdown.type === 'paid'
                ? 'var(--md-sys-color-on-success-container)'
                : countdown.type === 'over'
                ? 'var(--md-sys-color-error)'
                : countdown.type === 'warning'
                ? 'var(--md-sys-color-warning)'
                : 'var(--md-sys-color-success)',
          }}
        >
          <span>
            {countdown.type === 'paid' && '✓'}
            {countdown.type === 'over' && '⚠️'}
            {countdown.type === 'warning' && '⏳'}
            {countdown.type === 'safe' && '🗓️'}
          </span>
          <span>{countdown.message}</span>
        </div>
      )}

      {/* 1-Tap Copy Rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {/* Mobile Row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '7px 10px',
            borderRadius: '8px',
            backgroundColor: 'var(--md-sys-color-surface)',
            border: '1px solid var(--md-sys-color-outline-variant)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '10.5px', color: 'var(--md-sys-color-on-surface-variant)', fontWeight: 600 }}>
              মোবাইল নম্বর
            </div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--md-sys-color-on-surface)' }} className="tabular truncate">
              {customer.mobile || 'দেওয়া নেই'}
            </div>
          </div>
          <button
            type="button"
            className="md3-icon-btn"
            style={{ width: '32px', height: '32px', borderRadius: '8px' }}
            onClick={handleCopyMobile}
            title="মোবাইল নম্বর কপি করুন"
          >
            {copiedMobile ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--md-sys-color-success)" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            )}
          </button>
        </div>

        {/* SMS / Meter Row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '7px 10px',
            borderRadius: '8px',
            backgroundColor: 'var(--md-sys-color-surface)',
            border: '1px solid var(--md-sys-color-outline-variant)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '10.5px', color: 'var(--md-sys-color-on-surface-variant)', fontWeight: 600 }}>
              SMS অ্যাকাউন্ট / মিটার (১৩ ডিজিট)
            </div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--md-sys-color-on-surface)' }} className="tabular truncate">
              {customer.sms}
            </div>
          </div>
          <button
            type="button"
            className="md3-icon-btn"
            style={{ width: '32px', height: '32px', borderRadius: '8px' }}
            onClick={handleCopySms}
            title="SMS অ্যাকাউন্ট কপি করুন"
          >
            {copiedSms ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--md-sys-color-success)" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
