// Firestore Security Rules 테스트 — Firebase 에뮬레이터 필요.
// 실제 운영 Firebase 프로젝트에는 절대 쓰지 않는다 — projectId가 "demo-*"이면 에뮬레이터가
// 자동으로 프로덕션 접속을 거부하도록 되어 있다(Firebase 자체 안전장치).
//
// 실행: npm run test:rules (내부적으로 `firebase emulators:exec`가 에뮬레이터를 띄우고
// 이 테스트를 실행한 뒤 종료한다 — 개발자가 에뮬레이터를 따로 켤 필요 없음).
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, beforeEach, describe, it } from "vitest";
import {
  initializeTestEnvironment, assertSucceeds, assertFails, RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, collection, addDoc, deleteDoc, getDocs, runTransaction } from "firebase/firestore";
import { expect } from "vitest";

const PROJECT_ID = "demo-jointrun-rules-test";
/** @type {RulesTestEnvironment} */
let testEnv;

const validEvent = {
  schemaVersion: "v1.0",
  primaryTrigger: "pain_stiffness",
  secondaryTriggers: [],
  status: "draft",
  baselineCaptureId: null,
  baselineQualityStatus: null,
  nextRecheckDueAt: null,
};

const validCapture = {
  schemaVersion: "v1.0",
  type: "baseline",
  handSide: "right",
  qualityStatus: "pass",
  qualityFlags: [],
};

const validRecheck = {
  schemaVersion: "v1.0",
  dueType: "week2",
  status: "scheduled",
};

const validComparison = {
  schemaVersion: "v1.0",
  comparable: true,
  userPerceivedChange: "less_discomfort",
};

const validDecision = {
  schemaVersion: "v1.0",
  decisionType: "exercise_stretch",
  reason: "discomfort",
};

const validOutcome = {
  schemaVersion: "v1.0",
  perceivedChange: "less",
  continuedAction: "continue",
};

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync("firestore.rules", "utf8"),
      host: "127.0.0.1",
      port: 8180,
    },
  });
});

afterAll(async () => {
  await testEnv?.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

describe("v9Events — 본인 접근", () => {
  it("본인은 자신의 v9Event를 만들고 읽을 수 있다", async () => {
    const uid = "user-a";
    const db = testEnv.authenticatedContext(uid).firestore();
    const ref = doc(db, "users", uid, "v9Events", "evt1");
    await assertSucceeds(setDoc(ref, validEvent));
    await assertSucceeds(getDoc(ref));
  });

  it("본인은 자신의 v9Event 상태를 갱신할 수 있다", async () => {
    const uid = "user-a";
    const db = testEnv.authenticatedContext(uid).firestore();
    const ref = doc(db, "users", uid, "v9Events", "evt1");
    await assertSucceeds(setDoc(ref, validEvent));
    await assertSucceeds(setDoc(ref, { ...validEvent, status: "symptom_pending" }));
  });

  // RC1.2.1 §6 — 증상 기록 없이 곧바로 기준선을 확정하는 경로를 서버에서 막는다.
  it("draft에서 baseline_created로 곧바로 전환하는 것은 거부된다(symptom_pending 경유 필수)", async () => {
    const uid = "user-a";
    const db = testEnv.authenticatedContext(uid).firestore();
    const ref = doc(db, "users", uid, "v9Events", "evt-direct");
    await assertSucceeds(setDoc(ref, validEvent)); // draft
    await assertFails(setDoc(ref, { ...validEvent, status: "baseline_created" }));
  });

  it("symptom_pending에서 baseline_created로의 전환은 허용된다", async () => {
    const uid = "user-a";
    const db = testEnv.authenticatedContext(uid).firestore();
    const ref = doc(db, "users", uid, "v9Events", "evt-ok");
    await assertSucceeds(setDoc(ref, validEvent));
    await assertSucceeds(setDoc(ref, { ...validEvent, status: "symptom_pending" }));
    await assertSucceeds(setDoc(ref, { ...validEvent, status: "baseline_created" }));
  });
});

describe("v9Events — 타인 접근 거부", () => {
  it("다른 사용자의 v9Event는 읽을 수 없다", async () => {
    const ownerDb = testEnv.authenticatedContext("user-a").firestore();
    await setDoc(doc(ownerDb, "users", "user-a", "v9Events", "evt1"), validEvent);

    const intruderDb = testEnv.authenticatedContext("user-b").firestore();
    await assertFails(getDoc(doc(intruderDb, "users", "user-a", "v9Events", "evt1")));
  });

  it("다른 사용자의 경로에는 쓸 수 없다(잘못된 userId로 삽입 시도)", async () => {
    const intruderDb = testEnv.authenticatedContext("user-b").firestore();
    await assertFails(setDoc(doc(intruderDb, "users", "user-a", "v9Events", "evt-hack"), validEvent));
  });
});

describe("v9Events — 미인증 접근 거부", () => {
  it("로그인하지 않은 사용자는 읽기/쓰기 모두 거부된다", async () => {
    const anonDb = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(anonDb, "users", "user-a", "v9Events", "evt1")));
    await assertFails(setDoc(doc(anonDb, "users", "user-a", "v9Events", "evt-anon"), validEvent));
  });
});

