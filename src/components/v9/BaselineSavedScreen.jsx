// 04_APP_PRD_V9.md S06 "첫 기준선 저장 완료" (mode="baseline") / 재확인 완료 확인(mode="recheck")
import { Check, Compass } from "lucide-react";

function formatDate(date) {
  return new Date(date).toLocaleDateString("ko-KR", { month: "long", day: "numeric" });
}

export default function BaselineSavedScreen({ mode = "baseline", week2DueAt, week4DueAt, onDone }) {
  const isBaseline = mode === "baseline";

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#f8fafc", padding: "24px 24px 32px" }}>
      <div style={{ background: "#1d4ed8", color: "white", width: 60, height: 60, borderRadius: 18, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 18, boxShadow: "0 8px 20px rgba(29,78,216,0.3)" }}>
        <Check style={{ width: 28, height: 28 }} />
      </div>

      <div style={{ fontSize: 18, fontWeight: 900, color: "#0f172a", textAlign: "center", lineHeight: 1.4 }}>
        {isBaseline ? "오늘의 상태가 첫 기준선으로 저장되었습니다." : "재확인 기록이 저장되었습니다."}
      </div>
      <div style={{ fontSize: 13, color: "#64748b", marginTop: 10, textAlign: "center", lineHeight: 1.6, maxWidth: 320 }}>
        {isBaseline
          ? "2주와 4주 뒤 같은 조건으로 다시 확인하면 과거의 나와 비교할 수 있습니다."
          : "이 기록은 기준선과 비교할 수 있는 두 번째(또는 세 번째) 지점이 되었습니다."}
      </div>

      {isBaseline && week2DueAt && week4DueAt && (
        <div style={{ marginTop: 24, width: "100%", maxWidth: 320, background: "white", border: "1px solid #e2e8f0", borderRadius: 16, padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #f1f5f9" }}>
            <span style={{ fontSize: 12, color: "#64748b", fontWeight: 700 }}>2주 재확인 예정일</span>
            <span style={{ fontSize: 12, color: "#0f172a", fontWeight: 800 }}>{formatDate(week2DueAt)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0" }}>
            <span style={{ fontSize: 12, color: "#64748b", fontWeight: 700 }}>4주 재확인 예정일</span>
            <span style={{ fontSize: 12, color: "#0f172a", fontWeight: 800 }}>{formatDate(week4DueAt)}</span>
          </div>
        </div>
      )}

      <button
        onClick={onDone}
        style={{ marginTop: 28, width: "100%", maxWidth: 320, minHeight: 48, background: "#1d4ed8", color: "white", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
      >
        <Compass style={{ width: 16, height: 16 }} />홈으로
      </button>
    </div>
  );
}
