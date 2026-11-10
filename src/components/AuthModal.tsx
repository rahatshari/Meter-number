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
  initialTab = 'google', // Default to 1-Click Gmail login
}) => {
  const [activeTab, setActiveTab] = useState<AuthTab>(initialTab);
  const [emailMode, setEmailMode] = useState<EmailAuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [helperNotice, setHelperNotice] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAppendDomain = (domain: string) => {
    const trimmed = email.trim();
    if (!trimmed) {
      setEmail(domain);
      return;
    }
    const atIdx = trimmed.indexOf('@');
    if (atIdx === -1) {
      setEmail(trimmed + domain);
    } else {
      setEmail(trimmed.substring(0, atIdx) + domain);
    }
  };

  const handleGoogleClick = async () => {
    setIsLoading(true);
    setHelperNotice(null);
    try {
      await onGoogleLogin();
      onClose();
    } catch (err: any) {
      console.error('Google login catch in modal:', err);
      // If user closed the popup intentionally, don't show error
      if (err?.code === 'auth/popup-closed-by-user') {
        return;
      }
      setHelperNotice(
        '💡 জিমেইল পপআপে সমস্যা হলে নিচের "পাসওয়ার্ড দিয়ে লগইন" অপশন ব্যবহার করতে পারেন অথবা ইন্টারনেট সংযোগ নিশ্চিত করুন।'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      onShowToast('দয়া করে আপনার জিমেইল/ইমেইল দিন');
      return;
    }
    if (!password) {
      onShowToast('দয়া করে পাসওয়ার্ড দিন');
      return;
    }

    setIsLoading(true);
    setHelperNotice(null);
    try {
      if (emailMode === 'login') {
        await onEmailLogin(cleanEmail, password);
      } else {
        await onEmailRegister(cleanEmail, password);
      }
      onClose();
    } catch (err: any) {
      const errCode = err?.code || '';
      if (
        errCode === 'auth/user-not-found' ||
        errCode === 'auth/invalid-credential' ||
        errCode === 'auth/wrong-password'
      ) {
        setHelperNotice(
          '💡 পাসওয়ার্ড মনে না থাকলে নিচের "পাসওয়ার্ড রিসেট লিংক পাঠান" চাপুন অথবা "শুধু Gmail দিয়ে লগইন" ব্যবহার করুন।'
        );
      } else if (errCode === 'auth/email-already-in-use') {
        setHelperNotice(
          '✓ এই জিমেইলটি আগেই সিস্টেমে রয়েছে। "লগইন" মোড সিলেক্ট করে আপনার পাসওয়ার্ড দিন অথবা Gmail দিয়ে লগইন করুন।'
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgot = async () => {
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      onShowToast('প্রথমে আপনার জিমেইল/ইমেইল ঠিকানাটি লিখুন');
      return;
    }
    setIsLoading(true);
    try {
      await onForgotPassword(cleanEmail);
      setResetSent(true);
      setHelperNotice(
        `✓ আপনার ${cleanEmail} ঠিকানায় পাসওয়ার্ড সেট/রিসেট করার ইমেইল পাঠানো হয়েছে! ইনবক্স চেক করুন।`
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="md3-overlay" onClick={onClose}>
      <div className="md3-sheet" style={{ maxWidth: '440px' }} onClick={(e) => e.stopPropagation()}>
        <div className="md3-drag-handle" />

        <div style={{ textAlign: 'center', marginBottom: '16px' }}>
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '13px',
              backgroundColor: '#FFFFFF',
              border: '1.5px solid var(--md-sys-color-outline-variant)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '8px',
              boxShadow: 'var(--md-elevation-1)',
            }}
          >
            <img src="./icon.png" alt="বিদ্যুৎ বিল" style={{ width: '34px', height: '34px', objectFit: 'contain' }} />
          </div>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--md-sys-color-on-surface)' }}>
            ক্লাউড সিঙ্ক অ্যাকাউন্ট
          </h3>
          <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--md-sys-color-on-surface-variant)' }}>
            সব মোবাইলে একই তথ্য পেতে আপনার Gmail দিয়ে লগইন করুন
          </p>
        </div>

        {/* Tab Selection */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1.2fr 1fr',
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
              padding: '9px 6px',
              border: 'none',
              borderRadius: '9px',
              fontSize: '12.5px',
              fontWeight: 700,
              backgroundColor: activeTab === 'google' ? 'var(--md-sys-color-surface-container)' : 'transparent',
              color: activeTab === 'google' ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-on-surface-variant)',
              boxShadow: activeTab === 'google' ? 'var(--md-elevation-1)' : 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
            onClick={() => setActiveTab('google')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
            শুধু Gmail দিয়ে লগইন
          </button>

          <button
            type="button"
            style={{
              padding: '9px 6px',
              border: 'none',
              borderRadius: '9px',
              fontSize: '12px',
              fontWeight: 600,
              backgroundColor: activeTab === 'email' ? 'var(--md-sys-color-surface-container)' : 'transparent',
              color: activeTab === 'email' ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-on-surface-variant)',
              boxShadow: activeTab === 'email' ? 'var(--md-elevation-1)' : 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
            onClick={() => setActiveTab('email')}
          >
            <span>🔑</span> পাসওয়ার্ড দিয়ে
          </button>
        </div>

        {/* Helper Notice Banner */}
        {helperNotice && (
          <div
            style={{
              padding: '10px 12px',
              borderRadius: '10px',
              backgroundColor: 'var(--md-sys-color-primary-container)',
              color: 'var(--md-sys-color-on-primary-container)',
              fontSize: '12px',
              lineHeight: 1.45,
              marginBottom: '14px',
              border: '1px solid var(--md-sys-color-primary)',
            }}
          >
            {helperNotice}
          </div>
        )}

        {/* 1. PRIMARY DEFAULT: 1-CLICK GMAIL LOGIN */}
        {activeTab === 'google' && (
          <div>
            <div
              style={{
                backgroundColor: 'var(--md-sys-color-surface)',
                border: '1.5px solid var(--md-sys-color-outline-variant)',
                borderRadius: '16px',
                padding: '18px 16px',
                textAlign: 'center',
                marginBottom: '16px',
                boxShadow: 'var(--md-elevation-1)',
              }}
            >
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>⚡</div>
              <h4 style={{ margin: '0 0 6px', fontSize: '16px', fontWeight: 700, color: 'var(--md-sys-color-on-surface)' }}>
                কোনো পাসওয়ার্ড লিখতে হবে না!
              </h4>
              <p
                style={{
                  margin: '0 0 16px',
                  fontSize: '12.5px',
                  color: 'var(--md-sys-color-on-surface-variant)',
                  lineHeight: 1.45,
                }}
              >
                নিচের বাটনে চাপ দিয়ে শুধু আপনার <strong>Gmail</strong> সিলেক্ট করলেই আপনার অ্যাকাউন্ট সরাসরি লগইন হয়ে যাবে।
              </p>

              <button
                type="button"
                className="md3-btn-filled"
                disabled={isLoading}
                onClick={handleGoogleClick}
                style={{
                  width: '100%',
                  height: '52px',
                  fontSize: '15px',
                  fontWeight: 700,
                  backgroundColor: '#FFFFFF',
                  color: '#1F2937',
                  border: '1.5px solid #D1D5DB',
                  boxShadow: '0 3px 8px rgba(0,0,0,0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '12px',
                  borderRadius: '14px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                {isLoading ? 'লগইন হচ্ছে...' : 'Google / Gmail দিয়ে সরাসরি লগইন'}
              </button>
            </div>

            <div style={{ textAlign: 'center' }}>
              <button
                type="button"
                onClick={() => setActiveTab('email')}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '12px',
                  color: 'var(--md-sys-color-primary)',
                  cursor: 'pointer',
                  fontWeight: 600,
                  padding: '4px',
                }}
              >
                পাসওয়ার্ড দিয়ে লগইন করতে চান? এখানে ক্লিক করুন →
              </button>
            </div>
          </div>
        )}

        {/* 2. SECONDARY: EMAIL & PASSWORD (If user ever wants password) */}
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
                  padding: '7px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 700,
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
                  padding: '7px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 700,
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
                <label>আপনার জিমেইল / ইমেইল ঠিকানা *</label>
                <input
                  type="email"
                  className="md3-input"
                  placeholder="যেমন: example@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </div>

              {/* Quick domain buttons */}
              <div style={{ display: 'flex', gap: '6px', marginTop: '-4px', marginBottom: '12px' }}>
                <button
                  type="button"
                  onClick={() => handleAppendDomain('@gmail.com')}
                  className="md3-filter-chip"
                  style={{ padding: '3px 8px', fontSize: '11px', height: 'auto' }}
                >
                  + @gmail.com
                </button>
                <button
                  type="button"
                  onClick={() => handleAppendDomain('@outlook.com')}
                  className="md3-filter-chip"
                  style={{ padding: '3px 8px', fontSize: '11px', height: 'auto' }}
                >
                  + @outlook.com
                </button>
              </div>

              <div className="md3-text-field">
                <label>পাসওয়ার্ড *</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="md3-input"
                    placeholder="পাসওয়ার্ড দিন"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    style={{ paddingRight: '40px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--md-sys-color-on-surface-variant)',
                      fontSize: '14px',
                    }}
                    title={showPassword ? 'পাসওয়ার্ড লুকান' : 'পাসওয়ার্ড দেখুন'}
                  >
                    {showPassword ? '👁️' : '🔒'}
                  </button>
                </div>
              </div>

              {emailMode === 'login' && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <span style={{ fontSize: '11.5px', color: 'var(--md-sys-color-on-surface-variant)' }}>
                    পাসওয়ার্ড মনে নেই?
                  </span>
                  <button
                    type="button"
                    onClick={handleForgot}
                    disabled={isLoading}
                    style={{
                      background: 'none',
                      border: 'none',
                      fontSize: '12px',
                      fontWeight: 700,
                      color: 'var(--md-sys-color-primary)',
                      cursor: 'pointer',
                      padding: '4px 0',
                    }}
                  >
                    {resetSent ? '✓ রিসেট লিংক পাঠানো হয়েছে' : 'পাসওয়ার্ড রিসেট লিংক পাঠান'}
                  </button>
                </div>
              )}

              <button
                type="submit"
                className="md3-btn-filled"
                disabled={isLoading}
                style={{ marginTop: '4px' }}
              >
                {isLoading
                  ? 'অপেক্ষা করুন...'
                  : emailMode === 'login'
                  ? 'লগইন করুন'
                  : 'নতুন অ্যাকাউন্ট তৈরি করুন'}
              </button>
            </form>
          </div>
        )}

        {/* Offline notice & Cancel button */}
        <div style={{ marginTop: '16px', textAlign: 'center' }}>
          <p style={{ margin: '0 0 10px', fontSize: '11px', color: 'var(--md-sys-color-on-surface-variant)' }}>
            ✓ লগইন ছাড়াও আপনার মোবাইলে সব ডেটা সম্পূর্ণ নিরাপদে সংরক্ষিত থাকবে।
          </p>
          <button
            type="button"
            className="md3-btn-outlined"
            style={{ width: '100%', borderColor: 'transparent', color: 'var(--md-sys-color-on-surface-variant)' }}
            onClick={onClose}
          >
            পরে লগইন করব / অফলাইনে চলুন
          </button>
        </div>
      </div>
    </div>
  );
};
