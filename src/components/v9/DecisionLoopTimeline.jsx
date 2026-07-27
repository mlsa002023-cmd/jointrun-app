// S14 개인 타임라인 — Event/Capture/Baseline/Recheck/Comparison/Decision/Outcome을 하나의
// 시간축으로 연결한다. 원본 사진은 저장하지 않으므로 텍스트·날짜·상태만으로 구성한다.
//
// FIX-1 §3 — 루프가 여러 개 쌓여도 화면이 길어지지 않도록 압축한다:
//   - 최신 루프 1개만 기본 펼침, 이전 루프는 접힌 요약 카드('상세 보기'로 노드 표시)
//   - 펼친 상태에서도 기본 최근 3개 노드만, '전체 기록 보기'로 나머지
//   - 최신 루프가 상단, 동일 id 중복 제거, QA/test source는 production에서 숨김
//   - 날짜는 공통 dateValue로 변환(Invalid Date 노출 금지)
import { useEffect, useMemo, useState } from "react";
import { useV9Repository } from "../../hooks/useV9Repository";
import { useAuth } from "../../contexts/AuthContext";
import { trackKpiEvent } from "../../lib/analytics";
import { V9_ANALYTICS_EVENTS, DECISION_TYPE_LABEL, PERCEIVED_OUTCOME_LABEL, CONTINUED_ACTION_LABEL } from "../../lib/v9EventTypes";
import { getTriggerLabel } from "../../lib/triggerTypes";
import { PERCEIVED_CHANGE } from "../../lib/v9EventTypes";
import { formatDateValue, compareByDateDesc } from "../../lib/dateValue";
import { shouldShowQaTools } from "../../config/featureFlags";

const CHANGE_LABEL = {
  [PERCEIVED_CHANGE.LESS]: "덜함", [PERCEIVED_CHANGE.SAME]: "비슷함",
  [PERCEIVED_CHANGE.MORE]: "더함", [PERCEIVED_CHANGE.UNCLEAR]: "판단 어려움",
};

// 루프(이벤트) 진행 상태 요약 라벨.
const LOOP_STATUS_LABEL = {
  draft: "작성 중", capture_started: "측정 중", captured: "측정 완료",
  symptom_pending: "증상 기록 대기", baseline_created: "기준선 기록",
  recheck_due: "재확인 예정", rechecked: "재확인 완료", compared: "비교 완료",
  decision_logged: "선택 기록", outcome_logged: "결과 기록", completed: "완료",
  capture_failed: "측정 실패", recheck_skipped: "재확인 건너뜀",
  comparison_unreliable: "비교 신뢰도 낮음", abandoned: "중단", deleted: "삭제",
};
const COMPLETED_STATUSES = new Set(["completed", "outcome_logged"]);

const DEFAULT_NODE_LIMIT = 3;

