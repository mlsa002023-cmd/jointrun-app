// S14 개인 타임라인 — Event/Capture/Baseline/Recheck/Comparison/Decision/Outcome을 하나의
// 시간축으로 연결한다. 원본 사진은 저장하지 않으므로(RC1 지시서 비교 화면 제약과 동일 원칙),
// 여기도 텍스트·날짜·상태만으로 구성한다.
import { useEffect, useState } from "react";
import { useV9Repository } from "../../hooks/useV9Repository";
import { useAuth } from "../../contexts/AuthContext";
import { trackKpiEvent } from "../../lib/analytics";
import { V9_ANALYTICS_EVENTS, DECISION_TYPE_LABEL, PERCEIVED_OUTCOME_LABEL, CONTINUED_ACTION_LABEL } from "../../lib/v9EventTypes";
import { getTriggerLabel } from "../../lib/triggerTypes";
import { PERCEIVED_CHANGE } from "../../lib/v9EventTypes";

const CHANGE_LABEL = {
  [PERCEIVED_CHANGE.LESS]: "덜함", [PERCEIVED_CHANGE.SAME]: "비슷함",
  [PERCEIVED_CHANGE.MORE]: "더함", [PERCEIVED_CHANGE.UNCLEAR]: "판단 어려움",
};

function fmt(date) {
  if (!date) return "-";
  return new Date(date).toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
}

function Node({ state, label, desc }) {
  const dotColor = state === "done" ? "#122A5C" : state === "current" ? "#1F9E96" : "#CBD1DC";
  return (
    <div style={{ display: "flex", gap: 10, padding: "8px 0" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 4 }}>
        <span style={{ width: 10, height: 10, borderRadius: "50%", background: dotColor, flexShrink: 0 }} />
        <span style={{ flex: 1, width: 1, background: "#E1E7EF", marginTop: 2 }} />
      </div>
      <div style={{ paddingBottom: 6 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: "#16213D" }}>{label}</p>
        {desc && <p style={{ margin: "2px 0 0", fontSize: 12, color: "#5B6478" }}>{desc}</p>}
      </div>
    </div>
  );
}

function EventTimelineCard({ detail }) {
  const nodes = [];
  nodes.push({ state: "done", label: `${fmt(detail.createdAt)} · ${getTriggerLabel(detail.primaryTrigger)}`, desc: "판단 트리거" });

  const baseline = detail.captures?.find((c) => c.type === "baseline");
  if (baseline) {
    nodes.push({
      state: "done",
      label: `${fmt(baseline.capturedAt)} · 첫 기준선`,
      desc: `${baseline.handSide === "left" ? "왼손" : "오른손"}${baseline.qualityStatus !== "pass" ? " · 촬영 조건 불안정" : ""}`,
    });
  }

  for (const recheck of detail.rechecks ?? []) {
    const label = recheck.dueType === "week2" ? "2주 재확인" : "4주 재확인";
    if (recheck.status === "completed") {
      nodes.push({ state: "done", label: `${fmt(recheck.completedAt)} · ${label}`, desc: recheck.qualityStatus !== "pass" ? "촬영 조건 불안정" : "완료" });
    } else if (recheck.status === "skipped") {
      nodes.push({ state: "upcoming", label, desc: "건너뜀" });
    } else {
      nodes.push({ state: "upcoming", label, desc: `예정일 ${fmt(recheck.dueAt)}` });
    }
  }

  for (const comparison of detail.comparisons ?? []) {
    nodes.push({
      state: "done",
      label: `${fmt(comparison.viewedAt)} · 과거의 나와 비교`,
      desc: comparison.comparable ? `사용자 보고: ${CHANGE_LABEL[comparison.userPerceivedChange] ?? "-"}` : "비교 신뢰도 낮음(촬영 조건 불일치)",
    });
  }

  for (const decision of detail.decisions ?? []) {
    nodes.push({ state: "done", label: `${fmt(decision.createdAt)} · Decision Log`, desc: DECISION_TYPE_LABEL[decision.decisionType] ?? decision.decisionType });
  }

  for (const outcome of detail.outcomes ?? []) {
    nodes.push({
      state: "done",
      label: `${fmt(outcome.recordedAt)} · 결과 기록`,
      desc: `${PERCEIVED_OUTCOME_LABEL[outcome.perceivedChange] ?? "-"} · ${CONTINUED_ACTION_LABEL[outcome.continuedAction] ?? "-"}`,
    });
  }

  return (
    <div style={{ background: "white", border: "1px solid #E1E7EF", borderRadius: 18, padding: 16, marginBottom: 12 }}>
      {nodes.map((n, i) => <Node key={i} {...n} />)}
    </div>
  );
}

export default function DecisionLoopTimeline() {
  const { currentUser } = useAuth();
  const repository = useV9Repository();
  const [details, setDetails] = useState(null);

  useEffect(() => {
    let cancelled = false;
    repository.getHistoryDetailed(5).then((rows) => {
      if (!cancelled) setDetails(rows.filter(Boolean));
    });
    if (currentUser?.uid) trackKpiEvent(V9_ANALYTICS_EVENTS.TIMELINE_VIEWED, currentUser.uid);
    return () => { cancelled = true; };
  }, [repository, currentUser?.uid]);

  if (details === null) {
    return <div style={{ padding: 16, textAlign: "center", fontSize: 12, color: "#5B6478" }}>불러오는 중...</div>;
  }
  if (details.length === 0) {
    return (
      <div style={{ background: "#F4F6FA", border: "1px dashed #CBD1DC", borderRadius: 16, padding: 20, textAlign: "center" }}>
        <p style={{ fontSize: 13, color: "#5B6478", margin: 0 }}>아직 판단 기록이 없습니다. 첫 기준선을 만들면 여기에 타임라인이 생깁니다.</p>
      </div>
    );
  }
  return (
    <div>
      {details.map((d) => <EventTimelineCard key={d.id} detail={d} />)}
    </div>
  );
}
