// ─────────────────────────────────────────────
// recheckSchedule
// 04_APP_PRD_V9.md S06/S08 — 2주·4주 재확인 예정일 계산과 창(window) 상태 판정.
// 순수 함수만 둔다(Firestore/시간대 의존 없음) — 테스트하기 쉽고, 홈 카드/재확인 화면 양쪽에서 재사용.
// ─────────────────────────────────────────────

export const RECHECK_INTERVAL_DAYS = { week2: 14, week4: 28 };
// 예정일 전후 허용 창 — 이 범위 안에 재확인을 완료하면 "적격(recheck_completed)"으로 본다.
export const RECHECK_WINDOW_DAYS = 3;

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/** 기준선 촬영 시각을 기준으로 2주·4주 재확인 예정일을 계산한다. */
export function computeRecheckDueDates(baselineCapturedAt) {
  const base = new Date(baselineCapturedAt);
  return {
    week2DueAt: addDays(base, RECHECK_INTERVAL_DAYS.week2),
    week4DueAt: addDays(base, RECHECK_INTERVAL_DAYS.week4),
  };
}

/**
 * 재확인 예정일과 현재 시각을 비교해 상태를 판정한다.
 * - scheduled: 아직 허용 창 전 (예정일 - WINDOW 이전)
 * - due: 허용 창 안 (예정일 ± WINDOW)
 * - expired: 허용 창을 완료 없이 지남
 * 이미 completed/skipped인 recheck는 이 함수를 거치지 않고 그 상태를 그대로 표시한다(호출부 책임).
 */
export function getRecheckWindowState(dueAt, now = new Date()) {
  const due = new Date(dueAt);
  const windowStart = addDays(due, -RECHECK_WINDOW_DAYS);
  const windowEnd = addDays(due, RECHECK_WINDOW_DAYS);
  if (now < windowStart) return "scheduled";
  if (now <= windowEnd) return "due";
  return "expired";
}

export function daysUntil(dueAt, now = new Date()) {
  const due = new Date(dueAt);
  const diffMs = due.setHours(0, 0, 0, 0) - new Date(now).setHours(0, 0, 0, 0);
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * 홈 상단 카드(S07) 상태 라벨을 판정한다.
 * event: { status, rechecks: [{ dueType, dueAt, status }] } 형태를 기대한다.
 */
export function getHomeAgendaState(event, now = new Date()) {
  if (!event) return { key: "no_baseline", label: "첫 기준선 만들기" };

  const week2 = event.rechecks?.find((r) => r.dueType === "week2");
  const week4 = event.rechecks?.find((r) => r.dueType === "week4");

  if (week2 && week2.status !== "completed" && week2.status !== "skipped") {
    const state = getRecheckWindowState(week2.dueAt, now);
    if (state === "due") return { key: "recheck_ready", label: "오늘 2주 기록을 다시 확인할 수 있어요", recheck: week2 };
    if (state === "scheduled") return { key: "week2_waiting", label: `다음 재확인까지 D-${daysUntil(week2.dueAt, now)}`, recheck: week2 };
    // expired인데 아직 completed가 아니면— 그래도 재확인 자체는 유효하게 열어준다(늦게라도 기록 가능).
    return { key: "recheck_ready", label: "2주 재확인이 예정일을 지났어요. 지금 기록해보세요.", recheck: week2 };
  }

  if (week4 && week4.status !== "completed" && week4.status !== "skipped") {
    const state = getRecheckWindowState(week4.dueAt, now);
    if (state === "due") return { key: "recheck_ready", label: "오늘 4주 기록을 다시 확인할 수 있어요", recheck: week4 };
    if (state === "scheduled") return { key: "week4_waiting", label: "4주 비교까지 한 번 남았습니다", recheck: week4 };
    return { key: "recheck_ready", label: "4주 재확인이 예정일을 지났어요. 지금 기록해보세요.", recheck: week4 };
  }

  if (week4?.status === "completed" && event.status !== "outcome_logged" && event.status !== "completed") {
    return { key: "awaiting_decision", label: "선택한 관리의 결과를 기록해 주세요" };
  }

  return { key: "loop_completed", label: "이번 판단 루프를 완료했어요" };
}
