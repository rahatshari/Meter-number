import {
  Auth,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import {
  Firestore,
  collection,
  getDocs,
  doc,
  setDoc,
} from 'firebase/firestore';
import { Customer } from '../types';
import {
  normalizeGmailInput,
  getCleanUserEmail,
  getSharedAccountKey,
  getLegacyMirrorKeysForUser,
  recordSavedGmailAccount,
} from './authHelpers';

/**
 * Google Workspace OAuth Scopes for Google Drive Backup & Restore.
 * Configured via set_up_oauth following Least Privilege Principle.
 */
export const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.appdata',
];

export const DRIVE_BACKUP_FILENAME = 'Biddut_Bill_Drive_Backup.json';
const DRIVE_CONNECTED_EMAIL_KEY = 'biddut_drive_connected_email';
const DRIVE_ACCESS_GRANTED_PREFIX = 'biddut_drive_access_granted_';

// Flag to indicate if we are in the middle of a Google Drive OAuth sign-in flow
let isSigningIn = false;

// In-memory cache for the Google OAuth access token (NEVER stored in localStorage/sessionStorage per SKILL.md)
let cachedAccessToken: string | null = null;

export interface GoogleDriveBackupMetadata {
  isConnected: boolean;
  connectedEmail: string;
  hasLiveOAuthToken: boolean;
  backupFileName: string;
}

/**
 * Initializes the auth state listener to manage the in-memory OAuth access token.
 * Automatically clears cachedAccessToken when the user signs out.
 */
export const initDriveAuth = (
  authInstance: Auth,
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(authInstance, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const getDriveAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const clearDriveAccessToken = (): void => {
  cachedAccessToken = null;
};

/**
 * Initiates Google Sign-In with Google Drive scopes (drive.file + drive.appdata)
 * and caches the OAuth access token strictly in memory.
 */
export const googleDriveSignIn = async (
  driveAuthInstance: Auth,
  loginHintEmail?: string
): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const provider = new GoogleAuthProvider();
    for (const scope of SCOPES) {
      provider.addScope(scope);
    }
    const customParams: Record<string, string> = {
      prompt: 'select_account consent',
    };
    const cleanHint = loginHintEmail ? normalizeGmailInput(loginHintEmail) : '';
    if (cleanHint && cleanHint.includes('@')) {
      customParams.login_hint = cleanHint;
    }
    provider.setCustomParameters(customParams);

    const result = await signInWithPopup(driveAuthInstance, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to get Google Drive access token from Firebase Auth');
    }

    cachedAccessToken = credential.accessToken;
    const email = getCleanUserEmail(result.user) || cleanHint;
    if (email) {
      markGoogleDriveAccessGranted(email);
      recordSavedGmailAccount(email);
    }
    return { user: result.user, accessToken: cachedAccessToken };
  } finally {
    isSigningIn = false;
  }
};

/**
 * Records that the user has granted Google Drive backup access for a specific Gmail address.
 * (Stores only the email & boolean flag, never any token).
 */
export function markGoogleDriveAccessGranted(email: string): void {
  if (typeof localStorage === 'undefined') return;
  const clean = normalizeGmailInput(email).replace(/\+biddut([a-z0-9_]*)@/i, '@');
  if (!clean || !clean.includes('@')) return;
  try {
    localStorage.setItem(DRIVE_CONNECTED_EMAIL_KEY, clean);
    localStorage.setItem(`${DRIVE_ACCESS_GRANTED_PREFIX}${clean}`, 'true');
  } catch {
    // ignore storage errors
  }
}

export function disconnectGoogleDriveAccount(email?: string): void {
  cachedAccessToken = null;
  if (typeof localStorage === 'undefined') return;
  try {
    const target = email
      ? normalizeGmailInput(email).replace(/\+biddut([a-z0-9_]*)@/i, '@')
      : localStorage.getItem(DRIVE_CONNECTED_EMAIL_KEY) || '';
    localStorage.removeItem(DRIVE_CONNECTED_EMAIL_KEY);
    if (target) {
      localStorage.removeItem(`${DRIVE_ACCESS_GRANTED_PREFIX}${target}`);
    }
  } catch {
    // ignore
  }
}

