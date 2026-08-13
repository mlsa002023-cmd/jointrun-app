import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { FIREBASE_ENABLED, db, initFirebase, getAuthInstance, isFirestoreReady } from "../firebase/config";

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  setPersistence,
  browserLocalPersistence,
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
  const provider = new GoogleAuthProvider();
  // 계정이 여러 개인 기기에서 이전 선택이 자동 적용되지 않고 항상 계정 선택 화면이 뜨게 한다.
  provider.setCustomParameters({ prompt: "select_account" });
  return provider;
}

// RC1.2.2 P0-5 — popup은 완료 신호가 오지 않아도 promise가 영원히 pending으로 남을 수 있다
// (Safari/WebKit ITP가 authDomain iframe의 스토리지 접근을 막으면 실제로 이 상태가 된다).
// 그 경우 사용자는 "팝업은 닫혔는데 앱은 로그인 화면 그대로"를 보게 되므로, 일정 시간이
// 지나면 popup을 포기하고 redirect 방식으로 전환한다.
const POPUP_RESULT_TIMEOUT_MS = 20000;

/** WebKit(iOS Safari 포함)·모바일 여부 — 이 조합은 popup 핸드셰이크가 자주 실패한다. */
function prefersRedirectFlow() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const isWebKit = /AppleWebKit/.test(ua) && !/Chrome|Chromium|Edg/.test(ua);
  const isSmallScreen = typeof window !== "undefined" && window.innerWidth < 768;
  return isIOS || isWebKit || isSmallScreen;
}

/** Firebase 오류를 사용자에게 보여도 안전한 코드로 정규화한다(원문 message는 쓰지 않는다). */
export function normalizeAuthErrorCode(error) {
  const code = error?.code || "";
  if (code === "auth/popup-blocked") return "popup_blocked";
  if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") return "popup_closed";
  if (code === "auth/unauthorized-domain") return "unauthorized_domain";
  if (code === "auth/account-exists-with-different-credential") return "account_exists_with_different_credential";
  if (code === "auth/network-request-failed") return "network_request_failed";
  if (code === "popup_result_timeout") return "popup_result_timeout";
  if (code === "redirect_result_failed") return "redirect_result_failed";
  // 이메일/비밀번호 경로
  if (code === "auth/invalid-email") return "invalid_email";
  if (code === "auth/weak-password") return "weak_password";
  if (code === "auth/email-already-in-use") return "email_already_in_use";
  if (code === "auth/wrong-password" || code === "auth/user-not-found" || code === "auth/invalid-credential") {
    return "invalid_credentials";
  }
  if (code === "auth/too-many-requests") return "too_many_requests";
  return "signin_failed";
}

