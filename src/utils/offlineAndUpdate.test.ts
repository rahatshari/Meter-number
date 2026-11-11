import test from 'node:test';
import assert from 'node:assert/strict';
import {
  enqueueSyncMutation,
  dequeueSyncMutation,
  reconcileCloudWithPendingQueue,
  PendingSyncItem,
} from './offlineSync';
import { parseVersionParts, isNewerVersion } from './appUpdater';
import { Customer } from '../types';

const sampleCustomerA: Customer = {
  id: '101',
  name: 'রহিম উদ্দিন',
  father: 'করিম উদ্দিন',
  address: 'ঢাকা',
  mobile: '01711223344',
  sms: '1234567890123',
  dueDate: '15',
  lastPaidMonth: '2026-11',
};

const sampleCustomerB: Customer = {
  id: '102',
  name: 'সালমা বেগম',
  father: 'আবুল কাশেম',
  address: 'চট্টগ্রাম',
  mobile: '01811223344',
  sms: '9876543210123',
  dueDate: '20',
  lastPaidMonth: '',
};

test('enqueueSyncMutation deduplicates mutations for the same customer ID', () => {
  let queue: PendingSyncItem[] = [];
  queue = enqueueSyncMutation(queue, {
    id: '101',
    action: 'upsert',
    customer: { ...sampleCustomerA, lastPaidMonth: '' },
    timestamp: 1000,
  });
  queue = enqueueSyncMutation(queue, {
    id: '101',
    action: 'upsert',
    customer: { ...sampleCustomerA, lastPaidMonth: '2026-11' },
    timestamp: 2000,
  });

  assert.equal(queue.length, 1);
  assert.equal(queue[0].customer?.lastPaidMonth, '2026-11');
  assert.equal(queue[0].timestamp, 2000);
});

test('dequeueSyncMutation removes completed mutation only if not superseded by newer offline edit', () => {
  const queue: PendingSyncItem[] = [
    { id: '101', action: 'upsert', customer: sampleCustomerA, timestamp: 3000 },
    { id: '102', action: 'delete', timestamp: 1500 },
  ];

  // Attempt to dequeue 101 with an older timestamp (2000) -> should keep 101
  const afterStaleComplete = dequeueSyncMutation(queue, '101', 2000);
  assert.equal(afterStaleComplete.length, 2);

  // Dequeue 101 with matching timestamp (3000) -> should remove 101
  const afterValidComplete = dequeueSyncMutation(queue, '101', 3000);
  assert.equal(afterValidComplete.length, 1);
  assert.equal(afterValidComplete[0].id, '102');
});

test('reconcileCloudWithPendingQueue preserves offline edits and deletions against cloud snapshot', () => {
  const cloudList: Customer[] = [
    { ...sampleCustomerA, lastPaidMonth: '' }, // stale unpaid in cloud
    sampleCustomerB, // deleted offline
  ];
  const pendingQueue: PendingSyncItem[] = [
    {
      id: '101',
      action: 'upsert',
      customer: { ...sampleCustomerA, lastPaidMonth: '2026-11' }, // marked paid offline
      timestamp: 5000,
    },
    {
      id: '102',
      action: 'delete',
      timestamp: 5100,
    },
  ];

  const reconciled = reconcileCloudWithPendingQueue(cloudList, [], pendingQueue);
  assert.equal(reconciled.length, 1);
  assert.equal(reconciled[0].id, '101');
  assert.equal(reconciled[0].lastPaidMonth, '2026-11');
});

test('parseVersionParts and isNewerVersion accurately detect auto-incremented APK updates', () => {
  assert.deepEqual(parseVersionParts('v2.0.15'), [2, 0, 15]);
  assert.equal(isNewerVersion('2.0.1', '2.0.2'), true);
  assert.equal(isNewerVersion('2.0.5', '2.0.5'), false);
  assert.equal(isNewerVersion('2.0.10', '2.0.2'), false);
  assert.equal(isNewerVersion('2.0.1', '2.0.1', 101, 102), true);
});

test('normalizeGmailInput, getCleanUserEmail, and getSavedGmailAccounts have no default Gmail', async () => {
  const {
    normalizeGmailInput,
    getCleanUserEmail,
    deriveAppPasswordForEmail,
    getSavedGmailAccounts,
  } = await import('./authHelpers');
  assert.equal(normalizeGmailInput('user1'), 'user1@gmail.com');
  assert.equal(normalizeGmailInput('  User2@Gmail.com '), 'user2@gmail.com');
  assert.equal(
    getCleanUserEmail({ email: 'user2+biddut@gmail.com' }),
    'user2@gmail.com'
  );
  // Fresh storage has no default Gmail pre-populated
  assert.deepEqual(getSavedGmailAccounts(), []);

  const pw1 = await deriveAppPasswordForEmail('user2@gmail.com');
  const pw2 = await deriveAppPasswordForEmail('user2+biddut@gmail.com');
  assert.equal(pw1, pw2);
});

