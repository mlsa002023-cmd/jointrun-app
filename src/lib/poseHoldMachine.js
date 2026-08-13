// ─────────────────────────────────────────────
// poseHoldMachine — P0-14 공통 측정 상태머신 (§3)
//
// aligning → holding → confirmed. 순수 함수이며 시간(now)을 인자로 받아 테스트 가능하다.
//
// 원칙:
//   - aligning에서는 진행률이 0이다(자세가 맞기 전에는 측정이 진행되지 않는다).
//   - 자세가 유효해진 뒤에만 holding이 시작된다.
//   - holding은 "최소 유지 시간"과 "필요한 유효 프레임 수"를 모두 충족해야 confirmed가 된다.
//   - 자세가 깨지면 짧은 순간(debounce)은 진행을 멈추고, 그보다 길면 aligning으로 초기화한다.
//   - 잘못된 자세를 "시간이 지났다"는 이유로 자동 승인하지 않는다(타이머 자동확정 없음).
//   - confirmed는 종단 상태다 — 다시 step해도 confirm 콜백이 중복 실행되지 않는다.
// ─────────────────────────────────────────────

export const POSE_STATUS = {
  ALIGNING: "aligning",
  HOLDING: "holding",
  CONFIRMED: "confirmed",
};

export const DEFAULT_HOLD_OPTIONS = {
  minHoldMs: 1500, // §3 "최소 1.5초"
  requiredValidFrames: 8, // 안정 프레임 수(≈10fps에서 1.5초). 포즈별로 덮어쓸 수 있다.
  debounceMs: 250, // §3 "약 200~300ms debounce"
};

export function createHoldState() {
  return {
    status: POSE_STATUS.ALIGNING,
    holdStartMs: null, // holding이 시작된 시각(첫 유효 프레임)
    validFrameCount: 0, // holding 동안 누적된 유효 프레임 수
    lastValidMs: null, // 마지막으로 유효했던 시각(debounce 판정용)
    holdProgress: 0, // 0..1 (aligning=0)
    justConfirmed: false, // 이번 step에서 막 confirmed로 전이했는가(콜백 1회 실행용)
  };
}

function progressOf(elapsedMs, validFrameCount, opts) {
  const byTime = opts.minHoldMs > 0 ? elapsedMs / opts.minHoldMs : 1;
  const byFrames = opts.requiredValidFrames > 0 ? validFrameCount / opts.requiredValidFrames : 1;
  return Math.max(0, Math.min(1, Math.min(byTime, byFrames)));
}

/**
 * 상태머신 한 스텝. 새 상태 객체를 반환한다(입력 state를 변형하지 않음).
 * @param {object} state createHoldState()로 만든 이전 상태
 * @param {object} args
 * @param {boolean} args.valid 이 프레임에서 자세가 유효한가(evaluatePoseFrame.valid)
 * @param {number}  args.now performance.now() 등 단조 증가 시각(ms)
 * @param {object}  [args.options] { minHoldMs, requiredValidFrames, debounceMs }
 * @returns {object} 새 상태. status===CONFIRMED이고 justConfirmed===true일 때만 확정 콜백을 1회 실행한다.
 */
export function stepHold(state, { valid, now, options }) {
  const opts = { ...DEFAULT_HOLD_OPTIONS, ...(options || {}) };

  // 이미 확정됨 — 어떤 프레임이 와도 다시 확정 콜백을 부르지 않는다(중복 실행 방지).
  if (state.status === POSE_STATUS.CONFIRMED) {
    return { ...state, justConfirmed: false };
  }

  // 아직 aligning: 유효 프레임이 오기 전까지 진행률 0.
  if (state.status === POSE_STATUS.ALIGNING) {
    if (!valid) {
      return { ...state, holdProgress: 0, justConfirmed: false };
    }
    // 첫 유효 프레임 → holding 시작.
    const validFrameCount = 1;
    const holdProgress = progressOf(0, validFrameCount, opts);
    return {
      status: POSE_STATUS.HOLDING,
      holdStartMs: now,
      validFrameCount,
      lastValidMs: now,
      holdProgress,
      justConfirmed: false,
    };
  }

  // holding 상태.
  if (!valid) {
    // 자세가 깨짐 — 짧은 blip이면 진행 정지, 길면 초기화.
    const sinceValid = state.lastValidMs != null ? now - state.lastValidMs : Infinity;
    if (sinceValid <= opts.debounceMs) {
      // debounce 구간: 진행률을 올리지도, 초기화하지도 않는다(정지).
      return { ...state, justConfirmed: false };
    }
    // 지속적으로 깨짐 → aligning으로 초기화.
    return createHoldState();
  }

  // 유효 프레임 지속 → 프레임 누적, 경과시간 갱신.
  const validFrameCount = state.validFrameCount + 1;
  const holdStartMs = state.holdStartMs ?? now;
  const elapsed = now - holdStartMs;
  const holdProgress = progressOf(elapsed, validFrameCount, opts);

  const meetsTime = elapsed >= opts.minHoldMs;
  const meetsFrames = validFrameCount >= opts.requiredValidFrames;
  if (meetsTime && meetsFrames) {
    return {
      status: POSE_STATUS.CONFIRMED,
      holdStartMs,
      validFrameCount,
      lastValidMs: now,
      holdProgress: 1,
      justConfirmed: true,
    };
  }

  return {
    status: POSE_STATUS.HOLDING,
    holdStartMs,
    validFrameCount,
    lastValidMs: now,
    holdProgress,
    justConfirmed: false,
  };
}