describe("v9Events — 비정상 데이터 거부", () => {
  const uid = "user-a";

  it("필수 필드(primaryTrigger)가 없으면 거부된다", async () => {
    const db = testEnv.authenticatedContext(uid).firestore();
    const { primaryTrigger, ...missingField } = validEvent;
    await assertFails(setDoc(doc(db, "users", uid, "v9Events", "evt-bad1"), missingField));
  });

  it("status가 허용된 enum 값이 아니면 거부된다", async () => {
    const db = testEnv.authenticatedContext(uid).firestore();
    await assertFails(setDoc(doc(db, "users", uid, "v9Events", "evt-bad2"), { ...validEvent, status: "hacked_status" }));
  });

  it("primaryTrigger가 문자열이 아니면 거부된다", async () => {
    const db = testEnv.authenticatedContext(uid).firestore();
    await assertFails(setDoc(doc(db, "users", uid, "v9Events", "evt-bad3"), { ...validEvent, primaryTrigger: 12345 }));
  });

  it("secondaryTriggers가 배열이 아니면 거부된다", async () => {
    const db = testEnv.authenticatedContext(uid).firestore();
    await assertFails(setDoc(doc(db, "users", uid, "v9Events", "evt-bad4"), { ...validEvent, secondaryTriggers: "not-an-array" }));
  });
});

