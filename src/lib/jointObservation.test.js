// jointObservation / measurementQuality — DIP 중심 끝마디 관찰 모델 테스트 (RC1.2.2 P0-8)
//
// 합성 손 모델로 검증한다. 목표는 "실제 변형된 손을 실패시키지 않는가"이므로,
// 완전 신전뿐 아니라 잔여 굴곡·편위·작은 ROM·비대칭 손을 모두 정상 관찰로 통과시킨다.
import { describe, it, expect } from "vitest";
import {
  FINGER_CHAINS,
  DEVIATION_DIRECTION,
  buildPalmFrame,
  analyzeJoint,
  analyzeFingerJoints,
  aggregateJointSamples,
  buildFingerJointObservations,
  summarizeDeviationDirection,
  deviationDirectionOf,
} from "./jointObservation";
import {
  assessPoseMeasurement,
  assessMeasurement,
  inspectFrameLandmarks,
  hasCoordinateChange,
  QUALITY_FLAG,
} from "./measurementQuality";

// ─────────────────────────────────────────────
// 합성 손 생성기
//
// 좌표계: x = radial(엄지쪽, 오른손 기준), y = 손가락이 뻗는 방향, z = 손등 방향.
// 손가락은 y축으로 뻗고, 굴곡은 -z(손바닥 쪽)로 굽는다.
// ─────────────────────────────────────────────
const SEG = 3; // 분절 길이

/**
 * @param {object} opts
 *  pipFlex/dipFlex : 관절별 굴곡각(도). 손가락 키별로 다르게 줄 수 있다.
 *  pipDev/dipDev   : 좌우 편위각(도). + = radial(엄지쪽)
 *  hand            : "right" | "left" — left는 x축을 미러링한다.
 */
function makeHand({ pipFlex = 0, dipFlex = 0, pipDev = 0, dipDev = 0, hand = "right", perFinger = {} } = {}) {
  const lm = [];
  const set = (i, x, y, z) => { lm[i] = { x: hand === "left" ? -x : x, y, z }; };
  const rad = (d) => (d * Math.PI) / 180;

  set(0, 0, 0, 0); // wrist
  // 엄지(계산에 쓰지 않지만 자리는 채운다)
  [1, 2, 3, 4].forEach((i) => set(i, 4, i, 0));

  // MCP는 radial(x) 방향으로 나란히 — 검지가 가장 radial, 소지가 가장 ulnar.
  const mcpX = { index: 3, middle: 1, ring: -1, pinky: -3 };

  Object.entries(FINGER_CHAINS).forEach(([key, c]) => {
    const o = perFinger[key] ?? {};
    const pf = rad(o.pipFlex ?? pipFlex);
    const df = rad(o.dipFlex ?? dipFlex);
    const pd = rad(o.pipDev ?? pipDev);
    const dd = rad(o.dipDev ?? dipDev);

    const x0 = mcpX[key];
    set(c.mcp, x0, 4, 0);
    // 근위지골: MCP → PIP 는 항상 +y (기준 방향)
    set(c.pip, x0, 4 + SEG, 0);

    // 중위지골: PIP 기준 굴곡(-z) + 편위(+x = radial)
    const px = x0 + SEG * Math.sin(pd) * Math.cos(pf);
    const py = 4 + SEG + SEG * Math.cos(pd) * Math.cos(pf);
    const pz = -SEG * Math.sin(pf);
    set(c.dip, px, py, pz);

    // 말절골: 중위지골 방향 u를 기준으로 국소 직교 프레임을 만들어 정확히 회전시킨다.
    //   u    = 중위지골 방향
    //   lat  = radial(+x)에서 u 성분을 뺀 방향 → 좌우 편위 축
    //   bend = 굴곡 축(손바닥 쪽, -z)
    // (단순히 성분을 더하면 PIP가 크게 굽은 자세에서 DIP 각도가 왜곡된다.)
    const dl = Math.hypot(px - x0, py - (4 + SEG), pz) || 1;
    const u = { x: (px - x0) / dl, y: (py - (4 + SEG)) / dl, z: pz / dl };
    const rAx = { x: 1, y: 0, z: 0 };
    const rDot = rAx.x * u.x + rAx.y * u.y + rAx.z * u.z;
    const latRaw = { x: rAx.x - rDot * u.x, y: rAx.y - rDot * u.y, z: rAx.z - rDot * u.z };
    const latLen = Math.hypot(latRaw.x, latRaw.y, latRaw.z) || 1;
    const lat = { x: latRaw.x / latLen, y: latRaw.y / latLen, z: latRaw.z / latLen };
    // bend = -(lat × u) → u가 +y일 때 -z(손바닥 쪽)를 가리킨다.
    const bend = {
      x: -(lat.y * u.z - lat.z * u.y),
      y: -(lat.z * u.x - lat.x * u.z),
      z: -(lat.x * u.y - lat.y * u.x),
    };
    const cf = Math.cos(df) * Math.cos(dd);
    const sf = Math.sin(df);
    const sd = Math.sin(dd);
    set(
      c.tip,
      px + SEG * (u.x * cf + bend.x * sf + lat.x * sd),
      py + SEG * (u.y * cf + bend.y * sf + lat.y * sd),
      pz + SEG * (u.z * cf + bend.z * sf + lat.z * sd)
    );
  });
  return lm;
}

