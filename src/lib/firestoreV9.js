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
//
// 데모 모드(Firebase 미설정) 폴백: 기존 앱도 useHomeData의 addOptimisticScan처럼 Firebase 없이
// UI 흐름을 확인할 수 있는 로컬 상태 폴백을 이미 쓰고 있다. V9 Decision Loop도 같은 이유로
// FIREBASE_ENABLED가 false면 아래 in-memory demoStore를 대신 사용한다 — 그래야 카메라·Firebase
// 프로젝트 없이도(RC0 Mock Capture E2E 검증) 트리거→기준선→재확인→비교 전체 흐름을 실제로
// 클릭해서 끝까지 확인할 수 있다. 운영 환경(FIREBASE_ENABLED=true)에서는 이 경로를 타지 않는다.
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
import { MOCK_CAPTURE_ENABLED } from "../config/featureFlags";

const APP_VERSION = "1.0.0";
const USE_DEMO_STORE = !FIREBASE_ENABLED || !db;

// ── 데모 모드 in-memory 스토어 (uid -> event[]). 새로고침하면 사라진다 — 영구 저장이 아니다. ──
const demoEventsByUid = new Map();
let demoIdCounter = 0;
function nextDemoId(prefix) {
  demoIdCounter += 1;
  return `demo-${prefix}-${demoIdCounter}`;
}
function getDemoEvents(uid) {
  if (!demoEventsByUid.has(uid)) demoEventsByUid.set(uid, []);
  return demoEventsByUid.get(uid);
}
/** 테스트/개발에서 데모 스토어를 초기화할 때 사용 (프로덕션 코드 경로에서는 호출하지 않음). */
export function __resetDemoStoreForTests() {
  demoEventsByUid.clear();
  demoIdCounter = 0;
}

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
function decisionsCol(uid, eventId) {
  return collection(db, "users", uid, "v9Events", eventId, "decisions");
}
function outcomesCol(uid, eventId) {
  return collection(db, "users", uid, "v9Events", eventId, "outcomes");
}