test('cleanChangelogItems removes signature, SHA1, and markdown headers leaving only clean changes', async () => {
  const { cleanChangelogItems, isAutoUpdateEnabled } = await import('./appUpdater');
  const rawNotes = `
    ## ⚡ বিদ্যুৎ বিল — Android APK রিলিজ (v2.0.5)
    ### 📋 রিলিজ নোট ও পরিবর্তনসমূহ:
    • যেকোনো Gmail দিয়ে সরাসরি লগইন
    • অ্যাপের ভেতর সরাসরি অটো-আপডেট সুবিধা
    ---
    - **সিগনেচার (Same Signature)**: SHA1: A7:F8:FB
    - নিচের ফাইলটি ক্লিক করে ডাউনলোড করুন
  `;
  const cleaned = cleanChangelogItems(rawNotes);
  assert.deepEqual(cleaned, [
    'যেকোনো Gmail দিয়ে সরাসরি লগইন',
    'অ্যাপের ভেতর সরাসরি অটো-আপডেট সুবিধা',
  ]);
  assert.equal(isAutoUpdateEnabled(), true);
});

test('pickNativeAndroidGoogleAccount resolves with the phone Gmail picked via native Android AccountManager', async () => {
  const { hasNativeAndroidGooglePicker, pickNativeAndroidGoogleAccount } = await import(
    './authHelpers'
  );

  // Mock global window with AndroidApkUpdater.pickGoogleAccount
  const g = globalThis as any;
  g.window = g.window || {};
  g.window.AndroidApkUpdater = {
    isNativeApk: () => true,
    pickGoogleAccount: () => {
      setTimeout(() => {
        if (g.window.__onNativeGoogleAccountPicked) {
          g.window.__onNativeGoogleAccountPicked('phone.user@gmail.com');
        }
      }, 5);
    },
  };

  assert.equal(hasNativeAndroidGooglePicker(), true);
  const picked = await pickNativeAndroidGoogleAccount();
  assert.equal(picked, 'phone.user@gmail.com');

  delete g.window.AndroidApkUpdater;
});

test('formatLastBackupTimeBn and isAutoCloudBackupEnabled handle 1-click backup states cleanly', async () => {
  const { formatLastBackupTimeBn, isAutoCloudBackupEnabled } = await import('./offlineSync');
  assert.equal(formatLastBackupTimeBn(null), 'এখনো ব্যাকআপ নেওয়া হয়নি');
  const formatted = formatLastBackupTimeBn('2026-11-10T16:30:00.000Z');
  assert.equal(typeof formatted, 'string');
  assert.equal(formatted.length > 5, true);
  assert.equal(isAutoCloudBackupEnabled(), true);
});

test('getSharedAccountKey unifies Google Account login and ID/Password login onto the exact same Firestore bucket', async () => {
  const { getSharedAccountKey, getCleanUserEmail, getLegacyMirrorKeysForUser } = await import(
    './authHelpers'
  );
  const googleUser = { uid: 'uid_google_1', email: 'rahatsharif10448@gmail.com' };
  const passwordAliasUser = { uid: 'uid_pw_2', email: 'rahatsharif10448+biddut@gmail.com' };
  const googlePickerAliasUser = {
    uid: 'uid_picker_3',
    email: 'rahatsharif10448+biddut_google@gmail.com',
  };

  assert.equal(getCleanUserEmail(googleUser), 'rahatsharif10448@gmail.com');
  assert.equal(getCleanUserEmail(passwordAliasUser), 'rahatsharif10448@gmail.com');
  assert.equal(getCleanUserEmail(googlePickerAliasUser), 'rahatsharif10448@gmail.com');

  const key1 = getSharedAccountKey(googleUser);
  const key2 = getSharedAccountKey(passwordAliasUser);
  const key3 = getSharedAccountKey(googlePickerAliasUser);

  assert.equal(key1, 'acct_rahatsharif10448_gmail_com');
  assert.equal(key1, key2);
  assert.equal(key2, key3);

  const mirrorKeys = getLegacyMirrorKeysForUser(googleUser);
  assert.equal(mirrorKeys.includes('zHb7bQNqDfcDutkSKB3GCohaUuz2'), true);
});

test('googleDriveBackup defines drive.file & drive.appdata SCOPES and normalizes restored customers', async () => {
  const {
    SCOPES,
    DRIVE_BACKUP_FILENAME,
    normalizeRestoredCustomers,
    getDriveAccessToken,
    clearDriveAccessToken,
  } = await import('./googleDriveBackup');

  assert.deepEqual(SCOPES, [
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/drive.appdata',
  ]);
  assert.equal(DRIVE_BACKUP_FILENAME, 'Biddut_Bill_Drive_Backup.json');

  const restored = normalizeRestoredCustomers([
    {
      id: '101',
      name: 'মোঃ বেল্লাল শেখ',
      fatherName: 'কাসেম শেখ',
      address: 'ছোটোবাদুরা',
      mobile: '01766998577',
      smsAccount: '1032091754490',
      dueDate: '12',
      lastPaidMonth: '',
    },
  ]);

  assert.equal(restored.length, 1);
  assert.equal(restored[0].name, 'মোঃ বেল্লাল শেখ');
  assert.equal(restored[0].father, 'কাসেম শেখ');
  assert.equal(restored[0].sms, '1032091754490');

  clearDriveAccessToken();
  assert.equal(await getDriveAccessToken(), null);
});

