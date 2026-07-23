// ─────────────────────────────────────────────
// firestoreV9
// V9 Decision Loop(트리거→기준선→재확인→비교) 데이터 계층 — 05_DATA_ANALYTICS_SPEC.md 기준.
//
// 컬렉션 경로(스펙 대비 변경): users/{uid}/v9Events/{eventId} (+ captures/rechecks/comparisons 하위 컬렉션)
// 스펙 원문은 "events"지만, 이 저장소에는 이미 다른 뜻의 users/{uid}/events(Event Marker,
// src/lib/eventTypes.js)가 있어 그대로 쓰면 문서 스키마가 섞인다. v9Events로 분리해 기존 데이터를
// 건드리지 않는다 — docs/V9_ALIGNMENT_GAP.md, docs/v9-spec/05_DATA_ANALYTICS_SPEC.md 참고.
//
// SymptomSnapshot은 스펙상 별도 엔터티지만 항상 하나의 Capture와 1:1이라, 여기서는 캡처 문서의
// symptomSnapshot 필드로 저장한다(하위 컬렉션을 따로 만들지 않음 — 과설계 방지).
// ─────────────────────────────────────────────

import { FIREBASE_ENABLED, db } from "../firebase/config";
import {
  collection, addDoc, getDocs, getDoc, doc, updateDoc,
  query, orderBy, limit, serverTimestamp,
} from "firebase/firestore";
import {
  V9_SCHEMA_VERSION, CAPTURE_PROTOCOL_VERSION, ALGORITHM_VERSION,
  EVENT_STATUS, RECHECK_STATUS, RECHECK_DUE_TYPE,
} from "./v9EventTypes";
import { computeRecheckDueDates } from "./recheckSchedule";

const APP_VERSION = "1.0.0";

function eventsCol(uid) {
  return collection(db, "users", uid, "v9Events");
}
function eventDoc(uid, eventId) {
  return doc(db, "users", uid, "v9Events", eventId);
}
function capturesCol(uid, eventId) {
  return collection(db, "users", uid, "v9Events", eventId, "captures");
}
function rechecksCol(uid, eventId) {
  return collection(db, "users", uid, "v9Events", eventId, "rechecks");
}
function comparisonsCol(uid, eventId) {
  return collection(db, "users", uid, "v9Events", eventId, "comparisons");
}

