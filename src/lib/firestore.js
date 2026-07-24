import { FIREBASE_ENABLED, db } from "../firebase/config";
import {
  collection, addDoc, getDocs, query, orderBy, limit,
  doc, setDoc, getDoc, serverTimestamp,
} from "firebase/firestore";
import { EVENT_SCHEMA_VERSION } from "./eventTypes";

// 문서 구조(raw/metrics/scores/habit 계층 분리) 자체의 버전 — 점수 산출 알고리즘 버전(scoreVersion)과는 별개 개념.
// 계층 구조나 필드 이름이 바뀌면 이 값을 올린다.
export const SCHEMA_VERSION = "v1.0";

/**
 * 스캔 결과를 raw(landmark 원본) / metrics(각도·편위) / scores(하위점수+근거) 3계층으로 나눠 저장한다.
 *   users/{uid}/scans/{scanId}            — schemaVersion, metrics, scores만 (목록 조회 시 가벼움)
 *   users/{uid}/scans/{scanId}/raw/frames — 포즈별 원본 landmark 프레임 (getScanHistory는 여기를 안 건드림)
 */
export async function saveScanRecord(uid, { metrics, scores, rawFrames, recommendation }) {
  if (!FIREBASE_ENABLED || !db) {
    console.warn("⚠️ 데모 모드 - 저장되지 않음 (saveScanRecord)");
    return null;
  }
  if (!uid) return null;
  try {
    const ref = await addDoc(collection(db, "users", uid, "scans"), {
      schemaVersion: SCHEMA_VERSION,
      metrics: metrics ?? null,
      scores: scores ?? null,
      recommendation: recommendation ?? "",
      createdAt: serverTimestamp(),
    });
    if (rawFrames) {
      await addDoc(collection(db, "users", uid, "scans", ref.id, "raw"), {
        schemaVersion: SCHEMA_VERSION,
        frames: rawFrames,
        createdAt: serverTimestamp(),
      });
    }
    return ref.id;
  } catch (e) {
    // 실제 저장 실패는 삼키지 않고 호출부로 전파한다 — 완료 화면의 "다음 단계로" 저장
    // 게이트가 성공/실패를 구분해야 하기 때문(P0 UX: 저장 성공 전 홈 이동 불가).
    console.warn("saveScanRecord 실패:", e);
    throw e;
  }
}