/** S02 — 트리거 선택 시점에 Event를 만든다. */
export async function createV9Event(uid, { primaryTrigger, secondaryTriggers = [], contextNote = "" }) {
  if (!uid) return null;
  const base = {
    schemaVersion: V9_SCHEMA_VERSION,
    primaryTrigger,
    secondaryTriggers,
    contextNote: contextNote?.trim() || null,
    status: EVENT_STATUS.DRAFT,
    baselineCaptureId: null,
    baselineQualityStatus: null,
    nextRecheckDueAt: null,
  };
  if (USE_DEMO_STORE) {
    const id = nextDemoId("evt");
    const now = new Date();
    getDemoEvents(uid).push({ id, ...base, createdAt: now, updatedAt: now, captures: [], rechecks: [], comparisons: [], decisions: [], outcomes: [] });
    return id;
  }
  const ref = await addDoc(eventsCol(uid), { ...base, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  return ref.id;
}

export async function updateV9EventStatus(uid, eventId, status) {
  if (!uid || !eventId) return;
  if (USE_DEMO_STORE) {
    const event = getDemoEvents(uid).find((e) => e.id === eventId);
    if (event) { event.status = status; event.updatedAt = new Date(); }
    return;
  }
  await updateDoc(eventDoc(uid, eventId), { status, updatedAt: serverTimestamp() });
}

/** S04 — 촬영 1건을 저장한다(baseline 또는 recheck). 원본 이미지는 저장하지 않는다(landmark/품질값만). */
export async function saveCapture(uid, eventId, { type, handSide, qualityStatus, qualityFlags, landmarksRef, symptomSnapshot }) {
  if (!uid || !eventId) return null;
  const base = {
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
  };
  if (USE_DEMO_STORE) {
    const event = getDemoEvents(uid).find((e) => e.id === eventId);
    if (!event) return null;
    const id = nextDemoId("cap");
    event.captures.push({ id, ...base, capturedAt: new Date() });
    return id;
  }
  const ref = await addDoc(capturesCol(uid, eventId), { ...base, capturedAt: serverTimestamp() });
  return ref.id;
}

/**
 * S06 — 첫 기준선 확정: Event 상태를 갱신하고 2주·4주 재확인을 예약한다.
 * baselineQualityStatus를 Event 문서에 함께 저장해두면, 홈 카드(recheckSchedule.getHomeAgendaState)가
 * 캡처 문서를 추가로 조회하지 않고도 "기준선이 불안정하게 저장됐다"는 경고를 바로 띄울 수 있다.
 * qualityStatus가 "pass"가 아니어도(강제 저장) 판단 루프 자체는 계속 진행한다 — 기록은 보관하되
 * 신뢰도만 낮게 표시하는 것이 "저장은 허용, 정상 기준선으로 취급은 안 함" 원칙에 맞다.
 */
export async function markBaselineCreated(uid, eventId, captureId, baselineCapturedAt = new Date(), baselineQualityStatus = "pass") {
  if (!uid || !eventId) return null;
  const { week2DueAt, week4DueAt } = computeRecheckDueDates(baselineCapturedAt);

  if (USE_DEMO_STORE) {
    const event = getDemoEvents(uid).find((e) => e.id === eventId);
    if (!event) return null;
    event.status = EVENT_STATUS.BASELINE_CREATED;
    event.baselineCaptureId = captureId;
    event.baselineQualityStatus = baselineQualityStatus;
    event.nextRecheckDueAt = week2DueAt;
    event.updatedAt = new Date();
    const week2Id = nextDemoId("rc");
    const week4Id = nextDemoId("rc");
    event.rechecks.push(
      { id: week2Id, schemaVersion: V9_SCHEMA_VERSION, dueType: RECHECK_DUE_TYPE.WEEK2, dueAt: week2DueAt, status: RECHECK_STATUS.SCHEDULED, captureId: null, qualityStatus: null, completedAt: null },
      { id: week4Id, schemaVersion: V9_SCHEMA_VERSION, dueType: RECHECK_DUE_TYPE.WEEK4, dueAt: week4DueAt, status: RECHECK_STATUS.SCHEDULED, captureId: null, qualityStatus: null, completedAt: null },
    );
    return { week2Id, week4Id, week2DueAt, week4DueAt };
  }

  await updateDoc(eventDoc(uid, eventId), {
    status: EVENT_STATUS.BASELINE_CREATED,
    baselineCaptureId: captureId,
    baselineQualityStatus,
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

/** S08 — 재확인 완료 처리. qualityStatus도 함께 저장해 홈 카드가 캡처 조회 없이 경고를 띄울 수 있게 한다. */
export async function completeRecheck(uid, eventId, recheckId, captureId, qualityStatus = "pass") {
  if (!uid || !eventId || !recheckId) return;
  if (USE_DEMO_STORE) {
    const event = getDemoEvents(uid).find((e) => e.id === eventId);
    if (!event) return;
    const recheck = event.rechecks.find((r) => r.id === recheckId);
    if (recheck) {
      recheck.status = RECHECK_STATUS.COMPLETED;
      recheck.captureId = captureId;
      recheck.qualityStatus = qualityStatus;
      recheck.completedAt = new Date();
    }
    event.status = EVENT_STATUS.RECHECKED;
    event.updatedAt = new Date();
    return;
  }
  await updateDoc(doc(db, "users", uid, "v9Events", eventId, "rechecks", recheckId), {
    status: RECHECK_STATUS.COMPLETED,
    captureId,
    qualityStatus,
    completedAt: serverTimestamp(),
  });
  await updateDoc(eventDoc(uid, eventId), { status: EVENT_STATUS.RECHECKED, updatedAt: serverTimestamp() });
}

export async function skipRecheck(uid, eventId, recheckId) {
  if (!uid || !eventId || !recheckId) return;
  if (USE_DEMO_STORE) {
    const event = getDemoEvents(uid).find((e) => e.id === eventId);
    const recheck = event?.rechecks.find((r) => r.id === recheckId);
    if (recheck) recheck.status = RECHECK_STATUS.SKIPPED;
    return;
  }
  await updateDoc(doc(db, "users", uid, "v9Events", eventId, "rechecks", recheckId), {
    status: RECHECK_STATUS.SKIPPED,
  });
}

/** S09 — 기준선/현재 비교 결과 저장. */
export async function saveComparison(uid, eventId, { baselineCaptureId, currentCaptureId, comparable, nonComparableReasons, userPerceivedChange }) {
  if (!uid || !eventId) return null;
  const base = {
    schemaVersion: V9_SCHEMA_VERSION,
    baselineCaptureId,
    currentCaptureId,
    comparable,
    nonComparableReasons: nonComparableReasons ?? [],
    userPerceivedChange: userPerceivedChange ?? null,
  };
  if (USE_DEMO_STORE) {
    const event = getDemoEvents(uid).find((e) => e.id === eventId);
    if (!event) return null;
    const id = nextDemoId("cmp");
    event.comparisons.push({ id, ...base, viewedAt: new Date() });
    event.status = EVENT_STATUS.COMPARED;
    event.updatedAt = new Date();
    return id;
  }
  const ref = await addDoc(comparisonsCol(uid, eventId), { ...base, viewedAt: serverTimestamp() });
  await updateDoc(eventDoc(uid, eventId), { status: EVENT_STATUS.COMPARED, updatedAt: serverTimestamp() });
  return ref.id;
}

/** S12 — Decision Log: 무엇을 선택했고 왜 선택했는지 기록한다. 추천·정답 표시는 UI 쪽 책임(여기선 저장만). */
export async function saveDecision(uid, eventId, { decisionType, decisionLabel, reason, startedAt, memo }) {
  if (!uid || !eventId) return null;
  const base = {
    schemaVersion: V9_SCHEMA_VERSION,
    decisionType, decisionLabel: decisionLabel ?? null, reason,
    startedAt: startedAt ?? new Date().toISOString(),
    memo: memo?.trim() || null,
  };
  if (USE_DEMO_STORE) {
    const event = getDemoEvents(uid).find((e) => e.id === eventId);
    if (!event) return null;
    const id = nextDemoId("dec");
    const now = new Date();
    event.decisions.push({ id, ...base, createdAt: now, updatedAt: now });
    event.status = EVENT_STATUS.DECISION_LOGGED;
    event.updatedAt = now;
    return id;
  }
  const ref = await addDoc(decisionsCol(uid, eventId), { ...base, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  await updateDoc(eventDoc(uid, eventId), { status: EVENT_STATUS.DECISION_LOGGED, updatedAt: serverTimestamp() });
  return ref.id;
}

/** S13 — Outcome: 선택 이후 어떻게 느꼈는지 기록한다. 자동으로 호전/악화를 판정하지 않는다. */
export async function saveOutcome(uid, eventId, { perceivedChange, continuedAction, note }) {
  if (!uid || !eventId) return null;
  const base = {
    schemaVersion: V9_SCHEMA_VERSION,
    perceivedChange, continuedAction, note: note?.trim() || null,
  };
  if (USE_DEMO_STORE) {
    const event = getDemoEvents(uid).find((e) => e.id === eventId);
    if (!event) return null;
    const id = nextDemoId("out");
    const now = new Date();
    event.outcomes.push({ id, ...base, recordedAt: now });
    event.status = EVENT_STATUS.OUTCOME_LOGGED;
    event.updatedAt = now;
    return id;
  }
  const ref = await addDoc(outcomesCol(uid, eventId), { ...base, recordedAt: serverTimestamp() });
  await updateDoc(eventDoc(uid, eventId), { status: EVENT_STATUS.OUTCOME_LOGGED, updatedAt: serverTimestamp() });
  return ref.id;
}

function toJsDate(value) {
  return value?.toDate ? value.toDate() : value;
}

/**
 * 개인 타임라인(S14)·4주 리포트(S15)용 — Event 1건의 모든 하위 데이터(캡처·재확인·비교·
 * Decision·Outcome)를 한 번에 불러온다. 원본 이미지·랜드마크는 애초에 저장하지 않으므로
 * 여기서도 다루지 않는다 — 대표님 지시(RC1 비교 화면 제약)에 따라 사용자 입력값과 메타데이터만.
 */
export async function getEventDetail(uid, eventId) {
  if (!uid || !eventId) return null;
  if (USE_DEMO_STORE) {
    const event = getDemoEvents(uid).find((e) => e.id === eventId);
    if (!event) return null;
    return {
      ...event,
      rechecks: [...event.rechecks].sort((a, b) => a.dueAt - b.dueAt),
      captures: [...event.captures],
      comparisons: [...event.comparisons],
      decisions: [...event.decisions],
      outcomes: [...event.outcomes],
    };
  }
  const [eventSnap, capturesSnap, rechecksSnap, comparisonsSnap, decisionsSnap, outcomesSnap] = await Promise.all([
    getDoc(eventDoc(uid, eventId)),
    getDocs(query(capturesCol(uid, eventId), orderBy("capturedAt", "asc"))),
    getDocs(query(rechecksCol(uid, eventId), orderBy("dueAt", "asc"))),
    getDocs(query(comparisonsCol(uid, eventId), orderBy("viewedAt", "asc"))),
    getDocs(query(decisionsCol(uid, eventId), orderBy("createdAt", "asc"))),
    getDocs(query(outcomesCol(uid, eventId), orderBy("recordedAt", "asc"))),
  ]);
  if (!eventSnap.exists()) return null;
  return {
    id: eventSnap.id,
    ...eventSnap.data(),
    captures: capturesSnap.docs.map((d) => ({ id: d.id, ...d.data(), capturedAt: toJsDate(d.data().capturedAt) })),
    rechecks: rechecksSnap.docs.map((d) => ({ id: d.id, ...d.data(), dueAt: toJsDate(d.data().dueAt), completedAt: toJsDate(d.data().completedAt) })),
    comparisons: comparisonsSnap.docs.map((d) => ({ id: d.id, ...d.data(), viewedAt: toJsDate(d.data().viewedAt) })),
    decisions: decisionsSnap.docs.map((d) => ({ id: d.id, ...d.data(), createdAt: toJsDate(d.data().createdAt) })),
    outcomes: outcomesSnap.docs.map((d) => ({ id: d.id, ...d.data(), recordedAt: toJsDate(d.data().recordedAt) })),
  };
}

export async function getCapture(uid, eventId, captureId) {
  if (!uid || !eventId || !captureId) return null;
  if (USE_DEMO_STORE) {
    const event = getDemoEvents(uid).find((e) => e.id === eventId);
    return event?.captures.find((c) => c.id === captureId) ?? null;
  }
  const snap = await getDoc(doc(db, "users", uid, "v9Events", eventId, "captures", captureId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

const OPEN_STATUSES = new Set([
  EVENT_STATUS.DRAFT, EVENT_STATUS.CAPTURE_STARTED, EVENT_STATUS.CAPTURED,
  EVENT_STATUS.BASELINE_CREATED, EVENT_STATUS.RECHECK_DUE, EVENT_STATUS.RECHECKED,
  EVENT_STATUS.COMPARED, EVENT_STATUS.DECISION_LOGGED,
]);

/**
 * 홈 카드(S07)·재확인 화면용 — 아직 끝나지 않은(completed/abandoned/deleted가 아닌) 가장 최근 Event를
 * rechecks까지 함께 불러온다. 여러 개를 동시에 진행하지 않는다는 전제(한 번에 하나의 판단 루프)로 1건만 본다.
 */
export async function getActiveV9Event(uid) {
  if (!uid) return null;
  if (USE_DEMO_STORE) {
    const events = getDemoEvents(uid);
    const candidate = [...events].reverse().find((e) => OPEN_STATUSES.has(e.status));
    if (!candidate) return null;
    return { ...candidate, rechecks: [...candidate.rechecks].sort((a, b) => a.dueAt - b.dueAt) };
  }
  const q = query(eventsCol(uid), orderBy("createdAt", "desc"), limit(5));
  const snap = await getDocs(q);
  const candidate = snap.docs.map((d) => ({ id: d.id, ...d.data() })).find((e) => OPEN_STATUSES.has(e.status));
  if (!candidate) return null;

  const rechecksSnap = await getDocs(query(rechecksCol(uid, candidate.id), orderBy("dueAt", "asc")));
  const rechecks = rechecksSnap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
    dueAt: d.data().dueAt?.toDate ? d.data().dueAt.toDate() : d.data().dueAt,
  }));
  return { ...candidate, rechecks };
}

/**
 * 개발용 디버그 전용 — 2주/4주 재확인 예정일을 "지금"으로 앞당긴다. MOCK_CAPTURE_ENABLED가
 * 꺼져 있으면(production 빌드는 항상 꺼짐) 아무 것도 하지 않는다 — 실제 예정일 조작 경로가
 * production에 존재하지 않도록 이중으로 막는다. Mock Capture E2E 검증에서 2주/4주 뒤를
 * 기다리지 않고 재확인 화면까지 즉시 도달하기 위한 용도.
 */
export async function __debugForceRecheckDue(uid, eventId, dueType) {
  if (!MOCK_CAPTURE_ENABLED || !USE_DEMO_STORE) return;
  const event = getDemoEvents(uid).find((e) => e.id === eventId);
  const recheck = event?.rechecks.find((r) => r.dueType === dueType);
  if (recheck) recheck.dueAt = new Date();
}

export async function getV9EventHistory(uid, count = 20) {
  if (!uid) return [];
  if (USE_DEMO_STORE) {
    return [...getDemoEvents(uid)].reverse().slice(0, count);
  }
  const snap = await getDocs(query(eventsCol(uid), orderBy("createdAt", "desc"), limit(count)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** 개인 타임라인(S14)용 — 최근 Event들을 하위 데이터까지 채워서 반환한다(작은 개수만 다룬다는 전제). */
export async function getV9EventHistoryDetailed(uid, count = 5) {
  if (!uid) return [];
  const events = await getV9EventHistory(uid, count);
  return Promise.all(events.map((e) => getEventDetail(uid, e.id)));
}
