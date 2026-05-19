import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Only initialize if we have config vars available
export const hasFirebaseConfig = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId
);

const app = hasFirebaseConfig 
  ? (!getApps().length ? initializeApp(firebaseConfig) : getApp())
  : null;

const db = app ? getFirestore(app) : null;

export { app, db };
