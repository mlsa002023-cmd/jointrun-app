// 병원 담당자용 결과보고 화면 — 데스크톱/A4 인쇄 기준. 환자 모바일 리포트(FourWeekReport)와 별개다.
// 기존 V9 데이터(getHistoryDetailed)를 "읽기만" 한다 — 스키마 변경 없음.
// 제약: 판정 문구·경고 색상·권고 문장을 넣지 않는다. 관찰값과 사용자가 기록한 값만 시간순으로 나열한다.
// 지지강도·사이즈·담당자는 현재 스키마에 없어 빈 수기 기입란으로 둔다(병원에서 직접 기입).
import { useEffect, useState } from "react";
import { ArrowLeft, Printer } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useV9Repository } from "../../hooks/useV9Repository";
import { getTriggerLabel } from "../../lib/triggerTypes";
import { formatDateValue } from "../../lib/dateValue";

const FINGERS = [
  { key: "index", name: "검지" },
  { key: "middle", name: "중지" },
  { key: "ring", name: "약지" },
  { key: "pinky", name: "소지" },
];

const HAND_LABEL = { left: "왼손", right: "오른손" };
const DIR_LABEL = { radial: "엄지쪽", ulnar: "새끼쪽", neutral: "중앙" };
const SWELL = { none: "없음", mild: "조금", high: "많음", unknown: "모르겠음" };
const WARMTH = { none: "없음", present: "있음", unknown: "모르겠음" };
const FUNC = { none: "없음", mild: "가벼움", moderate: "보통", high: "큼" };

const dash = "—";
function deg(v) { return v == null || Number.isNaN(v) ? dash : `${Math.round(v)}°`; }
function dev(v, dir) {
  if (v == null || Number.isNaN(v)) return dash;
  const d = DIR_LABEL[dir];
  // 방향은 라벨(엄지쪽/새끼쪽)로 표기하므로 각도는 절댓값으로 보여 부호 중복을 피한다.
  return `${Math.abs(Math.round(v))}°${d ? ` ${d}` : ""}`;
}
function fmt(d) { return formatDateValue(d, { year: "numeric", month: "long", day: "numeric" }); }
function anonCode(uid) {
  const s = (uid || "GUEST").replace(/[^A-Za-z0-9]/g, "");
  return `JR-${(s.slice(-6) || "000000").toUpperCase()}`;
}
function findFinger(cap, key) {
  return (cap?.perFingerJointObservation || []).find((f) => f.key === key) || null;
}

