import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  User,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import {
  doc,
  collection,
  setDoc,
  deleteDoc,
  onSnapshot,
} from 'firebase/firestore';

import { auth, db, handleFirestoreError } from './firebase';
import { Customer, StatusFilter, NavTab, ThemeMode, OperationType, AuthTab } from './types';
import {
  getCurrentMonthStr,
  isCustomerPaidThisMonth,
  toEnglishNum,
} from './utils/bengali';

import { TopAppBar } from './components/TopAppBar';
import { BottomNavBar } from './components/BottomNavBar';
import { DashboardView } from './components/DashboardView';
import { CustomersView } from './components/CustomersView';
import { DuesView } from './components/DuesView';
import { SettingsView } from './components/SettingsView';
import { CustomerModal } from './components/CustomerModal';
import { ActionModal } from './components/ActionModal';
import { ConfirmModal } from './components/ConfirmModal';
import { AuthModal } from './components/AuthModal';
import { AccountModal } from './components/AccountModal';
import { Toast } from './components/Toast';

export const App: React.FC = () => {
  // Navigation & Theme
  const [currentTab, setCurrentTab] = useState<NavTab>('home');
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('billAppTheme');
    if (saved === 'dark' || saved === 'light') return saved;
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  });

  // Apply dark class to document root
  useEffect(() => {
    if (themeMode === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('billAppTheme', themeMode);
  }, [themeMode]);

  const toggleTheme = () => {
    setThemeMode((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Customers and user state
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Search & Filters (for CustomersView)
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');
  const [dateFilter, setDateFilter] = useState('All');

  // Modal controls
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  const [selectedCustomerForAction, setSelectedCustomerForAction] = useState<Customer | null>(null);

  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState<{
    title: string;
    message: string;
    okText?: string;
    onOk: () => void;
  }>({ title: '', message: '', onOk: () => {} });

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authInitialTab, setAuthInitialTab] = useState<AuthTab>('google');

  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);

  // Toast / Snackbar
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isToastVisible, setIsToastVisible] = useState(false);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Live backup pulse state
  const [backupPulse, setBackupPulse] = useState(false);
  const [backupPulseText, setBackupPulseText] = useState('💾 লোকাল ব্যাকআপ হয়েছে');
  const backupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setIsToastVisible(true);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => {
      setIsToastVisible(false);
    }, 2800);
  };

  const notifyRealtimeBackup = (customMessage?: string) => {
    setBackupPulse(true);
    setBackupPulseText(currentUser ? '☁️ ক্লাউডে ব্যাকআপ হয়েছে' : '💾 লোকাল ব্যাকআপ হয়েছে');

    if (backupTimerRef.current) clearTimeout(backupTimerRef.current);
    backupTimerRef.current = setTimeout(() => {
      setBackupPulse(false);
    }, 3000);

    const msg = customMessage || (currentUser ? '☁️ ক্লাউডে সাথে সাথে ব্যাকআপ হয়েছে!' : '💾 স্বয়ংক্রিয় ব্যাকআপ সম্পন্ন!');
    showToast(msg);
  };

  // Local storage helpers
  const saveToLocalStorage = (list: Customer[]) => {
    try {
      localStorage.setItem('billCustomers', JSON.stringify(list));
    } catch (e) {
      console.error('LocalStorage write error', e);
    }
  };

  const loadLocalData = (): Customer[] => {
    const saved = localStorage.getItem('billCustomers');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.map((c) => ({
            ...c,
            mobile: c.mobile || '',
            mother: c.mother || '',
            dueDate: c.dueDate || '',
            lastPaidMonth: c.lastPaidMonth || '',
          }));
        }
      } catch (e) {
        console.error('LocalStorage read error', e);
      }
    }
    return [];
  };

  // Firestore operations
  const saveCustomerToFirestore = async (c: Customer, user: User) => {
    const custId = String(c.id);
    const path = `users/${user.uid}/customers/${custId}`;
    try {
      const payload = {
        id: custId,
        name: String(c.name || '').slice(0, 100),
        father: String(c.father || '').slice(0, 100),
        mother: String(c.mother || '').slice(0, 100),
        address: String(c.address || '').slice(0, 200),
        mobile: String(c.mobile || '').slice(0, 30),
        sms: String(c.sms || '').slice(0, 50),
        dueDate: String(c.dueDate || '').slice(0, 10),
        group: String(c.group || '').slice(0, 100),
        lastPaidMonth: String(c.lastPaidMonth || '').slice(0, 20),
        userId: user.uid,
      };
      await setDoc(doc(db, 'users', user.uid, 'customers', custId), payload);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  };

  const deleteCustomerFromFirestore = async (id: string | number, user: User) => {
    const custId = String(id);
    const path = `users/${user.uid}/customers/${custId}`;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'customers', custId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  // Auth observer and Firestore listener
  useEffect(() => {
    let unsubscribeCustomers: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);

      if (unsubscribeCustomers) {
        unsubscribeCustomers();
        unsubscribeCustomers = null;
      }

      if (user) {
        showToast('স্বাগতম! অনলাইন ক্লাউড সিঙ্ক চালু হয়েছে');

        const custPath = `users/${user.uid}/customers`;
        unsubscribeCustomers = onSnapshot(
          collection(db, 'users', user.uid, 'customers'),
          (snapshot) => {
            const cloudCustomers: Customer[] = [];
            snapshot.forEach((docSnap) => {
              const data = docSnap.data();
              cloudCustomers.push({
                id: parseFloat(data.id) || data.id,
                name: data.name,
                father: data.father || '',
                mother: data.mother || '',
                address: data.address || '',
                mobile: data.mobile || '',
                sms: data.sms || '',
                dueDate: data.dueDate || '',
                group: data.group || '',
                lastPaidMonth: data.lastPaidMonth || '',
                userId: data.userId,
              });
            });

            if (cloudCustomers.length > 0) {
              setCustomers(cloudCustomers);
              saveToLocalStorage(cloudCustomers);
            } else {
              // Upload local data to cloud if cloud is newly initialized
              const localList = loadLocalData();
              if (localList.length > 0) {
                setCustomers(localList);
                localList.forEach((c) => saveCustomerToFirestore(c, user));
              } else {
                setCustomers([]);
              }
            }
          },
          (error) => {
            handleFirestoreError(error, OperationType.GET, custPath);
          }
        );
      } else {
        const local = loadLocalData();
        setCustomers(local);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeCustomers) unsubscribeCustomers();
    };
  }, []);

  const currentMonth = getCurrentMonthStr();

  // Filtered customers for CustomersView
  const filteredCustomers = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    return customers.filter((c) => {
      const isPaid = c.lastPaidMonth === currentMonth;

      const matchSearch =
        !query ||
        (c.name || '').toLowerCase().includes(query) ||
        (c.mobile || '').toLowerCase().includes(query) ||
        (c.sms || '').toLowerCase().includes(query) ||
        (c.father || '').toLowerCase().includes(query) ||
        (c.address || '').toLowerCase().includes(query);

      const matchDate =
        dateFilter === 'All' || toEnglishNum(String(c.dueDate || '')).trim() === String(dateFilter);

      let matchStatus = true;
      if (statusFilter === 'Paid') matchStatus = isPaid;
      if (statusFilter === 'Unpaid') matchStatus = !isPaid;

      return matchSearch && matchDate && matchStatus;
    });
  }, [customers, searchQuery, dateFilter, statusFilter, currentMonth]);

  // Unique due dates for dropdown
  const availableDates = useMemo(() => {
    const dateSet = new Set<number>();
    customers.forEach((c) => {
      if (c.dueDate) {
        const norm = parseInt(toEnglishNum(String(c.dueDate)).trim(), 10);
        if (!isNaN(norm) && norm >= 1 && norm <= 31) {
          dateSet.add(norm);
        }
      }
    });
    return Array.from(dateSet).sort((a, b) => a - b);
  }, [customers]);

  // Unpaid count
  const unpaidCount = useMemo(() => {
    return customers.filter((c) => !isCustomerPaidThisMonth(c)).length;
  }, [customers, currentMonth]);

  // Copy helper
  const handleCopyText = (text: string, label: string) => {
    if (!text) {
      showToast('কোনো নম্বর নেই');
      return;
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard
        .writeText(text)
        .then(() => showToast(`${label} কপি হয়েছে!`))
        .catch(() => fallbackCopy(text, label));
    } else {
      fallbackCopy(text, label);
    }
  };

  const fallbackCopy = (text: string, label: string) => {
    const temp = document.createElement('input');
    temp.value = text;
    document.body.appendChild(temp);
    temp.select();
    temp.setSelectionRange(0, 99999);
    try {
      document.execCommand('copy');
      showToast(`${label} কপি হয়েছে!`);
    } catch {
      showToast('কপি করা সম্ভব হয়নি!');
    }
    document.body.removeChild(temp);
  };

  // Customer Save (Add / Edit)
  const handleSaveCustomer = (customer: Customer, isEdit: boolean) => {
    let nextList: Customer[];
    if (isEdit) {
      nextList = customers.map((c) => (String(c.id) === String(customer.id) ? customer : c));
    } else {
      nextList = [customer, ...customers];
    }

    setCustomers(nextList);
    saveToLocalStorage(nextList);
    notifyRealtimeBackup(isEdit ? '✅ গ্রাহকের তথ্য সফলভাবে আপডেট হয়েছে!' : '✅ নতুন গ্রাহক সফলভাবে অ্যাড হয়েছে!');

    if (currentUser) {
      saveCustomerToFirestore(customer, currentUser).catch((err) =>
        console.error('Firestore save customer error', err)
      );
    }
  };

  // Payment Toggle
  const handleTogglePayment = (c: Customer) => {
    const isNowPaid = c.lastPaidMonth !== currentMonth;
    const updated: Customer = {
      ...c,
      lastPaidMonth: isNowPaid ? currentMonth : '',
    };

    const nextList = customers.map((item) => (item.id === c.id ? updated : item));
    setCustomers(nextList);
    saveToLocalStorage(nextList);

    notifyRealtimeBackup(isNowPaid ? '✅ বিল পরিশোধিত হিসেবে মার্ক করা হয়েছে!' : 'বিল আনপেইড করা হয়েছে!');

    if (currentUser) {
      saveCustomerToFirestore(updated, currentUser).catch((err) =>
        console.error('Firestore toggle payment error', err)
      );
    }
  };

  // Delete Customer
  const handleDeleteCustomer = (c: Customer) => {
    setConfirmConfig({
      title: 'গ্রাহকের তথ্য মুছুন',
      message: `আপনি কি নিশ্চিতভাবে '${c.name}'-এর তথ্য মুছে ফেলতে চান?`,
      okText: 'মুছে ফেলুন',
      onOk: () => {
        const nextList = customers.filter((item) => item.id !== c.id);
        setCustomers(nextList);
        saveToLocalStorage(nextList);
        notifyRealtimeBackup('🗑️ গ্রাহকের তথ্য মুছে ফেলা হয়েছে!');

        if (currentUser) {
          deleteCustomerFromFirestore(c.id, currentUser).catch((err) =>
            console.error('Firestore delete customer error', err)
          );
        }
      },
    });
    setIsConfirmModalOpen(true);
  };

  // Import customers from Data Hub
  const handleImportCustomers = async (importedList: Customer[], mode: 'merge' | 'replace') => {
    let nextList: Customer[];
    if (mode === 'replace') {
      nextList = importedList;
    } else {
      // Smart Merge
      nextList = [...customers];
      for (const nc of importedList) {
        const idx = nextList.findIndex(
          (c) =>
            (nc.id && String(c.id) === String(nc.id)) ||
            (c.sms && nc.sms && String(c.sms).trim() === String(nc.sms).trim()) ||
            (c.name &&
              nc.name &&
              c.name.trim().toLowerCase() === nc.name.trim().toLowerCase() &&
              (c.father || '').trim().toLowerCase() === (nc.father || '').trim().toLowerCase())
        );
        if (idx >= 0) {
          nextList[idx] = { ...nextList[idx], ...nc };
        } else {
          nextList.push(nc);
        }
      }
    }

    setCustomers(nextList);
    saveToLocalStorage(nextList);

    if (currentUser) {
      showToast('ক্লাউডে সিঙ্ক হচ্ছে...');
      try {
        for (const c of nextList) {
          await saveCustomerToFirestore(c, currentUser);
        }
        notifyRealtimeBackup('✅ সফলভাবে ইমপোর্ট সম্পন্ন এবং সব মোবাইলে সিঙ্ক হয়েছে!');
      } catch (err) {
        console.error('Cloud sync during import error', err);
        notifyRealtimeBackup('✅ লোকাল ইমপোর্ট সফল!');
      }
    } else {
      notifyRealtimeBackup('✅ সফলভাবে ইমপোর্ট ও ব্যাকআপ সম্পন্ন হয়েছে!');
    }
  };

  // Sync all local to cloud
  const handleSyncAllLocalToCloud = async () => {
    if (!currentUser) {
      setAuthInitialTab('google');
      setIsAuthModalOpen(true);
      return;
    }
    showToast('সব ডাটা ক্লাউডে সিঙ্ক হচ্ছে...');
    try {
      for (const c of customers) {
        await saveCustomerToFirestore(c, currentUser);
      }
      showToast('✅ সফলভাবে ক্লাউডে সিঙ্ক হয়েছে! যে কোনো মোবাইলে দেখতে পাবেন।');
      setIsAccountModalOpen(false);
    } catch {
      showToast('সিঙ্ক করতে সমস্যা হয়েছে!');
    }
  };

  // Auth methods
  const handleGoogleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      showToast('Google লগইন উইন্ডো খোলা হচ্ছে...');
      await signInWithPopup(auth, provider);
      showToast('Google লগইন সফল হয়েছে!');
    } catch (error: any) {
      console.error('Google Sign-In Error:', error);
      if (error?.code === 'auth/popup-closed-by-user') {
        showToast('লগইন উইন্ডো বন্ধ করা হয়েছে');
      } else {
        showToast('লগইন ব্যর্থ হয়েছে: ' + (error?.message || ''));
      }
    }
  };

  const handleEmailLogin = async (email: string, pass: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, pass);
      showToast('ইমেইল লগইন সফল হয়েছে!');
    } catch (err: any) {
      console.error('Email login error:', err);
      let msg = 'ত্রুটি: ';
      if (
        err.code === 'auth/user-not-found' ||
        err.code === 'auth/wrong-password' ||
        err.code === 'auth/invalid-credential'
      ) {
        msg += 'ভুল ইমেইল অথবা পাসওয়ার্ড';
      } else {
        msg += err.message || 'লগইন ব্যর্থ হয়েছে';
      }
      showToast(msg);
      throw err;
    }
  };

  const handleEmailRegister = async (email: string, pass: string) => {
    try {
      await createUserWithEmailAndPassword(auth, email, pass);
      showToast('অ্যাকাউন্ট সফলভাবে তৈরি হয়েছে!');
    } catch (err: any) {
      console.error('Email register error:', err);
      let msg = 'ত্রুটি: ';
      if (err.code === 'auth/email-already-in-use') {
        msg += 'এই ইমেইলে আগেই অ্যাকাউন্ট আছে। লগইন করুন।';
      } else if (err.code === 'auth/weak-password') {
        msg += 'পাসওয়ার্ড অন্তত ৬ অক্ষরের হতে হবে';
      } else {
        msg += err.message || 'অ্যাকাউন্ট তৈরি করা যায়নি';
      }
      showToast(msg);
      throw err;
    }
  };

  const handleForgotPassword = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email);
      showToast('পাসওয়ার্ড রিসেট লিংক আপনার ইমেইলে পাঠানো হয়েছে!');
    } catch (err: any) {
      showToast('রিসেট লিংক পাঠানো যায়নি: ' + (err.message || ''));
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      showToast('লগআউট করা হয়েছে');
    } catch {
      showToast('লগআউটে সমস্যা হয়েছে');
    }
  };

  const handleShowConfirm = (title: string, message: string, okText: string, onOk: () => void) => {
    setConfirmConfig({ title, message, okText, onOk });
    setIsConfirmModalOpen(true);
  };

  return (
    <div className="app-viewport-container">
      {/* Material Design 3 Top App Bar */}
      <TopAppBar
        currentUser={currentUser}
        themeMode={themeMode}
        onToggleTheme={toggleTheme}
        onOpenAccount={() => {
          if (currentUser) {
            setIsAccountModalOpen(true);
          } else {
            setAuthInitialTab('google');
            setIsAuthModalOpen(true);
          }
        }}
        onSearchClick={() => {
          setCurrentTab('customers');
        }}
      />

      {/* Main Content Body */}
      <main style={{ padding: '14px 16px', flex: 1 }}>
        {currentTab === 'home' && (
          <DashboardView
            customers={customers}
            onNavigateToTab={(tab) => setCurrentTab(tab)}
            onAddCustomer={() => {
              setEditingCustomer(null);
              setIsCustomerModalOpen(true);
            }}
            onSelectCustomer={(c) => setSelectedCustomerForAction(c)}
            onCopyText={handleCopyText}
            backupPulse={backupPulse}
            backupPulseText={backupPulseText}
          />
        )}

        {currentTab === 'customers' && (
          <CustomersView
            customers={customers}
            filteredCustomers={filteredCustomers}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            dateFilter={dateFilter}
            onDateFilterChange={setDateFilter}
            availableDates={availableDates}
            onSelectCustomer={(c) => setSelectedCustomerForAction(c)}
            onCopyText={handleCopyText}
            onAddCustomer={() => {
              setEditingCustomer(null);
              setIsCustomerModalOpen(true);
            }}
          />
        )}

        {currentTab === 'dues' && (
          <DuesView
            customers={customers}
            onSelectCustomer={(c) => setSelectedCustomerForAction(c)}
            onCopyText={handleCopyText}
            onShowToast={showToast}
            availableDates={availableDates}
          />
        )}

        {currentTab === 'settings' && (
          <SettingsView
            currentUser={currentUser}
            themeMode={themeMode}
            onToggleTheme={toggleTheme}
            onOpenAuthModal={() => {
              setAuthInitialTab('google');
              setIsAuthModalOpen(true);
            }}
            onLogout={handleLogout}
            onSyncAllLocalToCloud={handleSyncAllLocalToCloud}
            customers={customers}
            onImportCustomers={handleImportCustomers}
            onCopyText={handleCopyText}
            onShowToast={showToast}
            onShowConfirm={handleShowConfirm}
          />
        )}
      </main>

      {/* Floating Action Button (Visible on Home, Customers, and Dues tabs) */}
      {currentTab !== 'settings' && (
        <button
          type="button"
          className="md3-fab"
          onClick={() => {
            setEditingCustomer(null);
            setIsCustomerModalOpen(true);
          }}
          title="নতুন গ্রাহক যোগ করুন"
          aria-label="নতুন গ্রাহক যোগ করুন"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="24" height="24">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      )}

      {/* Material Design 3 Bottom Navigation Bar */}
      <BottomNavBar
        currentTab={currentTab}
        onTabChange={(tab) => setCurrentTab(tab)}
        unpaidCount={unpaidCount}
      />

      {/* Customer Add/Edit Modal */}
      <CustomerModal
        isOpen={isCustomerModalOpen}
        onClose={() => setIsCustomerModalOpen(false)}
        editingCustomer={editingCustomer}
        existingCustomers={customers}
        onSave={handleSaveCustomer}
        onShowToast={showToast}
      />

      {/* Customer Action Sheet Modal */}
      <ActionModal
        customer={selectedCustomerForAction}
        onClose={() => setSelectedCustomerForAction(null)}
        onTogglePayment={handleTogglePayment}
        onEdit={(c) => {
          setEditingCustomer(c);
          setIsCustomerModalOpen(true);
        }}
        onDelete={handleDeleteCustomer}
      />

      {/* Confirm Delete / Replace Modal */}
      <ConfirmModal
        isOpen={isConfirmModalOpen}
        title={confirmConfig.title}
        message={confirmConfig.message}
        okText={confirmConfig.okText}
        onOk={confirmConfig.onOk}
        onCancel={() => setIsConfirmModalOpen(false)}
      />

      {/* Auth Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onGoogleLogin={handleGoogleLogin}
        onEmailLogin={handleEmailLogin}
        onEmailRegister={handleEmailRegister}
        onForgotPassword={handleForgotPassword}
        onShowToast={showToast}
        initialTab={authInitialTab}
      />

      {/* Account Details Modal */}
      <AccountModal
        isOpen={isAccountModalOpen}
        onClose={() => setIsAccountModalOpen(false)}
        currentUser={currentUser}
        onSyncAllToCloud={handleSyncAllLocalToCloud}
        onLogout={handleLogout}
      />

      {/* Snackbar / Toast */}
      <Toast message={toastMessage} isVisible={isToastVisible} />
    </div>
  );
};