function fmt(date) {
  return formatDateValue(date, { month: "short", day: "numeric" });
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

/** 한 루프(이벤트)의 노드 목록을 시간축 순서로 만든다. */
function buildNodes(detail) {
  const nodes = [];
  nodes.push({ state: "done", label: `${fmt(detail.createdAt)} · ${getTriggerLabel(detail.primaryTrigger)}`, desc: "판단 트리거" });

  const baseline = detail.captures?.find((c) => c.type === "baseline");
  if (baseline) {
    nodes.push({
      state: "done",
      label: `${fmt(baseline.capturedAt)} · 첫 기준선`,
      desc: `${baseline.handSide === "left" ? "왼손" : "오른손"}${baseline.qualityStatus !== "pass" && baseline.comparisonQualityStatus === "unreliable" ? " · 촬영 조건 불안정" : ""}`,
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
  return nodes;
}

function LoopCard({ detail, isLatest }) {
  const nodes = useMemo(() => buildNodes(detail), [detail]);
  const [expanded, setExpanded] = useState(isLatest); // 최신 루프만 기본 펼침
  const [showAllNodes, setShowAllNodes] = useState(false);

  const statusLabel = LOOP_STATUS_LABEL[detail.status] ?? detail.status ?? "진행 중";
  const summaryLine = `${fmt(detail.createdAt)} · ${getTriggerLabel(detail.primaryTrigger)} · ${statusLabel}`;
  const completed = COMPLETED_STATUSES.has(detail.status);

  // 펼친 상태에서도 기본 최근 3개 노드만(최신 활동이 뒤에 쌓이므로 tail 3).
  const visibleNodes = showAllNodes ? nodes : nodes.slice(-DEFAULT_NODE_LIMIT);
  const hiddenCount = nodes.length - visibleNodes.length;

  return (
    <div style={{ background: "white", border: "1px solid #E1E7EF", borderRadius: 18, padding: 16, marginBottom: 12 }} data-testid={`loop-card-${detail.id}`}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 900, color: "#16213D", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{summaryLine}</p>
          <p style={{ margin: "2px 0 0", fontSize: 11, color: completed ? "#1F9E96" : "#5B6478", fontWeight: 700 }}>
            {isLatest ? "현재 판단 루프" : completed ? "완료된 루프" : "이전 루프"}
          </p>
        </div>
        <button
          onClick={() => setExpanded((v) => !v)}
          data-testid={`loop-toggle-${detail.id}`}
          style={{ flexShrink: 0, minHeight: 40, padding: "0 12px", background: expanded ? "#EEF1F8" : "white", color: "#122A5C", border: "1px solid #E1E7EF", borderRadius: 10, fontSize: 12, fontWeight: 800 }}>
          {expanded ? "접기" : "상세 보기"}
        </button>
      </div>

      {expanded && (
        <div style={{ marginTop: 12, borderTop: "1px solid #F1F5F9", paddingTop: 8 }}>
          {visibleNodes.map((n, i) => <Node key={i} {...n} />)}
          {hiddenCount > 0 && (
            <button onClick={() => setShowAllNodes(true)} data-testid={`loop-shownodes-${detail.id}`}
              style={{ width: "100%", minHeight: 40, background: "white", color: "#122A5C", border: "1px solid #E1E7EF", borderRadius: 10, fontSize: 12, fontWeight: 800, marginTop: 4 }}>
              전체 기록 보기 (+{hiddenCount})
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// details prop이 넘어오면(controlled) 상위가 이미 getHistoryDetailed를 조회한 것이므로
// 여기서 다시 조회하지 않는다(FIX-1 §5 중복 Firestore 조회 방지). prop이 undefined면(uncontrolled)
// 기존처럼 스스로 조회한다 — 단독 사용 하위 호환. null은 "로딩 중"을 뜻하는 유효한 controlled 값이다.
export default function DecisionLoopTimeline({ details: controlledDetails }) {
  const { currentUser } = useAuth();
  const repository = useV9Repository();
  const controlled = controlledDetails !== undefined;
  const [fetchedDetails, setFetchedDetails] = useState(null);
  const qa = shouldShowQaTools(currentUser);

  useEffect(() => {
    if (currentUser?.uid) trackKpiEvent(V9_ANALYTICS_EVENTS.TIMELINE_VIEWED, currentUser.uid);
    if (controlled) return;
    let cancelled = false;
    repository.getHistoryDetailed(5).then((rows) => {
      if (!cancelled) setFetchedDetails((rows ?? []).filter(Boolean));
    });
    return () => { cancelled = true; };
  }, [repository, currentUser?.uid, controlled]);

  const details = controlled ? controlledDetails : fetchedDetails;

  // 동일 id 중복 제거 + (production) QA/test source 숨김 + 최신순 정렬.
  const loops = useMemo(() => {
    if (!details) return null;
    const seen = new Set();
    const deduped = details.filter((d) => {
      if (!d?.id || seen.has(d.id)) return false;
      seen.add(d.id);
      if (!qa && (d.isTest || d.source === "test" || d.source === "qa" || d.mock)) return false;
      return true;
    });
    return [...deduped].sort((a, b) => compareByDateDesc(a.createdAt, b.createdAt));
  }, [details, qa]);

  if (loops === null) {
    return <div style={{ padding: 16, textAlign: "center", fontSize: 12, color: "#5B6478" }}>불러오는 중...</div>;
  }
  if (loops.length === 0) {
    return (
      <div style={{ background: "#F4F6FA", border: "1px dashed #CBD1DC", borderRadius: 16, padding: 20, textAlign: "center" }}>
        <p style={{ fontSize: 13, color: "#5B6478", margin: 0 }}>아직 판단 기록이 없습니다. 첫 기준선을 만들면 여기에 타임라인이 생깁니다.</p>
      </div>
    );
  }
  return (
    <div>
      {loops.map((d, i) => <LoopCard key={d.id} detail={d} isLatest={i === 0} />)}
    </div>
  );
}