/** 같은 손을 미세한 노이즈와 함께 n프레임 만든다(실제 좌표 변화 조건 충족). */
function makeFrames(opts, n = 6) {
  return Array.from({ length: n }, (_, i) =>
    makeHand(opts).map((p) => ({
      x: p.x + (i % 2 ? 0.002 : -0.002),
      y: p.y + i * 0.001,
      z: p.z + (i % 3 ? 0.001 : -0.001),
    }))
  );
}

function aggOf(opts, n = 6) {
  return aggregateJointSamples(makeFrames(opts, n).map(analyzeFingerJoints));
}

describe("FINGER_CHAINS — tip landmark", () => {
  it("네 손가락 모두 mcp/pip/dip/tip 인덱스를 갖는다", () => {
    expect(FINGER_CHAINS.index).toMatchObject({ mcp: 5, pip: 6, dip: 7, tip: 8 });
    expect(FINGER_CHAINS.middle).toMatchObject({ mcp: 9, pip: 10, dip: 11, tip: 12 });
    expect(FINGER_CHAINS.ring).toMatchObject({ mcp: 13, pip: 14, dip: 15, tip: 16 });
    expect(FINGER_CHAINS.pinky).toMatchObject({ mcp: 17, pip: 18, dip: 19, tip: 20 });
  });
});

describe("완전 신전", () => {
  it("다 편 손은 PIP·DIP 굴곡이 0에 가깝고 측정이 성립한다", () => {
    const agg = aggOf({ pipFlex: 0, dipFlex: 0 });
    agg.forEach((f) => {
      expect(f.pip.flexionDeg).toBeLessThan(3);
      expect(f.dip.flexionDeg).toBeLessThan(3);
    });
    const res = assessPoseMeasurement(makeFrames({}), agg);
    expect(res.ok).toBe(true);
  });
});

describe("잔여 굴곡 — 최대 신전 제한 인정 (§4)", () => {
  it("DIP에 잔여 굴곡이 남아도 실패로 처리하지 않고 값으로 기록한다", () => {
    const frames = makeFrames({ dipFlex: 25 });
    const agg = aggregateJointSamples(frames.map(analyzeFingerJoints));
    agg.forEach((f) => expect(f.dip.flexionDeg).toBeGreaterThan(18));

    const res = assessPoseMeasurement(frames, agg);
    expect(res.ok).toBe(true);
    expect(res.flags).not.toContain(QUALITY_FLAG.JOINT_UNRESOLVED);
  });

  it("PIP에 잔여 굴곡이 남아도 측정은 성공이다", () => {
    const frames = makeFrames({ pipFlex: 30 });
    const agg = aggregateJointSamples(frames.map(analyzeFingerJoints));
    agg.forEach((f) => expect(f.pip.flexionDeg).toBeGreaterThan(22));
    expect(assessPoseMeasurement(frames, agg).ok).toBe(true);
  });

  it("잔여 굴곡은 신전 포즈 값으로 저장된다", () => {
    const obs = buildFingerJointObservations(aggOf({ dipFlex: 20 }), aggOf({ dipFlex: 70 }));
    obs.forEach((o) => {
      expect(o.dipExtensionPoseFlexionDeg).toBeGreaterThan(14);
      expect(o.dipObserved).toBe(true);
    });
  });
});

