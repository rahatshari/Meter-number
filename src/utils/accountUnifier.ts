import { initializeApp, deleteApp, FirebaseApp } from 'firebase/app';
import {
  User,
  getAuth,
  signInWithPopup,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  EmailAuthProvider,
  linkWithCredential,
  signOut,
} from 'firebase/auth';
import {
  Firestore,
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  where,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { Customer } from '../types';
import {
  getCleanUserEmail,
  getLegacyMirrorKeysForUser,
  getSavedVaultIdForEmail,
  saveVaultIdForEmail,
  recordUserLinkedUid,
  mergeCustomerLists,
  deriveAppPasswordForEmail,
  signInWithStandardEmailPassword,
  normalizeGmailInput,
} from './authHelpers';

export interface VaultState {
  vaultId: string;
  memberUids: string[];
  mergedCustomers: Customer[];
}

export function sanitizeFirestoreDocId(rawId: string | number): string {
  const cleaned = String(rawId || '').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
  return cleaned || `c_${Date.now()}`;
}

export function normalizeDocToCustomer(
  data: Record<string, any>,
  fallbackId: string,
  fallbackUid: string
): Customer | null {
  const name = String(data?.name || '').trim();
  if (!name) return null;
  const rawId = data.id || fallbackId;
  return {
    id: parseFloat(String(rawId)) || String(rawId),
    name,
    father: String(data.father || ''),
    mother: String(data.mother || ''),
    address: String(data.address || ''),
    mobile: String(data.mobile || ''),
    sms: String(data.sms || ''),
    dueDate: String(data.dueDate || ''),
    group: String(data.group || ''),
    lastPaidMonth: String(data.lastPaidMonth || ''),
    userId: String(data.userId || fallbackUid),
  };
}

export function buildUserCustomerPayload(c: Customer, userId: string) {
  const custId = sanitizeFirestoreDocId(c.id);
  return {
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
    userId,
  };
}

export function buildVaultCustomerPayload(
  c: Customer,
  creatorUid: string,
  memberUids: string[]
) {
  const base = buildUserCustomerPayload(c, creatorUid);
  const safeMembers = Array.from(new Set(memberUids.filter(Boolean))).slice(0, 5);
  return {
    ...base,
    memberUids: safeMembers.length > 0 ? safeMembers : [creatorUid],
  };
}

async function readUserBucketCustomers(
  targetDb: Firestore,
  userId: string
): Promise<Customer[]> {
  try {
    const snap = await getDocs(collection(targetDb, 'users', userId, 'customers'));
    const list: Customer[] = [];
    snap.forEach((d) => {
      const cust = normalizeDocToCustomer(d.data() as Record<string, any>, d.id, userId);
      if (cust) list.push(cust);
    });
    return list;
  } catch {
    return [];
  }
}

async function readVaultCustomersMap(
  db: Firestore,
  vaultId: string,
  currentUid: string
): Promise<{ list: Customer[]; creatorById: Map<string, string>; memberUidsById: Map<string, string[]> }> {
  const list: Customer[] = [];
  const creatorById = new Map<string, string>();
  const memberUidsById = new Map<string, string[]>();
  try {
    const q = query(
      collection(db, 'vaults', vaultId, 'customers'),
      where('memberUids', 'array-contains', currentUid)
    );
    const snap = await getDocs(q);
    snap.forEach((d) => {
      const data = d.data() as Record<string, any>;
      const cust = normalizeDocToCustomer(data, d.id, currentUid);
      if (cust) {
        const cid = sanitizeFirestoreDocId(cust.id);
        list.push(cust);
        if (typeof data.userId === 'string' && data.userId) {
          creatorById.set(cid, data.userId);
        }
        if (Array.isArray(data.memberUids)) {
          memberUidsById.set(cid, data.memberUids.filter((u: any) => typeof u === 'string'));
        }
      }
    });
  } catch {
    // vault may not have customers yet
  }
  return { list, creatorById, memberUidsById };
}

/**
 * Ensures the signed-in user belongs to a canonical shared vault (/vaults/{vaultId}),
 * discovers & merges any sibling UID data belonging to the same user (from device history
 * or pre-authorized vaults), and keeps /vaults/{vaultId}/customers synchronized.
 */
export async function ensureUserVaultSetup(
  db: Firestore,
  legacyDefaultDb: Firestore,
  user: User,
  localCustomers: Customer[],
  isSwitchingUidOnDevice: boolean
): Promise<VaultState> {
  const cleanEmail = getCleanUserEmail(user);
  const nowIso = new Date().toISOString();
  const knownLinkedUids = getLegacyMirrorKeysForUser(user);
  const savedVaultId = cleanEmail ? getSavedVaultIdForEmail(cleanEmail) : '';

  let vaultId = '';
  let memberUids: string[] = [user.uid];

  // 1. Check current user's own /user_vaults/{uid} pointer
  try {
    const uvSnap = await getDoc(doc(db, 'user_vaults', user.uid));
    if (uvSnap.exists()) {
      const vId = uvSnap.data()?.vaultId;
      if (typeof vId === 'string' && vId) {
        vaultId = vId;
      }
    }
  } catch {
    // ignore read error
  }

  // 2. Check if a sibling UID on this device already invited user.uid to their shared vault
  const candidateVaults = Array.from(
    new Set([savedVaultId, ...knownLinkedUids].filter((v) => v && v !== vaultId))
  );
  for (const candId of candidateVaults) {
    try {
      const memberSnap = await getDoc(doc(db, 'vaults', candId, 'members', user.uid));
      if (memberSnap.exists()) {
        vaultId = candId;
        break;
      }
    } catch {
      // not a member of this candidate vault
    }
  }

  // 3. Fallback: create or reuse own vault
  if (!vaultId) {
    vaultId = user.uid;
  }

  let vaultExists = false;
  try {
    const vSnap = await getDoc(doc(db, 'vaults', vaultId));
    if (vSnap.exists()) {
      vaultExists = true;
      const existingMembers = vSnap.data()?.memberUids;
      if (Array.isArray(existingMembers)) {
        memberUids = Array.from(
          new Set([user.uid, ...existingMembers.filter((u: any) => typeof u === 'string')])
        ).slice(0, 5);
      }
    }
  } catch {
    // vault may not exist yet or user isn't member yet
  }

  if (!vaultExists) {
    vaultId = user.uid;
    memberUids = Array.from(new Set([user.uid, ...knownLinkedUids])).slice(0, 5);
    await setDoc(doc(db, 'vaults', vaultId), {
      id: vaultId,
      ownerUid: user.uid,
      memberUids: [user.uid],
      createdAt: nowIso,
    });
    await setDoc(doc(db, 'vaults', vaultId, 'members', user.uid), {
      uid: user.uid,
      addedBy: user.uid,
      role: 'owner',
      createdAt: nowIso,
    });
  } else {
    // Merge any known linked UIDs on this device into the vault's member list
    const desiredMembers = Array.from(new Set([...memberUids, ...knownLinkedUids])).slice(0, 5);
    if (desiredMembers.length > memberUids.length) {
      memberUids = desiredMembers;
    }
  }

  // Register any known sibling UIDs on this device as vault members (idempotent create)
  for (const mUid of memberUids) {
    if (!mUid || mUid === user.uid) continue;
    try {
      const mSnap = await getDoc(doc(db, 'vaults', vaultId, 'members', mUid));
      if (!mSnap.exists()) {
        await setDoc(doc(db, 'vaults', vaultId, 'members', mUid), {
          uid: mUid,
          addedBy: user.uid,
          role: 'owner',
          createdAt: nowIso,
        });
      }
    } catch {
      // ignore if already exists
    }
  }

  // Ensure vault parent doc lists all current members
  try {
    const vSnap = await getDoc(doc(db, 'vaults', vaultId));
    const currentList: string[] = Array.isArray(vSnap.data()?.memberUids)
      ? vSnap.data()!.memberUids
      : [user.uid];
    const nextList = Array.from(new Set([...currentList, ...memberUids])).slice(0, 5);
    memberUids = nextList;
    if (nextList.length !== currentList.length) {
      await setDoc(
        doc(db, 'vaults', vaultId),
        { memberUids: nextList },
        { merge: true }
      );
    }
  } catch {
    // ignore update if not needed
  }

  // Point /user_vaults/{user.uid} -> vaultId
  try {
    await setDoc(doc(db, 'user_vaults', user.uid), {
      userId: user.uid,
      vaultId,
      updatedAt: nowIso,
    });
  } catch {
    // ignore
  }

  if (cleanEmail) {
    saveVaultIdForEmail(cleanEmail, vaultId);
  }

  // 4. Read & merge customers across: vault + users/{uid} (db & legacyDefaultDb) + device-switched local cache
  const vaultData = await readVaultCustomersMap(db, vaultId, user.uid);
  const userDbCustomers = await readUserBucketCustomers(db, user.uid);
  const legacyDbCustomers = await readUserBucketCustomers(legacyDefaultDb, user.uid);

  let merged = mergeCustomerLists(vaultData.list, userDbCustomers);
  merged = mergeCustomerLists(merged, legacyDbCustomers);
  if (isSwitchingUidOnDevice && localCustomers.length > 0) {
    merged = mergeCustomerLists(merged, localCustomers);
  }

  // 5. Ensure all merged customers are stored in /vaults/{vaultId}/customers with full memberUids
  const vaultIdSet = new Set(vaultData.list.map((c) => sanitizeFirestoreDocId(c.id)));
  const userDbIdSet = new Set(userDbCustomers.map((c) => sanitizeFirestoreDocId(c.id)));

  const syncWrites: Promise<any>[] = [];
  for (const c of merged) {
    const cid = sanitizeFirestoreDocId(c.id);
    const existsInVault = vaultIdSet.has(cid);
    const existingMembers = vaultData.memberUidsById.get(cid) || [];
    const needsMemberUpdate =
      existsInVault && memberUids.some((u) => !existingMembers.includes(u));

    if (!existsInVault || needsMemberUpdate) {
      const creatorUid = existsInVault
        ? vaultData.creatorById.get(cid) || user.uid
        : user.uid;
      syncWrites.push(
        setDoc(
          doc(db, 'vaults', vaultId, 'customers', cid),
          buildVaultCustomerPayload(c, creatorUid, memberUids)
        ).catch(() => {})
      );
    }

    if (!userDbIdSet.has(cid)) {
      syncWrites.push(
        setDoc(
          doc(db, 'users', user.uid, 'customers', cid),
          buildUserCustomerPayload(c, user.uid)
        ).catch(() => {})
      );
    }
  }

  if (syncWrites.length > 0) {
    await Promise.allSettled(syncWrites);
  }

  return {
    vaultId,
    memberUids,
    mergedCustomers: merged,
  };
}

export async function saveCustomerToVault(
  db: Firestore,
  vaultId: string,
  memberUids: string[],
  customer: Customer,
  currentUid: string
): Promise<void> {
  if (!vaultId) return;
  const cid = sanitizeFirestoreDocId(customer.id);
  const creatorUid = customer.userId || currentUid;
  const safeMembers = Array.from(new Set([currentUid, ...memberUids])).slice(0, 5);
  await setDoc(
    doc(db, 'vaults', vaultId, 'customers', cid),
    buildVaultCustomerPayload(customer, creatorUid, safeMembers)
  );
}

export async function deleteCustomerFromVault(
  db: Firestore,
  vaultId: string,
  customerId: string | number
): Promise<void> {
  if (!vaultId) return;
  const cid = sanitizeFirestoreDocId(customerId);
  await deleteDoc(doc(db, 'vaults', vaultId, 'customers', cid));
}

export type SiblingUnifyMode = 'only_gmail' | 'email_password' | 'google_oauth';

export interface UnifyResult {
  alreadySameUid: boolean;
  linkedPasswordDirect?: boolean;
  siblingUid?: string;
  addedCount: number;
  mergedCustomers: Customer[];
  vaultId: string;
  memberUids: string[];
}

/**
 * Links & merges the currently signed-in user's account with a second login method
 * (e.g. Email+Password <-> Only Gmail / Google Sign-In) for the SAME Gmail address,
 * without logging out the active session, so both methods sync one unified dataset forever.
 */
export async function unifyWithSiblingMethod(
  primaryDb: Firestore,
  primaryLegacyDb: Firestore,
  currentUser: User,
  currentVaultId: string,
  currentCustomers: Customer[],
  mode: SiblingUnifyMode,
  password?: string
): Promise<UnifyResult> {
  const cleanEmail = getCleanUserEmail(currentUser);
  if (!cleanEmail || !cleanEmail.includes('@')) {
    throw new Error('সঠিক Gmail অ্যাকাউন্ট পাওয়া যায়নি');
  }

  // If signed in with Google OAuth on web and user provides a password without an existing separate password account,
  // try linking EmailAuthProvider directly onto the exact same Firebase Auth UID first!
  const hasPasswordProvider = currentUser.providerData.some((p) => p.providerId === 'password');
  const hasGoogleProvider = currentUser.providerData.some((p) => p.providerId === 'google.com');

  if (mode === 'email_password' && hasGoogleProvider && !hasPasswordProvider && password) {
    try {
      const cred = EmailAuthProvider.credential(cleanEmail, password);
      await linkWithCredential(currentUser, cred);
      return {
        alreadySameUid: true,
        linkedPasswordDirect: true,
        addedCount: 0,
        mergedCustomers: currentCustomers,
        vaultId: currentVaultId || currentUser.uid,
        memberUids: [currentUser.uid],
      };
    } catch (linkErr: any) {
      // If email/credential is already in use by another UID, proceed below to merge that sibling UID!
      const code = linkErr?.code || '';
      if (
        code !== 'auth/email-already-in-use' &&
        code !== 'auth/credential-already-in-use' &&
        code !== 'auth/provider-already-linked'
      ) {
        // Still try signing into sibling account below in case password belongs to +biddut
      }
    }
  }

  const dbId =
    firebaseConfig.firestoreDatabaseId &&
    firebaseConfig.firestoreDatabaseId !== '(default)'
      ? firebaseConfig.firestoreDatabaseId
      : undefined;

  let secondaryApp: FirebaseApp | null = null;
  try {
    secondaryApp = initializeApp(firebaseConfig, `biddut_unify_${Date.now()}`);
    const secondaryAuth = getAuth(secondaryApp);
    const secondaryDb = dbId ? getFirestore(secondaryApp, dbId) : getFirestore(secondaryApp);
    const secondaryLegacyDb = getFirestore(secondaryApp);

    let siblingUser: User | null = null;

    if (mode === 'email_password') {
      if (!password) {
        throw new Error('আপনার ইমেইল অ্যাকাউন্টের পাসওয়ার্ড দিন');
      }
      const res = await signInWithStandardEmailPassword(secondaryAuth, cleanEmail, password);
      siblingUser = res.credential.user;
    } else if (mode === 'google_oauth') {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account', login_hint: cleanEmail });
      const res = await signInWithPopup(secondaryAuth, provider);
      siblingUser = res.user;
    } else {
      // mode === 'only_gmail' -> check cleanEmail, +biddut, +biddut_google with derived password (no creation)
      const derivedPw = await deriveAppPasswordForEmail(cleanEmail);
      const [localPart, domainPart] = cleanEmail.split('@');
      const candidates = [
        cleanEmail,
        `${localPart}+biddut@${domainPart}`,
        `${localPart}+biddut_google@${domainPart}`,
      ];
      for (const candEmail of candidates) {
        try {
          const res = await signInWithEmailAndPassword(secondaryAuth, candEmail, derivedPw);
          if (res.user && res.user.uid !== currentUser.uid) {
            siblingUser = res.user;
            break;
          }
          if (res.user && res.user.uid === currentUser.uid && !siblingUser) {
            siblingUser = res.user;
          }
        } catch {
          // try next alias
        }
      }
      if (!siblingUser) {
        throw new Error('এই জিমেইলে আলাদা কোনো শুধু-জিমেইল অ্যাকাউন্ট পাওয়া যায়নি।');
      }
    }

    if (!siblingUser) {
      throw new Error('অন্য লগইন অ্যাকাউন্ট যাচাই করা যায়নি');
    }

    const siblingEmail = getCleanUserEmail(siblingUser);
    if (siblingEmail && siblingEmail !== cleanEmail) {
      throw new Error(
        `আপনি ভিন্ন Gmail (${siblingEmail}) নির্বাচন করেছেন। অনুগ্রহ করে একই Gmail (${cleanEmail}) নির্বাচন করুন।`
      );
    }

    if (siblingUser.uid === currentUser.uid) {
      return {
        alreadySameUid: true,
        siblingUid: siblingUser.uid,
        addedCount: 0,
        mergedCustomers: currentCustomers,
        vaultId: currentVaultId || currentUser.uid,
        memberUids: [currentUser.uid],
      };
    }

    recordUserLinkedUid(cleanEmail, siblingUser.uid);

    // Ensure primary user has a vault & register siblingUser.uid inside it
    const vaultState = await ensureUserVaultSetup(
      primaryDb,
      primaryLegacyDb,
      currentUser,
      currentCustomers,
      false
    );
    const activeVaultId = vaultState.vaultId;
    const nowIso = new Date().toISOString();
    const updatedMembers = Array.from(
      new Set([...vaultState.memberUids, currentUser.uid, siblingUser.uid])
    ).slice(0, 5);

    // Authorize siblingUser.uid as member of activeVaultId
    try {
      const mSnap = await getDoc(
        doc(primaryDb, 'vaults', activeVaultId, 'members', siblingUser.uid)
      );
      if (!mSnap.exists()) {
        await setDoc(doc(primaryDb, 'vaults', activeVaultId, 'members', siblingUser.uid), {
          uid: siblingUser.uid,
          addedBy: currentUser.uid,
          role: 'owner',
          createdAt: nowIso,
        });
      }
    } catch {
      // ignore if already exists
    }

    try {
      await setDoc(
        doc(primaryDb, 'vaults', activeVaultId),
        { memberUids: updatedMembers },
        { merge: true }
      );
    } catch {
      // ignore
    }

    // Read all data from siblingUser (its own /user_vaults -> /vaults, users/{siblingUid}, legacyDefaultDb)
    let siblingCustomers: Customer[] = [];
    try {
      const sibUvSnap = await getDoc(doc(secondaryDb, 'user_vaults', siblingUser.uid));
      const sibVaultId = sibUvSnap.data()?.vaultId;
      if (typeof sibVaultId === 'string' && sibVaultId && sibVaultId !== activeVaultId) {
        const sibVault = await readVaultCustomersMap(secondaryDb, sibVaultId, siblingUser.uid);
        siblingCustomers = mergeCustomerLists(siblingCustomers, sibVault.list);
      }
    } catch {
      // ignore
    }

    const sibUserDb = await readUserBucketCustomers(secondaryDb, siblingUser.uid);
    const sibLegacyDb = await readUserBucketCustomers(secondaryLegacyDb, siblingUser.uid);
    siblingCustomers = mergeCustomerLists(siblingCustomers, sibUserDb);
    siblingCustomers = mergeCustomerLists(siblingCustomers, sibLegacyDb);

    // Point siblingUser's /user_vaults/{siblingUid} -> activeVaultId
    try {
      await setDoc(doc(secondaryDb, 'user_vaults', siblingUser.uid), {
        userId: siblingUser.uid,
        vaultId: activeVaultId,
        updatedAt: nowIso,
      });
    } catch {
      // ignore
    }

    // Merge both lists without duplicates
    const baseMerged = mergeCustomerLists(vaultState.mergedCustomers, currentCustomers);
    const beforeCount = baseMerged.length;
    const finalMerged = mergeCustomerLists(baseMerged, siblingCustomers);
    const addedCount = Math.max(0, finalMerged.length - beforeCount);

    // Sync final merged list + updated memberUids into /vaults/{activeVaultId}/customers & users/{currentUser.uid}
    const vaultMap = await readVaultCustomersMap(primaryDb, activeVaultId, currentUser.uid);
    const writes: Promise<any>[] = [];
    for (const c of finalMerged) {
      const cid = sanitizeFirestoreDocId(c.id);
      const existsInVault = vaultMap.creatorById.has(cid);
      const creatorUid = existsInVault
        ? vaultMap.creatorById.get(cid) || currentUser.uid
        : currentUser.uid;
      writes.push(
        setDoc(
          doc(primaryDb, 'vaults', activeVaultId, 'customers', cid),
          buildVaultCustomerPayload(c, creatorUid, updatedMembers)
        ).catch(() => {})
      );
      writes.push(
        setDoc(
          doc(primaryDb, 'users', currentUser.uid, 'customers', cid),
          buildUserCustomerPayload(c, currentUser.uid)
        ).catch(() => {})
      );
    }
    await Promise.allSettled(writes);
    saveVaultIdForEmail(cleanEmail, activeVaultId);

    try {
      await signOut(secondaryAuth);
    } catch {
      // ignore
    }

    return {
      alreadySameUid: false,
      siblingUid: siblingUser.uid,
      addedCount,
      mergedCustomers: finalMerged,
      vaultId: activeVaultId,
      memberUids: updatedMembers,
    };
  } finally {
    if (secondaryApp) {
      try {
        await deleteApp(secondaryApp);
      } catch {
        // ignore cleanup error
      }
    }
  }
}

export function normalizeAuthUserEmail(email: string): string {
  return normalizeGmailInput(email).replace(/\+biddut([a-z0-9_]*)@/i, '@');
}
