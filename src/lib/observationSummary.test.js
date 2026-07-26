// observationSummary — 규칙 기반 한줄 요약 (RC1.2.2 P0-12)
import { describe, it, expect } from "vitest";
import { buildObservationSummary, SUMMARY_MODE, SUMMARY_CODE } from "./observationSummary";

const finger = (key, name, over = {}) => ({
  key, name,
  dipExtensionPoseFlexionDeg: 5,
  dipExtensionPoseDeviationDeg: 2,
  dipDeviationDirection: "radial",
  dipActiveRomDeg: 40,
  pipExtensionPoseFlexionDeg: 10,
  pipExtensionPoseDeviationDeg: 2,
  pipDeviationDirection: "radial",
  pipActiveRomDeg: 70,
  ...over,
});

const capture = (fingers, over = {}) => ({
  algorithmVersion: "v1.1",
  handSide: "left",
  comparisonQualityStatus: "unverified",
  recordingStatus: "completed",
  perFingerJointObservation: fingers,
  ...over,
});

const contour = (perKey) => ({
  measurementVersion: "dip-contour-v1",
  fingers: Object.entries(perKey).map(([key, v]) => ({ key, ...v })),
});

const FOUR = [
  finger("index", "검지"),
  finger("middle", "중지"),
  finger("ring", "약지"),
  finger("pinky", "소지"),
];

/** 금지 표현이 어디에도 없는지 확인한다(§10). */
const FORBIDDEN = /변형이|관절염|염증|붓기가 심|정상보다|좋아졌|호전|치료 효과|병원에 가|위험합니다|악화/;
function assertSafe(summary) {
  [summary.headline, summary.secondaryText, summary.summaryCode].forEach((t) => {
    expect(String(t)).not.toMatch(FORBIDDEN);
  });
}

describe("baseline — 항목 선택 (§4)", () => {
  it("DIP 잔여 굽힘이 상대적으로 큰 손가락을 고른다", () => {
    const fingers = [
      finger("index", "검지"),
      finger("middle", "중지"),
      finger("ring", "약지", { dipExtensionPoseFlexionDeg: 28 }),
      finger("pinky", "소지"),
    ];
    const s = buildObservationSummary({ mode: SUMMARY_MODE.BASELINE, currentCapture: capture(fingers) });
    expect(s.headline).toMatch(/약지 끝마디 말림/);
    expect(s.focusFingerKeys).toContain("ring");
    assertSafe(s);
  });

  it("DIP 편위가 큰 손가락과 방향을 함께 고른다", () => {
    const fingers = [
      finger("index", "검지"),
      finger("middle", "중지"),
      finger("ring", "약지", { dipExtensionPoseFlexionDeg: 28 }),
      finger("pinky", "소지", { dipExtensionPoseDeviationDeg: 18, dipDeviationDirection: "radial" }),
    ];
    const s = buildObservationSummary({ mode: SUMMARY_MODE.BASELINE, currentCapture: capture(fingers) });
    expect(s.headline).toMatch(/소지의 엄지쪽 치우침/);
    expect(s.focusFingerKeys).toEqual(["ring", "pinky"]);
    expect(s.summaryCode).toBe(SUMMARY_CODE.BASELINE_FOCUS);
    assertSafe(s);
  });

  it("contour 비대칭이 두드러지면 후보로 쓴다", () => {
    const s = buildObservationSummary({
      mode: SUMMARY_MODE.BASELINE,
      currentCapture: capture(FOUR, {
        dipContourObservation: contour({
          index: { dipWidthRatio: 1.0, contourAsymmetryRatio: 0.02 },
          middle: { dipWidthRatio: 1.0, contourAsymmetryRatio: 0.02 },
          ring: { dipWidthRatio: 1.0, contourAsymmetryRatio: 0.02 },
          pinky: { dipWidthRatio: 1.0, contourAsymmetryRatio: 0.3 },
        }),
      }),
    });
    expect(s.headline).toMatch(/소지 끝마디 좌우 윤곽 차이|소지/);
    assertSafe(s);
  });

  it("항목은 최대 2개까지만 담는다", () => {
    const fingers = [
      finger("index", "검지", { dipExtensionPoseFlexionDeg: 30 }),
      finger("middle", "중지", { dipExtensionPoseDeviationDeg: 25 }),
      finger("ring", "약지", { dipExtensionPoseFlexionDeg: 22 }),
      finger("pinky", "소지", { dipExtensionPoseDeviationDeg: 20 }),
    ];
    const s = buildObservationSummary({ mode: SUMMARY_MODE.BASELINE, currentCapture: capture(fingers) });
    expect(s.focusFingerKeys.length).toBeLessThanOrEqual(2);
    assertSafe(s);
  });

  it("뚜렷한 항목이 없으면 중립 문장으로 저장 사실만 알린다", () => {
    const same = ["index", "middle", "ring", "pinky"].map((k) => finger(k, k));
    const s = buildObservationSummary({
      mode: SUMMARY_MODE.BASELINE,
      currentCapture: capture(same, {
        dipContourObservation: contour({
          index: { dipWidthRatio: 1, contourAsymmetryRatio: 0 },
          middle: { dipWidthRatio: 1, contourAsymmetryRatio: 0 },
          ring: { dipWidthRatio: 1, contourAsymmetryRatio: 0 },
          pinky: { dipWidthRatio: 1, contourAsymmetryRatio: 0 },
        }),
      }),
    });
    expect(s.summaryCode).toBe(SUMMARY_CODE.BASELINE_NO_FOCUS);
    assertSafe(s);
  });

  it("외곽 관찰이 없고 두드러진 각도도 없으면 그 사실을 알린다", () => {
    const same = ["index", "middle", "ring", "pinky"].map((k) => finger(k, k));
    const s = buildObservationSummary({ mode: SUMMARY_MODE.BASELINE, currentCapture: capture(same) });
    expect(s.summaryCode).toBe(SUMMARY_CODE.BASELINE_CONTOUR_UNAVAILABLE);
    expect(s.headline).toMatch(/외곽 폭은 안정적으로 구분하지 못했어요/);
  });

  it("품질이 불충분하면 요약을 만들지 않는다", () => {
    const s = buildObservationSummary({
      mode: SUMMARY_MODE.BASELINE,
      currentCapture: capture(FOUR, { comparisonQualityStatus: "unreliable" }),
    });
    expect(s.summaryCode).toBe(SUMMARY_CODE.QUALITY_INSUFFICIENT);
    assertSafe(s);
  });

  it("baseline 제목을 쓰고 변화·증가·감소 표현을 쓰지 않는다 (§3)", () => {
    const s = buildObservationSummary({ mode: SUMMARY_MODE.BASELINE, currentCapture: capture(FOUR) });
    expect(s.title).toBe("이번 기록 한줄 요약");
    expect(s.headline).not.toMatch(/변화|증가|감소|이전보다/);
    expect(s.comparable).toBe(false);
  });

  it("누락값을 0으로 해석하지 않는다", () => {
    const fingers = [
      finger("index", "검지", { dipExtensionPoseFlexionDeg: null }),
      finger("middle", "중지", { dipExtensionPoseFlexionDeg: null }),
      finger("ring", "약지", { dipExtensionPoseFlexionDeg: 20 }),
      finger("pinky", "소지", { dipExtensionPoseFlexionDeg: 18 }),
    ];
    const s = buildObservationSummary({ mode: SUMMARY_MODE.BASELINE, currentCapture: capture(fingers) });
    // null인 손가락이 "0이라 제일 작다"는 식으로 쓰이지 않는다 — 약지가 선택되어야 한다.
    expect(s.headline).toMatch(/약지/);
  });
});

