import React, { useState } from 'react';
import { AuthTab, EmailAuthMode } from '../types';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGoogleLogin: () => Promise<void>;
  onEmailLogin: (email: string, pass: string) => Promise<void>;
  onEmailRegister: (email: string, pass: string) => Promise<void>;
  onForgotPassword: (email: string) => Promise<void>;
  onShowToast: (msg: string) => void;
  initialTab?: AuthTab;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onGoogleLogin,
  onEmailLogin,
  onEmailRegister,
  onForgotPassword,
  onShowToast,
  initialTab = 'google',
}) => {
  const [activeTab, setActiveTab] = useState<AuthTab>(initialTab);
  const [emailMode, setEmailMode] = useState<EmailAuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      onShowToast('দয়া করে ইমেইল ও পাসওয়ার্ড দিন');
      return;
    }

    setIsLoading(true);
    try {
      if (emailMode === 'login') {
        await onEmailLogin(email.trim(), password);
      } else {
        await onEmailRegister(email.trim(), password);
      }
      onClose();
    } catch {
      // Handled in parent
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgot = async () => {
    if (!email.trim()) {
      onShowToast('প্রথমে ইমেইল ইনপুটে আপনার ইমেইল দিন');
      return;
    }
    await onForgotPassword(email.trim());
  };

  return (
    <div className="md3-overlay" onClick={onClose}>
      <div className="md3-sheet" style={{ maxWidth: '420px' }} onClick={(e) => e.stopPropagation()}>
        <div className="md3-drag-handle" />

        <div style={{ textAlign: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--md-sys-color-on-surface)' }}>
            ক্লাউড সিঙ্ক অ্যাকাউন্ট
          </h3>
          <p style={{ margin: '4px 0 0', fontSize: '12.5px', color: 'var(--md-sys-color-on-surface-variant)' }}>
            সব মোবাইলে একই তথ্য পেতে লগইন করুন
          </p>
        </div>

        {/* Tab Selector */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '4px',
            backgroundColor: 'var(--md-sys-color-surface-container-high)',
            padding: '3px',
            borderRadius: '12px',
            marginBottom: '16px',
          }}
        >
          <button
            type="button"
            style={{
              padding: '8px',
              border: 'none',
              borderRadius: '9px',
              fontSize: '12.5px',
              fontWeight: 600,
              backgroundColor: activeTab === 'google' ? 'var(--md-sys-color-surface-container)' : 'transparent',
              color: activeTab === 'google' ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-on-surface-variant)',
              boxShadow: activeTab === 'google' ? 'var(--md-elevation-1)' : 'none',
              cursor: 'pointer',
            }}
            onClick={() => setActiveTab('google')}
          >
            Google লগইন
          </button>
          <button
            type="button"
            style={{
              padding: '8px',
              border: 'none',
              borderRadius: '9px',
              fontSize: '12.5px',
              fontWeight: 600,
              backgroundColor: activeTab === 'email' ? 'var(--md-sys-color-surface-container)' : 'transparent',
              color: activeTab === 'email' ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-on-surface-variant)',
              boxShadow: activeTab === 'email' ? 'var(--md-elevation-1)' : 'none',
              cursor: 'pointer',
            }}
            onClick={() => setActiveTab('email')}
          >
            ইমেইল ও পাসওয়ার্ড
          </button>
        </div>

        {/* Google View */}
        {activeTab === 'google' && (
          <div>
            <button
              type="button"
              className="md3-btn-outlined"
              style={{
                width: '100%',
                justifyContent: 'center',
                height: '48px',
                fontSize: '14.5px',
                fontWeight: 700,
                backgroundColor: 'var(--md-sys-color-surface-container)',
              }}
              onClick={async () => {
                await onGoogleLogin();
                onClose();
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              Google দিয়ে এক ক্লিকে লগইন
            </button>
          </div>
        )}

        {/* Email View */}
        {activeTab === 'email' && (
          <div>
            <div
              style={{
                display: 'flex',
                gap: '4px',
                marginBottom: '12px',
                backgroundColor: 'var(--md-sys-color-surface-container-high)',
                padding: '3px',
                borderRadius: '8px',
              }}
            >
              <button
                type="button"
                style={{
                  flex: 1,
                  border: 'none',
                  padding: '6px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  backgroundColor: emailMode === 'login' ? 'var(--md-sys-color-surface-container)' : 'transparent',
                  color: emailMode === 'login' ? 'var(--md-sys-color-on-surface)' : 'var(--md-sys-color-on-surface-variant)',
                  cursor: 'pointer',
                }}
                onClick={() => setEmailMode('login')}
              >
                লগইন
              </button>
              <button
                type="button"
                style={{
                  flex: 1,
                  border: 'none',
                  padding: '6px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  backgroundColor: emailMode === 'register' ? 'var(--md-sys-color-surface-container)' : 'transparent',
                  color: emailMode === 'register' ? 'var(--md-sys-color-on-surface)' : 'var(--md-sys-color-on-surface-variant)',
                  cursor: 'pointer',
                }}
                onClick={() => setEmailMode('register')}
              >
                নতুন অ্যাকাউন্ট
              </button>
            </div>

            <form onSubmit={handleEmailSubmit}>
              <div className="md3-text-field">
                <label>ইমেইল ঠিকানা *</label>
                <input
                  type="email"
                  className="md3-input"
                  placeholder="আপনার ইমেইল দিন"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="md3-text-field">
                <label>পাসওয়ার্ড *</label>
                <input
                  type="password"
                  className="md3-input"
                  placeholder="কমপক্ষে ৬ অক্ষরের পাসওয়ার্ড"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>

              {emailMode === 'login' && (
                <div style={{ textAlign: 'right', marginBottom: '10px' }}>
                  <button
                    type="button"
                    onClick={handleForgot}
                    style={{
                      background: 'none',
                      border: 'none',
                      fontSize: '11.5px',
                      color: 'var(--md-sys-color-primary)',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    পাসওয়ার্ড ভুলে গেছেন?
                  </button>
                </div>
              )}

              <button type="submit" className="md3-btn-filled" disabled={isLoading} style={{ marginTop: '6px' }}>
                {isLoading ? 'অপেক্ষা করুন...' : emailMode === 'login' ? 'লগইন করুন' : 'নতুন অ্যাকাউন্ট তৈরি করুন'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
