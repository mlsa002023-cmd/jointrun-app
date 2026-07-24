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
import { doc, getDoc, setDoc, collection, addDoc, deleteDoc } from "firebase/firestore";

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