/** S02 — 트리거 선택 시점에 Event를 만든다. */
export async function createV9Event(uid, { primaryTrigger, secondaryTriggers = [], contextNote = "" }) {
  if (!uid || !FIREBASE_ENABLED || !db) return null;
  const ref = await addDoc(eventsCol(uid), {
    schemaVersion: V9_SCHEMA_VERSION,
    primaryTrigger,
    secondaryTriggers,
    contextNote: contextNote?.trim() || null,
    status: EVENT_STATUS.DRAFT,
    baselineCaptureId: null,
    nextRecheckDueAt: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateV9EventStatus(uid, eventId, status) {
  if (!uid || !eventId || !FIREBASE_ENABLED || !db) return;
  await updateDoc(eventDoc(uid, eventId), { status, updatedAt: serverTimestamp() });
}

/** S04 — 촬영 1건을 저장한다(baseline 또는 recheck). 원본 이미지는 저장하지 않는다(landmark/품질값만). */
export async function saveCapture(uid, eventId, { type, handSide, qualityStatus, qualityFlags, landmarksRef, symptomSnapshot }) {
  if (!uid || !eventId || !FIREBASE_ENABLED || !db) return null;
  const ref = await addDoc(capturesCol(uid, eventId), {
    schemaVersion: V9_SCHEMA_VERSION,
    type,
    handSide: handSide ?? null,
    qualityStatus,
    qualityFlags: qualityFlags ?? [],
    landmarksRef: landmarksRef ?? null,
    symptomSnapshot: symptomSnapshot ?? null,
    captureProtocolVersion: CAPTURE_PROTOCOL_VERSION,
    algorithmVersion: ALGORITHM_VERSION,
    appVersion: APP_VERSION,
    capturedAt: serverTimestamp(),
  });
  return ref.id;
}

/** S06 — 첫 기준선 확정: Event 상태를 갱신하고 2주·4주 재확인을 예약한다. */
export async function markBaselineCreated(uid, eventId, captureId, baselineCapturedAt = new Date()) {
  if (!uid || !eventId || !FIREBASE_ENABLED || !db) return null;
  const { week2DueAt, week4DueAt } = computeRecheckDueDates(baselineCapturedAt);

  await updateDoc(eventDoc(uid, eventId), {
    status: EVENT_STATUS.BASELINE_CREATED,
    baselineCaptureId: captureId,
    nextRecheckDueAt: week2DueAt,
    updatedAt: serverTimestamp(),
  });

  const week2Ref = await addDoc(rechecksCol(uid, eventId), {
    schemaVersion: V9_SCHEMA_VERSION,
    dueType: RECHECK_DUE_TYPE.WEEK2,
    dueAt: week2DueAt,
    status: RECHECK_STATUS.SCHEDULED,
    captureId: null,
    completedAt: null,
  });
  const week4Ref = await addDoc(rechecksCol(uid, eventId), {
    schemaVersion: V9_SCHEMA_VERSION,
    dueType: RECHECK_DUE_TYPE.WEEK4,
    dueAt: week4DueAt,
    status: RECHECK_STATUS.SCHEDULED,
    captureId: null,
    completedAt: null,
  });

  return { week2Id: week2Ref.id, week4Id: week4Ref.id, week2DueAt, week4DueAt };
}

/** S08 — 재확인 완료 처리. */
export async function completeRecheck(uid, eventId, recheckId, captureId) {
  if (!uid || !eventId || !recheckId || !FIREBASE_ENABLED || !db) return;
  await updateDoc(doc(db, "users", uid, "v9Events", eventId, "rechecks", recheckId), {
    status: RECHECK_STATUS.COMPLETED,
    captureId,
    completedAt: serverTimestamp(),
  });
  await updateDoc(eventDoc(uid, eventId), { status: EVENT_STATUS.RECHECKED, updatedAt: serverTimestamp() });
}

export async function skipRecheck(uid, eventId, recheckId) {
  if (!uid || !eventId || !recheckId || !FIREBASE_ENABLED || !db) return;
  await updateDoc(doc(db, "users", uid, "v9Events", eventId, "rechecks", recheckId), {
    status: RECHECK_STATUS.SKIPPED,
  });
}

/** S09 — 기준선/현재 비교 결과 저장. */
export async function saveComparison(uid, eventId, { baselineCaptureId, currentCaptureId, comparable, nonComparableReasons, userPerceivedChange }) {
  if (!uid || !eventId || !FIREBASE_ENABLED || !db) return null;
  const ref = await addDoc(comparisonsCol(uid, eventId), {
    schemaVersion: V9_SCHEMA_VERSION,
    baselineCaptureId,
    currentCaptureId,
    comparable,
    nonComparableReasons: nonComparableReasons ?? [],
    userPerceivedChange: userPerceivedChange ?? null,
    viewedAt: serverTimestamp(),
  });
  await updateDoc(eventDoc(uid, eventId), { status: EVENT_STATUS.COMPARED, updatedAt: serverTimestamp() });
  return ref.id;
}

export async function getCapture(uid, eventId, captureId) {
  if (!uid || !eventId || !captureId || !FIREBASE_ENABLED || !db) return null;
  const snap = await getDoc(doc(db, "users", uid, "v9Events", eventId, "captures", captureId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/**
 * 홈 카드(S07)·재확인 화면용 — 아직 끝나지 않은(completed/abandoned/deleted가 아닌) 가장 최근 Event를
 * rechecks까지 함께 불러온다. 여러 개를 동시에 진행하지 않는다는 전제(한 번에 하나의 판단 루프)로 1건만 본다.
 */
export async function getActiveV9Event(uid) {
  if (!uid || !FIREBASE_ENABLED || !db) return null;
  const q = query(eventsCol(uid), orderBy("createdAt", "desc"), limit(5));
  const snap = await getDocs(q);
  const openStatuses = new Set([
    EVENT_STATUS.DRAFT, EVENT_STATUS.CAPTURE_STARTED, EVENT_STATUS.CAPTURED,
    EVENT_STATUS.BASELINE_CREATED, EVENT_STATUS.RECHECK_DUE, EVENT_STATUS.RECHECKED,
    EVENT_STATUS.COMPARED, EVENT_STATUS.DECISION_LOGGED,
  ]);
  const candidate = snap.docs.map((d) => ({ id: d.id, ...d.data() })).find((e) => openStatuses.has(e.status));
  if (!candidate) return null;

  const rechecksSnap = await getDocs(query(rechecksCol(uid, candidate.id), orderBy("dueAt", "asc")));
  const rechecks = rechecksSnap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
    dueAt: d.data().dueAt?.toDate ? d.data().dueAt.toDate() : d.data().dueAt,
  }));
  return { ...candidate, rechecks };
}

export async function getV9EventHistory(uid, count = 20) {
  if (!uid || !FIREBASE_ENABLED || !db) return [];
  const snap = await getDocs(query(eventsCol(uid), orderBy("createdAt", "desc"), limit(count)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
