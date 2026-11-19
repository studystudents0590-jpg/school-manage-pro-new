import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyAasfAvw4GfKda9ev0LiZ26_WHu138VVDk",
  authDomain: "school-manager-pro-new.firebaseapp.com",
  projectId: "school-manager-pro-new",
  storageBucket: "school-manager-pro-new.firebasestorage.app",
  messagingSenderId: "109334608441",
  appId: "1:109334608441:web:e6ddcc01e1fac517112be8",
  measurementId: "G-ELNQ06N1SM"
};

const firebaseApp = initializeApp(firebaseConfig);

export const firebaseAppInstance = firebaseApp;
export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);
export const storage = getStorage(firebaseApp);
export const isFirebaseConfigured = true;
