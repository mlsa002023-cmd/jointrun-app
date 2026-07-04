// src/firebase/config.js
// Firebase 초기화 — 환경변수 없을 때 crash 방지 (데모/오프라인 모드 지원)

import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY            || "",
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN        || "",
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID         || "",
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET     || "",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  appId:             import.meta.env.VITE_FIREBASE_APP_ID             || "",
};

// projectId 없으면 Firebase 없이 데모 모드로 운영
export const FIREBASE_ENABLED = Boolean(firebaseConfig.projectId);

let app = null;
let auth = null;
let db = null;

if (FIREBASE_ENABLED) {
  app  = getApps().length ? getApp() : initializeApp(firebaseConfig);
  auth = getAuth(app);
  db   = getFirestore(app);
}

export { auth, db };
export default app;