export async function getScanHistory(uid, count = 14) {
  if (!uid || !FIREBASE_ENABLED || !db) return [];
  try {
    const q = query(
      collection(db, "users", uid, "scans"),
      orderBy("createdAt", "desc"),
      limit(count)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.warn("getScanHistory 실패:", e);
    return [];
  }
}

export async function saveCheckIn(uid, data) {
  if (!uid || !FIREBASE_ENABLED || !db) return null;
  try {
    const ref = await addDoc(collection(db, "users", uid, "checkins"), {
      ...data, createdAt: serverTimestamp(),
    });
    return ref.id;
  } catch (e) {
    console.warn("saveCheckIn 실패:", e);
    return null;
  }
}

/** 붓기/피로도 필드를 담고 있는 가장 최근 체크인을 찾는다 (회복 미션 체크인은 이 필드가 없어 걸러진다). */
export async function getLatestConditionCheckIn(uid) {
  if (!uid || !FIREBASE_ENABLED || !db) return null;
  try {
    const q = query(
      collection(db, "users", uid, "checkins"),
      orderBy("createdAt", "desc"),
      limit(20)
    );
    const snap = await getDocs(q);
    const found = snap.docs.find(d => {
      const data = d.data();
      return data.swellingLevel != null || data.fatigueLevel != null;
    });
    return found ? { id: found.id, ...found.data() } : null;
  } catch (e) {
    console.warn("getLatestConditionCheckIn 실패:", e);
    return null;
  }
}

/**
 * Habit Score(Consistency/Streak) 계산용 활동일 기록. scans/checkins와는 별도 계층(users/{uid}/habit/current).
 * 최근 30개 날짜 키만 유지 — Streak/Consistency 계산에 그 이상은 필요 없다.
 */
export async function recordHabitActivity(uid, dateKey) {
  if (!uid || !FIREBASE_ENABLED || !db) return;
  try {
    const ref = doc(db, "users", uid, "habit", "current");
    const snap = await getDoc(ref);
    const prevDays = snap.exists() ? (snap.data().activeDays ?? []) : [];
    if (prevDays.includes(dateKey)) return;
    const nextDays = [...prevDays, dateKey].slice(-30);
    await setDoc(ref, { schemaVersion: SCHEMA_VERSION, activeDays: nextDays, updatedAt: serverTimestamp() }, { merge: true });
  } catch (e) {
    console.warn("recordHabitActivity 실패:", e);
  }
}

export async function getHabitActivity(uid) {
  if (!uid || !FIREBASE_ENABLED || !db) return [];
  try {
    const snap = await getDoc(doc(db, "users", uid, "habit", "current"));
    return snap.exists() ? (snap.data().activeDays ?? []) : [];
  } catch (e) {
    console.warn("getHabitActivity 실패:", e);
    return [];
  }
}

// ─────────────────────────────────────────────
// events (Event Marker) — 오프라인 큐잉: Firestore 쓰기 실패 시(오프라인 포함)
// localStorage에 쌓아두고, 재연결 시 flushPendingEvents로 순서대로 재전송한다.
// ─────────────────────────────────────────────
const EVENTS_QUEUE_KEY = "jointrun_pending_events";

function loadEventQueue() {
  try { return JSON.parse(localStorage.getItem(EVENTS_QUEUE_KEY) || "[]"); } catch { return []; }
}
function saveEventQueue(queueItems) {
  try { localStorage.setItem(EVENTS_QUEUE_KEY, JSON.stringify(queueItems)); } catch { /* localStorage 사용 불가 시 조용히 무시 */ }
}
function queueOfflineEvent(uid, record) {
  saveEventQueue([...loadEventQueue(), { uid, record, queuedAt: new Date().toISOString() }]);
}

export async function saveEvent(uid, { type, label, memo, timestamp }) {
  if (!uid) return null;
  const record = {
    type, label,
    memo: memo?.trim() || null,
    timestamp: (timestamp instanceof Date ? timestamp : new Date()).toISOString(),
    schemaVersion: EVENT_SCHEMA_VERSION,
  };
  if (!FIREBASE_ENABLED || !db || (typeof navigator !== "undefined" && !navigator.onLine)) {
    queueOfflineEvent(uid, record);
    return null;
  }
  try {
    const ref = await addDoc(collection(db, "users", uid, "events"), {
      ...record, timestamp: new Date(record.timestamp), createdAt: serverTimestamp(),
    });
    return ref.id;
  } catch (e) {
    console.warn("saveEvent 실패 - 오프라인 큐에 저장:", e);
    queueOfflineEvent(uid, record);
    return null;
  }
}

/** 재연결 시(온라인 이벤트, 앱 재진입 등) 큐에 쌓인 이벤트를 순서대로 재전송한다. */
export async function flushPendingEvents() {
  if (!FIREBASE_ENABLED || !db || (typeof navigator !== "undefined" && !navigator.onLine)) return;
  const queueItems = loadEventQueue();
  if (!queueItems.length) return;
  const stillPending = [];
  for (const item of queueItems) {
    try {
      await addDoc(collection(db, "users", item.uid, "events"), {
        type: item.record.type, label: item.record.label, memo: item.record.memo,
        timestamp: new Date(item.record.timestamp), schemaVersion: item.record.schemaVersion,
        createdAt: serverTimestamp(),
      });
    } catch (e) {
      stillPending.push(item);
    }
  }
  saveEventQueue(stillPending);
}

export async function getEventHistory(uid, count = 30) {
  if (!uid || !FIREBASE_ENABLED || !db) return [];
  try {
    const q = query(
      collection(db, "users", uid, "events"),
      orderBy("timestamp", "desc"),
      limit(count)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.warn("getEventHistory 실패:", e);
    return [];
  }
}

export async function saveProfileSnapshot(uid, profile) {
  if (!uid || !FIREBASE_ENABLED || !db) return;
  try {
    await setDoc(
      doc(db, "users", uid, "profile", "current"),
      { ...profile, updatedAt: serverTimestamp() },
      { merge: true }
    );
  } catch (e) {
    console.warn("saveProfileSnapshot 실패:", e);
  }
}

export async function getProfileSnapshot(uid) {
  if (!uid || !FIREBASE_ENABLED || !db) return null;
  try {
    const snap = await getDoc(doc(db, "users", uid, "profile", "current"));
    return snap.exists() ? snap.data() : null;
  } catch (e) {
    console.warn("getProfileSnapshot 실패:", e);
    return null;
  }
}