export default function ClinicalSummaryReport({ onClose }) {
  const { currentUser } = useAuth();
  const repository = useV9Repository();
  const [detail, setDetail] = useState(undefined); // undefined=로딩, null=대상 없음

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const history = await repository.getHistoryDetailed(5);
      const target = (history || []).find((e) => e?.baselineCaptureId) ?? null;
      if (!cancelled) setDetail(target);
    })();
    return () => { cancelled = true; };
  }, [repository]);

  if (detail === undefined) {
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 340, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ fontSize: 13, color: "#5B6478" }}>불러오는 중...</p>
      </div>
    );
  }
  if (!detail) {
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 340, background: "#fff", padding: "24px 20px" }}>
        <button onClick={onClose} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "#5B6478", fontSize: 14, fontWeight: 700, minHeight: 48 }}>
          <ArrowLeft style={{ width: 18, height: 18 }} />뒤로
        </button>
        <p style={{ marginTop: 40, textAlign: "center", fontSize: 14, color: "#5B6478" }}>아직 기준선 기록이 없어 보고서를 만들 수 없습니다.</p>
      </div>
    );
  }

  const baselineCap = detail.captures?.find((c) => c.type === "baseline") || null;
  const week2 = detail.rechecks?.find((r) => r.dueType === "week2");
  const week4 = detail.rechecks?.find((r) => r.dueType === "week4");
  const week2Cap = week2?.captureId ? detail.captures?.find((c) => c.id === week2.captureId) : null;
  const week4Cap = week4?.captureId ? detail.captures?.find((c) => c.id === week4.captureId) : null;

  const timepoints = [
    { label: "기준선", cap: baselineCap, date: baselineCap?.capturedAt },
    { label: "2주", cap: week2Cap, date: week2?.status === "completed" ? week2?.completedAt : null },
    { label: "4주", cap: week4Cap, date: week4?.status === "completed" ? week4?.completedAt : null },
  ];

  const handSide = HAND_LABEL[baselineCap?.handSide] ?? dash;
  const directionRaw = baselineCap?.deviationDirection ?? week4Cap?.deviationDirection ?? null;
  const direction = DIR_LABEL[directionRaw] ?? dash;
  const periodStart = baselineCap?.capturedAt;
  const periodEnd = week4Cap ? (week4?.completedAt) : (week2Cap ? week2?.completedAt : baselineCap?.capturedAt);

  const th = { textAlign: "center", fontWeight: 800, padding: "6px 8px", borderBottom: "1.5px solid #16213D", fontSize: 11.5, color: "#16213D" };
  const td = { textAlign: "center", padding: "5px 8px", borderBottom: "1px solid #E1E7EF", fontSize: 11.5, color: "#16213D" };
  const tdItem = { ...td, textAlign: "left", color: "#5B6478" };
  const sectionTitle = { fontSize: 13, fontWeight: 800, color: "#16213D", margin: "0 0 8px", borderLeft: "3px solid #122A5C", paddingLeft: 8 };
  const fieldLabel = { fontSize: 11, color: "#8A93A6", fontWeight: 700 };
  const fieldVal = { fontSize: 13, color: "#16213D", fontWeight: 700 };
  const blankLine = { display: "inline-block", minWidth: 120, borderBottom: "1px solid #8A93A6", height: 16 };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 340, background: "#EEF1F6", overflowY: "auto" }} className="jr-clinical-root">
      <style>{`
        @page { size: A4 portrait; margin: 12mm; }
        @media print {
          .jr-clinical-noprint { display: none !important; }
          .jr-clinical-root { position: static !important; background: #fff !important; overflow: visible !important; }
          .jr-clinical-page { box-shadow: none !important; margin: 0 !important; width: auto !important; }
          .jr-clinical-page section { break-inside: avoid; }
        }
      `}</style>

      <div className="jr-clinical-noprint" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", maxWidth: 820, margin: "0 auto", padding: "16px 16px 0" }}>
        <button onClick={onClose} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "#5B6478", fontSize: 14, fontWeight: 700, minHeight: 48, cursor: "pointer" }}>
          <ArrowLeft style={{ width: 18, height: 18 }} />뒤로
        </button>
        <button onClick={() => window.print()} style={{ display: "flex", alignItems: "center", gap: 6, minHeight: 48, padding: "0 18px", background: "#122A5C", color: "#fff", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          <Printer style={{ width: 15, height: 15 }} />인쇄 / PDF로 저장
        </button>
      </div>

      <div className="jr-clinical-page" style={{ width: "210mm", maxWidth: "calc(100% - 24px)", minHeight: "297mm", margin: "16px auto 40px", background: "#fff", boxShadow: "0 6px 24px rgba(16,24,40,.1)", padding: "18mm 16mm", boxSizing: "border-box", color: "#16213D" }}>
        {/* 헤더 */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", borderBottom: "2px solid #122A5C", paddingBottom: 10, marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 12, color: "#122A5C", fontWeight: 800, letterSpacing: ".04em" }}>JOINTRUN</div>
            <div style={{ fontSize: 20, fontWeight: 900, marginTop: 2 }}>관찰 기록 비교 보고서</div>
          </div>
          <div style={{ textAlign: "right", fontSize: 11.5, color: "#5B6478", lineHeight: 1.7 }}>
            <div>기록 트리거: {getTriggerLabel(detail.primaryTrigger)}</div>
            <div>측정 방식: {baselineCap?.poseProtocolVersion || dash}</div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
          <div><div style={fieldLabel}>환자 식별자(익명)</div><div style={fieldVal}>{anonCode(currentUser?.uid)}</div></div>
          <div><div style={fieldLabel}>적용 기간</div><div style={fieldVal}>{fmt(periodStart)} ~ {fmt(periodEnd)}</div></div>
          <div><div style={fieldLabel}>담당자</div><div style={{ marginTop: 4 }}><span style={blankLine} />&nbsp;</div></div>
          <div><div style={fieldLabel}>사용 손</div><div style={fieldVal}>{handSide}</div></div>
          <div><div style={fieldLabel}>기준선일</div><div style={fieldVal}>{fmt(baselineCap?.capturedAt)}</div></div>
        </div>

        {/* 관찰값 비교표 */}
        <section style={{ marginBottom: 16 }}>
          <h3 style={sectionTitle}>손가락 관절 관찰값 — 기준선 · 2주 · 4주 비교</h3>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ ...th, textAlign: "left", width: "20%" }}>손가락</th>
                <th style={{ ...th, textAlign: "left", width: "28%" }}>관찰 항목</th>
                <th style={{ ...th, width: "17%" }}>기준선</th>
                <th style={{ ...th, width: "17%" }}>2주</th>
                <th style={{ ...th, width: "18%" }}>4주</th>
              </tr>
            </thead>
            <tbody>
              {FINGERS.map((fg) => {
                const cells = timepoints.map((t) => findFinger(t.cap, fg.key));
                const rows = [
                  { label: "끝마디(DIP) 활동범위", get: (f) => deg(f?.dipActiveRomDeg) },
                  { label: "중간마디(PIP) 활동범위", get: (f) => deg(f?.pipActiveRomDeg) },
                  { label: "끝마디 좌우 치우침", get: (f) => dev(f?.dipExtensionPoseDeviationDeg, f?.dipDeviationDirection) },
                ];
                return rows.map((r, i) => (
                  <tr key={fg.key + i}>
                    {i === 0 && <td rowSpan={rows.length} style={{ ...td, textAlign: "left", fontWeight: 800, verticalAlign: "top", background: "#F7F9FC" }}>{fg.name}</td>}
                    <td style={tdItem}>{r.label}</td>
                    {cells.map((f, j) => <td key={j} style={td}>{r.get(f)}</td>)}
                  </tr>
                ));
              })}
            </tbody>
          </table>
          <p style={{ fontSize: 10.5, color: "#8A93A6", margin: "6px 0 0" }}>각도(°)는 관찰된 값이며, 값이 없으면 줄표(—)로 표기합니다. 좌우 치우침은 편 상태 기준 방향입니다.</p>
        </section>

        {/* 시점별 사용 상황·불편 메모 요약 */}
        <section style={{ marginBottom: 16 }}>
          <h3 style={sectionTitle}>시점별 사용 상황·불편 메모 (사용자 자기기록)</h3>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ ...th, textAlign: "left", width: "28%" }}>항목</th>
                <th style={th}>기준선</th><th style={th}>2주</th><th style={th}>4주</th>
              </tr>
            </thead>
            <tbody>
              {[
                { label: "통증 (0~10)", get: (s) => (s?.painSelfReport ?? dash) },
                { label: "뻣뻣함 (0~10)", get: (s) => (s?.stiffnessSelfReport ?? dash) },
                { label: "붓기", get: (s) => (SWELL[s?.swellingSelfReport] ?? dash) },
                { label: "열감", get: (s) => (WARMTH[s?.warmthSelfReport] ?? dash) },
                { label: "손 사용 불편", get: (s) => (FUNC[s?.functionDifficulty] ?? dash) },
              ].map((r, i) => (
                <tr key={i}>
                  <td style={tdItem}>{r.label}</td>
                  {timepoints.map((t, j) => <td key={j} style={td}>{r.get(t.cap?.symptomSnapshot)}</td>)}
                </tr>
              ))}
              <tr>
                <td style={tdItem}>상황 메모</td>
                {timepoints.map((t, j) => (
                  <td key={j} style={{ ...td, textAlign: "left", fontSize: 10.5, color: "#5B6478" }}>{t.cap?.symptomSnapshot?.note || dash}</td>
                ))}
              </tr>
            </tbody>
          </table>
        </section>

        {/* 피팅 사양 기록 */}
        <section style={{ marginBottom: 16 }}>
          <h3 style={sectionTitle}>피팅 사양 기록</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, border: "1px solid #E1E7EF", borderRadius: 8, padding: 12 }}>
            <div><div style={fieldLabel}>좌우</div><div style={fieldVal}>{handSide}</div></div>
            <div><div style={fieldLabel}>방향</div><div style={fieldVal}>{direction}</div></div>
            <div><div style={fieldLabel}>지지강도</div><div style={{ marginTop: 4 }}><span style={blankLine} />&nbsp;</div></div>
            <div><div style={fieldLabel}>사이즈</div><div style={{ marginTop: 4 }}><span style={blankLine} />&nbsp;</div></div>
          </div>
        </section>

        {/* 고지문 */}
        <section style={{ marginTop: 18, paddingTop: 12, borderTop: "1px solid #E1E7EF" }}>
          <p style={{ fontSize: 11, color: "#8A93A6", lineHeight: 1.6, margin: 0 }}>
            본 보고서는 기록 비교 자료이며 진단이나 의학적 판단을 제공하지 않습니다.
          </p>
        </section>
      </div>
    </div>
  );
}
