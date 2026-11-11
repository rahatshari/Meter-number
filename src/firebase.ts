import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  doc,
  getDocFromServer,
  Firestore,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { OperationType, FirestoreErrorInfo } from './types';

// Primary database & auth config (electric-20c05) where the user's live customer records are stored
const primaryFirebaseConfig = {
  projectId: 'electric-20c05',
  appId: '1:642666694691:web:b496aa83d01ceef65d8996',
  apiKey: 'AIzaSyBgVUNfPvuda_A6u3amqWoiu2s0nhY4rQE',
  authDomain: 'electric-20c05.firebaseapp.com',
  firestoreDatabaseId: '(default)',
  storageBucket: 'electric-20c05.firebasestorage.app',
  messagingSenderId: '642666694691',
  measurementId: '',
  oAuthClientId: '642666694691-7jdcvl05jek4drlr0is8ft79immhsrrq.apps.googleusercontent.com',
  recaptchaSiteKey: '',
};

const app = initializeApp(primaryFirebaseConfig);

// Secondary Firebase app instance using firebase-applet-config.json for Google Drive Workspace OAuth scopes
const driveOAuthApp = initializeApp(firebaseConfig, 'google-drive-workspace-oauth');

function createOfflineReadyFirestore(): Firestore {
  const dbId =
    primaryFirebaseConfig.firestoreDatabaseId &&
    primaryFirebaseConfig.firestoreDatabaseId !== '(default)'
      ? primaryFirebaseConfig.firestoreDatabaseId
      : undefined;
  try {
    return dbId
      ? initializeFirestore(
          app,
          {
            localCache: persistentLocalCache({
              tabManager: persistentMultipleTabManager(),
            }),
          },
          dbId
        )
      : initializeFirestore(app, {
          localCache: persistentLocalCache({
            tabManager: persistentMultipleTabManager(),
          }),
        });
  } catch {
    return dbId ? getFirestore(app, dbId) : getFirestore(app);
  }
}

export const db = createOfflineReadyFirestore();
export const auth = getAuth(app);
export const driveAuth = getAuth(driveOAuthApp);


// Validate Connection to Firestore when online (Per SKILL.md)
async function testConnection() {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return;
  }
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      // Expected when device has no internet connection; offline queue handles data safely
      console.info('অফলাইন মোডে অ্যাপ চালু হয়েছে — ইন্টারনেট সংযোগ পেলে স্বয়ংক্রিয়ভাবে সিঙ্ক হবে।');
    }
  }
}
testConnection();

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path,
    authInfo: {
      userId: auth.currentUser?.uid || null,
      email: auth.currentUser?.email || null,
      emailVerified: auth.currentUser?.emailVerified || null,
      isAnonymous: auth.currentUser?.isAnonymous || null,
      tenantId: auth.currentUser?.tenantId || null,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
