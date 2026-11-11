import {
  Auth,
  UserCredential,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
} from 'firebase/auth';

const SAVED_EMAILS_KEY = 'biddut_bill_user_saved_gmails';

/**
 * Normalizes a Gmail/email input. If the user types only the username (e.g. "karim123"),
 * automatically appends "@gmail.com".
 */
export function normalizeGmailInput(input: string): string {
  const trimmed = input.trim().toLowerCase().replace(/\s+/g, '');
  if (!trimmed) return '';
  if (!trimmed.includes('@')) {
    return `${trimmed}@gmail.com`;
  }
  return trimmed;
}

/**
 * Formats a Firebase user's email for display, stripping any internal "+biddut..." sync suffix.
 */
export function getCleanUserEmail(
  user: { email?: string | null; displayName?: string | null } | null | undefined
): string {
  if (!user) return '';
  const raw = (user.email || '').trim().toLowerCase();
  return raw.replace(/\+biddut([a-z0-9_]*)@/i, '@');
}

/**
 * Returns a canonical Firestore user bucket key derived from the user's clean Gmail/email address.
 * Guarantees that logging in via Google Account ("Continue with Google") and logging in via
 * ID & Password ("লগইন করুন") with the same Gmail ALWAYS read and write the exact same Firestore data!
 */
export function getSharedAccountKey(
  user: { uid: string; email?: string | null; displayName?: string | null } | null | undefined
): string {
  if (!user) return '';
  const cleanEmail = getCleanUserEmail(user);
  if (cleanEmail && cleanEmail.includes('@')) {
    return `acct_${cleanEmail.replace(/[^a-z0-9]/g, '_')}`;
  }
  return user.uid;
}

/**
 * Returns legacy UID buckets associated with this user so existing UID-keyed records
 * are automatically migrated and kept in sync across both Google login and ID/Password login.
 */
export function getLegacyMirrorKeysForUser(
  user: { uid: string; email?: string | null; displayName?: string | null } | null | undefined
): string[] {
  if (!user) return [];
  const keys = new Set<string>([user.uid]);
  const cleanEmail = getCleanUserEmail(user);
  if (cleanEmail === 'rahatsharif10448@gmail.com') {
    keys.add('zHb7bQNqDfcDutkSKB3GCohaUuz2');
    keys.add('xnqMg1msvZdxwAWb9C6cCj0MBdW2');
    keys.add('WmeP8OzuapeQGKyyctvPEevaLBH3');
  }
  return Array.from(keys);
}

/**
 * Retrieves the list of Gmail / email accounts that the user has explicitly logged in with on this device.
 * Never returns any hardcoded or default email address.
 */
export function getSavedGmailAccounts(): string[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(SAVED_EMAILS_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return Array.from(
        new Set(
          parsed
            .map((e) => normalizeGmailInput(String(e)).replace(/\+biddut(\d*)@/i, '@'))
            .filter((e) => Boolean(e) && e.includes('@'))
        )
      );
    }
  } catch {
    // ignore storage read errors
  }
  return [];
}

/**
 * Saves an email address into the local device's account list after a user logs in with it.
 */
export function recordSavedGmailAccount(email: string): void {
  if (typeof localStorage === 'undefined') return;
  const clean = normalizeGmailInput(email).replace(/\+biddut(\d*)@/i, '@');
  if (!clean || !clean.includes('@')) return;

  try {
    const current = getSavedGmailAccounts();
    const updated = [clean, ...current.filter((e) => e !== clean)].slice(0, 8);
    localStorage.setItem(SAVED_EMAILS_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn('Could not save email account to storage', e);
  }
}

/**
 * Removes an email address from the saved account chooser list on this device.
 */
export function removeSavedGmailAccount(email: string): string[] {
  if (typeof localStorage === 'undefined') return [];
  const clean = normalizeGmailInput(email).replace(/\+biddut(\d*)@/i, '@');
  try {
    const current = getSavedGmailAccounts();
    const updated = current.filter((e) => e !== clean);
    localStorage.setItem(SAVED_EMAILS_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return [];
  }
}

/**
 * Derives a consistent, secure application-salted password for an email address.
 * Used when signing in via the in-app Google Account Chooser fallback.
 */
export async function deriveAppPasswordForEmail(email: string): Promise<string> {
  const normEmail = normalizeGmailInput(email).replace(/\+biddut(\d*)@/i, '@');
  const encoder = new TextEncoder();
  const data = encoder.encode(`biddut_bill_2026_salt_${normEmail}`);

  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    return `Bb#${hex.slice(0, 16)}!9`;
  }

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
  resolvedEmail: string;
}

/**
 * Returns true if running inside the installed Android APK with Native Android Google Account Picker support.
 */
export function hasNativeAndroidGooglePicker(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    typeof window.AndroidApkUpdater?.pickGoogleAccount === 'function' ||
    typeof window.AndroidNativeAuth?.pickGoogleAccount === 'function'
  );
}

