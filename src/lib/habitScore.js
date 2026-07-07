// ─────────────────────────────────────────────
// habitScore
// 역할: Habit Score(Consistency/Streak) 계산 — Finger Health Score와 완전히 별도인 체계.
// "관절 상태"가 아니라 "얼마나 꾸준히 기록했는가"만 평가한다.
// 입력은 활동일 키(YYYY-MM-DD, 로컬 타임존 기준) 문자열 배열 하나뿐 — Firestore/Date 객체를 몰라도 된다.
// ─────────────────────────────────────────────

export const HABIT_SCORE_VERSION = "v1.0";

/** 로컬 타임존 기준 YYYY-MM-DD 키. UTC(toISOString)를 쓰면 자정 전후로 하루가 밀릴 수 있어 로컬 기준으로 계산한다. */
export function todayKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function shiftDayKey(key, offsetDays) {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + offsetDays);
  return todayKey(dt);
}

/** Consistency = 최근 7일 중 활동(스캔 또는 체크인)한 날 수 / 7. */
export function computeConsistency(activeDateKeys, referenceDate = new Date()) {
  const activeSet = new Set(activeDateKeys);
  const todaysKey = todayKey(referenceDate);
  let activeInWindow = 0;
  for (let i = 0; i < 7; i++) {
    if (activeSet.has(shiftDayKey(todaysKey, -i))) activeInWindow++;
  }
  const value = Math.round((activeInWindow / 7) * 100);
  return { value, activeDays: activeInWindow, windowDays: 7, reason: `최근 7일 중 ${activeInWindow}일 활동` };
}

/** Streak = 오늘 기준 연속 기록일수. 오늘 활동이 없으면 즉시 0 — 하루라도 빠지면 리셋. */
export function computeStreak(activeDateKeys, referenceDate = new Date()) {
  const activeSet = new Set(activeDateKeys);
  let cursor = todayKey(referenceDate);
  let days = 0;
  while (activeSet.has(cursor)) {
    days++;
    cursor = shiftDayKey(cursor, -1);
  }
  return { days, reason: `${days}일 연속 기록` };
}

export function computeHabitScore(activeDateKeys, referenceDate = new Date()) {
  return {
    scoreVersion: HABIT_SCORE_VERSION,
    consistency: computeConsistency(activeDateKeys, referenceDate),
    streak: computeStreak(activeDateKeys, referenceDate),
  };
}