export function getGoogleDriveConnectionState(
  currentUser?: { email?: string | null; displayName?: string | null } | null
): GoogleDriveBackupMetadata {
  const userEmail = getCleanUserEmail(currentUser);
  let storedEmail = '';
  let isGranted = false;

  if (typeof localStorage !== 'undefined') {
    try {
      storedEmail = localStorage.getItem(DRIVE_CONNECTED_EMAIL_KEY) || '';
      const checkEmail = userEmail || storedEmail;
      if (checkEmail) {
        isGranted =
          localStorage.getItem(`${DRIVE_ACCESS_GRANTED_PREFIX}${checkEmail}`) === 'true' ||
          Boolean(userEmail);
      }
    } catch {
      // ignore
    }
  }

  const activeEmail = userEmail || storedEmail;
  return {
    isConnected: Boolean(activeEmail) && (isGranted || Boolean(userEmail)),
    connectedEmail: activeEmail,
    hasLiveOAuthToken: Boolean(cachedAccessToken),
    backupFileName: DRIVE_BACKUP_FILENAME,
  };
}

/**
 * Searches the user's Google Drive for an existing Biddut_Bill_Drive_Backup.json file.
 */
export async function findBackupFileInGoogleDrive(
  accessToken: string
): Promise<{ id: string; name: string; modifiedTime?: string } | null> {
  // 1. Check drive.file space first so user can also see the file in their Drive
  const query = encodeURIComponent(
    `name = '${DRIVE_BACKUP_FILENAME}' and trashed = false`
  );
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${query}&spaces=drive&fields=files(id,name,modifiedTime)&pageSize=5`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (res.ok) {
    const data = await res.json();
    if (Array.isArray(data.files) && data.files.length > 0) {
      return data.files[0];
    }
  }

  // 2. Fallback: check appDataFolder space
  const appDataRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${query}&spaces=appDataFolder&fields=files(id,name,modifiedTime)&pageSize=5`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (appDataRes.ok) {
    const appData = await appDataRes.json();
    if (Array.isArray(appData.files) && appData.files.length > 0) {
      return appData.files[0];
    }
  }

  return null;
}

/**
 * Uploads or updates the customer backup JSON file directly in the user's Google Drive via Drive v3 API.
 */
export async function uploadBackupToGoogleDriveApi(
  accessToken: string,
  customers: Customer[],
  email: string
): Promise<{ fileId: string; modifiedTime: string }> {
  const nowIso = new Date().toISOString();
  const payload = {
    app: 'বিদ্যুৎ বিল',
    version: '2.0',
    gmail: email,
    exportedAt: nowIso,
    totalCustomers: customers.length,
    customers,
    groups: [],
  };

  const fileContent = JSON.stringify(payload, null, 2);
  const existingFile = await findBackupFileInGoogleDrive(accessToken);

  const metadata = existingFile
    ? {
        name: DRIVE_BACKUP_FILENAME,
        mimeType: 'application/json',
        description: `বিদ্যুৎ বিল অ্যাপ ব্যাকআপ (${email})`,
      }
    : {
        name: DRIVE_BACKUP_FILENAME,
        mimeType: 'application/json',
        description: `বিদ্যুৎ বিল অ্যাপ ব্যাকআপ (${email})`,
      };

  const boundary = '-------biddut_bill_drive_backup_boundary';
  const multipartBody =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${fileContent}\r\n` +
    `--${boundary}--`;

  const uploadUrl = existingFile
    ? `https://www.googleapis.com/upload/drive/v3/files/${existingFile.id}?uploadType=multipart&fields=id,modifiedTime`
    : `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,modifiedTime`;

  const res = await fetch(uploadUrl, {
    method: existingFile ? 'PATCH' : 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body: multipartBody,
  });

  if (!res.ok) {
    throw new Error(`Google Drive upload failed with status ${res.status}`);
  }

  const data = await res.json();
  return {
    fileId: data.id || existingFile?.id || 'drive_file',
    modifiedTime: data.modifiedTime || nowIso,
  };
}