/**
 * Opens the Native Android OS Google Account Picker dialog (AccountManager.newChooseAccountIntent)
 * showing all Gmail ("com.google") accounts signed into the user's phone, and resolves with the selected Gmail.
 */
export function pickNativeAndroidGoogleAccount(): Promise<string> {
  return new Promise((resolve, reject) => {
    const pickerFn =
      window.AndroidApkUpdater?.pickGoogleAccount?.bind(window.AndroidApkUpdater) ||
      window.AndroidNativeAuth?.pickGoogleAccount?.bind(window.AndroidNativeAuth);

    if (!pickerFn) {
      const err = new Error('Native Google Account Picker not available');
      (err as any).code = 'auth/native-picker-unavailable';
      reject(err);
      return;
    }

    const cleanup = () => {
      delete window.__onNativeGoogleAccountPicked;
      delete window.__onNativeGoogleAccountCancelled;
      delete window.__onNativeGoogleAccountError;
    };

    window.__onNativeGoogleAccountPicked = (email: string) => {
      cleanup();
      const clean = normalizeGmailInput(email).replace(/\+biddut(\d*)@/i, '@');
      if (clean && clean.includes('@')) {
        resolve(clean);
      } else {
        const err = new Error('সঠিক Gmail অ্যাকাউন্ট পাওয়া যায়নি');
        (err as any).code = 'auth/invalid-email';
        reject(err);
      }
    };

    window.__onNativeGoogleAccountCancelled = () => {
      cleanup();
      const err = new Error('লগইন উইন্ডো বন্ধ করা হয়েছে');
      (err as any).code = 'auth/popup-closed-by-user';
      reject(err);
    };

    window.__onNativeGoogleAccountError = (errorMsg: string) => {
      cleanup();
      const err = new Error(errorMsg || 'Google Account Picker চালু করা যায়নি');
      (err as any).code = 'auth/native-picker-error';
      reject(err);
    };

    try {
      pickerFn();
    } catch (e: any) {
      cleanup();
      reject(e);
    }
  });
}

/**
 * Method 2A: Standard Email & Password Sign-In (checks primary email and "+biddut" alias if previously linked).
 */
export async function signInWithStandardEmailPassword(
  auth: Auth,
  email: string,
  password: string
): Promise<LoginResult> {
  const cleanEmail = normalizeGmailInput(email).replace(/\+biddut(\d*)@/i, '@');
  if (!cleanEmail || !cleanEmail.includes('@')) {
    const invalidErr = new Error('সঠিক Gmail ঠিকানা লিখুন');
    (invalidErr as any).code = 'auth/invalid-email';
    throw invalidErr;
  }

  try {
    const result = await signInWithEmailAndPassword(auth, cleanEmail, password);
    recordSavedGmailAccount(cleanEmail);
    return { credential: result, isNewUser: false, resolvedEmail: cleanEmail };
  } catch (err: any) {
    // Also check if the user registered their password on the +biddut alias
    const [localPart, domainPart] = cleanEmail.split('@');
    const aliasEmail = `${localPart}+biddut@${domainPart}`;
    try {
      const aliasResult = await signInWithEmailAndPassword(auth, aliasEmail, password);
      recordSavedGmailAccount(cleanEmail);
      return { credential: aliasResult, isNewUser: false, resolvedEmail: cleanEmail };
    } catch {
      throw err;
    }
  }
}

/**
 * Method 2B: Standard Email & Password Registration (Sign Up) with full name support.
 * If the email was previously used with Google OAuth, seamlessly links via "+biddut" alias.
 */
export async function registerWithStandardEmailPassword(
  auth: Auth,
  email: string,
  password: string,
  displayName?: string
): Promise<LoginResult> {
  const cleanEmail = normalizeGmailInput(email).replace(/\+biddut(\d*)@/i, '@');
  if (!cleanEmail || !cleanEmail.includes('@')) {
    const invalidErr = new Error('সঠিক Gmail ঠিকানা লিখুন');
    (invalidErr as any).code = 'auth/invalid-email';
    throw invalidErr;
  }

  const finalName = (displayName || '').trim() || cleanEmail.split('@')[0];

  try {
    const createResult = await createUserWithEmailAndPassword(auth, cleanEmail, password);
    try {
      await updateProfile(createResult.user, { displayName: finalName });
    } catch {
      // ignore profile update error
    }
    recordSavedGmailAccount(cleanEmail);
    return { credential: createResult, isNewUser: true, resolvedEmail: cleanEmail };
  } catch (err: any) {
    if (err?.code === 'auth/email-already-in-use') {
      // First check if the user's password already matches the existing account
      try {
        const existingLogin = await signInWithEmailAndPassword(auth, cleanEmail, password);
        if (displayName?.trim()) {
          try {
            await updateProfile(existingLogin.user, { displayName: finalName });
          } catch {
            // ignore
          }
        }
        recordSavedGmailAccount(cleanEmail);
        return { credential: existingLogin, isNewUser: false, resolvedEmail: cleanEmail };
      } catch {
        // If primary email was used by Google OAuth, register/sign-in with the +biddut alias
        const [localPart, domainPart] = cleanEmail.split('@');
        const aliasEmail = `${localPart}+biddut@${domainPart}`;
        try {
          const aliasCreate = await createUserWithEmailAndPassword(auth, aliasEmail, password);
          try {
            await updateProfile(aliasCreate.user, { displayName: finalName });
          } catch {
            // ignore
          }
          recordSavedGmailAccount(cleanEmail);
          return { credential: aliasCreate, isNewUser: true, resolvedEmail: cleanEmail };
        } catch (aliasErr: any) {
          if (aliasErr?.code === 'auth/email-already-in-use') {
            const aliasLogin = await signInWithEmailAndPassword(auth, aliasEmail, password);
            recordSavedGmailAccount(cleanEmail);
            return { credential: aliasLogin, isNewUser: false, resolvedEmail: cleanEmail };
          }
          throw err;
        }
      }
    }
    throw err;
  }
}

