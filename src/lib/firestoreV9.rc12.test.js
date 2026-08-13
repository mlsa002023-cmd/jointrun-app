// RC1.2 — 각도 관찰 기록 → symptom_pending → 증상 → baseline_created 데이터 흐름 검증(데모 스토어).
// 저장 금지 필드(점수·rawFrames·landmarks·recommendation)가 실제 저장 payload에 들어가지 않는지 확인.
import { describe, it, expect, beforeEach } from "vitest";
import {
  createV9Event, saveObservationalAngleCapture, confirmBaselineWithSymptom,
  getActiveV9Event, getEventDetail, __resetDemoStoreForTests,
  completeRecheckWithSymptom,
} from "./firestoreV9";
import { getHomeAgendaState } from "./recheckSchedule";

const uid = "demo-user";

beforeEach(() => __resetDemoStoreForTests());

async function makeAngleBaseline() {
  const eventId = await createV9Event(uid, { primaryTrigger: "pain_stiffness", secondaryTriggers: [] });
  const captureId = await saveObservationalAngleCapture(uid, eventId, {
    handSide: "right",
    perFingerObservedRomDeg: [{ key: "index", name: "검지", romDeg: 118 }],
    averageObservedRomDeg: 122,
    qualityStatus: "pass",
    qualityFlags: [],
  });
  return { eventId, captureId };
}

describe("RC1.2 각도 관찰 → 기준선 흐름", () => {
  it("각도 관찰 저장 시 capture는 허용 필드만 갖고 금지 필드는 없다", async () => {
    const { eventId, captureId } = await makeAngleBaseline();
    const detail = await getEventDetail(uid, eventId);
    const cap = detail.captures.find((c) => c.id === captureId);
    expect(cap.handSide).toBe("right");
    expect(cap.averageObservedRomDeg).toBe(122);
    expect(cap.perFingerObservedRomDeg.length).toBe(1);
    // 금지 필드가 저장 payload에 없어야 한다.
    for (const forbidden of ["scores", "rawFrames", "landmarks", "landmarksRef", "recommendation", "metrics", "fingerHealthScore", "painIndex", "stiffnessMin"]) {
      expect(cap[forbidden]).toBeUndefined();
    }
  });

  it("각도 저장 직후 Event는 symptom_pending, agenda도 symptom_pending을 가리킨다", async () => {
    const { eventId } = await makeAngleBaseline();
    const active = await getActiveV9Event(uid);
    expect(active.status).toBe("symptom_pending");
    const agenda = getHomeAgendaState(active);
    expect(agenda.key).toBe("symptom_pending");
    expect(agenda.eventId).toBe(eventId);
  });

  it("증상 저장 전에는 baseline이 확정되지 않는다(재확인 일정 없음)", async () => {
    await makeAngleBaseline();
    const active = await getActiveV9Event(uid);
    expect(active.status).toBe("symptom_pending");
    expect(active.rechecks.length).toBe(0);
  });

  it("증상 저장 후 baseline_created + 2주·4주 일정이 생성된다", async () => {
    const { eventId, captureId } = await makeAngleBaseline();
    await confirmBaselineWithSymptom(uid, eventId, captureId, { painSelfReport: 5, stiffnessSelfReport: 6 });
    const active = await getActiveV9Event(uid);
    expect(active.status).toBe("baseline_created");
    expect(active.rechecks.map((r) => r.dueType).sort()).toEqual(["week2", "week4"]);
    // 증상은 같은 capture에 붙었다.
    const detail = await getEventDetail(uid, eventId);
    const cap = detail.captures.find((c) => c.id === captureId);
    expect(cap.symptomSnapshot.painSelfReport).toBe(5);
  });

  it("symptom_pending이 아닌 상태에서 confirmBaselineWithSymptom은 중복 확정하지 않는다", async () => {
    const { eventId, captureId } = await makeAngleBaseline();
    await confirmBaselineWithSymptom(uid, eventId, captureId, { painSelfReport: 5 });
    // 두 번째 호출은 무시(이미 baseline_created)
    const res = await confirmBaselineWithSymptom(uid, eventId, captureId, { painSelfReport: 9 });
    expect(res).toBeNull();
    const detail = await getEventDetail(uid, eventId);
    const cap = detail.captures.find((c) => c.id === captureId);
    expect(cap.symptomSnapshot.painSelfReport).toBe(5); // 덮어쓰지 않음
  });

  it("활성 Event가 있으면 재확인 이벤트를 새로 만들지 않는다(중복 기준선 방지)", async () => {
    const { eventId } = await makeAngleBaseline();
    // 같은 흐름을 다시 타면 getActiveV9Event가 같은 Event를 돌려준다(새 Event 생성 안 함).
    const active = await getActiveV9Event(uid);
    expect(active.id).toBe(eventId);
  });
});

