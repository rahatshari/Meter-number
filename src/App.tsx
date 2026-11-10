import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
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
  toBengaliNum,
} from './utils/bengali';
import {
  PendingSyncItem,
  loadPendingSyncQueue,
  savePendingSyncQueue,
  enqueueSyncMutation,
  dequeueSyncMutation,
  reconcileCloudWithPendingQueue,
  setLastSyncTime,
} from './utils/offlineSync';
import {
  APP_VERSION,
  APP_VERSION_CODE,
  APK_SIGNATURE_SHA1,
  DEFAULT_APK_DOWNLOAD_URL,
  DEFAULT_RELEASE_PAGE_URL,
  AppUpdateInfo,
  checkForAppUpdate,
} from './utils/appUpdater';
import { loginWithJustEmail } from './utils/authHelpers';

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
import { UpdateModal } from './components/UpdateModal';
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

  // Online / Offline Connectivity & Pending Sync Queue State
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [pendingQueue, setPendingQueue] = useState<PendingSyncItem[]>(() =>
    loadPendingSyncQueue()
  );
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const isFlushingRef = useRef<boolean>(false);

  // App Version & In-App APK Auto-Update State
  const [updateInfo, setUpdateInfo] = useState<AppUpdateInfo>({
    currentVersion: APP_VERSION,
    currentVersionCode: APP_VERSION_CODE,
    latestVersion: APP_VERSION,
    latestVersionCode: APP_VERSION_CODE,
    hasUpdate: false,
    apkDownloadUrl: DEFAULT_APK_DOWNLOAD_URL,
    releasePageUrl: DEFAULT_RELEASE_PAGE_URL,
    releaseNotes:
      'অফলাইন ফার্স্ট ও স্বয়ংক্রিয় ক্লাউড সিঙ্ক, একই সিগনেচার APK এবং ইন-অ্যাপ অটো-আপডেট সংস্করণ।',
    publishedAt: new Date().toISOString(),
    signatureSha1: APK_SIGNATURE_SHA1,
  });
  const [isCheckingUpdate, setIsCheckingUpdate] = useState<boolean>(false);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState<boolean>(false);

  // Customers and user state
  const [customers, setCustomers] = useState<Customer[]>(() => {
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
  });
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

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setIsToastVisible(true);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => {
      setIsToastVisible(false);
    }, 3000);
  }, []);

  const notifyRealtimeBackup = useCallback(
    (customMessage?: string) => {
      setBackupPulse(true);
      const isCloudReady = isOnline && !!currentUser;
      setBackupPulseText(
        isCloudReady ? '☁️ ক্লাউডে ব্যাকআপ হয়েছে' : '💾 অফলাইন ফোনে সংরক্ষিত'
      );

      if (backupTimerRef.current) clearTimeout(backupTimerRef.current);
      backupTimerRef.current = setTimeout(() => {
        setBackupPulse(false);
      }, 3000);

      const msg =
        customMessage ||
        (isCloudReady
          ? '☁️ ক্লাউডে সাথে সাথে ব্যাকআপ হয়েছে!'
          : '💾 অফলাইনে সংরক্ষিত! ইন্টারনেট পেলে স্বয়ংক্রিয় আপলোড হবে।');
      showToast(msg);
    },
    [isOnline, currentUser, showToast]
  );

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
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        throw err;
      }
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  };

  const deleteCustomerFromFirestore = async (id: string | number, user: User) => {
    const custId = String(id);
    const path = `users/${user.uid}/customers/${custId}`;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'customers', custId));
    } catch (err) {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        throw err;
      }
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  // Queue mutation helper (stores offline mutation and triggers auto-flush if online & signed in)
  const queueMutation = useCallback(
    (item: PendingSyncItem) => {
      setPendingQueue((prev) => {
        const next = enqueueSyncMutation(prev, item);
        savePendingSyncQueue(next);
        return next;
      });
    },
    []
  );

  // Automatic Offline Queue Flush when online and signed in
  const flushOfflineQueue = useCallback(
    async (user: User | null, online: boolean) => {
      if (!user || !online || isFlushingRef.current) return;
      const currentQueue = loadPendingSyncQueue();
      if (currentQueue.length === 0) return;

      isFlushingRef.current = true;
      setIsSyncing(true);

      let flushedCount = 0;
      let workingQueue = [...currentQueue];

      try {
        for (const item of currentQueue) {
          if (typeof navigator !== 'undefined' && !navigator.onLine) break;
          try {
            if (item.action === 'upsert' && item.customer) {
              await saveCustomerToFirestore(item.customer, user);
            } else if (item.action === 'delete') {
              await deleteCustomerFromFirestore(item.id, user);
            }
            workingQueue = dequeueSyncMutation(workingQueue, item.id, item.timestamp);
            savePendingSyncQueue(workingQueue);
            setPendingQueue(workingQueue);
            flushedCount++;
          } catch (err) {
            console.warn('Will retry offline sync item when connection stabilizes:', item.id, err);
          }
        }

        if (flushedCount > 0) {
          setLastSyncTime();
          showToast(
            `☁️ ইন্টারনেট সংযোগে ${toBengaliNum(flushedCount)}টি অফলাইন কাজ স্বয়ংক্রিয়ভাবে আপলোড হয়েছে!`
          );
        }
      } finally {
        isFlushingRef.current = false;
        setIsSyncing(false);
      }
    },
    [showToast]
  );

  // Monitor browser/device online & offline events
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      const q = loadPendingSyncQueue();
      if (q.length > 0 && auth.currentUser) {
        showToast('🌐 ইন্টারনেট সংযোগ পাওয়া গেছে! অফলাইন কাজ স্বয়ংক্রিয়ভাবে আপলোড হচ্ছে...');
        flushOfflineQueue(auth.currentUser, true);
      } else {
        showToast('🌐 ইন্টারনেট সংযোগ পুনরায় চালু হয়েছে');
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      showToast('📴 অফলাইন মোড: ইন্টারনেট ছাড়াই অ্যাপ সচল আছে, সকল কাজ ফোনে সেভ হবে');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [flushOfflineQueue, showToast]);

  // Trigger queue flush whenever online + user + pending items exist
  useEffect(() => {
    if (isOnline && currentUser && pendingQueue.length > 0) {
      flushOfflineQueue(currentUser, isOnline);
    }
  }, [isOnline, currentUser, pendingQueue.length, flushOfflineQueue]);

  // Automatic In-App APK Update Check (runs on launch and when coming back online)
  const handleCheckForUpdate = useCallback(
    async (silent: boolean = false) => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        if (!silent) {
          showToast('📴 অফলাইনে আপডেট চেক করা সম্ভব নয়। ইন্টারনেট সংযোগ চালু করুন।');
        }
        return;
      }

      setIsCheckingUpdate(true);
      try {
        const info = await checkForAppUpdate(APP_VERSION, APP_VERSION_CODE);
        setUpdateInfo(info);
        if (info.hasUpdate) {
          showToast(`🎉 অ্যাপের নতুন আপডেট (v${toBengaliNum(info.latestVersion)}) এসেছে!`);
          setIsUpdateModalOpen(true);
        } else if (!silent) {
          showToast(`✓ আপনার অ্যাপটি সর্বশেষ ভার্সনে (v${toBengaliNum(info.currentVersion)}) আছে!`);
        }
      } finally {
        setIsCheckingUpdate(false);
      }
    },
    [showToast]
  );

  useEffect(() => {
    if (isOnline) {
      handleCheckForUpdate(true);
    }
  }, [isOnline, handleCheckForUpdate]);

  // Auth observer and Firestore listener with Offline Queue Reconciliation
  useEffect(() => {
    let unsubscribeCustomers: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);

      if (unsubscribeCustomers) {
        unsubscribeCustomers();
        unsubscribeCustomers = null;
      }

      if (user) {
        // First flush any pending offline changes
        if (typeof navigator === 'undefined' || navigator.onLine) {
          flushOfflineQueue(user, true);
        }

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

            const localList = loadLocalData();
            const currentQueue = loadPendingSyncQueue();

            if (cloudCustomers.length > 0 || currentQueue.length > 0) {
              const reconciled = reconcileCloudWithPendingQueue(
                cloudCustomers,
                localList,
                currentQueue
              );
              setCustomers(reconciled);
              saveToLocalStorage(reconciled);
            } else if (localList.length > 0) {
              // Upload existing local data to cloud if cloud is newly initialized
              setCustomers(localList);
              localList.forEach((c) => {
                queueMutation({
                  id: String(c.id),
                  action: 'upsert',
                  customer: c,
                  timestamp: Date.now(),
                });
              });
            } else {
              setCustomers([]);
            }
          },
          (error) => {
            if (typeof navigator !== 'undefined' && !navigator.onLine) {
              return;
            }
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
  }, [flushOfflineQueue, queueMutation]);

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

  // Customer Save (Add / Edit) — 100% Offline-First + Auto Sync Queue
  const handleSaveCustomer = (customer: Customer, isEdit: boolean) => {
    let nextList: Customer[];
    if (isEdit) {
      nextList = customers.map((c) => (String(c.id) === String(customer.id) ? customer : c));
    } else {
      nextList = [customer, ...customers];
    }

    setCustomers(nextList);
    saveToLocalStorage(nextList);

    queueMutation({
      id: String(customer.id),
      action: 'upsert',
      customer,
      timestamp: Date.now(),
    });

    notifyRealtimeBackup(
      isEdit
        ? isOnline
          ? '✅ গ্রাহকের তথ্য সফলভাবে আপডেট হয়েছে!'
          : '💾 অফলাইনে আপডেট সংরক্ষিত! নেট পেলে স্বয়ংক্রিয় আপলোড হবে।'
        : isOnline
        ? '✅ নতুন গ্রাহক সফলভাবে অ্যাড হয়েছে!'
        : '💾 অফলাইনে নতুন গ্রাহক সংরক্ষিত! নেট পেলে স্বয়ংক্রিয় আপলোড হবে।'
    );
  };

  // Payment Toggle — 100% Offline-First + Auto Sync Queue
  const handleTogglePayment = (c: Customer) => {
    const isNowPaid = c.lastPaidMonth !== currentMonth;
    const updated: Customer = {
      ...c,
      lastPaidMonth: isNowPaid ? currentMonth : '',
    };

    const nextList = customers.map((item) => (item.id === c.id ? updated : item));
    setCustomers(nextList);
    saveToLocalStorage(nextList);

    queueMutation({
      id: String(updated.id),
      action: 'upsert',
      customer: updated,
      timestamp: Date.now(),
    });

    notifyRealtimeBackup(
      isNowPaid
        ? '✅ বিল পরিশোধিত হিসেবে মার্ক করা হয়েছে!'
        : 'বিল আনপেইড করা হয়েছে!'
    );
  };

  // Delete Customer — 100% Offline-First + Auto Sync Queue
  const handleDeleteCustomer = (c: Customer) => {
    setConfirmConfig({
      title: 'গ্রাহকের তথ্য মুছুন',
      message: `আপনি কি নিশ্চিতভাবে '${c.name}'-এর তথ্য মুছে ফেলতে চান?`,
      okText: 'মুছে ফেলুন',
      onOk: () => {
        const nextList = customers.filter((item) => item.id !== c.id);
        setCustomers(nextList);
        saveToLocalStorage(nextList);

        queueMutation({
          id: String(c.id),
          action: 'delete',
          timestamp: Date.now(),
        });

        notifyRealtimeBackup('🗑️ গ্রাহকের তথ্য মুছে ফেলা হয়েছে!');
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

    // Queue all imported customers for automatic cloud upload
    const nowTs = Date.now();
    setPendingQueue((prev) => {
      let updatedQueue = [...prev];
      for (const c of nextList) {
        updatedQueue = enqueueSyncMutation(updatedQueue, {
          id: String(c.id),
          action: 'upsert',
          customer: c,
          timestamp: nowTs,
        });
      }
      savePendingSyncQueue(updatedQueue);
      return updatedQueue;
    });

    if (currentUser && isOnline) {
      await flushOfflineQueue(currentUser, true);
      notifyRealtimeBackup('✅ সফলভাবে ইমপোর্ট সম্পন্ন এবং সব মোবাইলে সিঙ্ক হয়েছে!');
    } else {
      notifyRealtimeBackup(
        '✅ অফলাইনে ইমপোর্ট সম্পন্ন! ইন্টারনেট পেলে স্বয়ংক্রিয়ভাবে ক্লাউডে আপলোড হবে।'
      );
    }
  };

  // Sync all local to cloud
  const handleSyncAllLocalToCloud = async () => {
    if (!currentUser) {
      setAuthInitialTab('google');
      setIsAuthModalOpen(true);
      return;
    }
    const nowTs = Date.now();
    setPendingQueue((prev) => {
      let updatedQueue = [...prev];
      for (const c of customers) {
        updatedQueue = enqueueSyncMutation(updatedQueue, {
          id: String(c.id),
          action: 'upsert',
          customer: c,
          timestamp: nowTs,
        });
      }
      savePendingSyncQueue(updatedQueue);
      return updatedQueue;
    });

    if (!isOnline) {
      showToast('💾 সব ডেটা অটো-সিঙ্ক কিউতে যুক্ত হয়েছে! ইন্টারনেট পেলেই আপলোড হবে।');
      return;
    }

    showToast('সব ডাটা ক্লাউডে সিঙ্ক হচ্ছে...');
    await flushOfflineQueue(currentUser, true);
    showToast('✅ সফলভাবে ক্লাউডে সিঙ্ক হয়েছে! যে কোনো মোবাইলে দেখতে পাবেন।');
    setIsAccountModalOpen(false);
  };

  // Simulate / Preview In-App Update Notification
  const handleSimulateUpdateNotification = () => {
    const nextCode = updateInfo.currentVersionCode + 1;
    const simulatedVersion = `2.0.${nextCode - 100}`;
    setUpdateInfo((prev) => ({
      ...prev,
      latestVersion: simulatedVersion,
      latestVersionCode: nextCode,
      hasUpdate: true,
      releaseNotes:
        `✨ বিদ্যুৎ বিল v${simulatedVersion} (বিল্ড #${nextCode}) রিলিজ নোট:\n` +
        `• 📱 সরাসরি অ্যাপে লগইন: গুগল ক্রোমে রিডাইরেক্ট না হয়ে অ্যাপের ভেতর সরাসরি জিমেইল দিয়ে লগইন সুবিধা\n` +
        `• 🖼️ অফিসিয়াল স্প্ল্যাশ স্ক্রিন: অ্যাপ চালুর সময় বিদ্যুৎ বিলের আসল লোগো সহ অ্যানিমেশন\n` +
        `• 👤 প্রোফাইল ছবি ও অবতার: গুগল রেফারার পলিসি ফিক্স ও আকর্ষণীয় মনোগ্রাম অবতার ফলব্যাক\n` +
        `• ☁️ অফলাইন ও ক্লাউড অটো-সিঙ্ক: ইন্টারনেট ছাড়াই সচল এবং সংযোগ পেলেই ক্লাউডে স্বয়ংক্রিয় ব্যাকআপ\n` +
        `• 🔒 একই সিগনেচার (Same Signature): কোনো ডেটা না হারিয়ে সরাসরি ইন-অ্যাপ এক ক্লিকে আপডেট`,
    }));
    setIsUpdateModalOpen(true);
    showToast(`🔔 নতুন আপডেট v${toBengaliNum(simulatedVersion)} নোটিফিকেশন ও রিলিজ নোট সক্রিয় হয়েছে!`);
  };

  // Auth methods
  const handleGoogleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      showToast('গুগল অ্যাকাউন্ট নির্বাচন উইন্ডো খোলা হচ্ছে...');
      await signInWithPopup(auth, provider);
      showToast('✓ আপনার Gmail দিয়ে সফলভাবে লগইন হয়েছে!');
    } catch (error: any) {
      console.error('Google Sign-In Error:', error);
      const code = error?.code || '';
      if (code === 'auth/popup-closed-by-user') {
        showToast('লগইন উইন্ডো বন্ধ করা হয়েছে');
      } else if (code === 'auth/unauthorized-domain' || String(error?.message).includes('unauthorized domain')) {
        showToast('⚠️ অথরাইজেশন ফেইলড: Firebase-এ rahatshari.github.io ডোমেন যোগ করতে হবে');
      } else {
        showToast('লগইন সম্পন্ন হয়নি: ' + (error?.message || 'আবার চেষ্টা করুন'));
      }
      throw error;
    }
  };

  const handleJustEmailLogin = async (email: string) => {
    try {
      showToast('Gmail দিয়ে লগইন হচ্ছে...');
      const res = await loginWithJustEmail(auth, email);
      if (res.isNewUser) {
        showToast('✓ নতুন অ্যাকাউন্ট প্রস্তুত ও সফলভাবে লগইন হয়েছে!');
      } else {
        showToast('✓ আপনার Gmail দিয়ে সফলভাবে লগইন হয়েছে!');
      }
    } catch (err: any) {
      console.error('Direct Gmail Login Error:', err);
      let msg = 'লগইন ব্যর্থ হয়েছে: ';
      if (err.code === 'auth/invalid-email') {
        msg = 'সঠিক Gmail ঠিকানা লিখুন';
      } else if (err.code === 'auth/account-exists-with-different-credential') {
        msg = 'এই Gmail-টিতে পূর্বে অন্য পাসওয়ার্ড দেওয়া হয়েছিল। নিচের বক্সে পাসওয়ার্ড দিন অথবা রিসেট লিংক পাঠান।';
      } else {
        msg += err.message || '';
      }
      showToast(msg);
      throw err;
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
      {/* Material Design 3 Top App Bar (Clean Native APK Header) */}
      <TopAppBar
        currentUser={currentUser}
        themeMode={themeMode}
        isOnline={isOnline}
        pendingSyncCount={pendingQueue.length}
        isSyncing={isSyncing}
        hasUpdate={updateInfo.hasUpdate}
        appVersion={updateInfo.currentVersion}
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
        onOpenUpdateModal={() => setIsUpdateModalOpen(true)}
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
            isOnline={isOnline}
            pendingSyncCount={pendingQueue.length}
            isSyncing={isSyncing}
            updateInfo={updateInfo}
            onOpenUpdateModal={() => setIsUpdateModalOpen(true)}
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
            isOnline={isOnline}
            pendingSyncCount={pendingQueue.length}
            isSyncing={isSyncing}
            updateInfo={updateInfo}
            isCheckingUpdate={isCheckingUpdate}
            onToggleTheme={toggleTheme}
            onOpenAuthModal={() => {
              setAuthInitialTab('google');
              setIsAuthModalOpen(true);
            }}
            onLogout={handleLogout}
            onSyncAllLocalToCloud={handleSyncAllLocalToCloud}
            onCheckForUpdate={() => handleCheckForUpdate(false)}
            onOpenUpdateModal={() => setIsUpdateModalOpen(true)}
            onSimulateUpdateNotification={handleSimulateUpdateNotification}
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
        onJustEmailLogin={handleJustEmailLogin}
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

      {/* In-App APK Auto-Update Modal */}
      <UpdateModal
        isOpen={isUpdateModalOpen}
        onClose={() => setIsUpdateModalOpen(false)}
        updateInfo={updateInfo}
        isChecking={isCheckingUpdate}
        onCheckAgain={() => handleCheckForUpdate(false)}
        onShowToast={showToast}
      />

      {/* Snackbar / Toast */}
      <Toast message={toastMessage} isVisible={isToastVisible} />
    </div>
  );
};
