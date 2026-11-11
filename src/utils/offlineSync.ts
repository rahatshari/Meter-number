import { Customer } from '../types';

export interface PendingSyncItem {
  id: string;
  action: 'upsert' | 'delete';
  customer?: Customer;
  timestamp: number;
}

const SYNC_QUEUE_STORAGE_KEY = 'billOfflineSyncQueue';
const LAST_SYNC_TIME_KEY = 'billLastCloudSyncTime';
const AUTO_CLOUD_BACKUP_KEY = 'biddut_bill_auto_cloud_backup';

/**
 * Pure helper to merge a new mutation (upsert or delete) into an existing pending sync queue.
 * Deduplicates by customer ID so only the latest state for each customer is queued.
 */
export function enqueueSyncMutation(
  queue: PendingSyncItem[],
  item: PendingSyncItem
): PendingSyncItem[] {
  const targetId = String(item.id);
  const filtered = queue.filter((q) => String(q.id) !== targetId);
  return [...filtered, { ...item, id: targetId }];
}

/**
 * Pure helper to remove a completed mutation from the sync queue.
 * Only removes if the queued item's timestamp is <= the completed timestamp,
 * preserving newer edits made while a sync was in flight.
 */
export function dequeueSyncMutation(
  queue: PendingSyncItem[],
  id: string | number,
  completedTimestamp?: number
): PendingSyncItem[] {
  const targetId = String(id);
  return queue.filter((q) => {
    if (String(q.id) !== targetId) return true;
    if (completedTimestamp !== undefined && q.timestamp > completedTimestamp) {
      return true;
    }
    return false;
  });
}

/**
 * Reconciles incoming cloud customers with local customers and any un-flushed offline mutations.
 * Guarantees that offline additions, edits, payment toggles, and deletions are never overwritten
 * by stale cloud snapshots before the offline queue finishes uploading.
 */
export function reconcileCloudWithPendingQueue(
  cloudCustomers: Customer[],
  localCustomers: Customer[],
  pendingQueue: PendingSyncItem[]
): Customer[] {
  if (cloudCustomers.length === 0 && localCustomers.length > 0 && pendingQueue.length === 0) {
    return localCustomers;
  }

  const deletedIds = new Set(
    pendingQueue.filter((q) => q.action === 'delete').map((q) => String(q.id))
  );
  const upsertsMap = new Map<string, Customer>();
  for (const q of pendingQueue) {
    if (q.action === 'upsert' && q.customer) {
      upsertsMap.set(String(q.id), q.customer);
    }
  }

  const result: Customer[] = [];
  const seenIds = new Set<string>();

  // 1. Apply pending new/updated items first so recently added offline items stay at top
  for (const [idStr, cust] of upsertsMap.entries()) {
    const existsInCloud = cloudCustomers.some((c) => String(c.id) === idStr);
    if (!existsInCloud && !deletedIds.has(idStr)) {
      result.push(cust);
      seenIds.add(idStr);
    }
  }

  // 2. Process cloud customers, overriding with pending upserts and skipping pending deletes
  for (const cloudCust of cloudCustomers) {
    const idStr = String(cloudCust.id);
    if (deletedIds.has(idStr) || seenIds.has(idStr)) continue;

    if (upsertsMap.has(idStr)) {
      result.push(upsertsMap.get(idStr)!);
    } else {
      result.push(cloudCust);
    }
    seenIds.add(idStr);
  }

  return result;
}