describe("하위 컬렉션(captures/rechecks/comparisons) — 동일 원칙 적용", () => {
  const uid = "user-a";

  async function seedEvent(db) {
    await setDoc(doc(db, "users", uid, "v9Events", "evt1"), validEvent);
  }

  it("captures: 본인은 생성·조회 가능, 수정·삭제는 스키마상 항상 거부(불변 기록)", async () => {
    const db = testEnv.authenticatedContext(uid).firestore();
    await seedEvent(db);
    const capturesCol = collection(db, "users", uid, "v9Events", "evt1", "captures");
    const captureRef = await assertSucceeds(addDoc(capturesCol, validCapture));
    await assertFails(setDoc(doc(db, "users", uid, "v9Events", "evt1", "captures", captureRef.id), { ...validCapture, qualityStatus: "pass" }));
    await assertFails(deleteDoc(doc(db, "users", uid, "v9Events", "evt1", "captures", captureRef.id)));
  });

  it("captures: qualityStatus가 허용 값이 아니면 거부된다", async () => {
    const db = testEnv.authenticatedContext(uid).firestore();
    await seedEvent(db);
    const capturesCol = collection(db, "users", uid, "v9Events", "evt1", "captures");
    await assertFails(addDoc(capturesCol, { ...validCapture, qualityStatus: "definitely_fine_trust_me" }));
  });

  it("captures: 타인은 접근할 수 없다", async () => {
    const ownerDb = testEnv.authenticatedContext(uid).firestore();
    await seedEvent(ownerDb);
    const intruderDb = testEnv.authenticatedContext("user-b").firestore();
    const capturesCol = collection(intruderDb, "users", uid, "v9Events", "evt1", "captures");
    await assertFails(addDoc(capturesCol, validCapture));
  });

  // ── RC1.2 — 관찰 각도 capture 최소수집·상태전환 검증 ──
  const validAngleCapture = {
    schemaVersion: "v1.0",
    eventId: "evt1",
    type: "baseline",
    handSide: "right",
    perFingerObservedRomDeg: [{ key: "index", name: "검지", romDeg: 118 }],
    averageObservedRomDeg: 122,
    qualityStatus: "pass",
    qualityFlags: [],
    symptomSnapshot: null,
  };

  it("RC1.2 captures: 관찰 각도 기록은 허용 필드만으로 생성 가능", async () => {
    const db = testEnv.authenticatedContext(uid).firestore();
    await seedEvent(db);
    const col = collection(db, "users", uid, "v9Events", "evt1", "captures");
    await assertSucceeds(addDoc(col, validAngleCapture));
  });

  it("RC1.2 captures: handSide가 left/right가 아니면 거부", async () => {
    const db = testEnv.authenticatedContext(uid).firestore();
    await seedEvent(db);
    const col = collection(db, "users", uid, "v9Events", "evt1", "captures");
    await assertFails(addDoc(col, { ...validAngleCapture, handSide: "both" }));
  });

  it("RC1.2 captures: rawFrames/landmarks/scores/recommendation/landmarksRef 등 금지 필드는 쓰기 거부", async () => {
    const db = testEnv.authenticatedContext(uid).firestore();
    await seedEvent(db);
    const col = collection(db, "users", uid, "v9Events", "evt1", "captures");
    await assertFails(addDoc(col, { ...validAngleCapture, rawFrames: [{ x: 1 }] }));
    await assertFails(addDoc(col, { ...validAngleCapture, landmarks: [{ x: 1 }] }));
    await assertFails(addDoc(col, { ...validAngleCapture, scores: { mobility: 80 } }));
    await assertFails(addDoc(col, { ...validAngleCapture, recommendation: "쉬세요" }));
    await assertFails(addDoc(col, { ...validAngleCapture, landmarksRef: "gs://x" }));
    await assertFails(addDoc(col, { ...validAngleCapture, fingerHealthScore: 77 }));
  });

  it("RC1.2 captures: symptomSnapshot은 null→객체 1회만 붙일 수 있고, 다른 필드 변경은 거부", async () => {
    const db = testEnv.authenticatedContext(uid).firestore();
    await seedEvent(db);
    const capRef = doc(db, "users", uid, "v9Events", "evt1", "captures", "cap1");
    await assertSucceeds(setDoc(capRef, validAngleCapture));
    // 증상 1회 부착(null→객체) 허용
    await assertSucceeds(setDoc(capRef, { ...validAngleCapture, symptomSnapshot: { painSelfReport: 5 } }));
    // 이미 채워진 뒤 다른 필드 변경 시도 → 거부(불변)
    await assertFails(setDoc(capRef, { ...validAngleCapture, symptomSnapshot: { painSelfReport: 5 }, averageObservedRomDeg: 999 }));
  });

  it("RC1.2 events: status=symptom_pending로 갱신 가능(각도 저장 후 증상 대기)", async () => {
    const db = testEnv.authenticatedContext(uid).firestore();
    await seedEvent(db);
    await assertSucceeds(setDoc(doc(db, "users", uid, "v9Events", "evt1"), { ...validEvent, status: "symptom_pending", baselineCaptureId: "cap1" }));
    // baseline_created 전환도 허용
    await assertSucceeds(setDoc(doc(db, "users", uid, "v9Events", "evt1"), { ...validEvent, status: "baseline_created", baselineCaptureId: "cap1" }));
  });

  it("rechecks: 본인은 생성·갱신 가능", async () => {
    const db = testEnv.authenticatedContext(uid).firestore();
    await seedEvent(db);
    const recheckRef = doc(db, "users", uid, "v9Events", "evt1", "rechecks", "rc1");
    await assertSucceeds(setDoc(recheckRef, validRecheck));
    await assertSucceeds(setDoc(recheckRef, { ...validRecheck, status: "completed" }));
  });

  it("rechecks: dueType이 허용 값이 아니면 거부된다", async () => {
    const db = testEnv.authenticatedContext(uid).firestore();
    await seedEvent(db);
    const recheckRef = doc(db, "users", uid, "v9Events", "evt1", "rechecks", "rc-bad");
    await assertFails(setDoc(recheckRef, { ...validRecheck, dueType: "week99" }));
  });

  it("rechecks: 타인은 접근할 수 없다", async () => {
    const ownerDb = testEnv.authenticatedContext(uid).firestore();
    await seedEvent(ownerDb);
    const intruderDb = testEnv.authenticatedContext("user-b").firestore();
    await assertFails(setDoc(doc(intruderDb, "users", uid, "v9Events", "evt1", "rechecks", "rc-hack"), validRecheck));
  });

  it("comparisons: 본인은 생성 가능, comparable이 boolean이 아니면 거부된다", async () => {
    const db = testEnv.authenticatedContext(uid).firestore();
    await seedEvent(db);
    const comparisonsCol = collection(db, "users", uid, "v9Events", "evt1", "comparisons");
    await assertSucceeds(addDoc(comparisonsCol, validComparison));
    await assertFails(addDoc(comparisonsCol, { ...validComparison, comparable: "yes" }));
  });

  it("comparisons: 타인은 접근할 수 없다", async () => {
    const ownerDb = testEnv.authenticatedContext(uid).firestore();
    await seedEvent(ownerDb);
    const intruderDb = testEnv.authenticatedContext("user-b").firestore();
    const comparisonsCol = collection(intruderDb, "users", uid, "v9Events", "evt1", "comparisons");
    await assertFails(addDoc(comparisonsCol, validComparison));
  });

  it("decisions: 본인은 생성 가능, decisionType이 허용 값이 아니면 거부된다", async () => {
    const db = testEnv.authenticatedContext(uid).firestore();
    await seedEvent(db);
    const decisionsCol = collection(db, "users", uid, "v9Events", "evt1", "decisions");
    await assertSucceeds(addDoc(decisionsCol, validDecision));
    await assertFails(addDoc(decisionsCol, { ...validDecision, decisionType: "take_random_pill_i_found" }));
  });

  it("decisions: 타인은 접근할 수 없다", async () => {
    const ownerDb = testEnv.authenticatedContext(uid).firestore();
    await seedEvent(ownerDb);
    const intruderDb = testEnv.authenticatedContext("user-b").firestore();
    const decisionsCol = collection(intruderDb, "users", uid, "v9Events", "evt1", "decisions");
    await assertFails(addDoc(decisionsCol, validDecision));
  });

  it("outcomes: 본인은 생성 가능, perceivedChange가 허용 값이 아니면 거부된다", async () => {
    const db = testEnv.authenticatedContext(uid).firestore();
    await seedEvent(db);
    const outcomesCol = collection(db, "users", uid, "v9Events", "evt1", "outcomes");
    await assertSucceeds(addDoc(outcomesCol, validOutcome));
    await assertFails(addDoc(outcomesCol, { ...validOutcome, perceivedChange: "definitely_cured" }));
  });

  it("outcomes: 타인은 접근할 수 없다", async () => {
    const ownerDb = testEnv.authenticatedContext(uid).firestore();
    await seedEvent(ownerDb);
    const intruderDb = testEnv.authenticatedContext("user-b").firestore();
    const outcomesCol = collection(intruderDb, "users", uid, "v9Events", "evt1", "outcomes");
    await assertFails(addDoc(outcomesCol, validOutcome));
  });

  it("decisions/outcomes: 수정·삭제는 항상 거부된다(기록 보존)", async () => {
    const db = testEnv.authenticatedContext(uid).firestore();
    await seedEvent(db);
    const decisionsCol = collection(db, "users", uid, "v9Events", "evt1", "decisions");
    const decisionRef = await assertSucceeds(addDoc(decisionsCol, validDecision));
    await assertFails(setDoc(doc(db, "users", uid, "v9Events", "evt1", "decisions", decisionRef.id), validDecision));
    await assertFails(deleteDoc(doc(db, "users", uid, "v9Events", "evt1", "decisions", decisionRef.id)));
  });
});