describe("recheck — 비교 가능 판정 (§6)", () => {
  const base = capture(FOUR);

  it("같은 세대·같은 손이면 비교한다", () => {
    const cur = capture([
      finger("index", "검지", { dipExtensionPoseFlexionDeg: 12 }),
      ...FOUR.slice(1),
    ]);
    const s = buildObservationSummary({ mode: SUMMARY_MODE.RECHECK, baselineCapture: base, currentCapture: cur });
    expect(s.title).toBe("기준선과 비교한 한줄 요약");
    expect(s.comparable).toBe(true);
    assertSafe(s);
  });

  it("세대가 다르면 직접 비교하지 않는다", () => {
    const legacy = { algorithmVersion: "v1.0", handSide: "left", comparisonQualityStatus: "unverified", perFingerObservedRomDeg: [{ key: "index", romDeg: 0 }] };
    const s = buildObservationSummary({ mode: SUMMARY_MODE.RECHECK, baselineCapture: legacy, currentCapture: base });
    expect(s.comparable).toBe(false);
    expect(s.summaryCode).toBe(SUMMARY_CODE.LEGACY_BASELINE);
    expect(s.headline).toMatch(/이전 측정 방식으로 기록되어/);
  });

  it("손이 다르면 직접 비교하지 않는다", () => {
    const s = buildObservationSummary({
      mode: SUMMARY_MODE.RECHECK,
      baselineCapture: base,
      currentCapture: capture(FOUR, { handSide: "right" }),
    });
    expect(s.comparable).toBe(false);
    expect(s.summaryCode).toBe(SUMMARY_CODE.NOT_COMPARABLE);
  });

  it("품질이 unreliable이면 직접 비교하지 않는다", () => {
    const s = buildObservationSummary({
      mode: SUMMARY_MODE.RECHECK,
      baselineCapture: base,
      currentCapture: capture(FOUR, { comparisonQualityStatus: "unreliable" }),
    });
    expect(s.comparable).toBe(false);
  });

  it("algorithm_version_mismatch 사유가 있으면 직접 비교하지 않는다", () => {
    const s = buildObservationSummary({
      mode: SUMMARY_MODE.RECHECK,
      baselineCapture: base,
      currentCapture: capture(FOUR),
      comparisonQuality: { comparable: false, reasons: ["algorithm_version_mismatch"] },
    });
    expect(s.comparable).toBe(false);
  });
});

