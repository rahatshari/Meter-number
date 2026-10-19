import React from 'react';
import { Customer } from '../types';
import { isCustomerPaidThisMonth } from '../utils/bengali';

interface ActionModalProps {
  customer: Customer | null;
  onClose: () => void;
  onTogglePayment: (customer: Customer) => void;
  onEdit: (customer: Customer) => void;
  onDelete: (customer: Customer) => void;
}

export const ActionModal: React.FC<ActionModalProps> = ({
  customer,
  onClose,
  onTogglePayment,
  onEdit,
  onDelete,
}) => {
  if (!customer) return null;

  const isPaid = isCustomerPaidThisMonth(customer);

  return (
    <div className="md3-overlay" onClick={onClose}>
      <div className="md3-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="md3-drag-handle" />

        <div style={{ textAlign: 'center', marginBottom: '18px' }}>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--md-sys-color-on-surface)' }}>
            {customer.name}
          </h3>
          <p style={{ margin: '4px 0 0', fontSize: '12.5px', color: 'var(--md-sys-color-on-surface-variant)' }}>
            SMS অ্যাকাউন্ট: {customer.sms}
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {/* Payment Toggle */}
          <button
            type="button"
            className={isPaid ? 'md3-btn-outlined' : 'md3-btn-filled'}
            style={{
              backgroundColor: isPaid ? 'transparent' : 'var(--md-sys-color-success)',
              color: isPaid ? 'var(--md-sys-color-warning)' : '#FFFFFF',
              borderColor: isPaid ? 'var(--md-sys-color-warning)' : 'transparent',
            }}
            onClick={() => {
              onTogglePayment(customer);
              onClose();
            }}
          >
            {isPaid ? '❌ আনপেইড মার্ক করুন' : '✅ বিল পরিশোধিত (Success)'}
          </button>

          {/* Edit */}
          <button
            type="button"
            className="md3-btn-tonal"
            onClick={() => {
              onEdit(customer);
              onClose();
            }}
          >
            ✏️ তথ্য সম্পাদনা করুন
          </button>

          {/* Delete */}
          <button
            type="button"
            className="md3-btn-outlined md3-btn-danger"
            onClick={() => {
              onDelete(customer);
              onClose();
            }}
          >
            🗑️ গ্রাহকের তথ্য মুছে ফেলুন
          </button>

          {/* Cancel */}
          <button
            type="button"
            className="md3-btn-outlined"
            style={{ borderColor: 'transparent', color: 'var(--md-sys-color-on-surface-variant)', marginTop: '4px' }}
            onClick={onClose}
          >
            বাতিল
          </button>
        </div>
      </div>
    </div>
  );
};
