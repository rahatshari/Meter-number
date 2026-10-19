import React from 'react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  okText?: string;
  onOk: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  okText = 'মুছে ফেলুন',
  onOk,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div className="md3-overlay center" onClick={onCancel}>
      <div className="md3-sheet dialog" style={{ maxWidth: '400px' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ textAlign: 'center', marginBottom: '16px' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              backgroundColor: 'var(--md-sys-color-error-container)',
              color: 'var(--md-sys-color-error)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 12px',
              fontSize: '22px',
            }}
          >
            ⚠️
          </div>
          <h3 style={{ margin: '0 0 6px', fontSize: '18px', fontWeight: 700, color: 'var(--md-sys-color-on-surface)' }}>
            {title}
          </h3>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--md-sys-color-on-surface-variant)', lineHeight: 1.5 }}>
            {message}
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <button
            type="button"
            className="md3-btn-outlined"
            onClick={onCancel}
          >
            বাতিল
          </button>

          <button
            type="button"
            className="md3-btn-filled md3-btn-danger"
            onClick={() => {
              onOk();
              onCancel();
            }}
          >
            {okText}
          </button>
        </div>
      </div>
    </div>
  );
};
