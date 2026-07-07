import { FIREBASE_ENABLED, db } from "../firebase/config";
import {
  collection, addDoc, getDocs, query, orderBy, limit,
  doc, setDoc, getDoc, serverTimestamp,
} from "firebase/firestore";

/**
 * 스캔 결과를 raw(landmark 원본) / metrics(각도·편위) / scores(하위점수+근거) 3계층으로 나눠 저장한다.
 *   users/{uid}/scans/{scanId}            — metrics, scores만 (목록 조회 시 가벼움)
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
      metrics: metrics ?? null,
      scores: scores ?? null,
      recommendation: recommendation ?? "",
      createdAt: serverTimestamp(),
    });
    if (rawFrames) {
      await addDoc(collection(db, "users", uid, "scans", ref.id, "raw"), {
        frames: rawFrames,
        createdAt: serverTimestamp(),
      });
    }
    return ref.id;
  } catch (e) {
    console.warn("saveScanRecord 실패:", e);
    return null;
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
    await setDoc(ref, { activeDays: nextDays, updatedAt: serverTimestamp() }, { merge: true });
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
