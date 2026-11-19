// Add your NEW Firebase project's web-app configuration here when ready.
// Do not paste private service-account keys into this file.
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "ADD_API_KEY",
  authDomain: "ADD_PROJECT.firebaseapp.com",
  projectId: "ADD_PROJECT_ID",
  storageBucket: "ADD_PROJECT.appspot.com",
  messagingSenderId: "ADD_MESSAGING_SENDER_ID",
  appId: "ADD_APP_ID"
};

const configured = firebaseConfig.apiKey !== "ADD_API_KEY";
export const firebaseApp = configured ? initializeApp(firebaseConfig) : null;
export const auth = firebaseApp ? getAuth(firebaseApp) : null;
export const db = firebaseApp ? getFirestore(firebaseApp) : null;
export const storage = firebaseApp ? getStorage(firebaseApp) : null;
export const isFirebaseConfigured = configured;
