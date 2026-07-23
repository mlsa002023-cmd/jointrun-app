// S15 4주 리포트 — 최소 버전. 원본 사진 없이 사용자 입력값·날짜·상태만으로 구성한다(RC1 지시서
// 비교 화면 제약과 동일 원칙). 치료 효과나 질환 악화를 요약하지 않는다 — 관찰된 기록만 나열한다.
import { useEffect, useState } from "react";
import { ArrowLeft, Printer } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useV9Repository } from "../../hooks/useV9Repository";
import { trackKpiEvent } from "../../lib/analytics";
import { V9_ANALYTICS_EVENTS, DECISION_TYPE_LABEL, DECISION_REASON_LABEL, PERCEIVED_OUTCOME_LABEL, CONTINUED_ACTION_LABEL } from "../../lib/v9EventTypes";
import { getTriggerLabel } from "../../lib/triggerTypes";
import { isReliableCapture } from "../../lib/captureQuality";

const SYMPTOM_ROWS = [
  { key: "painSelfReport", label: "통증 체감" },
  { key: "stiffnessSelfReport", label: "뻣뻣함 체감" },
  { key: "swellingSelfReport", label: "붓기 체감" },
  { key: "warmthSelfReport", label: "열감 체감" },
  { key: "functionDifficulty", label: "손 사용 불편" },
];

function fmt(date) {
  if (!date) return "-";
  return new Date(date).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
}

const SYMPTOM_VALUE_LABEL = {
  swellingSelfReport: { none: "없음", mild: "조금", high: "많음", unknown: "모르겠음" },
  warmthSelfReport: { none: "없음", present: "있음", unknown: "모르겠음" },
  functionDifficulty: { none: "없음", mild: "가벼움", moderate: "보통", high: "큼" },
};

function formatSymptomValue(key, value) {
  if (value == null) return "—";
  const map = SYMPTOM_VALUE_LABEL[key];
  return map ? (map[value] ?? value) : value;
}