describe("DIP 좌우 편위", () => {
  it("radial 편위는 양수와 radial 방향으로 관찰된다", () => {
    const agg = aggOf({ dipDev: 18 });
    agg.forEach((f) => {
      expect(f.dip.deviationDeg).toBeGreaterThan(0);
      expect(f.dip.direction).toBe(DEVIATION_DIRECTION.RADIAL);
    });
  });

  it("ulnar 편위는 음수와 ulnar 방향으로 관찰된다", () => {
    const agg = aggOf({ dipDev: -18 });
    agg.forEach((f) => {
      expect(f.dip.deviationDeg).toBeLessThan(0);
      expect(f.dip.direction).toBe(DEVIATION_DIRECTION.ULNAR);
    });
  });

  it("편위가 거의 없으면 방향을 단정하지 않는다", () => {
    expect(deviationDirectionOf(0.4)).toBe(DEVIATION_DIRECTION.NEUTRAL);
  });
});

describe("왼손·오른손 부호 정규화와 미러링", () => {
  it("같은 해부학적 편위는 좌우 손에서 같은 방향으로 관찰된다", () => {
    const right = aggOf({ dipDev: 20, hand: "right" });
    const left = aggOf({ dipDev: 20, hand: "left" });
    right.forEach((f, i) => {
      expect(f.dip.direction).toBe(DEVIATION_DIRECTION.RADIAL);
      expect(left[i].dip.direction).toBe(DEVIATION_DIRECTION.RADIAL);
      // 크기도 좌우가 실질적으로 같아야 한다(부호 반전으로 왜곡되지 않음)
      expect(Math.abs(Math.abs(f.dip.deviationDeg) - Math.abs(left[i].dip.deviationDeg))).toBeLessThan(2);
    });
  });

  it("x축 미러링에도 굴곡각은 변하지 않는다", () => {
    const a = aggOf({ pipFlex: 40, dipFlex: 30, hand: "right" });
    const b = aggOf({ pipFlex: 40, dipFlex: 30, hand: "left" });
    a.forEach((f, i) => {
      expect(Math.abs(f.pip.flexionDeg - b[i].pip.flexionDeg)).toBeLessThan(2);
      expect(Math.abs(f.dip.flexionDeg - b[i].dip.flexionDeg)).toBeLessThan(2);
    });
  });
});

describe("비대칭 손", () => {
  it("손가락마다 다른 굴곡을 각각 구분해 관찰한다", () => {
    const perFinger = {
      index: { dipFlex: 5 },
      middle: { dipFlex: 35 },
      ring: { dipFlex: 60 },
      pinky: { dipFlex: 15 },
    };
    const agg = aggOf({ perFinger });
    const byKey = Object.fromEntries(agg.map((f) => [f.key, f.dip.flexionDeg]));
    expect(byKey.index).toBeLessThan(byKey.pinky);
    expect(byKey.pinky).toBeLessThan(byKey.middle);
    expect(byKey.middle).toBeLessThan(byKey.ring);
    expect(assessPoseMeasurement(makeFrames({ perFinger }), agg).ok).toBe(true);
  });
});

describe("작은 ROM — 실패로 처리하지 않는다 (§7)", () => {
  it("가동범위가 몇 도뿐이어도 측정은 성공이고 값이 저장된다", () => {
    const ext = aggOf({ dipFlex: 40, pipFlex: 40 });
    const flex = aggOf({ dipFlex: 45, pipFlex: 44 }); // ROM ≈ 5°, 4°
    const extFrames = makeFrames({ dipFlex: 40, pipFlex: 40 });

    expect(assessPoseMeasurement(extFrames, ext).ok).toBe(true);
    const obs = buildFingerJointObservations(ext, flex);
    obs.forEach((o) => {
      expect(o.dipActiveRomDeg).toBeGreaterThanOrEqual(0);
      expect(o.dipActiveRomDeg).toBeLessThan(15);
      expect(o.dipObserved).toBe(true);
    });
  });

  // P0-10 — 실기기에서 주먹을 쥐면 끝마디가 가려져 굴곡이 신전보다 작게 추정되는 경우가
  // 있었다. 그때 0°를 값으로 남기면 "전혀 안 움직인다"로 오해되므로 관찰 불가(null)로 둔다.
  it("굴곡이 신전보다 작게 나오면 0이 아니라 관찰 불가로 남긴다", () => {
    const obs = buildFingerJointObservations(aggOf({ dipFlex: 50 }), aggOf({ dipFlex: 30 }));
    obs.forEach((o) => expect(o.dipActiveRomDeg).toBeNull());
  });

  it("아주 작아도 실제로 관찰된 범위는 값으로 남긴다", () => {
    const obs = buildFingerJointObservations(aggOf({ dipFlex: 40 }), aggOf({ dipFlex: 45 }));
    obs.forEach((o) => {
      expect(o.dipActiveRomDeg).toBeGreaterThan(0);
      expect(o.dipActiveRomDeg).toBeLessThan(15);
    });
  });
});

