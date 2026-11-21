import React, { useState, useRef } from 'react';
import { User } from 'firebase/auth';
import { Customer, ThemeMode } from '../types';
import { toBengaliNum } from '../utils/bengali';
import { AppUpdateInfo, triggerApkUpdateDownload } from '../utils/appUpdater';
import { getCleanUserEmail } from '../utils/authHelpers';
import { formatLastBackupTimeBn } from '../utils/offlineSync';

interface SettingsViewProps {
  currentUser: User | null;
  themeMode: ThemeMode;
  pendingSyncCount: number;
  isSyncing: boolean;
  lastBackupTime: string | null;
  updateInfo: AppUpdateInfo;
  isCheckingUpdate: boolean;
  autoUpdateEnabled: boolean;
  onToggleAutoUpdate: (enabled: boolean) => void;
  onToggleTheme: () => void;
  onCheckForUpdate: () => Promise<void>;
  onOpenUpdateModal: () => void;
  onSimulateUpdateNotification: () => void;
  customers: Customer[];
  onImportCustomers: (importedList: Customer[], mode: 'merge' | 'replace') => Promise<void>;
  onShowToast: (msg: string) => void;
  onShowConfirm: (title: string, message: string, okText: string, onOk: () => void) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  currentUser,
  themeMode,
  pendingSyncCount,
  isSyncing,
  lastBackupTime,
  updateInfo,
  isCheckingUpdate,
  autoUpdateEnabled,
  onToggleAutoUpdate,
  onToggleTheme,
  onCheckForUpdate,
  onOpenUpdateModal,
  onSimulateUpdateNotification,
  customers,
  onImportCustomers,
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

  return (
    <div style={{ paddingBottom: '96px' }}>
      {/* SECTION 1: Firebase Cloud Sync Status Only (Login & Sync controls live in the Profile Account modal) */}
      <div className="md3-card" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              backgroundColor: 'var(--md-sys-color-primary-container)',
              color: 'var(--md-sys-color-on-primary-container)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
            </svg>
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--md-sys-color-on-surface)' }}>
              ফায়ারবেস ক্লাউড সিঙ্ক
            </h3>
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--md-sys-color-on-surface-variant)' }}>
              আপনার অ্যাকাউন্টের ডেটা স্বয়ংক্রিয়ভাবে ফায়ারবেসে সিঙ্ক হচ্ছে
            </p>
          </div>
        </div>

        <div
          style={{
            padding: '12px',
            borderRadius: '12px',
            backgroundColor: 'var(--md-sys-color-surface)',
            border: '1px solid var(--md-sys-color-outline-variant)',
            fontSize: '12.5px',
            display: 'flex',
            flexDirection: 'column',
            gap: '7px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>সংযুক্ত অ্যাকাউন্ট:</span>
            <strong
              style={{
                color: currentUser
                  ? 'var(--md-sys-color-primary)'
                  : 'var(--md-sys-color-on-surface-variant)',
              }}
              className="truncate"
            >
              {currentUser ? getCleanUserEmail(currentUser) : 'লগইন করা নেই'}
            </strong>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>সর্বশেষ সিঙ্ক সময়:</span>
            <strong style={{ color: 'var(--md-sys-color-on-surface)' }}>
              {formatLastBackupTimeBn(lastBackupTime)}
            </strong>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>সিঙ্ক অবস্থা:</span>
            <span
              style={{
                fontSize: '12px',
                fontWeight: 700,
                color: !currentUser
                  ? 'var(--md-sys-color-on-surface-variant)'
                  : pendingSyncCount > 0
                  ? 'var(--md-sys-color-warning)'
                  : 'var(--md-sys-color-success)',
              }}
            >
              {!currentUser
                ? 'অফলাইন লোকাল মোড'
                : isSyncing
                ? '⏳ ফায়ারবেসে সিঙ্ক হচ্ছে...'
                : pendingSyncCount > 0
                ? `${toBengaliNum(pendingSyncCount)}টি পরিবর্তন সিঙ্ক বাকি`
                : '✓ ফায়ারবেসে সব তথ্য সিঙ্ক আছে'}
            </span>
          </div>
        </div>
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
              color: autoUpdateEnabled ? 'var(--md-sys-color-on-primary)' : 'var(--md-sys-color-on-surface-variant)',
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

        {/* JSON Export Option */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
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

      {/* SECTION 4: Appearance & App Settings */}
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
          অফলাইন-ফার্স্ট ও স্বয়ংক্রিয় ফায়ারবেস সিঙ্ক
        </div>
      </div>
    </div>
  );
};
