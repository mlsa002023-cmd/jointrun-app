import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { FIREBASE_ENABLED, db, initFirebase, getAuthInstance, isFirestoreReady } from "../firebase/config";

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  updateProfile,
  sendPasswordResetEmail,
} from "firebase/auth";
import {
  doc, setDoc, getDoc, serverTimestamp,
} from "firebase/firestore";

const AuthContext = createContext(null);

// RC1.2.2 P0-3 — 최상위에서 SDK 객체를 만들지 않는다(모듈 evaluation 실패 방지).
function makeGoogleProvider() {
  return new GoogleAuthProvider();
}

async function upsertUserDoc(user) {
  if (!FIREBASE_ENABLED || !isFirestoreReady()) return;
  try {
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
  } catch (e) {
    console.warn("upsertUserDoc 실패:", e);
  }
}

const DEMO_USER = { uid: "demo", email: "demo@jointrun.app", displayName: "데모 사용자" };

// RC1.2.2 P0-2 — onAuthStateChanged가 성공도 실패도 아닌 채 계속 무응답이면(네트워크
// 차단·잘못된 Firebase 설정 등) authLoading이 영원히 true로 남아 로그인 화면조차
// 못 띄운다. 12초 안에 응답이 없으면 타임아웃으로 간주하고 명확한 오류 화면을 띄운다.
const AUTH_INIT_TIMEOUT_MS = 12000;

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [retryKey, setRetryKey] = useState(0);

  const retryAuthInit = useCallback(() => {
    setAuthError(null);
    setAuthLoading(true);
    setRetryKey((k) => k + 1);
  }, []);

  useEffect(() => {
    if (!FIREBASE_ENABLED) {
      setCurrentUser(DEMO_USER);
      setAuthLoading(false);
      return;
    }

    // RC1.2.2 P0-3 — 여기서 처음으로 Firebase를 초기화한다. 실패해도 throw되지 않으므로
    // App 모듈은 이미 정상 로드된 상태이고, 화면에는 명확한 오류 코드가 표시된다.
    const { ok, auth: authInstance, error } = initFirebase();
    if (!ok || !authInstance) {
      setAuthError(error || "firebase_init_failed");
      setAuthLoading(false);
      return;
    }

    let settled = false;
    const timeoutId = setTimeout(() => {
      if (settled) return;
      settled = true;
      console.error("[Auth] 초기화 타임아웃(12초)");
      setAuthError("connection_timeout");
      setAuthLoading(false);
    }, AUTH_INIT_TIMEOUT_MS);

    const unsubscribe = onAuthStateChanged(
      authInstance,
      (user) => {
        if (settled) return; // 타임아웃 이후 늦게 온 응답은 재시도 흐름과 겹치지 않게 무시
        settled = true;
        clearTimeout(timeoutId);
        setCurrentUser(user);
        setAuthLoading(false);
      },
      (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        console.error("[Auth] onAuthStateChanged 오류:", error);
        setAuthError("connection_error");
        setAuthLoading(false);
      }
    );

    return () => {
      clearTimeout(timeoutId);
      unsubscribe();
    };
  }, [retryKey]);

  const signup = useCallback(async (email, password, displayName) => {
    if (!FIREBASE_ENABLED) { setCurrentUser(DEMO_USER); return; }
    setAuthError(null);
    try {
      const cred = await createUserWithEmailAndPassword(getAuthInstance(), email, password);
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
      const cred = await signInWithEmailAndPassword(getAuthInstance(), email, password);
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
      const cred = await signInWithPopup(getAuthInstance(), makeGoogleProvider());
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
    try { await signOut(getAuthInstance()); } catch (e) { console.warn("logout 실패:", e); }
  }, []);

  const resetPassword = useCallback(async (email) => {
    if (!FIREBASE_ENABLED) return;
    setAuthError(null);
    try {
      await sendPasswordResetEmail(getAuthInstance(), email);
    } catch (e) {
      setAuthError(e.message);
      throw e;
    }
  }, []);

  return (
    <AuthContext.Provider value={{
      currentUser, authLoading, authError, setAuthError, retryAuthInit,
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