describe("활동 가동범위", () => {
  it("DIP/PIP 각각의 ROM을 최대굴곡 - 최대신전으로 계산한다", () => {
    const obs = buildFingerJointObservations(
      aggOf({ dipFlex: 10, pipFlex: 5 }),
      aggOf({ dipFlex: 70, pipFlex: 85 })
    );
    obs.forEach((o) => {
      expect(o.dipActiveRomDeg).toBeGreaterThan(50);
      expect(o.pipActiveRomDeg).toBeGreaterThan(70);
    });
  });
});

describe("TIP 가림", () => {
  it("tip landmark가 없으면 DIP는 관찰 불가로 표시되고 PIP는 계속 관찰된다", () => {
    const frames = makeFrames({ pipFlex: 30 }).map((f) => {
      const copy = [...f];
      Object.values(FINGER_CHAINS).forEach((c) => { copy[c.tip] = undefined; });
      return copy;
    });
    const agg = aggregateJointSamples(frames.map(analyzeFingerJoints));
    agg.forEach((f) => {
      expect(f.dip.valid).toBe(false);
      expect(f.pip.valid).toBe(true);
    });
    const res = assessPoseMeasurement(frames, agg);
    expect(res.flags).toContain(QUALITY_FLAG.TIP_OCCLUDED);
  });

  it("landmark가 전부 없으면 측정 실패로 판정한다", () => {
    const frames = [[], [], []];
    const agg = aggregateJointSamples(frames.map(analyzeFingerJoints));
    const res = assessPoseMeasurement(frames, agg);
    expect(res.ok).toBe(false);
    expect(res.flags).toContain(QUALITY_FLAG.LANDMARKS_MISSING);
  });
});

describe("센서 0도 오류 / 좌표 무변화", () => {
  it("모든 프레임이 완전히 동일하면 좌표 변화 없음으로 실패 처리한다", () => {
    const one = makeHand({ dipFlex: 20 });
    const frames = [one, one, one, one, one];
    expect(hasCoordinateChange(frames)).toBe(false);
    const agg = aggregateJointSamples(frames.map(analyzeFingerJoints));
    const res = assessPoseMeasurement(frames, agg);
    expect(res.ok).toBe(false);
    expect(res.flags).toContain(QUALITY_FLAG.NO_COORDINATE_CHANGE);
  });

  it("NaN/Infinity 좌표는 유효 landmark로 세지 않는다", () => {
    const bad = makeHand({});
    bad[8] = { x: NaN, y: 1, z: 0 };
    bad[12] = { x: Infinity, y: 1, z: 0 };
    const ins = inspectFrameLandmarks(bad);
    expect(ins.usable).toBe(false);
    expect(ins.missing).toEqual(expect.arrayContaining([8, 12]));
  });

  it("각도 계산 결과에 NaN이 새어나오지 않는다", () => {
    const agg = aggOf({ pipFlex: 45, dipFlex: 45 });
    agg.forEach((f) => {
      expect(Number.isFinite(f.pip.flexionDeg)).toBe(true);
      expect(Number.isFinite(f.dip.deviationDeg)).toBe(true);
    });
  });
});

describe("프레임 안정성", () => {
  it("같은 포즈 안에서 값이 크게 흔들리면 불안정으로 표시한다", () => {
    const frames = [
      ...makeFrames({ dipFlex: 5 }, 3),
      ...makeFrames({ dipFlex: 75 }, 3),
    ];
    const agg = aggregateJointSamples(frames.map(analyzeFingerJoints));
    const res = assessPoseMeasurement(frames, agg);
    expect(res.flags).toContain(QUALITY_FLAG.UNSTABLE_POSE);
  });

  it("프레임 수가 모자라면 측정으로 인정하지 않는다", () => {
    const frames = makeFrames({}, 2);
    const agg = aggregateJointSamples(frames.map(analyzeFingerJoints));
    const res = assessPoseMeasurement(frames, agg);
    expect(res.ok).toBe(false);
    expect(res.flags).toContain(QUALITY_FLAG.FRAMES_INSUFFICIENT);
  });
});

