import {
  Auth,
  UserCredential,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from 'firebase/auth';

const SAVED_EMAILS_KEY = 'biddut_bill_saved_gmail_accounts';

/**
 * Retrieves the list of Gmail / email accounts saved on this device.
 */
export function getSavedGmailAccounts(): string[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(SAVED_EMAILS_KEY);
    if (!raw) {
      const single = localStorage.getItem('lastLoginGmail');
      return single ? [single] : ['rahatsharif10448@gmail.com'];
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return Array.from(new Set(parsed.map((e) => String(e).trim().toLowerCase())));
    }
  } catch {
    // fallback
  }
  return ['rahatsharif10448@gmail.com'];
}

/**
 * Saves an email address into the local device's account list for 1-tap switching.
 */
export function recordSavedGmailAccount(email: string): void {
  if (typeof localStorage === 'undefined') return;
  const clean = email.trim().toLowerCase();
  if (!clean || !clean.includes('@')) return;

  try {
    const current = getSavedGmailAccounts();
    const updated = [clean, ...current.filter((e) => e !== clean)].slice(0, 5);
    localStorage.setItem(SAVED_EMAILS_KEY, JSON.stringify(updated));
    localStorage.setItem('lastLoginGmail', clean);
  } catch (e) {
    console.warn('Could not save email account to storage', e);
  }
}

/**
 * Derives a consistent, secure application-salted password for an email address.
 * This allows users to log in with JUST their Gmail without having to invent or remember
 * a separate password, avoiding external browser redirects and popup COOP issues.
 */
export async function deriveAppPasswordForEmail(email: string): Promise<string> {
  const normEmail = email.trim().toLowerCase();
  const encoder = new TextEncoder();
  const data = encoder.encode(`biddut_bill_2026_salt_${normEmail}`);

  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    return `Bb#${hex.slice(0, 16)}!9`;
  }

  // Fallback simple deterministic hash if crypto.subtle is unavailable
  let hash = 0;
  for (let i = 0; i < normEmail.length; i++) {
    hash = (hash << 5) - hash + normEmail.charCodeAt(i);
    hash |= 0;
  }
  const hex = Math.abs(hash).toString(16).padStart(8, '0');
  return `Bb#${hex}Secure!9`;
}

export interface LoginResult {
  credential: UserCredential;
  isNewUser: boolean;
}

/**
 * Logs in or registers a user directly with just their Gmail / email.
 * If the account was previously registered with a different password, provides a clear structured error.
 */
export async function loginWithJustEmail(
  auth: Auth,
  email: string,
  customPassword?: string
): Promise<LoginResult> {
  const cleanEmail = email.trim().toLowerCase();
  const targetPassword = customPassword || (await deriveAppPasswordForEmail(cleanEmail));

  try {
    const result = await signInWithEmailAndPassword(auth, cleanEmail, targetPassword);
    recordSavedGmailAccount(cleanEmail);
    return { credential: result, isNewUser: false };
  } catch (err: any) {
    const errCode = err?.code || '';

    // If account does not exist, or invalid credential with auto-derived password, try auto-registering
    if (
      !customPassword &&
      (errCode === 'auth/user-not-found' || errCode === 'auth/invalid-credential')
    ) {
      try {
        const createResult = await createUserWithEmailAndPassword(
          auth,
          cleanEmail,
          targetPassword
        );
        recordSavedGmailAccount(cleanEmail);
        return { credential: createResult, isNewUser: true };
      } catch (createErr: any) {
        if (createErr?.code === 'auth/email-already-in-use') {
          const conflictError = new Error(
            'এই Gmail অ্যাকাউন্টটিতে পূর্বে নিজস্ব পাসওয়ার্ড দিয়ে রেজিস্ট্রেশন করা হয়েছিল।'
          );
          (conflictError as any).code = 'auth/account-exists-with-different-credential';
          (conflictError as any).email = cleanEmail;
          throw conflictError;
        }
        throw createErr;
      }
    }
    throw err;
  }
}