/** 진단 코드 → 사용자 화면 문구. 원인을 숨기지 않되 기술 용어와 원문은 노출하지 않는다. */
export const AUTH_ERROR_MESSAGES = {
  popup_blocked: "브라우저가 로그인 창을 차단했습니다. 차단을 해제한 뒤 다시 시도해 주세요.",
  popup_closed: "로그인 창이 닫혔습니다. 다시 시도해 주세요.",
  popup_result_timeout: "로그인 창에서 응답이 오지 않아 다른 방식으로 다시 시도합니다.",
  redirect_result_failed: "로그인 결과를 확인하지 못했습니다. 다시 시도해 주세요.",
  unauthorized_domain: "이 주소에서는 로그인이 허용되어 있지 않습니다. 관리자에게 문의해 주세요.",
  account_exists_with_different_credential: "같은 이메일로 다른 방식의 계정이 이미 있습니다. 이메일 로그인을 사용해 주세요.",
  network_request_failed: "네트워크 연결을 확인한 뒤 다시 시도해 주세요.",
  signin_failed: "로그인을 완료하지 못했습니다. 다시 시도해 주세요.",
  invalid_email: "이메일 주소 형식을 확인해 주세요.",
  weak_password: "비밀번호는 6자 이상으로 정해 주세요.",
  email_already_in_use: "이미 가입된 이메일입니다. 로그인을 이용해 주세요.",
  invalid_credentials: "이메일 또는 비밀번호가 올바르지 않습니다.",
  too_many_requests: "시도가 많아 잠시 제한되었습니다. 잠시 후 다시 시도해 주세요.",
  connection_timeout: "서버 연결이 지연되고 있습니다.",
  connection_error: "서버에 연결하지 못했습니다.",
  firebase_init_failed: "서버 설정을 확인하지 못했습니다.",
};

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

    // RC1.2.2 P0-5 — initialResolved는 "첫 응답이 왔는가"만 판단한다. 예전에는 이 플래그
    // 하나로 구독 전체를 잠가서, 최초 null 응답 이후에 오는 로그인 성공 이벤트까지 무시했다.
    // 그래서 Google 계정을 선택해 로그인이 실제로 성사돼도 currentUser가 갱신되지 않고
    // 앱이 로그인 화면에 그대로 머물렀다. 이제 이후 상태 변화는 항상 반영한다.
    let initialResolved = false;
    const timeoutId = setTimeout(() => {
      if (initialResolved) return;
      initialResolved = true;
      console.error("[Auth] 초기화 타임아웃(12초)");
      setAuthError("connection_timeout");
      setAuthLoading(false);
    }, AUTH_INIT_TIMEOUT_MS);

    // RC1.2.2 P0-6 — 순서가 중요하다.
    //   1) persistence를 먼저 확정한다. redirect로 돌아온 자격증명은 이 저장소에서
    //      복원되므로, 설정이 끝나기 전에 getRedirectResult를 부르면 결과를 놓칠 수 있다.
    //   2) 그 다음 getRedirectResult로 redirect 로그인 결과를 회수한다.
    //   3) 마지막으로 onAuthStateChanged를 구독한다.
    let unsubscribe = () => {};
    let disposed = false;

    (async () => {
      try {
        await setPersistence(authInstance, browserLocalPersistence);
      } catch (e) {
        // 저장소를 쓸 수 없는 환경(사파리 비공개 모드 등)에서도 로그인 자체는 계속 시도한다.
        console.warn("[Auth] persistence 설정 실패:", e?.code || e?.name);
      }
      if (disposed) return;

      try {
        const result = await getRedirectResult(authInstance);
        if (!disposed && result?.user) {
          initialResolved = true;
          clearTimeout(timeoutId);
          setCurrentUser(result.user);
          setAuthError(null);
          setAuthLoading(false);
          await upsertUserDoc(result.user);
        }
      } catch (e) {
        console.error("[Auth] redirect 결과 처리 실패:", e?.code || e?.name);
        if (!disposed) setAuthError("redirect_result_failed");
      }
      if (disposed) return;

      unsubscribe = onAuthStateChanged(
        authInstance,
        (user) => {
          if (!initialResolved) {
            initialResolved = true;
            clearTimeout(timeoutId);
          }
          setCurrentUser(user);
          setAuthLoading(false);
          if (user) setAuthError(null); // 로그인에 성공하면 이전 오류 안내를 지운다
        },
        (error) => {
          if (!initialResolved) {
            initialResolved = true;
            clearTimeout(timeoutId);
          }
          console.error("[Auth] onAuthStateChanged 오류:", error?.code || error?.name);
          setAuthError("connection_error");
          setAuthLoading(false);
        }
      );
    })();

    return () => {
      disposed = true;
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
      setAuthError(normalizeAuthErrorCode(e));
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
      setAuthError(normalizeAuthErrorCode(e));
      throw e;
    }
  }, []);

  const loginWithGoogle = useCallback(async () => {
    if (!FIREBASE_ENABLED) { setCurrentUser(DEMO_USER); return; }
    setAuthError(null);

    const authInstance = getAuthInstance();
    if (!authInstance) { setAuthError("firebase_init_failed"); return; }

    const provider = makeGoogleProvider();

    // 모바일·WebKit에서는 popup 핸드셰이크가 자주 완료되지 않으므로 처음부터 redirect를 쓴다.
    if (prefersRedirectFlow()) {
      try {
        await signInWithRedirect(authInstance, provider);
      } catch (e) {
        console.error("[Auth] redirect 시작 실패:", e?.code || e?.name);
        setAuthError(normalizeAuthErrorCode(e));
      }
      return; // 페이지가 이동하므로 이후 코드는 실행되지 않는다
    }

    // 데스크톱: popup 우선. 단, 결과가 오지 않는 상태로 매달려 있지 않도록 타임아웃을 건다.
    try {
      const timeout = new Promise((_, reject) => {
        setTimeout(() => {
          const err = new Error("popup result timeout");
          err.code = "popup_result_timeout";
          reject(err);
        }, POPUP_RESULT_TIMEOUT_MS);
      });
      const cred = await Promise.race([signInWithPopup(authInstance, provider), timeout]);
      if (cred?.user) await upsertUserDoc(cred.user);
      return;
    } catch (e) {
      const code = normalizeAuthErrorCode(e);

      // 사용자가 직접 창을 닫은 경우는 오류로 소란스럽게 알리지 않는다.
      if (code === "popup_closed") { setAuthError(code); return; }

      // popup이 막혔거나 결과가 오지 않았다면 조용히 실패하지 않고 redirect로 이어간다.
      if (code === "popup_blocked" || code === "popup_result_timeout" || code === "signin_failed") {
        setAuthError(code);
        try {
          await signInWithRedirect(authInstance, provider);
          return;
        } catch (e2) {
          console.error("[Auth] popup 실패 후 redirect도 실패:", e2?.code || e2?.name);
          setAuthError(normalizeAuthErrorCode(e2));
          return;
        }
      }

      console.error("[Auth] Google 로그인 실패:", e?.code || e?.name);
      setAuthError(code);
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
      setAuthError(normalizeAuthErrorCode(e));
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