describe("반복 측정 일관성", () => {
  it("같은 자세를 반복 측정하면 관절별 값이 재현된다", () => {
    const opts = { pipFlex: 35, dipFlex: 28, dipDev: 12 };
    const a = buildFingerJointObservations(aggOf(opts), aggOf({ ...opts, dipFlex: 78, pipFlex: 90 }));
    const b = buildFingerJointObservations(aggOf(opts), aggOf({ ...opts, dipFlex: 78, pipFlex: 90 }));
    a.forEach((o, i) => {
      expect(Math.abs(o.dipExtensionPoseFlexionDeg - b[i].dipExtensionPoseFlexionDeg)).toBeLessThan(1);
      expect(Math.abs(o.dipActiveRomDeg - b[i].dipActiveRomDeg)).toBeLessThan(1);
      expect(o.dipDeviationDirection).toBe(b[i].dipDeviationDirection);
    });
  });
});

describe("저장 필드 계약 (§4·§5·§6·§9)", () => {
  it("요구된 관절별 필드를 모두 만들고 원본 좌표는 담지 않는다", () => {
    const obs = buildFingerJointObservations(aggOf({ dipFlex: 12, dipDev: -9 }), aggOf({ dipFlex: 70 }));
    const o = obs[0];
    [
      "pipExtensionPoseFlexionDeg", "dipExtensionPoseFlexionDeg",
      "pipExtensionPoseDeviationDeg", "dipExtensionPoseDeviationDeg",
      "pipMaxFlexionDeg", "dipMaxFlexionDeg",
      "pipActiveRomDeg", "dipActiveRomDeg",
      "dipDeviationDirection", "pipDeviationDirection",
    ].forEach((k) => expect(o).toHaveProperty(k));

    const serialized = JSON.stringify(obs);
    expect(serialized).not.toMatch(/landmark|rawFrame|"x":|"y":|"z":/);
  });

  it("대표 편위 방향을 요약한다", () => {
    const obs = buildFingerJointObservations(aggOf({ dipDev: -20 }), aggOf({ dipFlex: 60, dipDev: -20 }));
    expect(summarizeDeviationDirection(obs)).toBe(DEVIATION_DIRECTION.ULNAR);
  });
});

describe("측정 전체 판정", () => {
  it("모든 포즈가 성립해야 측정이 성립한다", () => {
    const extFrames = makeFrames({ dipFlex: 10 });
    const flexFrames = makeFrames({ dipFlex: 70 });
    const result = assessMeasurement({
      extension: assessPoseMeasurement(extFrames, aggregateJointSamples(extFrames.map(analyzeFingerJoints))),
      flexion: assessPoseMeasurement(flexFrames, aggregateJointSamples(flexFrames.map(analyzeFingerJoints))),
    });
    expect(result.ok).toBe(true);
    expect(result.byPose.extension.ok).toBe(true);
  });

  it("한 포즈라도 성립하지 않으면 전체가 성립하지 않는다", () => {
    const good = makeFrames({});
    const bad = [[], []];
    const result = assessMeasurement({
      extension: assessPoseMeasurement(good, aggregateJointSamples(good.map(analyzeFingerJoints))),
      flexion: assessPoseMeasurement(bad, aggregateJointSamples(bad.map(analyzeFingerJoints))),
    });
    expect(result.ok).toBe(false);
  });
});

describe("팜 좌표계", () => {
  it("세 점이 일직선이면 좌표계를 만들지 않는다", () => {
    const lm = [];
    lm[0] = { x: 0, y: 0, z: 0 };
    lm[5] = { x: 1, y: 0, z: 0 };
    lm[17] = { x: 2, y: 0, z: 0 };
    expect(buildPalmFrame(lm)).toBeNull();
  });

  it("좌표계가 없으면 관절 분석이 유효하지 않다고 표시한다", () => {
    const r = analyzeJoint(makeHand({}), 5, 6, 7, null);
    expect(r.valid).toBe(false);
    expect(r.reason).toBe("palm_frame_unavailable");
  });
});
