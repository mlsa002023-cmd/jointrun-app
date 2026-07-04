// src/lib/firestore.js
// Firestore 읽기/쓰기 — Firebase 없을 때 조용히 no-op 처리

import { FIREBASE_ENABLED, db } from "../firebase/config";

async function getFirestoreFns() {
  if (!FIREBASE_ENABLED || !db) return {};
  return import("firebase/firestore").catch(() => ({}));
}

export async function saveScanResult(uid, scanData) {
  if (!uid || !FIREBASE_ENABLED) return null;
  const { collection, addDoc, serverTimestamp } = await getFirestoreFns();
  if (!addDoc) return null;
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
  if (!uid || !FIREBASE_ENABLED) return [];
  const { collection, query, orderBy, limit, getDocs } = await getFirestoreFns();
  if (!getDocs) return [];
  const q = query(collection(db, "users", uid, "scans"), orderBy("createdAt", "desc"), limit(count));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function saveCheckIn(uid, data) {
  if (!uid || !FIREBASE_ENABLED) return null;
  const { collection, addDoc, serverTimestamp } = await getFirestoreFns();
  if (!addDoc) return null;
  const ref = await addDoc(collection(db, "users", uid, "checkins"), {
    ...data, createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function saveProfileSnapshot(uid, profile) {
  if (!uid || !FIREBASE_ENABLED) return;
  const { doc, setDoc, serverTimestamp } = await getFirestoreFns();
  if (!setDoc) return;
  await setDoc(doc(db, "users", uid, "profile", "current"), {
    ...profile, updatedAt: serverTimestamp(),
  }, { merge: true });
}

export async function getProfileSnapshot(uid) {
  if (!uid || !FIREBASE_ENABLED) return null;
  const { doc, getDoc } = await getFirestoreFns();
  if (!getDoc) return null;
  const snap = await getDoc(doc(db, "users", uid, "profile", "current"));
  return snap.exists() ? snap.data() : null;
}