export default function FourWeekReport({ onClose }) {
  const { currentUser } = useAuth();
  const repository = useV9Repository();
  const [detail, setDetail] = useState(undefined); // undefined=로딩, null=대상 없음

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const history = await repository.getHistoryDetailed(5);
      // 기준선이 있는 가장 최근 Event를 리포트 대상으로 삼는다(완료 여부와 무관하게 현재까지의 기록을 보여줌).
      const target = history.find((e) => e?.baselineCaptureId) ?? null;
      if (!cancelled) setDetail(target);
    })();
    if (currentUser?.uid) trackKpiEvent(V9_ANALYTICS_EVENTS.REPORT_VIEWED, currentUser.uid);
    return () => { cancelled = true; };
  }, [repository, currentUser?.uid]);

  if (detail === undefined) {
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 300, background: "#F4F6FA", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ fontSize: 13, color: "#5B6478" }}>불러오는 중...</p>
      </div>
    );
  }

  if (!detail) {
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 300, background: "#F4F6FA", padding: "24px 20px" }}>
        <button onClick={onClose} style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", color: "#5B6478", fontSize: 12, fontWeight: 700, minHeight: 48 }}>
          <ArrowLeft style={{ width: 15, height: 15 }} />뒤로
        </button>
        <div style={{ marginTop: 40, textAlign: "center" }}>
          <p style={{ fontSize: 14, color: "#5B6478" }}>아직 기준선이 없어 4주 리포트를 만들 수 없습니다. 첫 기준선을 먼저 만들어주세요.</p>
        </div>
      </div>
    );
  }

  const baseline = detail.captures?.find((c) => c.type === "baseline");
  const week2 = detail.rechecks?.find((r) => r.dueType === "week2");
  const week4 = detail.rechecks?.find((r) => r.dueType === "week4");
  const week4Capture = week4?.captureId ? detail.captures?.find((c) => c.id === week4.captureId) : null;
  const latestSymptom = week4Capture?.symptomSnapshot ?? baseline?.symptomSnapshot;
  const decision = detail.decisions?.[0];
  const outcome = detail.outcomes?.[0];

  const qualityWarnings = [];
  if (baseline && !isReliableCapture(baseline)) qualityWarnings.push("기준선 촬영 조건이 불안정했습니다.");
  if (week4Capture && !isReliableCapture(week4Capture)) qualityWarnings.push("4주 재확인 촬영 조건이 불안정했습니다.");

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 300, background: "#F4F6FA", overflowY: "auto" }} className="v9-report-root">
      <style>{`
        @media print {
          .v9-report-no-print { display: none !important; }
          .v9-report-root { position: static !important; background: white !important; }
        }
      `}</style>
      <div className="v9-report-no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 20px 0" }}>
        <button onClick={onClose} style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", color: "#5B6478", fontSize: 12, fontWeight: 700, minHeight: 48 }}>
          <ArrowLeft style={{ width: 15, height: 15 }} />뒤로
        </button>
        <button onClick={() => window.print()} style={{ display: "flex", alignItems: "center", gap: 6, minHeight: 44, padding: "0 16px", background: "#122A5C", color: "white", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700 }}>
          <Printer style={{ width: 14, height: 14 }} />인쇄 / PDF로 저장
        </button>
      </div>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "20px 20px 48px" }}>
        <div style={{ fontSize: 13, color: "#122A5C", fontWeight: 700, marginBottom: 6 }}>4주 리포트</div>
        <div style={{ fontSize: 22, fontWeight: 900, color: "#16213D", marginBottom: 4 }}>{getTriggerLabel(detail.primaryTrigger)}</div>
        <div style={{ fontSize: 13, color: "#5B6478", marginBottom: 24 }}>기준선 {fmt(baseline?.capturedAt)} 기록 기준</div>

        <section style={{ background: "white", border: "1px solid #E1E7EF", borderRadius: 16, padding: 18, marginBottom: 16 }}>
          <h3 style={{ fontSize: 15, fontWeight: 800, color: "#16213D", margin: "0 0 10px" }}>재확인 진행 상황</h3>
          <p style={{ fontSize: 14, color: "#16213D", margin: "4px 0" }}>2주 재확인: {week2?.status === "completed" ? `완료 (${fmt(week2.completedAt)})` : week2?.status === "skipped" ? "건너뜀" : "미완료"}</p>
          <p style={{ fontSize: 14, color: "#16213D", margin: "4px 0" }}>4주 재확인: {week4?.status === "completed" ? `완료 (${fmt(week4.completedAt)})` : week4?.status === "skipped" ? "건너뜀" : "미완료"}</p>
        </section>

        <section style={{ background: "white", border: "1px solid #E1E7EF", borderRadius: 16, padding: 18, marginBottom: 16 }}>
          <h3 style={{ fontSize: 15, fontWeight: 800, color: "#16213D", margin: "0 0 10px" }}>사용자가 기록한 증상 변화</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, fontSize: 12, fontWeight: 700, color: "#8A93A6", marginBottom: 8 }}>
            <span>항목</span><span style={{ textAlign: "center" }}>기준선</span><span style={{ textAlign: "center" }}>최근 기록</span>
          </div>
          {SYMPTOM_ROWS.map((row) => (
            <div key={row.key} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, padding: "8px 0", borderTop: "1px solid #F1F3F7" }}>
              <span style={{ fontSize: 13, color: "#16213D" }}>{row.label}</span>
              <span style={{ fontSize: 14, fontWeight: 700, textAlign: "center" }}>{formatSymptomValue(row.key, baseline?.symptomSnapshot?.[row.key])}</span>
              <span style={{ fontSize: 14, fontWeight: 700, textAlign: "center" }}>{formatSymptomValue(row.key, latestSymptom?.[row.key])}</span>
            </div>
          ))}
        </section>

        <section style={{ background: "white", border: "1px solid #E1E7EF", borderRadius: 16, padding: 18, marginBottom: 16 }}>
          <h3 style={{ fontSize: 15, fontWeight: 800, color: "#16213D", margin: "0 0 10px" }}>선택한 관리와 결과</h3>
          {decision ? (
            <p style={{ fontSize: 14, color: "#16213D", margin: "4px 0" }}>
              선택: {DECISION_TYPE_LABEL[decision.decisionType] ?? decision.decisionType} ({DECISION_REASON_LABEL[decision.reason] ?? decision.reason})
            </p>
          ) : (
            <p style={{ fontSize: 13, color: "#8A93A6", margin: "4px 0" }}>아직 Decision Log가 없습니다.</p>
          )}
          {outcome ? (
            <p style={{ fontSize: 14, color: "#16213D", margin: "4px 0" }}>
              결과: {PERCEIVED_OUTCOME_LABEL[outcome.perceivedChange] ?? outcome.perceivedChange} · {CONTINUED_ACTION_LABEL[outcome.continuedAction] ?? outcome.continuedAction}
            </p>
          ) : (
            <p style={{ fontSize: 13, color: "#8A93A6", margin: "4px 0" }}>아직 결과 기록이 없습니다.</p>
          )}
        </section>

        {qualityWarnings.length > 0 && (
          <section style={{ background: "#FDF1EE", border: "1px solid #F3C7BB", borderRadius: 16, padding: 16, marginBottom: 16 }}>
            <h3 style={{ fontSize: 13, fontWeight: 800, color: "#B3462E", margin: "0 0 8px" }}>촬영 품질 안내</h3>
            {qualityWarnings.map((w) => <p key={w} style={{ fontSize: 13, color: "#B3462E", margin: "2px 0" }}>{w}</p>)}
          </section>
        )}

        <section style={{ padding: "0 4px" }}>
          <p style={{ fontSize: 12, color: "#8A93A6", lineHeight: 1.6 }}>
            이 리포트는 사용자가 직접 기록한 증상 체감값과 선택·결과를 시간순으로 정리한 것입니다.
            질환의 진단, 악화·호전 판정, 치료 효과를 확정하지 않습니다. 통증이나 변형이 지속되거나
            심해지는 경우 의료진과 상담하세요.
          </p>
        </section>
      </div>
    </div>
  );
}
