// src/firebase/config.js
// Firebase 초기화 — RC1.2.2 P0-3부터 "지연 + 방어" 초기화다.
//
// 왜 lazy인가: 예전에는 모듈 최상위에서 getAuth()를 호출했는데, 환경변수의 apiKey가
// 잘못돼 있으면 그 자리에서 FirebaseError(auth/invalid-api-key)가 throw됐다. 이 모듈은
// App.jsx가 import하는 트리 안에 있어서, throw가 App 모듈 evaluation 전체를 실패시키고
// 사용자에게는 원인을 알 수 없는 백색 화면만 남았다(실기기 Safari에서 재현 확인).
// 이제 초기화는 initFirebase() 안에서만, try/catch로 일어난다 — 실패해도 모듈 import는
// 성공하므로 앱은 뜨고, 화면에는 명확한 연결 오류가 표시된다.

import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// 환경변수를 읽기만 하는 것은 SDK를 건드리지 않으므로 최상위에서도 안전하다.
const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY            || "",
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN        || "",
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID         || "",
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET     || "",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  appId:             import.meta.env.VITE_FIREBASE_APP_ID             || "",
};

// projectId·apiKey가 모두 있어야 실제 Firebase를 쓴다. 하나라도 비면 데모 모드로 운영한다
// (환경변수를 아직 넣지 않은 로컬/테스트 환경에서 앱이 죽지 않게 하는 기존 동작 유지).
export const FIREBASE_ENABLED = Boolean(firebaseConfig.projectId && firebaseConfig.apiKey);

// 라이브 바인딩 — initFirebase() 성공 후 값이 채워지고, 이 모듈을 import한 쪽에서도
// 갱신된 값이 그대로 보인다.
let app = null;
let auth = null;
let db = null;

let initialized = false;   // 같은 초기화를 두 번 하지 않는다
let initError = null;      // 안전하게 정리한 오류 코드(원문 stack·apiKey는 담지 않는다)

/**
 * Firebase를 초기화한다. 여러 번 불러도 실제 초기화는 한 번만 일어난다.
 * @returns {{ ok: boolean, auth: object|null, db: object|null, error: string|null }}
 *          error는 사용자에게 보여도 안전한 코드 문자열이다(원문 message·key 미포함).
 */
export function initFirebase() {
  if (initialized) return { ok: !initError, auth, db, error: initError };
  initialized = true;

  if (!FIREBASE_ENABLED) {
    // 설정 자체가 없는 경우는 오류가 아니라 데모 모드다.
    return { ok: false, auth: null, db: null, error: null };
  }

  try {
    app = getApps().length ? getApp() : initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    return { ok: true, auth, db, error: null };
  } catch (e) {
    // 콘솔에는 진단에 필요한 만큼만 남긴다 — apiKey 원문이나 stack은 남기지 않는다.
    console.error("[Firebase] 초기화 실패:", e?.name, e?.code || "(코드 없음)");
    app = null;
    auth = null;
    db = null;
    initError = "firebase_init_failed";
    return { ok: false, auth: null, db: null, error: initError };
  }
}

/** 초기화가 아직이면 초기화한 뒤 auth를 돌려준다(실패 시 null). */
export function getAuthInstance() {
  if (!initialized) initFirebase();
  return auth;
}

/** 초기화가 아직이면 초기화한 뒤 db를 돌려준다(실패 시 null). */
export function getDb() {
  if (!initialized) initFirebase();
  return db;
}

/** 실제 Firestore를 쓸 수 있는 상태인지 — 데모 스토어 분기용. */
export function isFirestoreReady() {
  return Boolean(getDb());
}

export { auth, db };
export default app;
