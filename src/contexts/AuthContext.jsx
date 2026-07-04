// src/contexts/AuthContext.jsx
// Firebase Auth Context — Firebase 없을 때 데모 모드로 동작

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { FIREBASE_ENABLED, auth, db } from "../firebase/config";

const AuthContext = createContext(null);

// Firebase가 있을 때만 동적 import
let fbAuth = {};
if (FIREBASE_ENABLED) {
  fbAuth = await import("firebase/auth").catch(() => ({}));
}
const {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  updateProfile,
  sendPasswordResetEmail,
} = fbAuth;

let fbFirestore = {};
if (FIREBASE_ENABLED) {
  fbFirestore = await import("firebase/firestore").catch(() => ({}));
}
const { doc, setDoc, getDoc, serverTimestamp } = fbFirestore;

const googleProvider = FIREBASE_ENABLED ? new GoogleAuthProvider() : null;

async function upsertUserDoc(user) {
  if (!FIREBASE_ENABLED || !db) return;
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      email: user.email || "",
      displayName: user.displayName || "",
      photoURL: user.photoURL || "",
      provider: user.providerData?.[0]?.providerId || "password",
      createdAt: serverTimestamp(),
      lastLoginAt: serverTimestamp(),
    });
  } else {
    await setDoc(ref, { lastLoginAt: serverTimestamp() }, { merge: true });
  }
}

// 데모 모드 가짜 유저
const DEMO_USER = { uid: "demo", email: "demo@jointrun.app", displayName: "데모 사용자" };

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    if (!FIREBASE_ENABLED || !auth || !onAuthStateChanged) {
      // 데모 모드: 로그인 없이 바로 앱 진입
      setCurrentUser(DEMO_USER);
      setAuthLoading(false);
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setAuthLoading(false);
    });
    return unsubscribe;
  }, []);

  const signup = useCallback(async (email, password, displayName) => {
    if (!FIREBASE_ENABLED) { setCurrentUser(DEMO_USER); return; }
    setAuthError(null);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      if (displayName) await updateProfile(cred.user, { displayName });
      await upsertUserDoc({ ...cred.user, displayName });
    } catch (e) {
      setAuthError(e.message);
      throw e;
    }
  }, []);

  const login = useCallback(async (email, password) => {
    if (!FIREBASE_ENABLED) { setCurrentUser(DEMO_USER); return; }
    setAuthError(null);
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      await upsertUserDoc(cred.user);
    } catch (e) {
      setAuthError(e.message);
      throw e;
    }
  }, []);

  const loginWithGoogle = useCallback(async () => {
    if (!FIREBASE_ENABLED) { setCurrentUser(DEMO_USER); return; }
    setAuthError(null);
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      await upsertUserDoc(cred.user);
    } catch (e) {
      if (e.code !== "auth/popup-closed-by-user") {
        setAuthError(e.message);
        throw e;
      }
    }
  }, []);

  const logout = useCallback(async () => {
    if (!FIREBASE_ENABLED) { setCurrentUser(null); return; }
    await signOut(auth);
  }, []);

  const resetPassword = useCallback(async (email) => {
    if (!FIREBASE_ENABLED) return;
    setAuthError(null);
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (e) {
      setAuthError(e.message);
      throw e;
    }
  }, []);

  return (
    <AuthContext.Provider value={{
      currentUser, authLoading, authError, setAuthError,
      signup, login, loginWithGoogle, logout, resetPassword,
      isDemo: !FIREBASE_ENABLED,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