export function loadPendingSyncQueue(scopeKey: string = 'guest'): PendingSyncItem[] {
  try {
    const raw = localStorage.getItem(`${SYNC_QUEUE_STORAGE_KEY}_${scopeKey}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
    // Backward-compatibility fallback for guest session
    if (scopeKey === 'guest') {
      const legacyRaw = localStorage.getItem(SYNC_QUEUE_STORAGE_KEY);
      if (legacyRaw) {
        const parsed = JSON.parse(legacyRaw);
        if (Array.isArray(parsed)) return parsed;
      }
    }
    return [];
  } catch (e) {
    console.error('Failed to read offline sync queue:', e);
    return [];
  }
}

export function savePendingSyncQueue(queue: PendingSyncItem[], scopeKey: string = 'guest'): void {
  try {
    localStorage.setItem(`${SYNC_QUEUE_STORAGE_KEY}_${scopeKey}`, JSON.stringify(queue));
  } catch (e) {
    console.error('Failed to write offline sync queue:', e);
  }
}

export function getLastSyncTime(): string | null {
  try {
    return localStorage.getItem(LAST_SYNC_TIME_KEY);
  } catch {
    return null;
  }
}

export function setLastSyncTime(isoTime: string = new Date().toISOString()): void {
  try {
    localStorage.setItem(LAST_SYNC_TIME_KEY, isoTime);
  } catch {
    // ignore storage errors
  }
}

/**
 * Checks whether automatic cloud/drive backup on every change is enabled.
 * When false ("Manual 1-Click Backup" mode), new changes accumulate in the pending queue
 * until the user taps the "এখনই ব্যাকআপ করুন (Backup Now)" button.
 */
export function isAutoCloudBackupEnabled(): boolean {
  if (typeof localStorage === 'undefined') return true;
  try {
    const val = localStorage.getItem(AUTO_CLOUD_BACKUP_KEY);
    if (val === null) return true;
    return val === 'true';
  } catch {
    return true;
  }
}

export function setAutoCloudBackupEnabled(enabled: boolean): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(AUTO_CLOUD_BACKUP_KEY, enabled ? 'true' : 'false');
  } catch {
    // ignore storage errors
  }
}

/**
 * Formats an ISO timestamp into a friendly Bengali date/time string for the Backup Center.
 */
export function formatLastBackupTimeBn(isoTime: string | null): string {
  if (!isoTime) return 'এখনো ব্যাকআপ নেওয়া হয়নি';
  try {
    const dt = new Date(isoTime);
    if (isNaN(dt.getTime())) return 'এখনো ব্যাকআপ নেওয়া হয়নি';
    return dt.toLocaleString('bn-BD', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return 'এখনো ব্যাকআপ নেওয়া হয়নি';
  }
}

/**
 * Saves/shares the complete JSON backup file directly to the phone's Google Drive app
 * (via Native Android Intent on APK, Web Share API on mobile browsers, or direct file download).
 */
export async function shareBackupFileToGoogleDrive(customers: Customer[]): Promise<'native_drive' | 'web_share' | 'download'> {
  const dateStr = new Date().toISOString().slice(0, 10);
  const fileName = `Biddut_Bill_Backup_${dateStr}.json`;
  const jsonContent = JSON.stringify(
    {
      app: 'বিদ্যুৎ বিল',
      exportedAt: new Date().toISOString(),
      totalCustomers: customers.length,
      customers,
      groups: [],
    },
    null,
    2
  );

  // 1. Inside the installed Android APK: launch native Google Drive "Save to Drive" intent
  if (typeof window !== 'undefined' && typeof window.AndroidApkUpdater?.saveBackupToGoogleDrive === 'function') {
    window.AndroidApkUpdater.saveBackupToGoogleDrive(jsonContent, fileName);
    return 'native_drive';
  }

  // 2. Mobile browser with Web Share API file support (lets user pick Google Drive from system sheet)
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function' && typeof File !== 'undefined') {
    try {
      const file = new File([jsonContent], fileName, { type: 'application/json' });
      if (!navigator.canShare || navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: 'বিদ্যুৎ বিল — Google Drive ব্যাকআপ',
          text: 'বিদ্যুৎ বিল অ্যাপের সম্পূর্ণ গ্রাহক তালিকার ব্যাকআপ ফাইল',
          files: [file],
        });
        return 'web_share';
      }
    } catch {
      // Fall through to direct download if user cancels share sheet or browser blocks file share
    }
  }

  // 3. Direct file download fallback
  const blob = new Blob([jsonContent], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
  return 'download';
}

