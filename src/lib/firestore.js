// src/lib/firestore.js
// Firestore 데이터 구조:
//   users/{uid}                              - 기본 프로필
//   users/{uid}/scans/{scanId}                - 정밀 스캔(HandScanEngine) 결과
//   users/{uid}/checkins/{checkinId}          - 통증/일일 체크인
//   users/{uid}/profile/current               - 현재 Finger Score 등 최신 지표 스냅샷

import {
  doc, collection, addDoc, setDoc, getDoc, getDocs,
  query, orderBy, limit, serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase/config";

// ── 스캔 결과 저장 (HandScanEngine 완료 시 호출) ──────────────────────
export async function saveScanResult(uid, scanData) {
  if (!uid) return null;
  const ref = await addDoc(collection(db, "users", uid, "scans"), {
    romDeg: scanData.romDeg ?? null,
    stiffnessMin: scanData.stiffnessMin ?? null,
    painIndex: scanData.painIndex ?? null,
    fingers: scanData.fingers ?? null,
    avgScore: scanData.avgScore ?? null,
    recommendation: scanData.recommendation ?? "",
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function getScanHistory(uid, count = 14) {
  if (!uid) return [];
  const q = query(collection(db, "users", uid, "scans"), orderBy("createdAt", "desc"), limit(count));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// ── 통증/일일 체크인 저장 (회복 스텝 완료, 통증 기록 등) ──────────────
export async function saveCheckIn(uid, checkinData) {
  if (!uid) return null;
  const ref = await addDoc(collection(db, "users", uid, "checkins"), {
    painIndex: checkinData.painIndex ?? null,
    morningStiffnessMin: checkinData.morningStiffnessMin ?? null,
    note: checkinData.note ?? "",
    stepId: checkinData.stepId ?? null,
    stepLabel: checkinData.stepLabel ?? "",
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function getCheckInHistory(uid, count = 30) {
  if (!uid) return [];
  const q = query(collection(db, "users", uid, "checkins"), orderBy("createdAt", "desc"), limit(count));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// ── 최신 프로필 지표 스냅샷 (Finger Score 등) ──────────────────────────
export async function saveProfileSnapshot(uid, profile) {
  if (!uid) return;
  await setDoc(
    doc(db, "users", uid, "profile", "current"),
    { ...profile, updatedAt: serverTimestamp() },
    { merge: true }
  );
}

export async function getProfileSnapshot(uid) {
  if (!uid) return null;
  const snap = await getDoc(doc(db, "users", uid, "profile", "current"));
  return snap.exists() ? snap.data() : null;
}
