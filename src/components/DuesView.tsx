import React, { useState } from 'react';
import { Customer } from '../types';
import {
  toBengaliNum,
  isCustomerPaidThisMonth,
  toEnglishNum,
} from '../utils/bengali';
import { CustomerCard } from './CustomerCard';

interface DuesViewProps {
  customers: Customer[];
  onSelectCustomer: (c: Customer) => void;
  onCopyText: (text: string, label: string) => void;
  onShowToast: (msg: string) => void;
  availableDates: number[];
}

export const DuesView: React.FC<DuesViewProps> = ({
  customers,
  onSelectCustomer,
  onCopyText,
  onShowToast,
  availableDates,
}) => {
  const [selectedDate, setSelectedDate] = useState<string>('All');

  // Filter only unpaid customers
  const unpaidCustomers = customers.filter((c) => !isCustomerPaidThisMonth(c));

  const filteredUnpaid = unpaidCustomers.filter((c) => {
    if (selectedDate === 'All') return true;
    return toEnglishNum(String(c.dueDate || '')).trim() === selectedDate;
  });

  const handleCopyUnpaidWhatsApp = () => {
    if (unpaidCustomers.length === 0) {
      onShowToast('আলহামদুলিল্লাহ! কোনো বকেয়া বিল নেই।');
      return;
    }

    const now = new Date();
    const monthName = now.toLocaleString('bn-BD', { month: 'long', year: 'numeric' });

    let summary = `⚡ বিদ্যুৎ বিল বকেয়া তালিকা (${monthName})\n`;
    summary += `মোট বকেয়া গ্রাহক: ${toBengaliNum(unpaidCustomers.length)} জন\n`;
    summary += `------------------------------\n`;

    unpaidCustomers.forEach((c, i) => {
      summary += `${toBengaliNum(i + 1)}. ${c.name}`;
      if (c.mobile) summary += ` | মোবা: ${c.mobile}`;
      if (c.sms) summary += ` | SMS: ${c.sms}`;
      if (c.dueDate) summary += ` | শেষ তারিখ: ${toBengaliNum(c.dueDate)}`;
      summary += `\n`;
    });

    onCopyText(summary, 'বকেয়া তালিকা');
  };

  return (
    <div style={{ paddingBottom: '96px' }}>
      {/* Header card with summary & WhatsApp Copy trigger */}
      <div
        className="md3-card"
        style={{
          background: 'linear-gradient(135deg, var(--md-sys-color-warning-container), var(--md-sys-color-surface-container))',
          borderColor: 'var(--md-sys-color-warning)',
          marginBottom: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--md-sys-color-warning)' }}>
              চলতি মাসের বকেয়া খাতা
            </div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--md-sys-color-on-surface)', marginTop: '2px' }} className="tabular">
              {toBengaliNum(unpaidCustomers.length)} জন বকেয়া
            </div>
            <div style={{ fontSize: '12px', color: 'var(--md-sys-color-on-surface-variant)', marginTop: '2px' }}>
              তালিকাভুক্ত গ্রাহকদের বিল পরিশোধ বাকি রয়েছে।
            </div>
          </div>

          <button
            type="button"
            className="md3-btn-filled"
            style={{
              width: 'auto',
              padding: '8px 14px',
              fontSize: '12.5px',
              backgroundColor: 'var(--md-sys-color-warning)',
              color: '#FFFFFF',
              boxShadow: 'var(--md-elevation-1)',
            }}
            onClick={handleCopyUnpaidWhatsApp}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
            বকেয়া সামারি কপি
          </button>
        </div>
      </div>

      {/* Date Filter Chips for Dues */}
      <div className="md3-chip-bar" style={{ marginBottom: '14px' }}>
        <button
          type="button"
          className={`md3-chip ${selectedDate === 'All' ? 'active' : ''}`}
          onClick={() => setSelectedDate('All')}
        >
          সব তারিখ ({toBengaliNum(unpaidCustomers.length)})
        </button>

        {availableDates.map((d) => {
          const countForDate = unpaidCustomers.filter(
            (c) => toEnglishNum(String(c.dueDate || '')).trim() === String(d)
          ).length;
          if (countForDate === 0) return null;
          return (
            <button
              key={d}
              type="button"
              className={`md3-chip ${selectedDate === String(d) ? 'active' : ''}`}
              onClick={() => setSelectedDate(String(d))}
            >
              {toBengaliNum(d)} তারিখ ({toBengaliNum(countForDate)})
            </button>
          );
        })}
      </div>

      {/* Unpaid List or All Paid Empty State */}
      {filteredUnpaid.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '48px 16px',
            backgroundColor: 'var(--md-sys-color-surface-container)',
            borderRadius: 'var(--md-shape-corner-lg)',
            border: '1px solid var(--md-sys-color-outline-variant)',
            color: 'var(--md-sys-color-on-surface-variant)',
          }}
        >
          <div style={{ fontSize: '40px', marginBottom: '10px' }}>🎉</div>
          <div style={{ fontSize: '17px', fontWeight: 700, color: 'var(--md-sys-color-success)' }}>
            আলহামদুলিল্লাহ! কোনো বকেয়া বিল নেই
          </div>
          <p style={{ fontSize: '13px', margin: '6px 0 0', color: 'var(--md-sys-color-on-surface-variant)' }}>
            এই তালিকার সকল গ্রাহকের বর্তমান মাসের বিল পরিশোধ সম্পন্ন হয়েছে।
          </p>
        </div>
      ) : (
        filteredUnpaid.map((customer, index) => (
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
  );
};
