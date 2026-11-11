import React, { useState, useEffect, useRef } from 'react';
import { AuthTab, EmailAuthMode } from '../types';
import {
  recordSavedGmailAccount,
  normalizeGmailInput,
} from '../utils/authHelpers';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGoogleLogin: () => Promise<void>;
  onJustEmailLogin?: (email: string) => Promise<void>;
  onEmailLogin: (email: string, pass: string) => Promise<void>;
  onEmailRegister: (email: string, pass: string, fullName?: string) => Promise<void>;
  onForgotPassword: (email: string) => Promise<void>;
  onShowToast: (msg: string) => void;
  initialTab?: AuthTab;
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
  const [emailMode, setEmailMode] = useState<EmailAuthMode>('login');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [driveGmail, setDriveGmail] = useState('');
  const [pendingDriveConsentEmail, setPendingDriveConsentEmail] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [helperNotice, setHelperNotice] = useState<{
    type: 'info' | 'warning' | 'success';
    text: string;
  } | null>(null);

  const emailInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setHelperNotice(null);
      setResetSent(false);
      setFullName('');
      setEmail('');
      setPassword('');
      setDriveGmail('');
      setPendingDriveConsentEmail(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // METHOD 1: "Continue with Google"
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

      setHelperNotice({
        type: 'info',
        text: 'পপআপ উইন্ডো চালু করা যায়নি। নিচের "Google Drive ব্যাকআপ ও রিস্টোর" বক্সে আপনার Gmail বসিয়ে ক্লিক করলেই সব তথ্য চলে আসবে!',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // METHOD 1B: Direct Gmail -> Google Drive Access & Auto-Restore
  const handleDriveGmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = normalizeGmailInput(driveGmail);
    if (!clean || !clean.includes('@')) {
      onShowToast('দয়া করে আপনার সঠিক Gmail ঠিকানা বসান');
      return;
    }
    setPendingDriveConsentEmail(clean);
  };

  const handleConfirmDriveGmailAccess = async () => {
    if (!pendingDriveConsentEmail || !onJustEmailLogin) return;
    setIsLoading(true);
    setHelperNotice(null);
    try {
      await onJustEmailLogin(pendingDriveConsentEmail);
      recordSavedGmailAccount(pendingDriveConsentEmail);
      setPendingDriveConsentEmail(null);
      onClose();
    } catch {
      setHelperNotice({
        type: 'warning',
        text: 'সংযোগ সম্পন্ন হয়নি। ইন্টারনেট সংযোগ চেক করে আবার চেষ্টা করুন।',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // METHOD 2: Standard Email & Password (Sign In / Sign Up)
  const handleEmailPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = normalizeGmailInput(email);

    if (!cleanEmail) {
      onShowToast('দয়া করে আপনার Gmail বা ইমেইল ঠিকানা লিখুন');
      emailInputRef.current?.focus();
      return;
    }

    if (emailMode === 'register' && !fullName.trim()) {
      onShowToast('দয়া করে আপনার নাম লিখুন');
      return;
    }

    if (!password || password.length < 6) {
      onShowToast('পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে');
      return;
    }

    setIsLoading(true);
    setHelperNotice(null);
    try {
      if (emailMode === 'login') {
        await onEmailLogin(cleanEmail, password);
      } else {
        await onEmailRegister(cleanEmail, password, fullName.trim());
      }
      recordSavedGmailAccount(cleanEmail);
      onClose();
    } catch (err: any) {
      const code = err?.code || '';
      if (
        code === 'auth/wrong-password' ||
        code === 'auth/invalid-credential' ||
        code === 'auth/user-not-found'
      ) {
        setHelperNotice({
          type: 'warning',
          text: 'ইমেইল বা পাসওয়ার্ড মেলেনি। আপনি চাইলে উপরের "Google Drive ব্যাকআপ ও রিস্টোর" বক্সে শুধু Gmail বসিয়ে সব তথ্য অ্যাপে আনতে পারেন!',
        });
      } else if (code === 'auth/email-already-in-use') {
        setHelperNotice({
          type: 'info',
          text: 'এই Gmail দিয়ে আগেই অ্যাকাউন্ট খোলা আছে। অনুগ্রহ করে "লগইন করুন" ট্যাব থেকে লগইন করুন।',
        });
        setEmailMode('login');
      } else {
        setHelperNotice({
          type: 'warning',
          text: 'লগইন সম্পন্ন হয়নি। অনুগ্রহ করে তথ্য যাচাই করে আবার চেষ্টা করুন।',
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Forgot Password handler
  const handleForgot = async () => {
    const cleanEmail = normalizeGmailInput(email);
    if (!cleanEmail) {
      onShowToast('পাসওয়ার্ড রিসেট করতে প্রথমে Gmail ঠিকানাটি বক্সে লিখুন');
      emailInputRef.current?.focus();
      return;
    }
    setIsLoading(true);
    setHelperNotice(null);
    try {
      await onForgotPassword(cleanEmail);
      setResetSent(true);
      setHelperNotice({
        type: 'success',
        text: `✓ আপনার ${cleanEmail} ঠিকানায় পাসওয়ার্ড রিসেট লিংক পাঠানো হয়েছে! আপনার Gmail ইনবক্স বা Spam ফোল্ডার চেক করুন।`,
      });
    } catch {
      setHelperNotice({
        type: 'warning',
        text: 'রিসেট লিংক পাঠানো যায়নি। এই Gmail দিয়ে আগে অ্যাকাউন্ট খোলা হয়েছে কি না তা নিশ্চিত করুন।',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="md3-overlay" onClick={onClose}>
      <div
        className="md3-sheet"
        style={{ maxWidth: '430px', maxHeight: '92vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
      >
        <div className="md3-drag-handle" />

        {/* App Brand & Standard Login Header */}
        <div style={{ textAlign: 'center', marginBottom: '14px' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '14px',
              backgroundColor: '#FFFFFF',
              border: '1.5px solid var(--md-sys-color-outline-variant)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '8px',
              boxShadow: 'var(--md-elevation-1)',
            }}
          >
            <img
              src="./icon.png"
              alt="বিদ্যুৎ বিল"
              style={{ width: '38px', height: '38px', objectFit: 'contain' }}
            />
          </div>

          <h3
            id="auth-modal-title"
            style={{
              margin: 0,
              fontSize: '19px',
              fontWeight: 700,
              color: 'var(--md-sys-color-on-surface)',
            }}
          >
            অ্যাকাউন্ট ও Google Drive ব্যাকআপ
          </h3>
          <p
            style={{
              margin: '4px 0 0',
              fontSize: '12px',
              color: 'var(--md-sys-color-on-surface-variant)',
            }}
          >
            Gmail দিয়ে Google Drive অ্যাক্সেস নিন অথবা ইমেইল-পাসওয়ার্ড দিয়ে লগইন করুন
          </p>
        </div>

        {/* Alert / Feedback Banner */}
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

        {/* ============================================================
            METHOD 1: CONTINUE WITH GOOGLE (1-CLICK GOOGLE SIGN-IN)
            ============================================================ */}
        <div style={{ marginBottom: '12px' }}>
          <button
            type="button"
            disabled={isLoading}
            onClick={handleGoogleClick}
            style={{
              width: '100%',
              height: '46px',
              borderRadius: '12px',
              border: '1.5px solid var(--md-sys-color-outline)',
              backgroundColor: 'var(--md-sys-color-surface)',
              color: 'var(--md-sys-color-on-surface)',
              fontSize: '13.5px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              cursor: isLoading ? 'wait' : 'pointer',
              boxShadow: 'var(--md-elevation-1)',
              transition: 'all 0.15s ease',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24">
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
            <span>Google দিয়ে চালিয়ে যান (Continue with Google)</span>
          </button>
        </div>

        {/* ============================================================
            METHOD 1B: DIRECT GMAIL -> GOOGLE DRIVE ACCESS & RESTORE
            ============================================================ */}
        {onJustEmailLogin && (
          <div
            style={{
              backgroundColor: 'var(--md-sys-color-surface)',
              border: '1.5px solid var(--md-sys-color-primary)',
              borderRadius: '14px',
              padding: '12px',
              marginBottom: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <svg width="18" height="18" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
                <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
                <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z" fill="#00ac47"/>
                <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335"/>
                <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/>
                <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/>
                <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/>
              </svg>
              <strong style={{ fontSize: '13px', color: 'var(--md-sys-color-on-surface)' }}>
                Google Drive ব্যাকআপ ও রিস্টোর (শুধু Gmail দিয়ে)
              </strong>
            </div>
            <p style={{ margin: '0 0 8px', fontSize: '11.5px', color: 'var(--md-sys-color-on-surface-variant)', lineHeight: 1.4 }}>
              অ্যাপ আনইনস্টল করে পুনরায় ইনস্টল করলে এখানে আপনার Gmail বসিয়ে ক্লিক করলেই আগের আপলোড করা সব তথ্য অ্যাপে চলে আসবে:
            </p>
            {!pendingDriveConsentEmail ? (
              <form onSubmit={handleDriveGmailSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <input
                  type="text"
                  inputMode="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  className="md3-input"
                  placeholder="আপনার Gmail বসান (যেমন: example@gmail.com)"
                  value={driveGmail}
                  onChange={(e) => setDriveGmail(e.target.value)}
                />
                <button
                  type="submit"
                  className="md3-btn-filled"
                  disabled={isLoading}
                  style={{ height: '42px', fontSize: '13px', fontWeight: 700 }}
                >
                  🔓 Google Drive অ্যাক্সেস নিন ও সব তথ্য আনুন
                </button>
              </form>
            ) : (
              <div
                style={{
                  padding: '10px',
                  borderRadius: '10px',
                  backgroundColor: 'var(--md-sys-color-primary-container)',
                  color: 'var(--md-sys-color-on-primary-container)',
                  fontSize: '12px',
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: '6px' }}>
                  ✓ {pendingDriveConsentEmail} — Google Drive অ্যাক্সেস অনুমতি:
                </div>
                <div style={{ marginBottom: '8px', lineHeight: 1.4 }}>
                  এই Gmail-এর Google Drive ব্যাকআপ থেকে আপনার আপলোড করা সব গ্রাহকের তথ্য অ্যাপে লোড এবং নতুন তথ্য ব্যাকআপ করার অনুমতি দিন।
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    className="md3-btn-filled"
                    disabled={isLoading}
                    onClick={handleConfirmDriveGmailAccess}
                    style={{ flex: 1, height: '40px', fontSize: '12.5px', fontWeight: 700 }}
                  >
                    {isLoading ? '⏳ তথ্য আসছে...' : '✓ অনুমতি দিন ও সব তথ্য আনুন'}
                  </button>
                  <button
                    type="button"
                    className="md3-btn-outlined"
                    disabled={isLoading}
                    onClick={() => setPendingDriveConsentEmail(null)}
                    style={{ width: 'auto', padding: '0 12px', height: '40px', fontSize: '12px' }}
                  >
                    বাতিল
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ============================================================
            DIVIDER: অথবা ইমেইল ও পাসওয়ার্ড দিয়ে
            ============================================================ */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            margin: '12px 0',
          }}
        >
          <div
            style={{
              flex: 1,
              height: '1px',
              backgroundColor: 'var(--md-sys-color-outline-variant)',
            }}
          />
          <span
            style={{
              fontSize: '11.5px',
              fontWeight: 600,
              color: 'var(--md-sys-color-on-surface-variant)',
              whiteSpace: 'nowrap',
            }}
          >
            অথবা ইমেইল ও পাসওয়ার্ড দিয়ে
          </span>
          <div
            style={{
              flex: 1,
              height: '1px',
              backgroundColor: 'var(--md-sys-color-outline-variant)',
            }}
          />
        </div>


        {/* ============================================================
            METHOD 2: STANDARD EMAIL & PASSWORD (SIGN IN / SIGN UP)
            ============================================================ */}
        <div
          style={{
            backgroundColor: 'var(--md-sys-color-surface)',
            border: '1px solid var(--md-sys-color-outline-variant)',
            borderRadius: '16px',
            padding: '14px',
            marginBottom: '12px',
          }}
        >
          {/* Segmented Tabs: লগইন করুন (Sign In) | নতুন অ্যাকাউন্ট (Sign Up) */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '4px',
              backgroundColor: 'var(--md-sys-color-surface-container-high)',
              padding: '3px',
              borderRadius: '10px',
              marginBottom: '14px',
            }}
          >
            <button
              type="button"
              onClick={() => {
                setEmailMode('login');
                setHelperNotice(null);
              }}
              style={{
                padding: '8px 6px',
                border: 'none',
                borderRadius: '8px',
                fontSize: '12.5px',
                fontWeight: 700,
                backgroundColor:
                  emailMode === 'login' ? 'var(--md-sys-color-surface)' : 'transparent',
                color:
                  emailMode === 'login'
                    ? 'var(--md-sys-color-primary)'
                    : 'var(--md-sys-color-on-surface-variant)',
                boxShadow: emailMode === 'login' ? 'var(--md-elevation-1)' : 'none',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              লগইন করুন (Sign In)
            </button>

            <button
              type="button"
              onClick={() => {
                setEmailMode('register');
                setHelperNotice(null);
              }}
              style={{
                padding: '8px 6px',
                border: 'none',
                borderRadius: '8px',
                fontSize: '12.5px',
                fontWeight: 700,
                backgroundColor:
                  emailMode === 'register' ? 'var(--md-sys-color-surface)' : 'transparent',
                color:
                  emailMode === 'register'
                    ? 'var(--md-sys-color-primary)'
                    : 'var(--md-sys-color-on-surface-variant)',
                boxShadow: emailMode === 'register' ? 'var(--md-elevation-1)' : 'none',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              নতুন অ্যাকাউন্ট (Sign Up)
            </button>
          </div>

          <form onSubmit={handleEmailPasswordSubmit}>
            {/* Full Name input (shown only on Sign Up) */}
            {emailMode === 'register' && (
              <div className="md3-text-field" style={{ marginBottom: '10px' }}>
                <label>আপনার নাম *</label>
                <input
                  type="text"
                  className="md3-input"
                  placeholder="আপনার পূর্ণ নাম লিখুন"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>
            )}

            {/* Gmail / Email input */}
            <div className="md3-text-field" style={{ marginBottom: '10px' }}>
              <label>Gmail / ইমেইল ঠিকানা *</label>
              <input
                ref={emailInputRef}
                type="text"
                inputMode="email"
                autoCapitalize="none"
                autoCorrect="off"
                className="md3-input"
                placeholder="যেমন: example@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            {/* Password input */}
            <div className="md3-text-field" style={{ marginBottom: '8px' }}>
              <label>
                {emailMode === 'register' ? 'নতুন পাসওয়ার্ড (কমপক্ষে ৬ অক্ষর) *' : 'পাসওয়ার্ড *'}
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="md3-input"
                  placeholder={
                    emailMode === 'register'
                      ? 'কমপক্ষে ৬ অক্ষরের পাসওয়ার্ড দিন'
                      : 'আপনার পাসওয়ার্ড লিখুন'
                  }
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  style={{ paddingRight: '42px' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  title={showPassword ? 'পাসওয়ার্ড লুকান' : 'পাসওয়ার্ড দেখুন'}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '15px',
                    padding: '4px',
                  }}
                >
                  {showPassword ? '👁️' : '🔒'}
                </button>
              </div>
            </div>

            {/* Forgot Password link (shown on Sign In) */}
            {emailMode === 'login' && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  marginBottom: '12px',
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
                  {resetSent
                    ? '✓ রিসেট লিংক পাঠানো হয়েছে (আবার পাঠান)'
                    : 'পাসওয়ার্ড ভুলে গেছেন? রিসেট লিংক পাঠান'}
                </button>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              className="md3-btn-filled"
              disabled={isLoading}
              style={{
                width: '100%',
                height: '46px',
                fontSize: '14px',
                fontWeight: 700,
                borderRadius: '12px',
                marginTop: emailMode === 'register' ? '6px' : 0,
              }}
            >
              {isLoading
                ? 'অপেক্ষা করুন...'
                : emailMode === 'login'
                ? 'লগইন করুন'
                : 'নতুন অ্যাকাউন্ট তৈরি করুন'}
            </button>
          </form>

          {/* Mode Toggle Footer Helper */}
          <div style={{ textAlign: 'center', marginTop: '10px' }}>
            <button
              type="button"
              onClick={() => {
                setEmailMode(emailMode === 'login' ? 'register' : 'login');
                setHelperNotice(null);
              }}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '12px',
                fontWeight: 600,
                color: 'var(--md-sys-color-primary)',
                cursor: 'pointer',
                padding: '4px',
              }}
            >
              {emailMode === 'login'
                ? 'নতুন ব্যবহারকারী? নতুন অ্যাকাউন্ট তৈরি করুন →'
                : 'আগে থেকেই অ্যাকাউন্ট আছে? লগইন করুন →'}
            </button>
          </div>
        </div>

        {/* Offline notice & Close button */}
        <div style={{ textAlign: 'center', marginTop: '4px' }}>
          <p
            style={{
              margin: '0 0 6px',
              fontSize: '11px',
              color: 'var(--md-sys-color-on-surface-variant)',
            }}
          >
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
