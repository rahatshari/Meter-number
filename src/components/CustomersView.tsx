import React, { useRef } from 'react';
import { Customer, StatusFilter } from '../types';
import { toBengaliNum } from '../utils/bengali';
import { CustomerCard } from './CustomerCard';

interface CustomersViewProps {
  customers: Customer[];
  filteredCustomers: Customer[];
  searchQuery: string;
  onSearchChange: (q: string) => void;
  statusFilter: StatusFilter;
  onStatusFilterChange: (s: StatusFilter) => void;
  dateFilter: string;
  onDateFilterChange: (d: string) => void;
  availableDates: number[];
  onSelectCustomer: (c: Customer) => void;
  onCopyText: (text: string, label: string) => void;
  onAddCustomer: () => void;
}

export const CustomersView: React.FC<CustomersViewProps> = ({
  customers,
  filteredCustomers,
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  dateFilter,
  onDateFilterChange,
  availableDates,
  onSelectCustomer,
  onCopyText,
  onAddCustomer,
}) => {
  const searchInputRef = useRef<HTMLInputElement>(null);

  return (
    <div style={{ paddingBottom: '96px' }}>
      {/* Material 3 Search Bar */}
      <div
        style={{
          position: 'relative',
          marginBottom: '12px',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: '14px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--md-sys-color-on-surface-variant)',
            display: 'flex',
            alignItems: 'center',
            pointerEvents: 'none',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </div>

        <input
          ref={searchInputRef}
          type="text"
          className="md3-input"
          style={{ paddingLeft: '42px', paddingRight: searchQuery ? '40px' : '14px', borderRadius: '24px' }}
          placeholder="নাম, মোবাইল, SMS বা ঠিকানা দিয়ে খুঁজুন..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />

        {searchQuery && (
          <button
            type="button"
            style={{
              position: 'absolute',
              right: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              backgroundColor: 'var(--md-sys-color-surface-container-highest)',
              color: 'var(--md-sys-color-on-surface)',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px',
            }}
            onClick={() => {
              onSearchChange('');
              searchInputRef.current?.focus();
            }}
            aria-label="ক্লিয়ার"
          >
            ✕
          </button>
        )}
      </div>

      {/* Material 3 Filter Chips Row */}
      <div className="md3-chip-bar" style={{ marginBottom: '12px' }}>
        <button
          type="button"
          className={`md3-chip ${statusFilter === 'All' ? 'active' : ''}`}
          onClick={() => onStatusFilterChange('All')}
        >
          সব গ্রাহক
        </button>

        <button
          type="button"
          className={`md3-chip ${statusFilter === 'Unpaid' ? 'active' : ''}`}
          onClick={() => onStatusFilterChange('Unpaid')}
        >
          বাকি আছে
        </button>

        <button
          type="button"
          className={`md3-chip ${statusFilter === 'Paid' ? 'active' : ''}`}
          onClick={() => onStatusFilterChange('Paid')}
        >
          পরিশোধিত
        </button>

        {/* Due date filter dropdown chip */}
        <div style={{ position: 'relative' }}>
          <select
            value={dateFilter}
            onChange={(e) => onDateFilterChange(e.target.value)}
            className={`md3-chip ${dateFilter !== 'All' ? 'active' : ''}`}
            style={{
              appearance: 'none',
              WebkitAppearance: 'none',
              paddingRight: '28px',
              cursor: 'pointer',
            }}
          >
            <option value="All">সব তারিখ</option>
            {availableDates.map((d) => (
              <option key={d} value={String(d)}>
                {toBengaliNum(d)} তারিখ
              </option>
            ))}
          </select>
          <span
            style={{
              position: 'absolute',
              right: '10px',
              top: '50%',
              transform: 'translateY(-50%)',
              fontSize: '10px',
              pointerEvents: 'none',
              color: 'currentColor',
            }}
          >
            ▼
          </span>
        </div>
      </div>

      {/* Stats counter badge */}
      <div style={{ textAlign: 'center', marginBottom: '14px' }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '4px 14px',
            borderRadius: '20px',
            backgroundColor: 'var(--md-sys-color-surface-container)',
            border: '1px solid var(--md-sys-color-outline-variant)',
            fontSize: '12px',
            fontWeight: 600,
            color: 'var(--md-sys-color-on-surface-variant)',
          }}
        >
          <span>
            মোট: <strong style={{ color: 'var(--md-sys-color-primary)' }}>{toBengaliNum(filteredCustomers.length)}</strong> জন
          </span>
          {dateFilter !== 'All' && <span>(ফিল্টারকৃত)</span>}
        </span>
      </div>

      {/* Customer List / Empty State */}
      {filteredCustomers.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '40px 16px',
            backgroundColor: 'var(--md-sys-color-surface-container)',
            borderRadius: 'var(--md-shape-corner-lg)',
            border: '1px solid var(--md-sys-color-outline-variant)',
            color: 'var(--md-sys-color-on-surface-variant)',
          }}
        >
          <div style={{ fontSize: '36px', marginBottom: '10px' }}>🔍</div>
          <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--md-sys-color-on-surface)' }}>
            কোনো গ্রাহক পাওয়া যায়নি
          </div>
          <p style={{ fontSize: '12.5px', margin: '4px 0 16px', color: 'var(--md-sys-color-on-surface-variant)' }}>
            অনুসন্ধান কীওয়ার্ড পরিবর্তন করুন অথবা নতুন গ্রাহক যোগ করুন।
          </p>
          <button
            type="button"
            className="md3-btn-filled"
            style={{ width: 'auto', padding: '10px 20px' }}
            onClick={onAddCustomer}
          >
            + নতুন গ্রাহক যোগ করুন
          </button>
        </div>
      ) : (
        filteredCustomers.map((customer, index) => (
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