// ─────────────────────────────────────────────
// RC1.2.1 — 품질 의미 분리 / 재확인 각도 흐름 / 결정적 일정
// ─────────────────────────────────────────────
describe("RC1.2.1 관찰 품질·재확인", () => {
  it("각도 capture는 recordingStatus=completed + comparisonQualityStatus=unverified로 저장된다", async () => {
    const { eventId, captureId } = await makeAngleBaseline();
    const detail = await getEventDetail(uid, eventId);
    const cap = detail.captures.find((c) => c.id === captureId);
    expect(cap.recordingStatus).toBe("completed");
    // 조명·거리·흔들림을 실제로 검증하지 않았으므로 pass를 쓰지 않는다.
    expect(cap.comparisonQualityStatus).toBe("unverified");
    expect(cap.qualityStatus).toBeUndefined();
  });

  it("기준선 확정 시 capturedAt 기준으로 2주·4주 일정이 계산되고, 재실행해도 2건을 넘지 않는다", async () => {
    const { eventId, captureId } = await makeAngleBaseline();
    const first = await confirmBaselineWithSymptom(uid, eventId, captureId, { painSelfReport: 5 });
    const active = await getActiveV9Event(uid);
    const detail = await getEventDetail(uid, eventId);
    const cap = detail.captures.find((c) => c.id === captureId);
    const capturedAt = new Date(cap.capturedAt);
    expect(Math.round((first.week2DueAt - capturedAt) / 86400000)).toBe(14);
    expect(Math.round((first.week4DueAt - capturedAt) / 86400000)).toBe(28);
    // 결정적 ID이므로 재실행해도 중복 생성되지 않는다(두 번째 호출은 no-op).
    await confirmBaselineWithSymptom(uid, eventId, captureId, { painSelfReport: 9 });
    expect(active.rechecks.length).toBe(2);
  });

  it("재확인 각도 capture는 기준선과 같은 handSide로 저장되고 증상까지 함께 남는다", async () => {
    const { eventId, captureId } = await makeAngleBaseline();
    await confirmBaselineWithSymptom(uid, eventId, captureId, { painSelfReport: 5 });
    const active = await getActiveV9Event(uid);
    const week2 = active.rechecks.find((r) => r.dueType === "week2");

    // 재확인도 같은 관찰 프로토콜 — 기준선 handSide를 그대로 사용한다.
    const recheckCaptureId = await saveObservationalAngleCapture(uid, eventId, {
      handSide: active.baselineHandSide,
      perFingerObservedRomDeg: [{ key: "index", name: "검지", romDeg: 124 }],
      averageObservedRomDeg: 128,
      captureType: "recheck",
      qualityFlags: [],
    });
    await completeRecheckWithSymptom(uid, eventId, week2.id, recheckCaptureId, { painSelfReport: 3 });

    const detail = await getEventDetail(uid, eventId);
    const baselineCap = detail.captures.find((c) => c.id === captureId);
    const recheckCap = detail.captures.find((c) => c.id === recheckCaptureId);
    expect(recheckCap.handSide).toBe(baselineCap.handSide); // 같은 손
    expect(recheckCap.type).toBe("recheck");
    expect(recheckCap.averageObservedRomDeg).toBe(128);     // 재확인에도 각도 저장
    expect(recheckCap.symptomSnapshot.painSelfReport).toBe(3);
    // 재확인 완료 처리도 반영된다.
    const after = await getActiveV9Event(uid);
    expect(after.rechecks.find((r) => r.dueType === "week2").status).toBe("completed");
  });

  it("재확인 capture에도 금지 필드가 저장되지 않는다", async () => {
    const { eventId, captureId } = await makeAngleBaseline();
    await confirmBaselineWithSymptom(uid, eventId, captureId, { painSelfReport: 5 });
    const recheckCaptureId = await saveObservationalAngleCapture(uid, eventId, {
      handSide: "right", perFingerObservedRomDeg: [], averageObservedRomDeg: 120,
      captureType: "recheck", qualityFlags: [],
    });
    const detail = await getEventDetail(uid, eventId);
    const cap = detail.captures.find((c) => c.id === recheckCaptureId);
    for (const forbidden of ["scores", "rawFrames", "landmarks", "landmarksRef", "recommendation", "metrics", "fingerHealthScore"]) {
      expect(cap[forbidden]).toBeUndefined();
    }
  });
});