describe("recheck — 반복 오차 처리 (§8)", () => {
  const base = capture(FOUR);

  it("반복 범위 안이면 '비슷한 범위'로 적는다", () => {
    const cur = capture(FOUR.map((f) => ({ ...f, dipExtensionPoseFlexionDeg: f.dipExtensionPoseFlexionDeg + 1 })));
    const s = buildObservationSummary({
      mode: SUMMARY_MODE.RECHECK, baselineCapture: base, currentCapture: cur,
      personalRepeatBand: { dipFlexionDeg: 5, dipDeviationDeg: 5, dipActiveRomDeg: 5, pipFlexionDeg: 5 },
    });
    expect(s.summaryCode).toBe(SUMMARY_CODE.RECHECK_SIMILAR);
    expect(s.headline).toMatch(/비슷한 범위로 기록됐어요/);
    assertSafe(s);
  });

  it("반복 범위를 넘으면 '다르게 기록됐어요'로 적는다", () => {
    const cur = capture([
      finger("index", "검지", { dipExtensionPoseFlexionDeg: 40 }),
      ...FOUR.slice(1),
    ]);
    const s = buildObservationSummary({
      mode: SUMMARY_MODE.RECHECK, baselineCapture: base, currentCapture: cur,
      personalRepeatBand: { dipFlexionDeg: 3, dipDeviationDeg: 3, dipActiveRomDeg: 3, pipFlexionDeg: 3 },
    });
    expect(s.headline).toMatch(/반복 측정 범위를 넘어 다르게 기록됐어요/);
    assertSafe(s);
  });

  it("반복 범위가 없으면 방향성 대신 '차이로 기록됐어요'를 쓴다", () => {
    const cur = capture([
      finger("index", "검지", { dipExtensionPoseFlexionDeg: 12 }),
      ...FOUR.slice(1),
    ]);
    const s = buildObservationSummary({ mode: SUMMARY_MODE.RECHECK, baselineCapture: base, currentCapture: cur });
    expect(s.headline).toMatch(/차이로 기록됐어요/);
    expect(s.headline).not.toMatch(/증가|감소/);
    assertSafe(s);
  });

  it("최대 2개 항목만 요약한다", () => {
    const cur = capture([
      finger("index", "검지", { dipExtensionPoseFlexionDeg: 40, dipExtensionPoseDeviationDeg: 30 }),
      finger("middle", "중지", { dipExtensionPoseFlexionDeg: 38 }),
      finger("ring", "약지", { dipExtensionPoseFlexionDeg: 35 }),
      finger("pinky", "소지", { dipExtensionPoseFlexionDeg: 33 }),
    ]);
    const s = buildObservationSummary({ mode: SUMMARY_MODE.RECHECK, baselineCapture: base, currentCapture: cur });
    expect(s.headline.split("은 ").length - 1).toBeLessThanOrEqual(2);
  });
});

describe("recheck — 외곽 비교", () => {
  it("양쪽 모두 외곽이 있으면 후보로 쓴다", () => {
    const b = capture(FOUR, { dipContourObservation: contour({ middle: { dipWidthRatio: 0.9, contourAsymmetryRatio: 0.01 } }) });
    const c = capture(FOUR, { dipContourObservation: contour({ middle: { dipWidthRatio: 1.4, contourAsymmetryRatio: 0.01 } }) });
    const s = buildObservationSummary({ mode: SUMMARY_MODE.RECHECK, baselineCapture: b, currentCapture: c });
    expect(s.comparable).toBe(true);
    assertSafe(s);
  });

  it("한쪽만 외곽이 있으면 외곽을 비교 항목으로 쓰지 않는다", () => {
    const b = capture(FOUR);
    const c = capture(FOUR, { dipContourObservation: contour({ middle: { dipWidthRatio: 1.4, contourAsymmetryRatio: 0.5 } }) });
    const s = buildObservationSummary({ mode: SUMMARY_MODE.RECHECK, baselineCapture: b, currentCapture: c });
    expect(s.headline).not.toMatch(/외곽 폭|윤곽 차이/);
  });
});

describe("금지 표현 (§10)", () => {
  it("어떤 입력에서도 진단·악화·호전 표현을 만들지 않는다", () => {
    const variants = [
      buildObservationSummary({ mode: SUMMARY_MODE.BASELINE, currentCapture: capture(FOUR) }),
      buildObservationSummary({ mode: SUMMARY_MODE.BASELINE, currentCapture: capture(FOUR, { comparisonQualityStatus: "unreliable" }) }),
      buildObservationSummary({ mode: SUMMARY_MODE.RECHECK, baselineCapture: capture(FOUR), currentCapture: capture(FOUR) }),
      buildObservationSummary({ mode: SUMMARY_MODE.RECHECK, baselineCapture: null, currentCapture: capture(FOUR) }),
    ];
    variants.forEach(assertSafe);
  });

  it("허용 표현만 쓴다", () => {
    const s = buildObservationSummary({ mode: SUMMARY_MODE.BASELINE, currentCapture: capture(FOUR) });
    expect(s.headline).toMatch(/기록됐|관찰됐|저장됐|구분하지 못했|우선 비교/);
  });
});
