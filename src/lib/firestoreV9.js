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

import { FIREBASE_ENABLED, db, isFirestoreReady } from "../firebase/config";
import {
  collection, addDoc, getDocs, getDoc, doc, updateDoc, deleteDoc,
  query, orderBy, limit, serverTimestamp, runTransaction,
} from "firebase/firestore";
import {
  V9_SCHEMA_VERSION, CAPTURE_PROTOCOL_VERSION, ALGORITHM_VERSION,
  EVENT_STATUS, RECHECK_STATUS, RECHECK_DUE_TYPE, CAPTURE_TYPE,
  RECORDING_STATUS, COMPARISON_QUALITY_STATUS,
} from "./v9EventTypes";
import { computeRecheckDueDates } from "./recheckSchedule";
import { MOCK_CAPTURE_ENABLED } from "../config/featureFlags";

const APP_VERSION = "1.0.0";
// RC1.2.2 P0-3 — Firebase 초기화가 지연되므로(firebase/config.js 참고) 모듈 로드
// 시점에 상수로 굳히지 않고, 호출할 때마다 실제 준비 상태를 확인한다.
function isDemoStore() {
  return !FIREBASE_ENABLED || !isFirestoreReady();
}

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
  if (isDemoStore()) {
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
  if (isDemoStore()) {
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
  if (isDemoStore()) {
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
 * RC1.2 — 손 각도 관찰 기록을 V10 Event의 baseline capture로 저장한다.
 * 최소수집: 각도·품질·버전 메타만 저장하고 원본 사진/영상/랜드마크/점수/추천은 저장하지 않는다.
 * (실시간 랜드마크는 각도 계산에만 쓰고 이 함수에 도달하기 전에 폐기된다.)
 * 저장 직후 Event 상태를 symptom_pending으로 두어, 증상 기록을 마쳐야 baseline이 확정되게 한다.
 */
export async function saveObservationalAngleCapture(uid, eventId, {
  handSide, perFingerObservedRomDeg, averageObservedRomDeg,
  perFingerJointObservation, deviationDirection, dipContourObservation,
  captureType = CAPTURE_TYPE.BASELINE, qualityFlags,
}) {
  if (!uid || !eventId) return null;
  // RC1.2.1 §3 — "기록 완료"와 "비교 품질 검증"을 분리한다. 각도 흐름은 조명·거리·흔들림을
  // 실제로 검증하지 않으므로 comparisonQualityStatus는 unverified로 둔다(pass 금지).
  const base = {
    schemaVersion: V9_SCHEMA_VERSION,
    eventId,
    type: captureType, // baseline | recheck (기존 리더 호환 유지)
    handSide: handSide ?? null,
    // RC1.2.2 P0-8 — 관절별(DIP/PIP) 관찰이 주 기록이다. 파생 각도와 품질값만 담는다
    // (원본 사진·영상·landmark는 저장하지 않는다 — §9).
    perFingerJointObservation: perFingerJointObservation ?? [],
    deviationDirection: deviationDirection ?? null,
    // RC1.2.2 P0-9 — DIP 외곽 폭 관찰. 관찰에 실패하면 아예 싣지 않는다(0 저장 금지).
    // 파생 비율·유효 프레임 수·안정성 값만 담고 이미지·마스크·윤곽 좌표는 담지 않는다.
    dipContourObservation: dipContourObservation ?? null,
    // 이전 세대 리더(비교 화면 등) 호환을 위해 손가락 전체 활동 가동범위도 함께 남긴다.
    perFingerObservedRomDeg: perFingerObservedRomDeg ?? [],
    averageObservedRomDeg: averageObservedRomDeg ?? null,
    recordingStatus: RECORDING_STATUS.COMPLETED,
    comparisonQualityStatus: COMPARISON_QUALITY_STATUS.UNVERIFIED,
    qualityFlags: qualityFlags ?? [],
    symptomSnapshot: null, // 증상은 다음 단계에서 채운다(symptom_pending)
    captureProtocolVersion: CAPTURE_PROTOCOL_VERSION,
    algorithmVersion: ALGORITHM_VERSION,
    appVersion: APP_VERSION,
  };
  const isBaseline = captureType === CAPTURE_TYPE.BASELINE;

  if (isDemoStore()) {
    const event = getDemoEvents(uid).find((e) => e.id === eventId);
    if (!event) return null;
    const id = nextDemoId("cap");
    event.captures.push({ id, ...base, capturedAt: new Date() });
    if (isBaseline) {
      event.status = EVENT_STATUS.SYMPTOM_PENDING;
      event.baselineCaptureId = id;
      event.baselineComparisonQualityStatus = base.comparisonQualityStatus;
      // 재확인이 "같은 손"인지 확인·검증할 수 있도록 Event에 보존한다(Rules에서도 사용).
      event.baselineHandSide = base.handSide;
    }
    event.updatedAt = new Date();
    return id;
  }
  const ref = await addDoc(capturesCol(uid, eventId), { ...base, capturedAt: serverTimestamp() });
  if (isBaseline) {
    await updateDoc(eventDoc(uid, eventId), {
      status: EVENT_STATUS.SYMPTOM_PENDING,
      baselineCaptureId: ref.id,
      baselineComparisonQualityStatus: base.comparisonQualityStatus,
      baselineHandSide: base.handSide,
      updatedAt: serverTimestamp(),
    });
  }
  return ref.id;
}

/**
 * RC1.2 — symptom_pending 상태의 Event에 증상을 붙이고 첫 기준선을 확정한다.
 * 증상 저장이 성공한 뒤에만 baseline_created로 전환하고 2주·4주 재확인을 예약한다.
 * capture는 불변 원칙이지만 symptomSnapshot 필드에 한해 1회(null→객체) 채우는 것만 허용한다(Rules 검증).
 * 이미 baseline_created 이상이면 중복 확정을 막기 위해 아무 것도 하지 않는다.
 */
export async function confirmBaselineWithSymptom(uid, eventId, captureId, symptomSnapshot) {
  if (!uid || !eventId || !captureId) return null;

  if (isDemoStore()) {
    const event = getDemoEvents(uid).find((e) => e.id === eventId);
    // symptom_pending일 때만 실행(중복 확정 방지).
    if (!event || event.status !== EVENT_STATUS.SYMPTOM_PENDING) return null;
    const capture = event.captures.find((c) => c.id === captureId);
    if (!capture) return null;
    // 데모 스토어는 단일 스레드라 아래 네 변경이 원자적으로 적용된다(실패 지점 없음).
    if (capture.symptomSnapshot == null) capture.symptomSnapshot = symptomSnapshot ?? null;
    const { week2DueAt, week4DueAt } = computeRecheckDueDates(capture.capturedAt ?? new Date());
    event.status = EVENT_STATUS.BASELINE_CREATED;
    event.baselineCaptureId = captureId;
    event.nextRecheckDueAt = week2DueAt;
    event.updatedAt = new Date();
    // 결정적 ID — 중복 실행해도 같은 문서 2개만 존재한다.
    const mk = (dueType, dueAt) => ({
      id: `${dueType}-${captureId}`,
      schemaVersion: V9_SCHEMA_VERSION,
      dueType,
      dueAt,
      status: RECHECK_STATUS.SCHEDULED,
      captureId: null,
      qualityStatus: null,
      completedAt: null,
    });
    for (const [dueType, dueAt] of [[RECHECK_DUE_TYPE.WEEK2, week2DueAt], [RECHECK_DUE_TYPE.WEEK4, week4DueAt]]) {
      const id = `${dueType}-${captureId}`;
      if (!event.rechecks.some((r) => r.id === id)) event.rechecks.push(mk(dueType, dueAt));
    }
    return { week2Id: `week2-${captureId}`, week4Id: `week4-${captureId}`, week2DueAt, week4DueAt };
  }

  // ── 실제 Firestore: 네 쓰기를 하나의 transaction으로 묶는다(중간 실패 시 전체 rollback) ──
  // 1) Capture symptomSnapshot 1회 부착  2) Event baseline_created 전환
  // 3) week2 Recheck 생성               4) week4 Recheck 생성
  // Recheck 문서 ID는 `week2-{captureId}` / `week4-{captureId}`로 결정적이라, 재시도해도
  // 중복 생성되지 않는다(같은 문서를 다시 set). 일정은 Capture의 capturedAt을 기준으로 계산한다.
  const eventRef = eventDoc(uid, eventId);
  const captureRef = doc(db, "users", uid, "v9Events", eventId, "captures", captureId);
  const week2Ref = doc(db, "users", uid, "v9Events", eventId, "rechecks", `week2-${captureId}`);
  const week4Ref = doc(db, "users", uid, "v9Events", eventId, "rechecks", `week4-${captureId}`);

  return runTransaction(db, async (tx) => {
    const [eventSnap, captureSnap] = await Promise.all([tx.get(eventRef), tx.get(captureRef)]);
    if (!eventSnap.exists() || !captureSnap.exists()) return null;

    const eventData = eventSnap.data();
    // symptom_pending일 때만 확정한다 — 이미 baseline_created면 재실행해도 아무 것도 하지 않는다.
    if (eventData.status !== EVENT_STATUS.SYMPTOM_PENDING) return null;

    const captureData = captureSnap.data();
    const capturedAt = captureData.capturedAt?.toDate ? captureData.capturedAt.toDate() : (captureData.capturedAt ?? new Date());
    const { week2DueAt, week4DueAt } = computeRecheckDueDates(capturedAt);

    // 1) 증상은 1회만 부착(이미 있으면 덮어쓰지 않는다).
    if (captureData.symptomSnapshot == null) {
      tx.update(captureRef, { symptomSnapshot: symptomSnapshot ?? null });
    }
    // 2) Event 확정 — 기존 baselineComparisonQualityStatus를 보존한다(덮어쓰지 않음).
    tx.update(eventRef, {
      status: EVENT_STATUS.BASELINE_CREATED,
      baselineCaptureId: captureId,
      nextRecheckDueAt: week2DueAt,
      updatedAt: serverTimestamp(),
    });
    // 3)·4) 결정적 ID로 2주·4주 재확인 생성(재시도 시 동일 문서 재작성 → 중복 없음).
    const recheckBase = { schemaVersion: V9_SCHEMA_VERSION, status: RECHECK_STATUS.SCHEDULED, captureId: null, completedAt: null };
    tx.set(week2Ref, { ...recheckBase, dueType: RECHECK_DUE_TYPE.WEEK2, dueAt: week2DueAt });
    tx.set(week4Ref, { ...recheckBase, dueType: RECHECK_DUE_TYPE.WEEK4, dueAt: week4DueAt });

    return { week2Id: week2Ref.id, week4Id: week4Ref.id, week2DueAt, week4DueAt };
  });
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

  if (isDemoStore()) {
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
  if (isDemoStore()) {
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

/**
 * RC1.2.1 §2 — 재확인 각도 관찰에 증상을 붙이고 재확인을 완료 처리한다(원자적).
 * capture symptomSnapshot 1회 부착 + recheck completed + Event rechecked를 한 transaction으로 묶어
 * 중간 실패 시 전체 rollback되게 한다. 재시도해도 같은 문서를 다시 쓰므로 중복이 생기지 않는다.
 */
export async function completeRecheckWithSymptom(uid, eventId, recheckId, captureId, symptomSnapshot) {
  if (!uid || !eventId || !recheckId || !captureId) return null;

  if (isDemoStore()) {
    const event = getDemoEvents(uid).find((e) => e.id === eventId);
    if (!event) return null;
    const recheck = event.rechecks.find((r) => r.id === recheckId);
    if (!recheck || recheck.status === RECHECK_STATUS.COMPLETED) return null; // 중복 완료 방지
    const capture = event.captures.find((c) => c.id === captureId);
    if (capture && capture.symptomSnapshot == null) capture.symptomSnapshot = symptomSnapshot ?? null;
    recheck.status = RECHECK_STATUS.COMPLETED;
    recheck.captureId = captureId;
    recheck.completedAt = new Date();
    event.status = EVENT_STATUS.RECHECKED;
    event.updatedAt = new Date();
    return { recheckId, captureId };
  }

  const eventRef = eventDoc(uid, eventId);
  const captureRef = doc(db, "users", uid, "v9Events", eventId, "captures", captureId);
  const recheckRef = doc(db, "users", uid, "v9Events", eventId, "rechecks", recheckId);

  return runTransaction(db, async (tx) => {
    const [recheckSnap, captureSnap] = await Promise.all([tx.get(recheckRef), tx.get(captureRef)]);
    if (!recheckSnap.exists() || !captureSnap.exists()) return null;
    if (recheckSnap.data().status === RECHECK_STATUS.COMPLETED) return null; // 이미 완료 → 중복 실행 무시

    if (captureSnap.data().symptomSnapshot == null) {
      tx.update(captureRef, { symptomSnapshot: symptomSnapshot ?? null });
    }
    tx.update(recheckRef, {
      status: RECHECK_STATUS.COMPLETED,
      captureId,
      completedAt: serverTimestamp(),
    });
    tx.update(eventRef, { status: EVENT_STATUS.RECHECKED, updatedAt: serverTimestamp() });
    return { recheckId, captureId };
  });
}

export async function skipRecheck(uid, eventId, recheckId) {
  if (!uid || !eventId || !recheckId) return;
  if (isDemoStore()) {
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
  if (isDemoStore()) {
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
  if (isDemoStore()) {
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
  if (isDemoStore()) {
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
  if (isDemoStore()) {
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
  if (isDemoStore()) {
    const event = getDemoEvents(uid).find((e) => e.id === eventId);
    return event?.captures.find((c) => c.id === captureId) ?? null;
  }
  const snap = await getDoc(doc(db, "users", uid, "v9Events", eventId, "captures", captureId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

const OPEN_STATUSES = new Set([
  EVENT_STATUS.DRAFT, EVENT_STATUS.CAPTURE_STARTED, EVENT_STATUS.CAPTURED,
  EVENT_STATUS.SYMPTOM_PENDING,
  EVENT_STATUS.BASELINE_CREATED, EVENT_STATUS.RECHECK_DUE, EVENT_STATUS.RECHECKED,
  EVENT_STATUS.COMPARED, EVENT_STATUS.DECISION_LOGGED,
]);

/**
 * 홈 카드(S07)·재확인 화면용 — 아직 끝나지 않은(completed/abandoned/deleted가 아닌) 가장 최근 Event를
 * rechecks까지 함께 불러온다. 여러 개를 동시에 진행하지 않는다는 전제(한 번에 하나의 판단 루프)로 1건만 본다.
 */
export async function getActiveV9Event(uid) {
  if (!uid) return null;
  if (isDemoStore()) {
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
 * 개발/QA 전용 디버그 — 2주/4주 재확인 예정일을 "지금"으로 앞당긴다. MOCK_CAPTURE_ENABLED가
 * 꺼져 있으면(production 빌드는 항상 꺼짐) 아무 것도 하지 않는다 — 실제 예정일 조작 경로가
 * production에 존재하지 않도록 이중으로 막는다. 로컬 개발의 데모 스토어뿐 아니라, 대표 검수용
 * Preview에서 Staging Firebase에 연결된 경우(QA 모드)에도 동작해야 하므로 실제 Firestore
 * 경로도 지원한다 — rechecks 서브컬렉션은 Rules상 본인 소유 문서의 update가 허용되어 있다.
 */
export async function __debugForceRecheckDue(uid, eventId, dueType) {
  if (!MOCK_CAPTURE_ENABLED) return;
  if (isDemoStore()) {
    const event = getDemoEvents(uid).find((e) => e.id === eventId);
    const recheck = event?.rechecks.find((r) => r.dueType === dueType);
    if (recheck) recheck.dueAt = new Date();
    return;
  }
  const snap = await getDocs(rechecksCol(uid, eventId));
  const target = snap.docs.find((d) => d.data().dueType === dueType);
  if (target) {
    await updateDoc(target.ref, { dueAt: serverTimestamp() });
  }
}

/**
 * 개발/QA 전용 디버그 — 현재 계정의 V9 Decision Loop 기록을 전부 초기화한다("테스트 기록
 * 초기화"). MOCK_CAPTURE_ENABLED가 꺼져 있으면(production 빌드는 항상 꺼짐) 아무 것도
 * 하지 않는다. 실제 Firestore(Staging)에서는 v9Events 문서 삭제만 수행한다(Rules상 본인
 * 문서 delete가 허용됨) — captures/rechecks/comparisons/decisions/outcomes 서브컬렉션은
 * 불변 기록 원칙(update/delete: if false)이라 클라이언트에서 지울 수 없으므로 그대로 남지만,
 * 부모 이벤트 문서가 없으면 앱의 정상 조회 경로(이벤트 목록 조회)로는 다시 나타나지 않는다.
 */
export async function resetV9DataForUser(uid) {
  if (!MOCK_CAPTURE_ENABLED || !uid) return;
  if (isDemoStore()) {
    demoEventsByUid.delete(uid);
    return;
  }
  const snap = await getDocs(eventsCol(uid));
  await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
}

export async function getV9EventHistory(uid, count = 20) {
  if (!uid) return [];
  if (isDemoStore()) {
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
