import React, { useState, useEffect, useRef } from 'react';
import { AuthTab, EmailAuthMode } from '../types';
import {
  getSavedGmailAccounts,
  recordSavedGmailAccount,
  removeSavedGmailAccount,
  normalizeGmailInput,
} from '../utils/authHelpers';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGoogleLogin: () => Promise<void>;
  onJustEmailLogin: (email: string) => Promise<void>;
  onEmailLogin: (email: string, pass: string) => Promise<void>;
  onEmailRegister: (email: string, pass: string) => Promise<void>;
  onForgotPassword: (email: string) => Promise<void>;
  onShowToast: (msg: string) => void;
  initialTab?: AuthTab;
}

const AVATAR_COLORS = [
  '#1A73E8',
  '#0F9D58',
  '#D93025',
  '#F29900',
  '#9334E6',
  '#00897B',
];

function getAvatarColor(email: string): string {
  let sum = 0;
  for (let i = 0; i < email.length; i++) {
    sum += email.charCodeAt(i);
  }
  return AVATAR_COLORS[sum % AVATAR_COLORS.length];
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onGoogleLogin,
  onJustEmailLogin,
  onEmailLogin,
  onEmailRegister,
  onForgotPassword,
  onShowToast,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [emailMode, setEmailMode] = useState<EmailAuthMode>('login');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingAccount, setLoadingAccount] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);
  const [helperNotice, setHelperNotice] = useState<{
    type: 'info' | 'warning' | 'success';
    text: string;
  } | null>(null);
  const [savedAccounts, setSavedAccounts] = useState<string[]>([]);
  const emailInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      const accounts = getSavedGmailAccounts();
      setSavedAccounts(accounts);
      setHelperNotice(null);
      setLoadingAccount(null);
      setEmail('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // 1-Tap Login directly from previously used Gmail accounts on this device
  const handleInstantAccountTap = async (selectedGmail: string) => {
    const cleanEmail = normalizeGmailInput(selectedGmail);
    if (!cleanEmail) return;

    setIsLoading(true);
    setLoadingAccount(cleanEmail);
    setHelperNotice(null);
    try {
      await onJustEmailLogin(cleanEmail);
      recordSavedGmailAccount(cleanEmail);
      setSavedAccounts(getSavedGmailAccounts());
      onClose();
    } catch (err: any) {
      console.error('1-Tap Gmail Login error:', err);
      setHelperNotice({
        type: 'warning',
        text: 'লগইন করতে সমস্যা হয়েছে। অনুগ্রহ করে ইন্টারনেট সংযোগ চেক করে আবার চেষ্টা করুন।',
      });
    } finally {
      setIsLoading(false);
      setLoadingAccount(null);
    }
  };

  // Direct Gmail Login for any typed Gmail address
  const handleDirectGmailLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanEmail = normalizeGmailInput(email);
    if (!cleanEmail) {
      onShowToast('দয়া করে আপনার Gmail ঠিকানা লিখুন');
      emailInputRef.current?.focus();
      return;
    }

    setIsLoading(true);
    setLoadingAccount(cleanEmail);
    setHelperNotice(null);
    try {
      await onJustEmailLogin(cleanEmail);
      recordSavedGmailAccount(cleanEmail);
      setSavedAccounts(getSavedGmailAccounts());
      setEmail('');
      onClose();
    } catch (err: any) {
      console.error('Direct Gmail Login failed:', err);
      setHelperNotice({
        type: 'warning',
        text: 'সঠিক Gmail ঠিকানা লিখুন (যেমন: name@gmail.com) এবং ইন্টারনেট সংযোগ চালু রাখুন।',
      });
    } finally {
      setIsLoading(false);
      setLoadingAccount(null);
    }
  };

  // Browser / Native Google Popup with fallback only if user typed an email
  const handleGoogleClick = async () => {
    setIsLoading(true);
    setHelperNotice(null);
    try {
      await onGoogleLogin();
      onClose();
    } catch (err: any) {
      const errCode = err?.code || '';
      if (errCode === 'auth/popup-closed-by-user') {
        setIsLoading(false);
        return;
      }

      const typedEmail = normalizeGmailInput(email);
      if (typedEmail) {
        try {
          await onJustEmailLogin(typedEmail);
          recordSavedGmailAccount(typedEmail);
          setSavedAccounts(getSavedGmailAccounts());
          setEmail('');
          onClose();
          return;
        } catch (fallbackErr) {
          console.error('Fallback login error:', fallbackErr);
        }
      }

      setHelperNotice({
        type: 'info',
        text: 'উপরের বক্সে আপনার ইচ্ছামতো যেকোনো Gmail লিখে "Gmail দিয়ে লগইন করুন" বাটনে ট্যাপ করুন।',
      });
      emailInputRef.current?.focus();
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveSaved = (e: React.MouseEvent, acc: string) => {
    e.stopPropagation();
    const updated = removeSavedGmailAccount(acc);
    setSavedAccounts(updated);
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = normalizeGmailInput(email);
    if (!cleanEmail || !password) {
      onShowToast('দয়া করে আপনার Gmail এবং পাসওয়ার্ড দিন');
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
      recordSavedGmailAccount(cleanEmail);
      onClose();
    } catch (err: any) {
      setHelperNotice({
        type: 'warning',
        text: 'পাসওয়ার্ড মেলেনি। পাসওয়ার্ড ছাড়াই সরাসরি লগইন করতে উপরের Gmail অপশনটি ব্যবহার করুন।',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgot = async () => {
    const cleanEmail = normalizeGmailInput(email);
    if (!cleanEmail) {
      onShowToast('প্রথমে উপরের বক্সে আপনার জিমেইল ঠিকানাটি লিখুন');
      emailInputRef.current?.focus();
      return;
    }
    setIsLoading(true);
    try {
      await onForgotPassword(cleanEmail);
      setResetSent(true);
      setHelperNotice({
        type: 'success',
        text: `✓ আপনার ${cleanEmail} ঠিকানায় পাসওয়ার্ড রিসেট লিংক পাঠানো হয়েছে!`,
      });
      onShowToast('✓ পাসওয়ার্ড রিসেট লিংক পাঠানো হয়েছে');
    } catch (err: any) {
      setHelperNotice({
        type: 'warning',
        text: 'রিসেট লিংক পাঠানো যায়নি: ' + (err?.message || 'পুনরায় চেষ্টা করুন'),
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="md3-overlay" onClick={onClose}>
      <div
        className="md3-sheet"
        style={{ maxWidth: '440px', maxHeight: '92vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="md3-drag-handle" />

        {/* Google Sign-In Header */}
        <div style={{ textAlign: 'center', marginBottom: '16px' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              marginBottom: '8px',
              padding: '6px 14px',
              borderRadius: '999px',
              backgroundColor: 'var(--md-sys-color-surface-container)',
              border: '1px solid var(--md-sys-color-outline-variant)',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--md-sys-color-on-surface)' }}>
              Google ফায়ারবেস ক্লাউড লগইন
            </span>
          </div>

          <h3 style={{ margin: 0, fontSize: '19px', fontWeight: 700, color: 'var(--md-sys-color-on-surface)' }}>
            Gmail দিয়ে লগইন করুন
          </h3>
          <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--md-sys-color-on-surface-variant)' }}>
            আপনার ইচ্ছামতো যেকোনো Gmail দিয়ে সরাসরি লগইন ও ক্লাউড সিঙ্ক করুন
          </p>
        </div>

        {/* Notice alert banner if any */}
        {helperNotice && (
          <div
            style={{
              padding: '10px 12px',
              borderRadius: '10px',
              backgroundColor:
                helperNotice.type === 'warning'
                  ? '#FEF2F2'
                  : helperNotice.type === 'success'
                  ? '#F0FDF4'
                  : 'var(--md-sys-color-primary-container)',
              color:
                helperNotice.type === 'warning'
                  ? '#991B1B'
                  : helperNotice.type === 'success'
                  ? '#166534'
                  : 'var(--md-sys-color-on-primary-container)',
              fontSize: '12px',
              lineHeight: 1.45,
              marginBottom: '12px',
              border: `1px solid ${
                helperNotice.type === 'warning'
                  ? '#F87171'
                  : helperNotice.type === 'success'
                  ? '#86EFAC'
                  : 'var(--md-sys-color-primary)'
              }`,
            }}
          >
            {helperNotice.text}
          </div>
        )}

        {/* 1. PRIMARY: ENTER ANY GMAIL ADDRESS (NO DEFAULT GMAIL PRE-FILLED) */}
        <form
          onSubmit={handleDirectGmailLogin}
          style={{
            backgroundColor: 'var(--md-sys-color-surface)',
            border: '2px solid var(--md-sys-color-primary)',
            borderRadius: '16px',
            padding: '14px',
            marginBottom: '14px',
            boxShadow: 'var(--md-elevation-1)',
          }}
        >
          <div className="md3-text-field" style={{ marginBottom: '12px' }}>
            <label>আপনার Gmail ঠিকানা লিখুন</label>
            <input
              ref={emailInputRef}
              type="text"
              inputMode="email"
              autoCapitalize="none"
              autoCorrect="off"
              className="md3-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="যেমন: example@gmail.com"
            />
          </div>

          <button
            type="submit"
            className="md3-btn-filled"
            disabled={isLoading || !email.trim()}
            style={{
              width: '100%',
              height: '46px',
              fontSize: '14px',
              fontWeight: 700,
              justifyContent: 'center',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              borderRadius: '12px',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
              <polyline points="10 17 15 12 10 7" />
              <line x1="15" y1="12" x2="3" y2="12" />
            </svg>
            {isLoading && loadingAccount === normalizeGmailInput(email)
              ? 'লগইন হচ্ছে...'
              : 'Gmail দিয়ে সরাসরি লগইন করুন'}
          </button>
        </form>

        {/* 2. PREVIOUSLY USED GMAIL ACCOUNTS ON THIS DEVICE (ONLY SHOWN IF USER HAS LOGGED IN BEFORE) */}
        {savedAccounts.length > 0 && (
          <div style={{ marginBottom: '14px' }}>
            <div
              style={{
                fontSize: '11.5px',
                fontWeight: 700,
                color: 'var(--md-sys-color-on-surface-variant)',
                marginBottom: '6px',
                paddingLeft: '2px',
              }}
            >
              পূর্বে ব্যবহৃত Gmail অ্যাকাউন্ট:
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {savedAccounts.map((acc) => {
                const namePart = acc.split('@')[0];
                const initial = (namePart.charAt(0) || 'G').toUpperCase();
                const isThisLoading = loadingAccount === acc;

                return (
                  <div
                    key={acc}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <button
                      type="button"
                      disabled={isLoading}
                      onClick={() => handleInstantAccountTap(acc)}
                      style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '10px 12px',
                        borderRadius: '14px',
                        border: '1.5px solid var(--md-sys-color-outline-variant)',
                        backgroundColor: 'var(--md-sys-color-surface)',
                        cursor: isLoading ? 'wait' : 'pointer',
                        textAlign: 'left',
                        boxShadow: 'var(--md-elevation-1)',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div
                        style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '50%',
                          backgroundColor: getAvatarColor(acc),
                          color: '#FFFFFF',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '15px',
                          fontWeight: 700,
                          flexShrink: 0,
                        }}
                      >
                        {initial}
                      </div>

                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div
                          style={{
                            fontSize: '13px',
                            fontWeight: 700,
                            color: 'var(--md-sys-color-on-surface)',
                          }}
                          className="truncate"
                        >
                          {namePart}
                        </div>
                        <div
                          style={{
                            fontSize: '11.5px',
                            color: 'var(--md-sys-color-on-surface-variant)',
                          }}
                          className="truncate"
                        >
                          {acc}
                        </div>
                      </div>

                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '4px 10px',
                          borderRadius: '999px',
                          backgroundColor: 'var(--md-sys-color-primary-container)',
                          color: 'var(--md-sys-color-primary)',
                          flexShrink: 0,
                        }}
                      >
                        {isThisLoading ? 'লগইন হচ্ছে...' : 'লগইন →'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => handleRemoveSaved(e, acc)}
                      title="তালিকা থেকে সরান"
                      aria-label={`${acc} সরান`}
                      style={{
                        width: '34px',
                        height: '34px',
                        borderRadius: '10px',
                        border: '1px solid var(--md-sys-color-outline-variant)',
                        backgroundColor: 'var(--md-sys-color-surface-container)',
                        color: 'var(--md-sys-color-on-surface-variant)',
                        cursor: 'pointer',
                        fontSize: '13px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 3. SECONDARY: GOOGLE BROWSER POPUP & OPTIONAL PASSWORD */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '10px' }}>
          <button
            type="button"
            className="md3-btn-outlined"
            disabled={isLoading}
            onClick={handleGoogleClick}
            style={{
              width: '100%',
              height: '42px',
              fontSize: '13px',
              fontWeight: 600,
              justifyContent: 'center',
              backgroundColor: 'var(--md-sys-color-surface-container)',
              borderRadius: '10px',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" style={{ marginRight: '6px' }}>
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            Google পপআপ উইন্ডো দিয়ে লগইন
          </button>

          <button
            type="button"
            className="md3-btn-tonal"
            onClick={() => setShowPasswordSection(!showPasswordSection)}
            style={{
              width: '100%',
              height: '36px',
              fontSize: '12px',
              justifyContent: 'center',
              borderRadius: '10px',
            }}
          >
            {showPasswordSection ? '▲ পাসওয়ার্ড অপশন লুকান' : '▼ পাসওয়ার্ড বা রিসেট লিংক (ঐচ্ছিক)'}
          </button>
        </div>

        {/* 4. OPTIONAL PASSWORD FORM */}
        {showPasswordSection && (
          <div
            style={{
              padding: '12px',
              borderRadius: '12px',
              backgroundColor: 'var(--md-sys-color-surface-container)',
              border: '1px solid var(--md-sys-color-outline-variant)',
              marginBottom: '10px',
            }}
          >
            <div
              style={{
                display: 'flex',
                gap: '4px',
                marginBottom: '10px',
                backgroundColor: 'var(--md-sys-color-surface-container-high)',
                padding: '2px',
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
                  fontSize: '11.5px',
                  fontWeight: 700,
                  backgroundColor:
                    emailMode === 'login' ? 'var(--md-sys-color-surface-container)' : 'transparent',
                  color:
                    emailMode === 'login'
                      ? 'var(--md-sys-color-on-surface)'
                      : 'var(--md-sys-color-on-surface-variant)',
                  cursor: 'pointer',
                }}
                onClick={() => setEmailMode('login')}
              >
                পাসওয়ার্ড লগইন
              </button>
              <button
                type="button"
                style={{
                  flex: 1,
                  border: 'none',
                  padding: '6px',
                  borderRadius: '6px',
                  fontSize: '11.5px',
                  fontWeight: 700,
                  backgroundColor:
                    emailMode === 'register'
                      ? 'var(--md-sys-color-surface-container)'
                      : 'transparent',
                  color:
                    emailMode === 'register'
                      ? 'var(--md-sys-color-on-surface)'
                      : 'var(--md-sys-color-on-surface-variant)',
                  cursor: 'pointer',
                }}
                onClick={() => setEmailMode('register')}
              >
                নতুন পাসওয়ার্ড সেট
              </button>
            </div>

            <form onSubmit={handlePasswordSubmit}>
              <div className="md3-text-field" style={{ marginBottom: '8px' }}>
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
                      fontSize: '14px',
                    }}
                  >
                    {showPassword ? '👁️' : '🔒'}
                  </button>
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '10px',
                }}
              >
                <button
                  type="button"
                  onClick={handleForgot}
                  disabled={isLoading}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '11.5px',
                    fontWeight: 700,
                    color: 'var(--md-sys-color-primary)',
                    cursor: 'pointer',
                    padding: '2px 0',
                  }}
                >
                  📩 {resetSent ? '✓ রিসেট লিংক পাঠানো হয়েছে' : 'পাসওয়ার্ড রিসেট লিংক পাঠান'}
                </button>
              </div>

              <button
                type="submit"
                className="md3-btn-filled"
                disabled={isLoading}
                style={{ width: '100%', height: '40px', fontSize: '13px' }}
              >
                {isLoading ? 'অপেক্ষা করুন...' : 'পাসওয়ার্ড দিয়ে লগইন'}
              </button>
            </form>
          </div>
        )}

        {/* Offline notice & Cancel button */}
        <div style={{ textAlign: 'center', marginTop: '6px' }}>
          <p style={{ margin: '0 0 6px', fontSize: '11px', color: 'var(--md-sys-color-on-surface-variant)' }}>
            ✓ লগইন ছাড়াও আপনার মোবাইলে সব হিসাব ১০০% নিরাপদ ও অফলাইনে সচল থাকবে।
          </p>
          <button
            type="button"
            className="md3-btn-outlined"
            style={{
              width: '100%',
              borderColor: 'transparent',
              color: 'var(--md-sys-color-on-surface-variant)',
            }}
            onClick={onClose}
          >
            পরে লগইন করব / অফলাইনে চলুন
          </button>
        </div>
      </div>
    </div>
  );
};
