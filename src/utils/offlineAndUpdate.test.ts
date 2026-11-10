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
