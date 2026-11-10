import { Customer } from '../types';

export interface PendingSyncItem {
  id: string;
  action: 'upsert' | 'delete';
  customer?: Customer;
  timestamp: number;
}

const SYNC_QUEUE_STORAGE_KEY = 'billOfflineSyncQueue';
const LAST_SYNC_TIME_KEY = 'billLastCloudSyncTime';

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

export function loadPendingSyncQueue(): PendingSyncItem[] {
  try {
    const raw = localStorage.getItem(SYNC_QUEUE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error('Failed to read offline sync queue:', e);
    return [];
  }
}

export function savePendingSyncQueue(queue: PendingSyncItem[]): void {
  try {
    localStorage.setItem(SYNC_QUEUE_STORAGE_KEY, JSON.stringify(queue));
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
