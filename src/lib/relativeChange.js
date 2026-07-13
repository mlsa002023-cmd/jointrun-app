// ─────────────────────────────────────────────
// relativeChange
// 역할: 최근 스캔 값을 과거 평균(rolling window)과 비교해 "관찰된 사실"만 서술하는 문장을 고른다.
// 절대 점수(Finger Score 원점수)는 HOME 첫 화면에 노출하지 않는다는 §5.1 원칙에 따라,
// 이 모듈은 점수 자체가 아니라 판정 결과(문장)만 반환한다.
//
// 카피 가이드라인(작업지시서 §5.2) — 반드시 지킬 것:
//   - 관찰된 사실만 서술한다 (원인 진단·처방 금지, 행동 지시 금지, 판단은 사용자 몫)
// 아래 3개 문장은 작업지시서에 명시된 문구를 그대로 사용한다 — 임의로 바꾸지 않는다.
// ─────────────────────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000;

function daysAgo(date, now) {
  return (now - date) / DAY_MS;
}

function average(items) {
  return items.reduce((sum, s) => sum + s.score, 0) / items.length;
}

/**
 * scans: getScanHistory() 반환값(최신순) — { createdAt: Timestamp, scores: { total } }[]
 * 반환: { status: "insufficient" | "stable" | "worsening", message: string }
 */
export function computeRelativeChangeMessage(scans, now = new Date()) {
  if (!scans || scans.length < 3) {
    const remaining = Math.max(1, 3 - (scans?.length ?? 0));
    return {
      status: "insufficient",
      message: `아직 비교할 기록이 충분하지 않습니다. ${remaining}회 더 측정하면 변화를 보여드릴게요.`,
    };
  }

  const withDates = scans
    .map((s) => ({ date: s.createdAt?.toDate ? s.createdAt.toDate() : null, score: s.scores?.total }))
    .filter((s) => s.date && s.score != null);

  if (withDates.length < 3) {
    return {
      status: "insufficient",
      message: "아직 비교할 기록이 충분하지 않습니다. 조금 더 측정하면 변화를 보여드릴게요.",
    };
  }

  const threeWeekWindow = withDates.filter((s) => daysAgo(s.date, now) <= 21);
  const monthWindow = withDates.filter((s) => daysAgo(s.date, now) <= 30);

  if (threeWeekWindow.length >= 3) {
    const latest = withDates[0].score;
    const windowAvg = average(threeWeekWindow);
    const recentWindow = withDates.filter((s) => daysAgo(s.date, now) <= 14);
    const recentAvg = recentWindow.length >= 2 ? average(recentWindow) : latest;
    // 최근 2주 평균이 3주 평균보다 뚜렷하게(10%+) 낮으면 악화 경향으로 판정.
    if (recentAvg < windowAvg * 0.9) {
      return { status: "worsening", message: "최근 2주간 평소보다 뻣뻣한 날이 증가했습니다." };
    }
    return { status: "stable", message: "최근 3주 평균과 유사합니다." };
  }

  if (monthWindow.length >= 3) {
    return { status: "stable", message: "지난달 대비 큰 변화는 관찰되지 않았습니다." };
  }

  return {
    status: "insufficient",
    message: "아직 비교할 기록이 충분하지 않습니다. 조금 더 측정하면 변화를 보여드릴게요.",
  };
}