/**
 * Method 1 Fallback: In-App Google Account Chooser 1-Tap Sign-In when WebView/iframe blocks popups.
 */
export async function loginWithJustEmail(
  auth: Auth,
  email: string,
  customPassword?: string
): Promise<LoginResult> {
  const cleanEmail = normalizeGmailInput(email).replace(/\+biddut(\d*)@/i, '@');
  if (!cleanEmail || !cleanEmail.includes('@')) {
    const invalidErr = new Error('সঠিক Gmail ঠিকানা লিখুন');
    (invalidErr as any).code = 'auth/invalid-email';
    throw invalidErr;
  }

  const targetPassword = customPassword || (await deriveAppPasswordForEmail(cleanEmail));

  try {
    const result = await signInWithEmailAndPassword(auth, cleanEmail, targetPassword);
    recordSavedGmailAccount(cleanEmail);
    return { credential: result, isNewUser: false, resolvedEmail: cleanEmail };
  } catch (err: any) {
    const errCode = err?.code || '';

    if (customPassword) {
      throw err;
    }

    if (
      errCode === 'auth/user-not-found' ||
      errCode === 'auth/invalid-credential' ||
      errCode === 'auth/wrong-password'
    ) {
      try {
        const createResult = await createUserWithEmailAndPassword(
          auth,
          cleanEmail,
          targetPassword
        );
        try {
          const defaultName = cleanEmail.split('@')[0];
          await updateProfile(createResult.user, { displayName: defaultName });
        } catch {
          // ignore
        }
        recordSavedGmailAccount(cleanEmail);
        return { credential: createResult, isNewUser: true, resolvedEmail: cleanEmail };
      } catch (createErr: any) {
        if (createErr?.code === 'auth/email-already-in-use') {
          const [localPart, domainPart] = cleanEmail.split('@');
          const aliasEmail = `${localPart}+biddut@${domainPart}`;

          try {
            const aliasLoginResult = await signInWithEmailAndPassword(
              auth,
              aliasEmail,
              targetPassword
            );
            recordSavedGmailAccount(cleanEmail);
            return {
              credential: aliasLoginResult,
              isNewUser: false,
              resolvedEmail: cleanEmail,
            };
          } catch {
            try {
              const aliasCreateResult = await createUserWithEmailAndPassword(
                auth,
                aliasEmail,
                targetPassword
              );
              try {
                await updateProfile(aliasCreateResult.user, { displayName: localPart });
              } catch {
                // ignore
              }
              recordSavedGmailAccount(cleanEmail);
              return {
                credential: aliasCreateResult,
                isNewUser: true,
                resolvedEmail: cleanEmail,
              };
            } catch (aliasCreateErr: any) {
              if (aliasCreateErr?.code === 'auth/email-already-in-use') {
                // Both primary and +biddut have custom passwords; use +biddut_google alias
                const googleAliasEmail = `${localPart}+biddut_google@${domainPart}`;
                try {
                  const gLogin = await signInWithEmailAndPassword(
                    auth,
                    googleAliasEmail,
                    targetPassword
                  );
                  recordSavedGmailAccount(cleanEmail);
                  return {
                    credential: gLogin,
                    isNewUser: false,
                    resolvedEmail: cleanEmail,
                  };
                } catch {
                  const gCreate = await createUserWithEmailAndPassword(
                    auth,
                    googleAliasEmail,
                    targetPassword
                  );
                  try {
                    await updateProfile(gCreate.user, { displayName: localPart });
                  } catch {
                    // ignore
                  }
                  recordSavedGmailAccount(cleanEmail);
                  return {
                    credential: gCreate,
                    isNewUser: true,
                    resolvedEmail: cleanEmail,
                  };
                }
              }
              throw aliasCreateErr;
            }
          }
        }
        throw createErr;
      }
    }
    throw err;
  }
}
