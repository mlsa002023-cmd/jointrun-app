// S09 홈(다음 재확인 중심) 카드 — Claude Design 원본 S09-home 기준.
//
// 디자인 원본은 "D+9 · 다음 재확인까지 5일" 형태의 카운트다운 헤드라인 + 기준선↔재확인
// 진행 슬라이더를 보여준다. 기존 agenda 로직(recheckSchedule.js)은 그대로 쓰고 표현만 맞춘다.
//
// 기준선 날짜는 이벤트에 별도 필드로 저장하지 않으므로 week2 예정일에서 14일을 빼서 유도한다
// (computeRecheckDueDates가 기준선 + 14일 = week2라는 규칙을 쓰기 때문에 역산이 정확하다).
//
// focusSignal: 측정 완료 화면의 "다음 단계로"에서 홈으로 넘어온 직후, 이 카드로 scroll·focus·강조를
// 유도하기 위한 nonce. 값이 바뀔 때마다 한 번 스크롤·포커스하고 잠깐 강조 테두리를 보여준다.
import { useEffect, useRef, useState } from "react";
import { RECHECK_INTERVAL_DAYS } from "../../lib/recheckSchedule";

const DAY_MS = 24 * 60 * 60 * 1000;

function toDate(value) {
  if (!value) return null;
  return value?.toDate ? value.toDate() : new Date(value);
}

// 디자인 원본은 "7/1" 형태를 쓴다 — toLocaleDateString("ko-KR")은 "7. 1."로 나오므로 직접 만든다.
function fmtShort(date) {
  if (!date) return "-";
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

export default function HomeAgendaCard({ agenda, focusSignal = 0, onFocused, children }) {
  const cardRef = useRef(null);
  const [highlight, setHighlight] = useState(false);
  const recheck = agenda?.recheck;
  const dueAt = toDate(recheck?.dueAt);
  const baselineAt = dueAt && recheck?.dueType
    ? new Date(dueAt.getTime() - (RECHECK_INTERVAL_DAYS[recheck.dueType] ?? 14) * DAY_MS)
    : null;

  // 슬라이더는 기준선~예정일 구간에서 오늘이 어디쯤인지만 보여준다(0~100%).
  const progress = (() => {
    if (!baselineAt || !dueAt) return null;
    const total = dueAt.getTime() - baselineAt.getTime();
    if (total <= 0) return null;
    const elapsed = Date.now() - baselineAt.getTime();
    return Math.max(0, Math.min(100, (elapsed / total) * 100));
  })();

  const dueLabel = recheck?.dueType === "week4" ? "4주" : "2주";

  // focusSignal이 올라오면(측정 완료 → 다음 단계로) 카드로 스크롤·포커스하고 잠깐 강조한다.
  useEffect(() => {
    if (!focusSignal) return;
    const el = cardRef.current;
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    // 스크롤 애니메이션 도중 포커스가 화면을 다시 튀게 하지 않도록 preventScroll.
    try { el.focus({ preventScroll: true }); } catch { el.focus(); }
    setHighlight(true);
    onFocused?.();
    const t = setTimeout(() => setHighlight(false), 1600);
    return () => clearTimeout(t);
  }, [focusSignal, onFocused]);

  return (
    <div
      ref={cardRef}
      tabIndex={-1}
      aria-label="지금 필요한 기록"
      style={{
        background: "white",
        border: `1px solid ${highlight ? "#1F9E96" : "#E1E7EF"}`,
        boxShadow: highlight ? "0 0 0 3px rgba(31,158,150,0.22)" : "none",
        transition: "box-shadow 0.3s ease, border-color 0.3s ease",
        borderRadius: 18,
        padding: "20px 18px",
        marginBottom: 12,
        outline: "none",
        scrollMarginTop: 12,
      }}
    >
      <p style={{ margin: 0, fontSize: 11.5, fontWeight: 700, color: "#5B6478" }}>지금 필요한 기록</p>
      <h2 style={{ margin: "6px 0 0", fontSize: 20, fontWeight: 900, color: "#16213D", lineHeight: 1.35, letterSpacing: "-0.02em" }}>
        {agenda.label}
      </h2>

      {progress != null && (
        <div style={{ marginTop: 16, background: "#F4F6FA", borderRadius: 14, padding: "16px 16px 12px" }}>
          <div style={{ position: "relative", height: 6, borderRadius: 999, background: "#E1E7EF" }}>
            <span style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${progress}%`, borderRadius: 999, background: "#122A5C" }} />
            <span style={{ position: "absolute", left: 0, top: "50%", transform: "translate(-2px,-50%)", width: 11, height: 11, borderRadius: "50%", background: "#122A5C" }} />
            <span style={{ position: "absolute", right: 0, top: "50%", transform: "translate(2px,-50%)", width: 13, height: 13, borderRadius: "50%", background: "white", border: "2px solid #8A93A6" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, fontSize: 11.5, color: "#5B6478", fontWeight: 600 }}>
            <span>기준선 · {fmtShort(baselineAt)}</span>
            <span>{dueLabel} · {fmtShort(dueAt)}(예정)</span>
          </div>
        </div>
      )}

      {agenda.qualityWarning && (
        <div style={{ marginTop: 12, padding: "10px 12px", background: "#FDF6EC", border: "1px solid #F0D8AE", borderRadius: 12, fontSize: 12, color: "#8A5A20", fontWeight: 600, lineHeight: 1.5 }}>
          {agenda.qualityWarning}
        </div>
      )}

      {children}
    </div>
  );
}
