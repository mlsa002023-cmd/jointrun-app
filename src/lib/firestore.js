import { FIREBASE_ENABLED, db } from "../firebase/config";
import {
  collection, addDoc, getDocs, query, orderBy, limit,
  doc, setDoc, getDoc, serverTimestamp,
} from "firebase/firestore";

export async function saveScanResult(uid, scanData) {
  if (!uid || !FIREBASE_ENABLED || !db) return null;
  try {
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
  } catch (e) {
    console.warn("saveScanResult 실패:", e);
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