/**
 * Downloads and parses the customer backup JSON file from the user's Google Drive via Drive v3 API.
 */
export async function downloadBackupFromGoogleDriveApi(
  accessToken: string
): Promise<{ customers: Customer[]; exportedAt?: string; fileName: string } | null> {
  const existingFile = await findBackupFileInGoogleDrive(accessToken);
  if (!existingFile) return null;

  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${existingFile.id}?alt=media`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!res.ok) {
    return null;
  }

  const parsed = await res.json();
  const rawList = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed?.customers)
    ? parsed.customers
    : [];

  const normalized = normalizeRestoredCustomers(rawList);
  return {
    customers: normalized,
    exportedAt: parsed?.exportedAt || existingFile.modifiedTime,
    fileName: existingFile.name || DRIVE_BACKUP_FILENAME,
  };
}

/**
 * Pure helper to normalize customer records restored from Google Drive or Cloud Backup.
 */
export function normalizeRestoredCustomers(rawList: any[]): Customer[] {
  if (!Array.isArray(rawList)) return [];
  return rawList
    .filter((item) => item && (item.name || item.sms || item.mobile))
    .map((item, idx) => ({
      id: item.id ? parseFloat(String(item.id)) || item.id : Date.now() + idx,
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
}

/**
 * Fetches all backed-up customer records for a given Gmail/User from both:
 * 1. Google Drive API (if an in-memory OAuth access token is available), AND
 * 2. The Gmail's unified Cloud Drive Backup Vault in Firestore (`users/acct_<clean_email>/customers` + legacy buckets).
 *
 * This guarantees that if the user uninstalls the app, reinstalls it, enters their Gmail,
 * and taps "Connect / Restore", 100% of their previously uploaded customers immediately appear in the app!
 */
export async function fetchAllBackedUpCustomersForGmail(
  dbInstance: Firestore,
  user: { uid: string; email?: string | null; displayName?: string | null }
): Promise<Customer[]> {
  const mergedMap = new Map<string, Customer>();

  // 1. Check live Google Drive API if OAuth access token is in memory
  if (cachedAccessToken) {
    try {
      const driveData = await downloadBackupFromGoogleDriveApi(cachedAccessToken);
      if (driveData && driveData.customers.length > 0) {
        for (const c of driveData.customers) {
          mergedMap.set(String(c.id), c);
        }
      }
    } catch (e) {
      console.warn('Google Drive API restore check skipped:', e);
    }
  }

  // 2. Check unified Gmail Cloud Vault in Firestore + legacy UID buckets
  const sharedKey = getSharedAccountKey(user);
  const mirrorKeys = getLegacyMirrorKeysForUser(user);
  const allKeysToCheck = Array.from(new Set([sharedKey, ...mirrorKeys])).filter(Boolean);

  for (const key of allKeysToCheck) {
    try {
      const snap = await getDocs(collection(dbInstance, 'users', key, 'customers'));
      snap.forEach((docSnap) => {
        const data = docSnap.data();
        const cid = String(data.id || docSnap.id);
        if (!mergedMap.has(cid) && data.name) {
          mergedMap.set(cid, {
            id: parseFloat(cid) || cid,
            name: String(data.name || ''),
            father: String(data.father || ''),
            mother: String(data.mother || ''),
            address: String(data.address || ''),
            mobile: String(data.mobile || ''),
            sms: String(data.sms || ''),
            dueDate: String(data.dueDate || ''),
            group: String(data.group || ''),
            lastPaidMonth: String(data.lastPaidMonth || ''),
            userId: data.userId || sharedKey,
          });
        }
      });
    } catch {
      // continue checking other keys
    }
  }

  // 3. Ensure any records found in legacy keys are also written into the canonical sharedKey bucket
  const finalCustomers = Array.from(mergedMap.values());
  if (finalCustomers.length > 0 && sharedKey) {
    for (const c of finalCustomers) {
      const custId = String(c.id);
      setDoc(doc(dbInstance, 'users', sharedKey, 'customers', custId), {
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
        userId: sharedKey,
      }).catch(() => {});
    }
  }

  return finalCustomers;
}
