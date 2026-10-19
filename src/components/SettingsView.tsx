import React, { useState, useRef } from 'react';
import { User } from 'firebase/auth';
import { Customer, ThemeMode } from '../types';
import { toBengaliNum, isCustomerPaidThisMonth } from '../utils/bengali';

interface SettingsViewProps {
  currentUser: User | null;
  themeMode: ThemeMode;
  onToggleTheme: () => void;
  onOpenAuthModal: () => void;
  onLogout: () => Promise<void>;
  onSyncAllLocalToCloud: () => Promise<void>;
  customers: Customer[];
  onImportCustomers: (importedList: Customer[], mode: 'merge' | 'replace') => Promise<void>;
  onCopyText: (text: string, label: string) => void;
  onShowToast: (msg: string) => void;
  onShowConfirm: (title: string, message: string, okText: string, onOk: () => void) => void;
  onOpenInstall: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  currentUser,
  themeMode,
  onToggleTheme,
  onOpenAuthModal,
  onLogout,
  onSyncAllLocalToCloud,
  customers,
  onImportCustomers,
  onCopyText,
  onShowToast,
  onShowConfirm,
  onOpenInstall,
}) => {
  const [mergeMode, setMergeMode] = useState<'merge' | 'replace'>('merge');
  const [selectedFile, setSelectedFile] = useState<{
    name: string;
    size: string;
    customerList: Customer[];
  } | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const parsed = JSON.parse(text);
        let list: any[] = [];
        if (Array.isArray(parsed)) {
          list = parsed;
        } else if (parsed && Array.isArray(parsed.customers)) {
          list = parsed.customers;
        } else {
          onShowToast('ভুল ফরম্যাট! ফাইলে গ্রাহকদের তথ্য পাওয়া যায়নি।');
          return;
        }

        const normalized: Customer[] = list.map((item, idx) => ({
          id: item.id ? (parseFloat(item.id) || item.id) : Date.now() + idx,
          name: String(item.name || '').trim(),
          father: String(item.father || item.fatherName || '').trim(),
          mother: String(item.mother || item.motherName || '').trim(),
          address: String(item.address || '').trim(),
          mobile: String(item.mobile || '').trim(),
          sms: String(item.sms || item.smsAccount || item.meterNumber || '').trim(),
          dueDate: String(item.dueDate || '').trim(),
          group: String(item.group || '').trim(),
          lastPaidMonth: String(item.lastPaidMonth || '').trim(),
          userId: item.userId,
        }));

        setSelectedFile({
          name: file.name,
          size: (file.size / 1024).toFixed(1) + ' KB',
          customerList: normalized,
        });
      } catch {
        onShowToast('ফাইল পড়তে ত্রুটি হয়েছে। সঠিক .json ফাইল দিন।');
      }
    };
    reader.readAsText(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const executeImport = async () => {
    if (!selectedFile) return;

    if (mergeMode === 'replace') {
      onShowConfirm(
        'সম্পূর্ণ প্রতিস্থাপন নিশ্চিত করুন',
        'বর্তমান সকল গ্রাহক ডেটা মুছে ফেলে এই ব্যাকআপ ফাইলের ডেটা দ্বারা প্রতিস্থাপিত হবে। আপনি কি নিশ্চিত?',
        'প্রতিস্থাপন করুন',
        async () => {
          setIsImporting(true);
          try {
            await onImportCustomers(selectedFile.customerList, 'replace');
            setSelectedFile(null);
          } finally {
            setIsImporting(false);
          }
        }
      );
    } else {
      setIsImporting(true);
      try {
        await onImportCustomers(selectedFile.customerList, 'merge');
        setSelectedFile(null);
      } finally {
        setIsImporting(false);
      }
    }
  };

  const handleExportJSON = () => {
    const data = { customers, groups: [] };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `বিদ্যুৎ_বিল_ব্যাকআপ_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    onShowToast('ব্যাকআপ ডাউনলোড হয়েছে!');
  };

  const handleExportCSV = () => {
    if (!customers || customers.length === 0) {
      onShowToast('রপ্তানি করার মতো কোনো গ্রাহক নেই');
      return;
    }

    const headers = [
      'ক্রমিক',
      'গ্রাহকের নাম',
      'পিতার নাম',
      'মাতার নাম',
      'ঠিকানা',
      'মোবাইল নম্বর',
      'SMS একাউন্ট / মিটার নং',
      'বিল পরিশোধ শেষ তারিখ',
      'বিলের অবস্থা',
    ];

    const escapeCSV = (field: any) => {
      if (field === null || field === undefined) return '""';
      const str = String(field).replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows = customers.map((c, index) => {
      const statusText = isCustomerPaidThisMonth(c) ? 'পরিশোধিত' : 'বকেয়া';
      return [
        index + 1,
        c.name || '',
        c.father || '',
        c.mother || '',
        c.address || '',
        c.mobile || '',
        c.sms || '',
        c.dueDate || '',
        statusText,
      ].map(escapeCSV).join(',');
    });

    // Add UTF-8 BOM (\uFEFF) so Excel opens Bengali characters properly
    const csvContent = '\uFEFF' + [headers.map(escapeCSV).join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `বিদ্যুৎ_বিল_গ্রাহক_তালিকা_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    onShowToast('📊 Excel/CSV ফাইল ডাউনলোড হয়েছে!');
  };

  const handleCopyUnpaidSummary = () => {
    const unpaid = customers.filter((c) => !isCustomerPaidThisMonth(c));
    if (unpaid.length === 0) {
      onShowToast('আলহামদুলিল্লাহ! কোনো বকেয়া বিল নেই।');
      return;
    }

    const now = new Date();
    const monthName = now.toLocaleString('bn-BD', { month: 'long', year: 'numeric' });

    let summary = `⚡ বিদ্যুৎ বিল বকেয়া তালিকা (${monthName})\n`;
    summary += `মোট বকেয়া গ্রাহক: ${toBengaliNum(unpaid.length)} জন\n`;
    summary += `------------------------------\n`;

    unpaid.forEach((c, i) => {
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
      {/* SECTION 1: Google Cloud Sync */}
      <div className="md3-card" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              backgroundColor: 'var(--md-sys-color-primary-container)',
              color: 'var(--md-sys-color-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
            </svg>
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--md-sys-color-on-surface)' }}>
              Google ক্লাউড সিঙ্ক
            </h3>
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--md-sys-color-on-surface-variant)' }}>
              সব ডিভাইসে রিয়েল-টাইম ব্যাকআপ ও অটো-সিঙ্ক
            </p>
          </div>
        </div>

        {currentUser ? (
          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px',
                backgroundColor: 'var(--md-sys-color-surface)',
                borderRadius: 'var(--md-shape-corner-md)',
                marginBottom: '12px',
                border: '1px solid var(--md-sys-color-outline-variant)',
              }}
            >
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '50%',
                  overflow: 'hidden',
                  backgroundColor: 'var(--md-sys-color-primary-container)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  color: 'var(--md-sys-color-primary)',
                  flexShrink: 0,
                }}
              >
                {currentUser.photoURL ? (
                  <img src={currentUser.photoURL} alt="User" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  (currentUser.displayName || currentUser.email || 'U').charAt(0).toUpperCase()
                )}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--md-sys-color-on-surface)' }} className="truncate">
                  {currentUser.displayName || 'সম্মানিত ব্যবহারকারী'}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--md-sys-color-on-surface-variant)' }} className="truncate">
                  {currentUser.email}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--md-sys-color-success)', fontWeight: 600, marginTop: '2px' }}>
                  ✓ অনলাইন সিঙ্ক সক্রিয়
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <button
                type="button"
                className="md3-btn-tonal"
                style={{ padding: '10px 12px', fontSize: '13px' }}
                onClick={onSyncAllLocalToCloud}
              >
                ☁️ ক্লাউডে রি-সিঙ্ক
              </button>

              <button
                type="button"
                className="md3-btn-outlined"
                style={{ padding: '10px 12px', fontSize: '13px', color: 'var(--md-sys-color-error)', borderColor: 'var(--md-sys-color-error)' }}
                onClick={onLogout}
              >
                🚪 লগআউট
              </button>
            </div>
          </div>
        ) : (
          <div>
            <p style={{ fontSize: '12.5px', color: 'var(--md-sys-color-on-surface-variant)', lineHeight: 1.5, marginBottom: '14px' }}>
              মোবাইল পরিবর্তন করলেও বা হারিয়ে গেলেও আপনার সকল গ্রাহক ও বিলের তথ্য নিরাপদ রাখতে Google বা ইমেইল অ্যাকাউন্ট দিয়ে সিঙ্ক চালু করুন।
            </p>
            <button
              type="button"
              className="md3-btn-filled"
              onClick={onOpenAuthModal}
            >
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              Google / ইমেইল দিয়ে লগইন করুন
            </button>
          </div>
        )}
      </div>

      {/* SECTION 2: Data Backup & Restore */}
      <div className="md3-card" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              backgroundColor: 'var(--md-sys-color-secondary-container)',
              color: 'var(--md-sys-color-on-secondary-container)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--md-sys-color-on-surface)' }}>
              ডেটা ব্যাকআপ ও এক্সপোর্ট হাব
            </h3>
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--md-sys-color-on-surface-variant)' }}>
              সংরক্ষিত গ্রাহক: <strong style={{ color: 'var(--md-sys-color-primary)' }}>{toBengaliNum(customers.length)}</strong> জন
            </p>
          </div>
        </div>

        {/* Export Options */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
          {/* JSON Export */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px',
              backgroundColor: 'var(--md-sys-color-surface)',
              borderRadius: 'var(--md-shape-corner-md)',
              border: '1px solid var(--md-sys-color-outline-variant)',
            }}
          >
            <div>
              <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--md-sys-color-on-surface)' }}>
                📁 সম্পূর্ণ JSON ব্যাকআপ
              </div>
              <div style={{ fontSize: '11.5px', color: 'var(--md-sys-color-on-surface-variant)' }}>
                অন্য যেকোনো ফোনে রিস্টোর করার জন্য উপযুক্ত
              </div>
            </div>
            <button
              type="button"
              className="md3-btn-filled"
              style={{ width: 'auto', padding: '6px 14px', fontSize: '12px' }}
              onClick={handleExportJSON}
            >
              ডাউনলোড
            </button>
          </div>

          {/* CSV Export */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px',
              backgroundColor: 'var(--md-sys-color-surface)',
              borderRadius: 'var(--md-shape-corner-md)',
              border: '1px solid var(--md-sys-color-outline-variant)',
            }}
          >
            <div>
              <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--md-sys-color-on-surface)' }}>
                📊 Excel / CSV স্প্রেডশিট
              </div>
              <div style={{ fontSize: '11.5px', color: 'var(--md-sys-color-on-surface-variant)' }}>
                Excel ও Sheets-এ প্রিন্ট উপযোগী বাংলা ফাইল
              </div>
            </div>
            <button
              type="button"
              className="md3-btn-tonal"
              style={{ width: 'auto', padding: '6px 14px', fontSize: '12px' }}
              onClick={handleExportCSV}
            >
              এক্সপোর্ট
            </button>
          </div>

          {/* WhatsApp Unpaid Summary Copy */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px',
              backgroundColor: 'var(--md-sys-color-surface)',
              borderRadius: 'var(--md-shape-corner-md)',
              border: '1px solid var(--md-sys-color-outline-variant)',
            }}
          >
            <div>
              <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--md-sys-color-on-surface)' }}>
                📋 বকেয়া বিলের সামারি টেক্সট
              </div>
              <div style={{ fontSize: '11.5px', color: 'var(--md-sys-color-on-surface-variant)' }}>
                এক ক্লিকে হোয়াটসঅ্যাপে পাঠানোর উপযোগী
              </div>
            </div>
            <button
              type="button"
              className="md3-btn-outlined"
              style={{ width: 'auto', padding: '6px 14px', fontSize: '12px' }}
              onClick={handleCopyUnpaidSummary}
            >
              কপি
            </button>
          </div>
        </div>

        {/* Import JSON Backup */}
        <h4 style={{ margin: '0 0 8px', fontSize: '14px', fontWeight: 700, color: 'var(--md-sys-color-on-surface)' }}>
          📥 ব্যাকআপ ফাইল ইমপোর্ট করুন (.json)
        </h4>

        {!selectedFile ? (
          <div
            style={{
              border: '2px dashed var(--md-sys-color-outline)',
              borderRadius: 'var(--md-shape-corner-md)',
              padding: '20px 14px',
              textAlign: 'center',
              cursor: 'pointer',
              backgroundColor: isDragging ? 'var(--md-sys-color-primary-container)' : 'var(--md-sys-color-surface)',
              transition: 'all 0.2s',
            }}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              const file = e.dataTransfer.files?.[0];
              if (file) handleFile(file);
            }}
          >
            <div style={{ fontSize: '28px', marginBottom: '4px' }}>📂</div>
            <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--md-sys-color-on-surface)' }}>
              ব্যাকআপ ফাইল সিলেক্ট করুন
            </div>
            <div style={{ fontSize: '11.5px', color: 'var(--md-sys-color-on-surface-variant)', marginTop: '2px' }}>
              ক্লিক করুন অথবা ড্রপ করুন (.json ফাইল সমর্থিত)
            </div>
          </div>
        ) : (
          <div
            style={{
              padding: '14px',
              backgroundColor: 'var(--md-sys-color-surface)',
              borderRadius: 'var(--md-shape-corner-md)',
              border: '1px solid var(--md-sys-color-outline-variant)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <div>
                <strong style={{ fontSize: '13.5px', color: 'var(--md-sys-color-on-surface)' }}>
                  {selectedFile.name}
                </strong>
                <span style={{ fontSize: '11.5px', color: 'var(--md-sys-color-on-surface-variant)', marginLeft: '8px' }}>
                  ({selectedFile.size})
                </span>
              </div>
              <button
                type="button"
                className="md3-btn-outlined"
                style={{ width: 'auto', padding: '3px 8px', fontSize: '11px' }}
                onClick={() => setSelectedFile(null)}
              >
                বাতিল
              </button>
            </div>

            <div
              style={{
                padding: '8px 12px',
                backgroundColor: 'var(--md-sys-color-primary-container)',
                borderRadius: '8px',
                fontSize: '12.5px',
                fontWeight: 600,
                color: 'var(--md-sys-color-on-primary-container)',
                marginBottom: '12px',
              }}
            >
              ✓ ফাইলে {toBengaliNum(selectedFile.customerList.length)} জন গ্রাহকের তথ্য পাওয়া গেছে।
            </div>

            {/* Merge vs Replace selector */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px' }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px',
                  padding: '10px',
                  borderRadius: '8px',
                  border: '1.5px solid',
                  borderColor: mergeMode === 'merge' ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-outline-variant)',
                  backgroundColor: mergeMode === 'merge' ? 'var(--md-sys-color-primary-container)' : 'transparent',
                  cursor: 'pointer',
                  fontSize: '12.5px',
                }}
              >
                <input
                  type="radio"
                  name="settingsMergeMode"
                  value="merge"
                  checked={mergeMode === 'merge'}
                  onChange={() => setMergeMode('merge')}
                  style={{ marginTop: '3px' }}
                />
                <div>
                  <strong style={{ color: 'var(--md-sys-color-on-surface)' }}>🔄 স্মার্ট মার্জ (Merge)</strong>
                  <div style={{ fontSize: '11px', color: 'var(--md-sys-color-on-surface-variant)' }}>
                    বর্তমান তালিকার সাথে নতুনদের যোগ করবে, কোনো পূর্বের তথ্য মুছবে না।
                  </div>
                </div>
              </label>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px',
                  padding: '10px',
                  borderRadius: '8px',
                  border: '1.5px solid',
                  borderColor: mergeMode === 'replace' ? 'var(--md-sys-color-error)' : 'var(--md-sys-color-outline-variant)',
                  backgroundColor: mergeMode === 'replace' ? 'var(--md-sys-color-error-container)' : 'transparent',
                  cursor: 'pointer',
                  fontSize: '12.5px',
                }}
              >
                <input
                  type="radio"
                  name="settingsMergeMode"
                  value="replace"
                  checked={mergeMode === 'replace'}
                  onChange={() => setMergeMode('replace')}
                  style={{ marginTop: '3px' }}
                />
                <div>
                  <strong style={{ color: 'var(--md-sys-color-error)' }}>⚠️ সম্পূর্ণ প্রতিস্থাপন (Replace All)</strong>
                  <div style={{ fontSize: '11px', color: 'var(--md-sys-color-on-surface-variant)' }}>
                    বর্তমান সকল তথ্য মুছে ব্যাকআপের তথ্য হুবহু সেট করবে।
                  </div>
                </div>
              </label>
            </div>

            <button
              type="button"
              className="md3-btn-filled"
              disabled={isImporting}
              onClick={executeImport}
            >
              {isImporting ? 'ইমপোর্ট ও সিঙ্ক হচ্ছে...' : 'ইমপোর্ট সম্পন্ন করুন'}
            </button>
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
      </div>

      {/* SECTION 3: Appearance & App Settings */}
      <div className="md3-card">
        <h3 style={{ margin: '0 0 12px', fontSize: '16px', fontWeight: 700, color: 'var(--md-sys-color-on-surface)' }}>
          ⚙️ অ্যাপ ও ডিসপ্লে সেটিংস
        </h3>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px',
            backgroundColor: 'var(--md-sys-color-surface)',
            borderRadius: 'var(--md-shape-corner-md)',
            border: '1px solid var(--md-sys-color-outline-variant)',
            marginBottom: '10px',
          }}
        >
          <div>
            <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--md-sys-color-on-surface)' }}>
              📲 ফোনে অ্যাপ হিসেবে ইনস্টল করুন
            </div>
            <div style={{ fontSize: '11.5px', color: 'var(--md-sys-color-on-surface-variant)' }}>
              Chrome বা Safari থেকে সরাসরি হোম স্ক্রিনে যুক্ত করুন
            </div>
          </div>
          <button
            type="button"
            className="md3-btn-filled"
            style={{ width: 'auto', padding: '6px 14px', fontSize: '12px' }}
            onClick={onOpenInstall}
          >
            ইনস্টল
          </button>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px',
            backgroundColor: 'var(--md-sys-color-surface)',
            borderRadius: 'var(--md-shape-corner-md)',
            border: '1px solid var(--md-sys-color-outline-variant)',
            marginBottom: '10px',
          }}
        >
          <div>
            <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--md-sys-color-on-surface)' }}>
              ডার্ক থিম (Dark Mode)
            </div>
            <div style={{ fontSize: '11.5px', color: 'var(--md-sys-color-on-surface-variant)' }}>
              রাতের বেলা চোখের সুরক্ষায় আরামদায়ক ডিসপ্লে
            </div>
          </div>
          <button
            type="button"
            className="md3-btn-tonal"
            style={{ width: 'auto', padding: '6px 14px', fontSize: '12px' }}
            onClick={onToggleTheme}
          >
            {themeMode === 'dark' ? '☀️ লাইট মোড' : '🌙 ডার্ক মোড'}
          </button>
        </div>

        <div
          style={{
            padding: '10px 14px',
            fontSize: '11.5px',
            color: 'var(--md-sys-color-on-surface-variant)',
            textAlign: 'center',
            lineHeight: 1.5,
          }}
        >
          বিদ্যুৎ বিল · ভার্সন ২.০ (Material Design 3)<br />
          অফলাইন ও অনলাইন ক্লাউড সিঙ্ক সমর্থিত
        </div>
      </div>
    </div>
  );
};
