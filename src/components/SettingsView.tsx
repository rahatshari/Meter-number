import React, { useState, useRef } from 'react';
import { User } from 'firebase/auth';
import { Customer, ThemeMode } from '../types';
import { toBengaliNum, isCustomerPaidThisMonth } from '../utils/bengali';
import { AppUpdateInfo, triggerApkUpdateDownload } from '../utils/appUpdater';
import { getCleanUserEmail } from '../utils/authHelpers';
import { formatLastBackupTimeBn } from '../utils/offlineSync';
import { DRIVE_BACKUP_FILENAME } from '../utils/googleDriveBackup';
import { UserAvatar } from './UserAvatar';

interface SettingsViewProps {
  currentUser: User | null;
  themeMode: ThemeMode;
  isOnline: boolean;
  pendingSyncCount: number;
  isSyncing: boolean;
  lastBackupTime: string | null;
  autoCloudBackupEnabled: boolean;
  onToggleAutoCloudBackup: (enabled: boolean) => void;
  updateInfo: AppUpdateInfo;
  isCheckingUpdate: boolean;
  autoUpdateEnabled: boolean;
  onToggleAutoUpdate: (enabled: boolean) => void;
  onToggleTheme: () => void;
  onOpenAuthModal: () => void;
  onLogout: () => Promise<void>;
  onSyncAllLocalToCloud: () => Promise<void>;
  onConnectGoogleDriveWithEmail: (email: string) => Promise<number>;
  onConnectGoogleDriveOAuthPopup: (hintEmail?: string) => Promise<number>;
  onRestoreFromGoogleDrive: () => Promise<number>;
  onCheckForUpdate: () => Promise<void>;
  onOpenUpdateModal: () => void;
  onSimulateUpdateNotification: () => void;
  customers: Customer[];
  onImportCustomers: (importedList: Customer[], mode: 'merge' | 'replace') => Promise<void>;
  onCopyText: (text: string, label: string) => void;
  onShowToast: (msg: string) => void;
  onShowConfirm: (title: string, message: string, okText: string, onOk: () => void) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  currentUser,
  themeMode,
  isOnline,
  pendingSyncCount,
  isSyncing,
  lastBackupTime,
  autoCloudBackupEnabled,
  onToggleAutoCloudBackup,
  updateInfo,
  isCheckingUpdate,
  autoUpdateEnabled,
  onToggleAutoUpdate,
  onToggleTheme,
  onOpenAuthModal,
  onLogout,
  onSyncAllLocalToCloud,
  onConnectGoogleDriveWithEmail,
  onConnectGoogleDriveOAuthPopup,
  onRestoreFromGoogleDrive,
  onCheckForUpdate,
  onOpenUpdateModal,
  onSimulateUpdateNotification,
  customers,
  onImportCustomers,
  onCopyText,
  onShowToast,
  onShowConfirm,
}) => {
  const [mergeMode, setMergeMode] = useState<'merge' | 'replace'>('merge');
  const [selectedFile, setSelectedFile] = useState<{
    name: string;
    size: string;
    customerList: Customer[];
  } | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isBackingUpNow, setIsBackingUpNow] = useState(false);
  const [isRestoringDrive, setIsRestoringDrive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleBackupNowClick = () => {
    const cleanEmail = currentUser ? getCleanUserEmail(currentUser) : '';
    onShowConfirm(
      'Google Drive-এ ব্যাকআপ সংরক্ষণ নিশ্চিত করুন',
      `আপনার সংযুক্ত Google Drive (${cleanEmail || 'Gmail'})-এর '${DRIVE_BACKUP_FILENAME}' ফাইলে বর্তমান ${toBengaliNum(customers.length)} জন গ্রাহকের সকল তথ্য ব্যাকআপ ও আপডেট করা হবে। আপনি কি অনুমতি দিচ্ছেন?`,
      '✓ হ্যাঁ, ব্যাকআপ রাখুন',
      async () => {
        setIsBackingUpNow(true);
        try {
          await onSyncAllLocalToCloud();
        } finally {
          setIsBackingUpNow(false);
        }
      }
    );
  };

  const handleRestoreFromDriveClick = async () => {
    setIsRestoringDrive(true);
    try {
      await onRestoreFromGoogleDrive();
    } finally {
      setIsRestoringDrive(false);
    }
  };

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
      {/* SECTION 1: Google Drive Backup & Auto-Restore Setup (Gmail -> Drive Access -> Backup & Reinstall Restore) */}
      <div className="md3-card" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              backgroundColor: 'var(--md-sys-color-primary-container)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {/* Official Google Drive 3-color triangle icon */}
            <svg width="24" height="24" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
              <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
              <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z" fill="#00ac47"/>
              <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335"/>
              <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/>
              <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/>
              <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/>
            </svg>
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--md-sys-color-on-surface)' }}>
              Google Drive ব্যাকআপ ও রিস্টোর
            </h3>
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--md-sys-color-on-surface-variant)' }}>
              Gmail দিয়ে Google Drive অ্যাক্সেস নিলে সব তথ্য ব্যাকআপ থাকবে এবং অ্যাপ পুনরায় ইনস্টল করলে ফিরে আসবে
            </p>
          </div>
        </div>

        {/* Backup Summary Box */}
        <div
          style={{
            padding: '12px',
            borderRadius: '12px',
            backgroundColor: 'var(--md-sys-color-surface)',
            border: '1px solid var(--md-sys-color-outline-variant)',
            marginBottom: '12px',
            fontSize: '12.5px',
            display: 'flex',
            flexDirection: 'column',
            gap: '7px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>Google Drive অ্যাক্সেস:</span>
            <span
              style={{
                fontSize: '11.5px',
                fontWeight: 700,
                padding: '2px 9px',
                borderRadius: '999px',
                backgroundColor: currentUser
                  ? 'var(--md-sys-color-success-container)'
                  : 'var(--md-sys-color-warning-container)',
                color: currentUser
                  ? 'var(--md-sys-color-success)'
                  : 'var(--md-sys-color-warning)',
              }}
            >
              {currentUser ? '✓ অ্যাক্সেস সক্রিয় ও সংযুক্ত' : 'অ্যাক্সেস নেওয়া হয়নি'}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>সংযুক্ত Gmail:</span>
            <strong
              style={{
                color: currentUser
                  ? 'var(--md-sys-color-primary)'
                  : 'var(--md-sys-color-on-surface-variant)',
              }}
            >
              {currentUser ? getCleanUserEmail(currentUser) : 'যুক্ত করা হয়নি'}
            </strong>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>ড্রাইভ ব্যাকআপ ফাইল:</span>
            <strong style={{ color: 'var(--md-sys-color-on-surface)', fontSize: '11.5px' }}>
              {DRIVE_BACKUP_FILENAME}
            </strong>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>সর্বশেষ ব্যাকআপ সময়:</span>
            <strong style={{ color: 'var(--md-sys-color-on-surface)' }}>
              {formatLastBackupTimeBn(lastBackupTime)}
            </strong>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>মোট ব্যাকআপকৃত গ্রাহক:</span>
            <strong style={{ color: 'var(--md-sys-color-primary)' }}>
              {toBengaliNum(customers.length)} জন গ্রাহক
            </strong>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>নতুন পরিবর্তন:</span>
            <span
              style={{
                fontSize: '11.5px',
                fontWeight: 700,
                padding: '2px 9px',
                borderRadius: '999px',
                backgroundColor:
                  pendingSyncCount > 0
                    ? 'var(--md-sys-color-warning-container)'
                    : 'var(--md-sys-color-success-container)',
                color:
                  pendingSyncCount > 0
                    ? 'var(--md-sys-color-warning)'
                    : 'var(--md-sys-color-success)',
              }}
            >
              {isSyncing
                ? '⏳ ব্যাকআপ হচ্ছে...'
                : pendingSyncCount > 0
                ? `${toBengaliNum(pendingSyncCount)}টি নতুন তথ্য ব্যাকআপ বাকি`
                : '✓ সব তথ্য ব্যাকআপ করা আছে'}
            </span>
          </div>
        </div>

        {/* Auto-Backup vs Manual 1-Click Backup Switch */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px',
            padding: '10px 12px',
            borderRadius: '12px',
            backgroundColor: 'var(--md-sys-color-surface)',
            border: '1px solid var(--md-sys-color-outline-variant)',
            marginBottom: '12px',
          }}
        >
          <div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--md-sys-color-on-surface)' }}>
              ☁️ ব্যাকআপের ধরন (অটো / ম্যানুয়াল)
            </div>
            <div style={{ fontSize: '11px', color: 'var(--md-sys-color-on-surface-variant)', marginTop: '2px' }}>
              {autoCloudBackupEnabled
                ? 'অটো চালু আছে — নতুন তথ্য যোগ করলেই স্বয়ংক্রিয়ভাবে Google Drive-এ ব্যাকআপ হবে'
                : 'ম্যানুয়াল মোড — যখন খুশি "এখনই ব্যাকআপ রাখুন" বাটনে ক্লিক করলে ব্যাকআপ হবে'}
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={autoCloudBackupEnabled}
            onClick={() => onToggleAutoCloudBackup(!autoCloudBackupEnabled)}
            style={{
              padding: '6px 14px',
              borderRadius: '999px',
              border: '1.5px solid',
              borderColor: autoCloudBackupEnabled
                ? 'var(--md-sys-color-primary)'
                : 'var(--md-sys-color-outline)',
              backgroundColor: autoCloudBackupEnabled
                ? 'var(--md-sys-color-primary)'
                : 'var(--md-sys-color-surface-container)',
              color: autoCloudBackupEnabled ? '#FFFFFF' : 'var(--md-sys-color-on-surface-variant)',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            {autoCloudBackupEnabled ? '✓ অটো চালু' : 'ম্যানুয়াল'}
          </button>
        </div>

        {!currentUser && (
          <div
            style={{
              padding: '14px',
              borderRadius: '14px',
              backgroundColor: 'var(--md-sys-color-surface)',
              border: '1px solid var(--md-sys-color-outline-variant)',
              marginBottom: '12px',
              textAlign: 'center',
            }}
          >
            <p style={{ margin: '0 0 10px', fontSize: '12.5px', color: 'var(--md-sys-color-on-surface-variant)' }}>
              Google Drive ব্যাকআপ ও রিস্টোর ব্যবহারের জন্য আপনার Gmail বা আইডি দিয়ে সাইন ইন করুন
            </p>
            <button
              type="button"
              className="md3-btn-filled"
              onClick={onOpenAuthModal}
              style={{
                width: '100%',
                height: '42px',
                fontSize: '13px',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              <span>🔑 Google Drive ব্যাকআপের জন্য সাইন ইন করুন</span>
            </button>
          </div>
        )}

        {currentUser && (
          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '10px 12px',
                backgroundColor: 'var(--md-sys-color-surface)',
                borderRadius: 'var(--md-shape-corner-md)',
                marginBottom: '10px',
                border: '1px solid var(--md-sys-color-outline-variant)',
              }}
            >
              <UserAvatar user={currentUser} size={42} showStatusDot={true} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--md-sys-color-on-surface)' }} className="truncate">
                  {currentUser.displayName && !currentUser.displayName.includes('+biddut')
                    ? currentUser.displayName
                    : getCleanUserEmail(currentUser).split('@')[0] || 'সম্মানিত ব্যবহারকারী'}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--md-sys-color-on-surface-variant)' }} className="truncate">
                  {getCleanUserEmail(currentUser)}
                </div>
              </div>
              <span
                style={{
                  fontSize: '10.5px',
                  fontWeight: 700,
                  padding: '3px 8px',
                  borderRadius: '999px',
                  backgroundColor: 'var(--md-sys-color-success-container)',
                  color: 'var(--md-sys-color-success)',
                  flexShrink: 0,
                }}
              >
                ✓ Drive সংযুক্ত
              </span>
            </div>

            {/* 1. Primary "Backup All Uploaded Data to Google Drive Now" Button */}
            <button
              type="button"
              className="md3-btn-filled"
              disabled={isBackingUpNow || isSyncing}
              onClick={handleBackupNowClick}
              style={{
                width: '100%',
                height: '46px',
                fontSize: '14px',
                fontWeight: 700,
                marginBottom: '8px',
              }}
            >
              {isBackingUpNow || isSyncing
                ? '⏳ Google Drive-এ ব্যাকআপ হচ্ছে...'
                : pendingSyncCount > 0
                ? `☁️ Google Drive-এ এখনই ব্যাকআপ রাখুন (${toBengaliNum(pendingSyncCount)}টি নতুন)`
                : '☁️ Google Drive-এ এখনই ব্যাকআপ রাখুন (Backup Now)'}
            </button>

            {/* 2. "Restore All Data from Google Drive" Button */}
            <button
              type="button"
              className="md3-btn-tonal"
              disabled={isRestoringDrive || isSyncing}
              onClick={handleRestoreFromDriveClick}
              style={{ width: '100%', padding: '10px 12px', fontSize: '13px', fontWeight: 700, marginBottom: '8px' }}
            >
              {isRestoringDrive
                ? '⏳ Google Drive থেকে তথ্য অ্যাপে আসছে...'
                : '📥 Google Drive থেকে সব তথ্য অ্যাপে আনুন (Restore)'}
            </button>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <button
                type="button"
                className="md3-btn-outlined"
                style={{ padding: '9px 10px', fontSize: '12px' }}
                onClick={onOpenAuthModal}
              >
                🔄 অন্য অ্যাকাউন্ট
              </button>

              <button
                type="button"
                className="md3-btn-outlined"
                style={{ padding: '9px 10px', fontSize: '12px', color: 'var(--md-sys-color-error)', borderColor: 'var(--md-sys-color-error)' }}
                onClick={onLogout}
              >
                🚪 লগআউট করুন
              </button>
            </div>
          </div>
        )}
      </div>


      {/* SECTION 2: APK Auto-Update & Release Hub */}
      <div className="md3-card" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              backgroundColor: '#FFFFFF',
              border: '1px solid var(--md-sys-color-outline-variant)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: 'var(--md-elevation-1)',
            }}
          >
            <img
              src="./icon.png"
              alt="APK Logo"
              style={{ width: '36px', height: '36px', objectFit: 'contain' }}
            />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--md-sys-color-on-surface)' }}>
                অ্যাপ ভার্সন ও অটো-আপডেট (APK)
              </h3>
              <span
                style={{
                  fontSize: '10.5px',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '999px',
                  backgroundColor: updateInfo.hasUpdate
                    ? 'var(--md-sys-color-warning-container)'
                    : 'var(--md-sys-color-primary-container)',
                  color: updateInfo.hasUpdate
                    ? 'var(--md-sys-color-warning)'
                    : 'var(--md-sys-color-primary)',
                }}
              >
                v{toBengaliNum(updateInfo.currentVersion)}
              </span>
            </div>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--md-sys-color-on-surface-variant)' }}>
              অ্যাপের ভেতর থেকে সরাসরি আপডেট ও পরিবর্তনসমূহ
            </p>
          </div>
        </div>

        {/* Auto-Update On / Off Switch Row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px',
            padding: '10px 12px',
            borderRadius: '12px',
            backgroundColor: 'var(--md-sys-color-surface)',
            border: '1px solid var(--md-sys-color-outline-variant)',
            marginBottom: '10px',
          }}
        >
          <div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--md-sys-color-on-surface)' }}>
              🔄 অটো-আপডেট সিস্টেম
            </div>
            <div style={{ fontSize: '11px', color: 'var(--md-sys-color-on-surface-variant)', marginTop: '2px' }}>
              {autoUpdateEnabled
                ? 'চালু আছে — নতুন আপডেট এলে স্বয়ংক্রিয়ভাবে জানাবে'
                : 'বন্ধ আছে — নিজে চেক না করলে আপডেট নোটিফিকেশন আসবে না'}
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={autoUpdateEnabled}
            onClick={() => onToggleAutoUpdate(!autoUpdateEnabled)}
            style={{
              padding: '6px 14px',
              borderRadius: '999px',
              border: '1.5px solid',
              borderColor: autoUpdateEnabled
                ? 'var(--md-sys-color-primary)'
                : 'var(--md-sys-color-outline)',
              backgroundColor: autoUpdateEnabled
                ? 'var(--md-sys-color-primary)'
                : 'var(--md-sys-color-surface-container)',
              color: autoUpdateEnabled ? '#FFFFFF' : 'var(--md-sys-color-on-surface-variant)',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            {autoUpdateEnabled ? '✓ চালু আছে' : 'বন্ধ আছে'}
          </button>
        </div>

        <div
          style={{
            padding: '12px',
            borderRadius: '12px',
            backgroundColor: 'var(--md-sys-color-surface)',
            border: '1px solid var(--md-sys-color-outline-variant)',
            marginBottom: '12px',
            fontSize: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>বর্তমান ইনস্টলকৃত ভার্সন:</span>
            <strong style={{ color: 'var(--md-sys-color-on-surface)' }}>
              v{toBengaliNum(updateInfo.currentVersion)} (কোড #{toBengaliNum(updateInfo.currentVersionCode)})
            </strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>সর্বশেষ রিলিজ ভার্সন:</span>
            <strong
              style={{
                color: updateInfo.hasUpdate
                  ? 'var(--md-sys-color-primary)'
                  : 'var(--md-sys-color-success)',
              }}
            >
              v{toBengaliNum(updateInfo.latestVersion)}{' '}
              {updateInfo.hasUpdate ? '(নতুন আপডেট আছে!)' : '(আপ-টু-ডেট)'}
            </strong>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
          <button
            type="button"
            className="md3-btn-filled"
            style={{ padding: '10px 12px', fontSize: '12.5px' }}
            onClick={onOpenUpdateModal}
          >
            📲 {updateInfo.hasUpdate ? 'এখনই আপডেট করুন' : 'আপডেট ও পরিবর্তনসমূহ'}
          </button>

          <button
            type="button"
            className="md3-btn-tonal"
            style={{ padding: '10px 12px', fontSize: '12.5px' }}
            disabled={isCheckingUpdate}
            onClick={onCheckForUpdate}
          >
            {isCheckingUpdate ? 'চেক হচ্ছে...' : '🔄 আপডেট চেক করুন'}
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <button
            type="button"
            className="md3-btn-outlined"
            style={{ padding: '8px 10px', fontSize: '11.5px' }}
            onClick={() => {
              triggerApkUpdateDownload(updateInfo.apkDownloadUrl);
              onShowToast('📥 সর্বশেষ APK ডাউনলোড শুরু হয়েছে!');
            }}
          >
            📥 সরাসরি APK ডাউনলোড
          </button>

          <button
            type="button"
            className="md3-btn-outlined"
            style={{ padding: '8px 10px', fontSize: '11.5px' }}
            onClick={onSimulateUpdateNotification}
          >
            🔔 টেস্ট আপডেট অ্যালার্ট
          </button>
        </div>
      </div>

      {/* SECTION 3: Data Backup & Restore */}
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

      {/* SECTION 4: Appearance & App Settings (Clean APK UI without web install button) */}
      <div className="md3-card">
        <h3 style={{ margin: '0 0 12px', fontSize: '16px', fontWeight: 700, color: 'var(--md-sys-color-on-surface)' }}>
          ⚙️ ডিসপ্লে সেটিংস
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
          বিদ্যুৎ বিল · ভার্সন {toBengaliNum(updateInfo.currentVersion)} (বিল্ড #{toBengaliNum(updateInfo.currentVersionCode)})<br />
          অফলাইন-ফার্স্ট ও স্বয়ংক্রিয় ক্লাউড সিঙ্ক
        </div>
      </div>
    </div>
  );
};
