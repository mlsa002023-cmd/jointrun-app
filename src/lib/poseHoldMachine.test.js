import { describe, it, expect } from "vitest";
import { createHoldState, stepHold, POSE_STATUS } from "./poseHoldMachine";

const OPTS = { minHoldMs: 1500, requiredValidFrames: 8, debounceMs: 250 };

/** valid 프레임을 dtMs 간격으로 n번 흘려보낸다. */
function runValid(state, n, startNow = 0, dtMs = 100, options = OPTS) {
  let s = state;
  let now = startNow;
  for (let i = 0; i < n; i += 1) {
    s = stepHold(s, { valid: true, now, options });
    now += dtMs;
  }
  return { state: s, now };
}

describe("poseHoldMachine (§15A 포즈 상태머신)", () => {
  it("aligning에서는 진행률이 0이고, 잘못된 자세는 아무리 지나도 확정되지 않는다", () => {
    let s = createHoldState();
    expect(s.status).toBe(POSE_STATUS.ALIGNING);
    for (let i = 0; i < 100; i += 1) {
      s = stepHold(s, { valid: false, now: i * 100, options: OPTS });
      expect(s.status).toBe(POSE_STATUS.ALIGNING);
      expect(s.holdProgress).toBe(0);
      expect(s.justConfirmed).toBe(false);
    }
  });

  it("유효 자세일 때만 holding이 시작되고, 유지될수록 진행률이 오른다", () => {
    let s = createHoldState();
    s = stepHold(s, { valid: false, now: 0, options: OPTS });
    expect(s.status).toBe(POSE_STATUS.ALIGNING);
    s = stepHold(s, { valid: true, now: 100, options: OPTS });
    expect(s.status).toBe(POSE_STATUS.HOLDING);
    // 첫 유효 프레임은 경과 0ms라 진행률 0(시간·프레임 둘 다 충족해야 오름). 이어지면 증가.
    const after = runValid(s, 4, 200, 100).state;
    expect(after.holdProgress).toBeGreaterThan(0);
  });

  it("최소 시간과 필요한 프레임을 모두 충족해야 confirmed가 된다", () => {
    // 8프레임을 100ms 간격으로 → 700ms 경과(시간 미달)라 아직 confirmed 아님.
    const r1 = runValid(createHoldState(), 8, 0, 100);
    expect(r1.state.status).toBe(POSE_STATUS.HOLDING);
    // 시간(1500ms)까지 채우면 confirmed.
    const r2 = runValid(createHoldState(), 16, 0, 100);
    expect(r2.state.status).toBe(POSE_STATUS.CONFIRMED);
    expect(r2.state.justConfirmed).toBe(true);
  });

  it("시간은 충분해도 유효 프레임이 부족하면 confirmed가 아니다", () => {
    // 2프레임을 각각 0ms, 2000ms에 → 경과 2000ms지만 프레임 2개뿐.
    let s = createHoldState();
    s = stepHold(s, { valid: true, now: 0, options: OPTS });
    s = stepHold(s, { valid: true, now: 2000, options: OPTS });
    expect(s.status).toBe(POSE_STATUS.HOLDING);
    expect(s.status).not.toBe(POSE_STATUS.CONFIRMED);
  });

  it("holding 중 짧은 blip(debounce 이내)은 진행을 멈추되 초기화하지 않는다", () => {
    let s = createHoldState();
    const r = runValid(s, 5, 0, 100); // 5 유효 프레임(400ms 경과)
    s = r.state;
    const framesBefore = s.validFrameCount;
    // 마지막 유효(now=400)로부터 200ms 지난 blip.
    s = stepHold(s, { valid: false, now: 600, options: OPTS });
    expect(s.status).toBe(POSE_STATUS.HOLDING);
    expect(s.validFrameCount).toBe(framesBefore); // 프레임 증가 없음(정지)
  });

  it("holding 중 지속적으로 깨지면(debounce 초과) aligning으로 초기화된다", () => {
    let s = createHoldState();
    s = runValid(s, 5, 0, 100).state;
    // 마지막 유효(now=400)로부터 300ms(>250) 지난 무효 프레임.
    s = stepHold(s, { valid: false, now: 700, options: OPTS });
    expect(s.status).toBe(POSE_STATUS.ALIGNING);
    expect(s.validFrameCount).toBe(0);
    expect(s.holdProgress).toBe(0);
  });

  it("confirmed는 종단 상태 — 이후 step에서 justConfirmed가 다시 true가 되지 않는다(중복 실행 방지)", () => {
    let s = runValid(createHoldState(), 16, 0, 100).state;
    expect(s.status).toBe(POSE_STATUS.CONFIRMED);
    expect(s.justConfirmed).toBe(true);
    s = stepHold(s, { valid: true, now: 2000, options: OPTS });
    expect(s.status).toBe(POSE_STATUS.CONFIRMED);
    expect(s.justConfirmed).toBe(false);
    s = stepHold(s, { valid: false, now: 2100, options: OPTS });
    expect(s.status).toBe(POSE_STATUS.CONFIRMED);
    expect(s.justConfirmed).toBe(false);
  });
});
