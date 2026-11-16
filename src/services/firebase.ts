import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';

/**
 * Firebase Client Configuration
 * Keys are loaded from Vite environment variables (VITE_FIREBASE_*).
 */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
};

/**
 * Checks whether valid Firebase credentials have been provided.
 */
export function isFirebaseConfigured(): boolean {
  const { apiKey, projectId } = firebaseConfig;
  return Boolean(
    apiKey &&
    projectId &&
    !apiKey.includes('your-api-key') &&
    !projectId.includes('your-project-id')
  );
}

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

if (isFirebaseConfigured()) {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    auth = getAuth(app);
    db = getFirestore(app);
    console.log('[Firebase] Initialized successfully for project:', firebaseConfig.projectId);
  } catch (err) {
    console.warn('[Firebase] Initialization error, falling back to local mode:', err);
  }
} else {
  console.info('[Firebase] Config keys not found in .env; running in local storage fallback mode.');
}

export { app, auth, db };
