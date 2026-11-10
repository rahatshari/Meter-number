import React, { useState, useEffect } from 'react';
import { AuthTab, EmailAuthMode } from '../types';
import { getSavedGmailAccounts, recordSavedGmailAccount } from '../utils/authHelpers';

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
  const [showDomainHelp, setShowDomainHelp] = useState(false);
  const [emailMode, setEmailMode] = useState<EmailAuthMode>('login');
  const [isLoading, setIsLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [helperNotice, setHelperNotice] = useState<{ type: 'info' | 'warning' | 'success'; text: string; showReset?: boolean } | null>(null);
  const [savedAccounts, setSavedAccounts] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) {
      const accounts = getSavedGmailAccounts();
      setSavedAccounts(accounts);
      if (accounts.length > 0 && !email) {
        setEmail(accounts[0]);
      } else if (!email) {
        setEmail('rahatsharif10448@gmail.com');
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSelectAccount = (acc: string) => {
    setEmail(acc);
    setHelperNotice(null);
  };

  const handleDirectGmailLogin = async () => {
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      onShowToast('দয়া করে আপনার Gmail ঠিকানা দিন');
      return;
    }
    if (!cleanEmail.includes('@')) {
      onShowToast('সঠিক ইমেইল ঠিকানা দিন (যেমন: example@gmail.com)');
      return;
    }

    setIsLoading(true);
    setHelperNotice(null);
    try {
      await onJustEmailLogin(cleanEmail);
      recordSavedGmailAccount(cleanEmail);
      setSavedAccounts(getSavedGmailAccounts());
      onClose();
    } catch (err: any) {
      console.error('Direct Gmail Login failed:', err);
      const errCode = err?.code || '';

      if (errCode === 'auth/account-exists-with-different-credential') {
        setShowPasswordSection(true);
        setEmailMode('login');
        setHelperNotice({
          type: 'warning',
          text: `⚠️ এই Gmail (${cleanEmail}) অ্যাকাউন্টটিতে পূর্বে অন্য পাসওয়ার্ড দেওয়া হয়েছিল। নিচের বক্সে পাসওয়ার্ড দিন অথবা সরাসরি রিসেট লিংক পাঠিয়ে নতুন পাসওয়ার্ড সেট করুন।`,
          showReset: true,
        });
      } else if (errCode === 'auth/invalid-email') {
        setHelperNotice({
          type: 'warning',
          text: 'দয়া করে সঠিক জিমেইল ফরম্যাটে লিখুন (যেমন: name@gmail.com)',
        });
      } else {
        setHelperNotice({
          type: 'info',
          text: '💡 সরাসরি লগইনে সমস্যা হলে আপনি নিচের "Google অ্যাকাউন্ট পপআপ" দিয়ে লগইন করতে পারেন অথবা পাসওয়ার্ড রিসেট লিংক নিতে পারেন।',
          showReset: true,
        });
      }
    } finally {
      setIsLoading(false);
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
      const errCode = err?.code || '';
      if (errCode === 'auth/popup-closed-by-user') {
        return;
      }
      if (errCode === 'auth/unauthorized-domain' || String(err?.message || '').includes('unauthorized domain') || String(err?.message || '').includes('auth/unauthorized-domain')) {
        setShowDomainHelp(true);
        setHelperNotice({
          type: 'warning',
          text: '⚠️ "Authorization Failed" / অনুমোদিত ডোমেন সমস্যা: Firebase Console-এ GitHub Pages ডোমেনটি (rahatshari.github.io) অনুমোদন করতে হবে। নিচের নির্দেশনাটি দেখুন অথবা উপরের "শুধু Gmail দিয়ে সরাসরি লগইন" ব্যবহার করুন।',
        });
      } else {
        setHelperNotice({
          type: 'info',
          text: '💡 গুগল পপআপে সমস্যা হলে উপরের "শুধু Gmail দিয়ে সরাসরি লগইন" বাটনে ট্যাপ করুন। এটি কোনো পপআপ ছাড়াই সরাসরি কাজ করে।',
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      onShowToast('দয়া করে ইমেইল ও পাসওয়ার্ড দিন');
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
      const errCode = err?.code || '';
      if (
        errCode === 'auth/user-not-found' ||
        errCode === 'auth/invalid-credential' ||
        errCode === 'auth/wrong-password'
      ) {
        setHelperNotice({
          type: 'warning',
          text: 'ভুল পাসওয়ার্ড। আপনার পাসওয়ার্ড মনে না থাকলে নিচের "পাসওয়ার্ড রিসেট লিংক পাঠান" বাটনে ক্লিক করুন।',
          showReset: true,
        });
      } else {
        setHelperNotice({
          type: 'warning',
          text: 'ত্রুটি: ' + (err?.message || 'লগইন ব্যর্থ হয়েছে'),
          showReset: true,
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgot = async () => {
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      onShowToast('প্রথমে আপনার জিমেইল ঠিকানাটি লিখুন');
      return;
    }
    setIsLoading(true);
    try {
      await onForgotPassword(cleanEmail);
      setResetSent(true);
      setHelperNotice({
        type: 'success',
        text: `✓ আপনার ${cleanEmail} ঠিকানায় পাসওয়ার্ড সেট/রিসেট লিংক পাঠানো হয়েছে! আপনার Gmail ইনবক্স বা স্প্যাম ফোল্ডার চেক করুন।`,
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

  const copyDomain = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText('rahatshari.github.io');
      onShowToast('✓ rahatshari.github.io কপি হয়েছে');
    }
  };

  return (
    <div className="md3-overlay" onClick={onClose}>
      <div className="md3-sheet" style={{ maxWidth: '440px', maxHeight: '92vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <div className="md3-drag-handle" />

        <div style={{ textAlign: 'center', marginBottom: '14px' }}>
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '14px',
              backgroundColor: '#FFFFFF',
              border: '1.5px solid var(--md-sys-color-outline-variant)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '6px',
              boxShadow: 'var(--md-elevation-1)',
            }}
          >
            <img src="./icon.png" alt="বিদ্যুৎ বিল" style={{ width: '34px', height: '34px', objectFit: 'contain' }} />
          </div>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--md-sys-color-on-surface)' }}>
            ক্লাউড সিঙ্ক অ্যাকাউন্ট
          </h3>
          <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--md-sys-color-on-surface-variant)' }}>
            আপনার যেকোনো Gmail দিয়ে লগইন করে সব ডিভাইসে এক ডাটাবেজ রাখুন
          </p>
        </div>

        {/* Notice alert banner if any */}
        {helperNotice && (
          <div
            style={{
              padding: '10px 12px',
              borderRadius: '10px',
              backgroundColor: helperNotice.type === 'warning' ? '#FEF2F2' : helperNotice.type === 'success' ? '#F0FDF4' : 'var(--md-sys-color-primary-container)',
              color: helperNotice.type === 'warning' ? '#991B1B' : helperNotice.type === 'success' ? '#166534' : 'var(--md-sys-color-on-primary-container)',
              fontSize: '12px',
              lineHeight: 1.45,
              marginBottom: '12px',
              border: `1px solid ${helperNotice.type === 'warning' ? '#F87171' : helperNotice.type === 'success' ? '#86EFAC' : 'var(--md-sys-color-primary)'}`,
            }}
          >
            <div>{helperNotice.text}</div>
            {helperNotice.showReset && (
              <button
                type="button"
                onClick={handleForgot}
                disabled={isLoading}
                style={{
                  marginTop: '8px',
                  background: helperNotice.type === 'warning' ? '#DC2626' : 'var(--md-sys-color-primary)',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '5px 10px',
                  fontSize: '11.5px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                📩 ১-ট্যাপে পাসওয়ার্ড রিসেট লিংক পাঠান
              </button>
            )}
          </div>
        )}

        {/* 1. PRIMARY: DIRECT GMAIL LOGIN CARD */}
        <div
          style={{
            backgroundColor: 'var(--md-sys-color-surface)',
            border: '2px solid var(--md-sys-color-primary)',
            borderRadius: '16px',
            padding: '14px',
            marginBottom: '12px',
            boxShadow: 'var(--md-elevation-1)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '10px',
                backgroundColor: 'var(--md-sys-color-primary-container)',
                color: 'var(--md-sys-color-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '18px',
                flexShrink: 0,
              }}
            >
              ⚡
            </div>
            <div>
              <h4 style={{ margin: 0, fontSize: '14.5px', fontWeight: 700, color: 'var(--md-sys-color-on-surface)' }}>
                শুধু Gmail দিয়ে সরাসরি লগইন
              </h4>
              <p style={{ margin: 0, fontSize: '11px', color: 'var(--md-sys-color-on-surface-variant)' }}>
                ফোনের যেকোনো Gmail লিখে সরাসরি লগইন করুন
              </p>
            </div>
          </div>

          {/* Quick Saved Accounts Chips */}
          {savedAccounts.length > 0 && (
            <div style={{ marginBottom: '10px' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--md-sys-color-on-surface-variant)', marginBottom: '5px' }}>
                ফোনে সংরক্ষিত অ্যাকাউন্টসমূহ (ট্যাপ করুন):
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {savedAccounts.map((acc) => (
                  <button
                    key={acc}
                    type="button"
                    onClick={() => handleSelectAccount(acc)}
                    style={{
                      border: email === acc ? '1.5px solid var(--md-sys-color-primary)' : '1px solid var(--md-sys-color-outline-variant)',
                      backgroundColor: email === acc ? 'var(--md-sys-color-primary-container)' : 'var(--md-sys-color-surface-container)',
                      color: email === acc ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-on-surface)',
                      borderRadius: '8px',
                      padding: '4px 8px',
                      fontSize: '11px',
                      fontWeight: email === acc ? 700 : 500,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <span>📧</span>
                    <span>{acc}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="md3-text-field" style={{ marginBottom: '10px' }}>
            <label>আপনার Gmail ঠিকানা</label>
            <input
              type="email"
              className="md3-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="যেমন: example@gmail.com"
              required
            />
          </div>

          <button
            type="button"
            className="md3-btn-filled"
            disabled={isLoading || !email.trim()}
            onClick={handleDirectGmailLogin}
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
            {isLoading ? 'লগইন হচ্ছে...' : '👉 এই Gmail দিয়ে সরাসরি লগইন করুন'}
          </button>
        </div>

        {/* 2. SECONDARY: GOOGLE BROWSER POPUP OPTION */}
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
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
            Google অ্যাকাউন্ট পপআপ দিয়ে লগইন
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
            {showPasswordSection ? '▲ নিজস্ব পাসওয়ার্ড অপশন বন্ধ করুন' : '▼ নিজস্ব পাসওয়ার্ড অথবা রিসেট লিংক'}
          </button>
        </div>

        {/* 3. AUTHORIZATION FAILED HELP ACCORDION */}
        <div style={{ marginBottom: '10px' }}>
          <button
            type="button"
            onClick={() => setShowDomainHelp(!showDomainHelp)}
            style={{
              width: '100%',
              padding: '8px 10px',
              borderRadius: '8px',
              border: '1px dashed var(--md-sys-color-outline-variant)',
              backgroundColor: 'var(--md-sys-color-surface-container-low)',
              color: 'var(--md-sys-color-on-surface-variant)',
              fontSize: '11.5px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span>ℹ️ "অথরাইজেশন ফেইলড" (Authorization Failed) আসলে সমাধান কী?</span>
            <span>{showDomainHelp ? '▲' : '▼'}</span>
          </button>

          {showDomainHelp && (
            <div
              style={{
                marginTop: '6px',
                padding: '10px 12px',
                borderRadius: '8px',
                backgroundColor: 'var(--md-sys-color-surface-container)',
                fontSize: '11.5px',
                lineHeight: 1.5,
                color: 'var(--md-sys-color-on-surface)',
                border: '1px solid var(--md-sys-color-outline-variant)',
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: '4px', color: 'var(--md-sys-color-primary)' }}>
                Firebase Authorized Domains সমাধান:
              </div>
              <p style={{ margin: '0 0 6px' }}>
                GitHub Pages (<b>rahatshari.github.io</b>)-এ Google OAuth চালু করার নিয়ম:
              </p>
              <ol style={{ margin: '0 0 8px', paddingLeft: '18px' }}>
                <li><b>Firebase Console</b>-এ গিয়ে আপনার <b>electric-20c05</b> প্রজেক্টে ঢুকুন।</li>
                <li>বাম পাশের মেনু থেকে <b>Authentication &gt; Settings</b> ট্যাবে যান।</li>
                <li><b>Authorized domains</b>-এ <b>Add domain</b> বাটনে ক্লিক করুন।</li>
                <li>নিচের ডোমেনটি বসিয়ে Save করুন:</li>
              </ol>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#FFFFFF', padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--md-sys-color-outline-variant)' }}>
                <code style={{ fontSize: '11.5px', fontWeight: 700, color: '#1E40AF', flex: 1 }}>rahatshari.github.io</code>
                <button
                  type="button"
                  onClick={copyDomain}
                  style={{
                    backgroundColor: 'var(--md-sys-color-primary)',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '3px 8px',
                    fontSize: '11px',
                    cursor: 'pointer',
                  }}
                >
                  কপি
                </button>
              </div>
              <div style={{ marginTop: '6px', fontSize: '11px', color: 'var(--md-sys-color-on-surface-variant)' }}>
                👉 অথবা কোনো কনফিগারেশন ছাড়া সরাসরি উপরে <b>"শুধু Gmail দিয়ে সরাসরি লগইন"</b> ব্যবহার করুন—এটি সঙ্গে সঙ্গে কাজ করবে!
              </div>
            </div>
          )}
        </div>

        {/* 4. OPTIONAL CUSTOM PASSWORD & RESET FORM */}
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
                  backgroundColor: emailMode === 'login' ? 'var(--md-sys-color-surface-container)' : 'transparent',
                  color: emailMode === 'login' ? 'var(--md-sys-color-on-surface)' : 'var(--md-sys-color-on-surface-variant)',
                  cursor: 'pointer',
                }}
                onClick={() => setEmailMode('login')}
              >
                পাসওয়ার্ড দিয়ে লগইন
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
                  backgroundColor: emailMode === 'register' ? 'var(--md-sys-color-surface-container)' : 'transparent',
                  color: emailMode === 'register' ? 'var(--md-sys-color-on-surface)' : 'var(--md-sys-color-on-surface-variant)',
                  cursor: 'pointer',
                }}
                onClick={() => setEmailMode('register')}
              >
                নতুন অ্যাকাউন্ট তৈরি
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

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <button
                  type="button"
                  onClick={handleForgot}
                  disabled={isLoading || !email.trim()}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '11.5px',
                    fontWeight: 700,
                    color: 'var(--md-sys-color-primary)',
                    cursor: 'pointer',
                    padding: '2px 0',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  📩 {resetSent ? '✓ রিসেট লিংক পাঠানো হয়েছে' : 'পাসওয়ার্ড মনে নেই? রিসেট লিংক পাঠান'}
                </button>
              </div>

              <button
                type="submit"
                className="md3-btn-filled"
                disabled={isLoading}
                style={{ width: '100%', height: '40px', fontSize: '13px' }}
              >
                {isLoading ? 'অপেক্ষা করুন...' : emailMode === 'login' ? 'পাসওয়ার্ড দিয়ে লগইন' : 'অ্যাকাউন্ট নিশ্চিত করুন'}
              </button>
            </form>
          </div>
        )}

        {/* Offline notice & Cancel button */}
        <div style={{ textAlign: 'center', marginTop: '6px' }}>
          <p style={{ margin: '0 0 6px', fontSize: '11px', color: 'var(--md-sys-color-on-surface-variant)' }}>
            ✓ লগইন ছাড়াও আপনার মোবাইলে সব হিসাব ১০০% নিরাপদ ও সম্পূর্ণ অফলাইনে সচল থাকবে।
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
