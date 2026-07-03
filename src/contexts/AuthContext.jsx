// src/contexts/AuthContext.jsx
// Firebase Authentication을 앱 전역에서 쓸 수 있게 감싸는 Context.
// JOINTRUNUnified 앱을 <AuthProvider> 로 감싸고, useAuth() 훅으로 currentUser / login / signup / logout 을 사용합니다.

import { createContext, useContext, useEffect, useState, useCallback } from "react";
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
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase/config";

const AuthContext = createContext(null);
const googleProvider = new GoogleAuthProvider();

// users/{uid} 문서가 없으면 생성, 있으면 마지막 로그인 시각만 갱신
async function upsertUserDoc(user) {
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

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setAuthLoading(false);
    });
    return unsubscribe;
  }, []);

  // 회원가입: Auth 계정 생성 + users/{uid} 문서 초기화
  const signup = useCallback(async (email, password, displayName) => {
    setAuthError(null);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      if (displayName) {
        await updateProfile(cred.user, { displayName });
      }
      await upsertUserDoc(cred.user);
      return cred.user;
    } catch (err) {
      setAuthError(mapAuthError(err.code));
      throw err;
    }
  }, []);

  const login = useCallback(async (email, password) => {
    setAuthError(null);
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      await upsertUserDoc(cred.user);
      return cred.user;
    } catch (err) {
      setAuthError(mapAuthError(err.code));
      throw err;
    }
  }, []);

  const loginWithGoogle = useCallback(async () => {
    setAuthError(null);
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      await upsertUserDoc(cred.user);
      return cred.user;
    } catch (err) {
      if (err.code !== "auth/popup-closed-by-user") {
        setAuthError(mapAuthError(err.code));
      }
      throw err;
    }
  }, []);

  const logout = useCallback(async () => {
    await signOut(auth);
  }, []);

  const resetPassword = useCallback(async (email) => {
    setAuthError(null);
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (err) {
      setAuthError(mapAuthError(err.code));
      throw err;
    }
  }, []);

  const value = { currentUser, authLoading, authError, setAuthError, signup, login, loginWithGoogle, logout, resetPassword };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth는 AuthProvider 내부에서만 사용할 수 있습니다.");
  return ctx;
}

// Firebase 에러 코드를 한국어 안내 메시지로 변환
function mapAuthError(code) {
  switch (code) {
    case "auth/email-already-in-use": return "이미 가입된 이메일입니다.";
    case "auth/invalid-email": return "이메일 형식이 올바르지 않습니다.";
    case "auth/weak-password": return "비밀번호는 6자 이상이어야 합니다.";
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential": return "이메일 또는 비밀번호가 올바르지 않습니다.";
    case "auth/too-many-requests": return "잠시 후 다시 시도해 주세요.";
    case "auth/popup-blocked": return "팝업이 차단되었습니다. 브라우저 팝업 차단을 해제해 주세요.";
    case "auth/account-exists-with-different-credential": return "이미 다른 로그인 방식으로 가입된 이메일입니다.";
    default: return "요청 처리 중 오류가 발생했습니다.";
  }
}