// ─────────────────────────────────────────────
// RC1.2.1 §1/§7 — 기준선 확정 원자성(transaction) 검증.
// 에뮬레이터의 실제 transaction 의미론으로 rollback·재시도·중복 없음을 확인한다.
// ─────────────────────────────────────────────
describe("RC1.2.1 — 기준선 확정 transaction 원자성", () => {
  const uid = "user-tx";
  const eventId = "evt-tx";
  const captureId = "cap-tx";

  const angleCapture = {
    schemaVersion: "v1.0",
    eventId,
    type: "baseline",
    handSide: "right",
    perFingerObservedRomDeg: [{ key: "index", name: "검지", romDeg: 118 }],
    averageObservedRomDeg: 122,
    recordingStatus: "completed",
    comparisonQualityStatus: "unverified",
    qualityFlags: [],
    symptomSnapshot: null,
    capturedAt: new Date("2026-07-01T09:00:00Z"),
  };

  async function seed(db) {
    await setDoc(doc(db, "users", uid, "v9Events", eventId), { ...validEvent, status: "symptom_pending", baselineCaptureId: captureId });
    await setDoc(doc(db, "users", uid, "v9Events", eventId, "captures", captureId), angleCapture);
  }

  // 프로덕션 코드와 동일한 구조의 transaction(결정적 recheck ID + symptom_pending 가드).
  async function confirmBaselineTx(db, { failBeforeCommit = false } = {}) {
    const eventRef = doc(db, "users", uid, "v9Events", eventId);
    const captureRef = doc(db, "users", uid, "v9Events", eventId, "captures", captureId);
    const week2Ref = doc(db, "users", uid, "v9Events", eventId, "rechecks", `week2-${captureId}`);
    const week4Ref = doc(db, "users", uid, "v9Events", eventId, "rechecks", `week4-${captureId}`);
    return runTransaction(db, async (tx) => {
      const eventSnap = await tx.get(eventRef);
      const captureSnap = await tx.get(captureRef);
      if (eventSnap.data().status !== "symptom_pending") return null; // 중복 확정 방지
      const capturedAt = captureSnap.data().capturedAt.toDate();
      const week2DueAt = new Date(capturedAt.getTime() + 14 * 86400000);
      const week4DueAt = new Date(capturedAt.getTime() + 28 * 86400000);
      tx.update(captureRef, { symptomSnapshot: { painSelfReport: 5 } });
      tx.update(eventRef, { status: "baseline_created", baselineCaptureId: captureId });
      tx.set(week2Ref, { schemaVersion: "v1.0", dueType: "week2", dueAt: week2DueAt, status: "scheduled", captureId: null, completedAt: null });
      // week2 생성 직후 실패시켜 rollback을 검증한다(§7 "week2 생성 실패 시 전체 rollback").
      if (failBeforeCommit) throw new Error("simulated failure after week2 write");
      tx.set(week4Ref, { schemaVersion: "v1.0", dueType: "week4", dueAt: week4DueAt, status: "scheduled", captureId: null, completedAt: null });
      return { week2DueAt, week4DueAt };
    });
  }

  it("중간 실패 시 전체 rollback — capture 증상·Event 상태·week2가 모두 원복된다", async () => {
    const db = testEnv.authenticatedContext(uid).firestore();
    await seed(db);
    await expect(confirmBaselineTx(db, { failBeforeCommit: true })).rejects.toThrow();

    const eventSnap = await getDoc(doc(db, "users", uid, "v9Events", eventId));
    const captureSnap = await getDoc(doc(db, "users", uid, "v9Events", eventId, "captures", captureId));
    const rechecks = await getDocs(collection(db, "users", uid, "v9Events", eventId, "rechecks"));
    expect(eventSnap.data().status).toBe("symptom_pending"); // 전환 안 됨
    expect(captureSnap.data().symptomSnapshot).toBeNull();   // 증상 안 붙음
    expect(rechecks.size).toBe(0);                            // week2도 남지 않음
  });

  it("실패 후 재시도하면 성공하고, capturedAt 기준으로 2주·4주 일정이 생성된다", async () => {
    const db = testEnv.authenticatedContext(uid).firestore();
    await seed(db);
    await expect(confirmBaselineTx(db, { failBeforeCommit: true })).rejects.toThrow();
    await confirmBaselineTx(db); // 재시도 성공

    const eventSnap = await getDoc(doc(db, "users", uid, "v9Events", eventId));
    const captureSnap = await getDoc(doc(db, "users", uid, "v9Events", eventId, "captures", captureId));
    const rechecks = await getDocs(collection(db, "users", uid, "v9Events", eventId, "rechecks"));
    expect(eventSnap.data().status).toBe("baseline_created");
    expect(captureSnap.data().symptomSnapshot.painSelfReport).toBe(5);
    expect(rechecks.size).toBe(2);
    const byType = Object.fromEntries(rechecks.docs.map((d) => [d.data().dueType, d.data()]));
    // capturedAt(7/1) 기준 +14일 = 7/15, +28일 = 7/29
    expect(byType.week2.dueAt.toDate().toISOString().slice(0, 10)).toBe("2026-07-15");
    expect(byType.week4.dueAt.toDate().toISOString().slice(0, 10)).toBe("2026-07-29");
  });

  it("중복 실행해도 Recheck는 2건을 넘지 않는다(결정적 ID + symptom_pending 가드)", async () => {
    const db = testEnv.authenticatedContext(uid).firestore();
    await seed(db);
    await confirmBaselineTx(db);
    const second = await confirmBaselineTx(db); // 이미 baseline_created → no-op
    expect(second).toBeNull();
    const rechecks = await getDocs(collection(db, "users", uid, "v9Events", eventId, "rechecks"));
    expect(rechecks.size).toBe(2);
  });
});
