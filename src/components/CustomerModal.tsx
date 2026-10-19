import React, { useState, useEffect } from 'react';
import { Customer } from '../types';
import { toEnglishNum, toBengaliNum } from '../utils/bengali';

interface CustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingCustomer: Customer | null;
  existingCustomers: Customer[];
  onSave: (customer: Customer, isEdit: boolean) => void;
  onShowToast: (msg: string) => void;
}

export const CustomerModal: React.FC<CustomerModalProps> = ({
  isOpen,
  onClose,
  editingCustomer,
  existingCustomers,
  onSave,
  onShowToast,
}) => {
  const [name, setName] = useState('');
  const [father, setFather] = useState('');
  const [mother, setMother] = useState('');
  const [address, setAddress] = useState('');
  const [mobile, setMobile] = useState('');
  const [sms, setSms] = useState('');
  const [dueDate, setDueDate] = useState('');

  useEffect(() => {
    if (editingCustomer) {
      setName(editingCustomer.name || '');
      setFather(editingCustomer.father || '');
      setMother(editingCustomer.mother || '');
      setAddress(editingCustomer.address || '');
      setMobile(editingCustomer.mobile || '');
      setSms(editingCustomer.sms || '');
      setDueDate(editingCustomer.dueDate || '');
    } else {
      setName('');
      setFather('');
      setMother('');
      setAddress('');
      setMobile('');
      setSms('');
      setDueDate('');
    }
  }, [editingCustomer, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedName = name.trim();
    if (!trimmedName) {
      onShowToast('দয়া করে গ্রাহকের নাম লিখুন।');
      return;
    }

    if (!mobile.trim()) {
      onShowToast('দয়া করে ১১ ডিজিটের মোবাইল নম্বর দিন।');
      return;
    }

    const cleanMobile = toEnglishNum(mobile.trim()).replace(/\D/g, '');
    if (cleanMobile.length !== 11) {
      onShowToast(
        `⚠️ মোবাইল নম্বর অবশ্যই ঠিক ১১ ডিজিটের হতে হবে! (বর্তমানে ${toBengaliNum(cleanMobile.length)} ডিজিট রয়েছে)`
      );
      return;
    }

    if (!sms.trim()) {
      onShowToast('দয়া করে ১৩ ডিজিটের SMS অ্যাকাউন্ট / মিটার নম্বর দিন।');
      return;
    }

    const cleanSms = toEnglishNum(sms.trim()).replace(/\D/g, '');
    if (cleanSms.length !== 13) {
      onShowToast(
        `⚠️ SMS অ্যাকাউন্ট নম্বর অবশ্যই ঠিক ১৩ ডিজিটের হতে হবে! (বর্তমানে ${toBengaliNum(cleanSms.length)} ডিজিট রয়েছে)`
      );
      return;
    }

    // Duplicate SMS account check
    const dupSms = existingCustomers.find((c) => {
      if (editingCustomer && String(c.id) === String(editingCustomer.id)) return false;
      const existingClean = toEnglishNum(String(c.sms || '')).replace(/\D/g, '');
      return existingClean === cleanSms;
    });

    if (dupSms) {
      onShowToast(`⚠️ এই SMS অ্যাকাউন্ট নম্বরটি ইতিমধ্যে "${dupSms.name}" এর তথ্যে ব্যবহৃত হয়েছে!`);
      return;
    }

    if (!dueDate.trim()) {
      onShowToast('দয়া করে বিলের শেষ তারিখ দিন (১ থেকে ৩১)।');
      return;
    }

    const dueDateNum = parseInt(toEnglishNum(dueDate.trim()), 10);
    if (isNaN(dueDateNum) || dueDateNum < 1 || dueDateNum > 31) {
      onShowToast('দয়া করে ১ থেকে ৩১ এর মধ্যে একটি সঠিক তারিখ দিন।');
      return;
    }

    const isEdit = !!editingCustomer;
    const customerPayload: Customer = {
      id: editingCustomer ? editingCustomer.id : Date.now(),
      name: trimmedName,
      father: father.trim(),
      mother: mother.trim(),
      address: address.trim(),
      mobile: cleanMobile,
      sms: cleanSms,
      dueDate: String(dueDateNum),
      group: editingCustomer?.group || '',
      lastPaidMonth: editingCustomer?.lastPaidMonth || '',
      userId: editingCustomer?.userId,
    };

    onSave(customerPayload, isEdit);
    onClose();
  };

  return (
    <div className="md3-overlay" onClick={onClose}>
      <div className="md3-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="md3-drag-handle" />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--md-sys-color-on-surface)' }}>
            {editingCustomer ? '✏️ গ্রাহকের তথ্য সম্পাদনা' : '👤 নতুন গ্রাহক যোগ করুন'}
          </h3>
          <button
            type="button"
            className="md3-icon-btn"
            style={{ width: '32px', height: '32px' }}
            onClick={onClose}
            aria-label="বন্ধ করুন"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Name */}
          <div className="md3-text-field">
            <label>গ্রাহকের নাম *</label>
            <input
              type="text"
              className="md3-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="পূর্ণ নাম লিখুন"
            />
          </div>

          {/* Father's Name */}
          <div className="md3-text-field">
            <label>পিতার নাম</label>
            <input
              type="text"
              className="md3-input"
              value={father}
              onChange={(e) => setFather(e.target.value)}
              placeholder="পিতার নাম"
            />
          </div>

          {/* Mother's Name */}
          <div className="md3-text-field">
            <label>মাতার নাম (ঐচ্ছিক)</label>
            <input
              type="text"
              className="md3-input"
              value={mother}
              onChange={(e) => setMother(e.target.value)}
              placeholder="মাতার নাম"
            />
          </div>

          {/* Address */}
          <div className="md3-text-field">
            <label>ঠিকানা</label>
            <input
              type="text"
              className="md3-input"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="গ্রাম / পাড়া / বাড়ি নম্বর"
            />
          </div>

          {/* Mobile (11 digits) */}
          <div className="md3-text-field">
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <label>মোবাইল নম্বর (১১ ডিজিট) *</label>
              <span style={{ fontSize: '11px', color: 'var(--md-sys-color-on-surface-variant)' }}>
                {toBengaliNum(mobile.length)}/১১ ডিজিট
              </span>
            </div>
            <input
              type="tel"
              className="md3-input"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              placeholder="যেমন: 017xxxxxxxx"
              maxLength={11}
              inputMode="numeric"
            />
          </div>

          {/* SMS Account / Meter Number (13 digits) */}
          <div className="md3-text-field">
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <label>SMS অ্যাকাউন্ট / মিটার নাম্বার (১৩ ডিজিট) *</label>
              <span style={{ fontSize: '11px', color: 'var(--md-sys-color-on-surface-variant)' }}>
                {toBengaliNum(sms.length)}/১৩ ডিজিট
              </span>
            </div>
            <input
              type="tel"
              className="md3-input"
              value={sms}
              onChange={(e) => setSms(e.target.value)}
              placeholder="যেমন: 103xxxxxxxxxx"
              maxLength={13}
              inputMode="numeric"
            />
          </div>

          {/* Bill Due Day (1 to 31) */}
          <div className="md3-text-field">
            <label>বিলের শেষ তারিখ (১ থেকে ৩১) *</label>
            <input
              type="number"
              className="md3-input"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              placeholder="যেমন: ১৮, ২৫, ৩০"
              min={1}
              max={31}
            />
          </div>

          <button type="submit" className="md3-btn-filled" style={{ marginTop: '10px' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
              <polyline points="17 21 17 13 7 13 7 21" />
              <polyline points="7 3 7 8 15 8" />
            </svg>
            {editingCustomer ? 'তথ্য আপডেট করুন' : 'গ্রাহক সংরক্ষণ করুন'}
          </button>
        </form>
      </div>
    </div>
  );
};
