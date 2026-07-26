// RC1.2.2 P0-12 — 결과·비교 화면 최상단 한줄 요약 카드.
//
// 상세 숫자를 읽기 전에 "어디를 봐야 하는가"를 먼저 보여준다. 규칙 기반으로 만들어진
// 문장만 표시하며, 이 컴포넌트는 어떤 판정도 하지 않는다(문장 생성은 observationSummary.js).
//
// 320px에서도 가로 스크롤이 생기지 않도록 고정 폭·nowrap을 쓰지 않는다.
export default function ObservationSummaryCard({ summary }) {
  if (!summary?.headline) return null;

  return (
    <section
      data-testid="observation-summary"
      aria-label={summary.title}
      style={{
        background: "#F4F6FA",
        border: "1px solid #E1E7EF",
        borderRadius: 14,
        padding: 14,
        marginBottom: 12,
        maxWidth: "100%",
      }}
    >
      <p style={{ fontSize: 11, fontWeight: 800, color: "#5B6478", margin: 0, marginBottom: 6 }}>
        {summary.title}
      </p>
      <p
        data-testid="observation-summary-headline"
        style={{ fontSize: 14, fontWeight: 800, color: "#0f172a", margin: 0, lineHeight: 1.5, wordBreak: "keep-all" }}
      >
        {summary.headline}
      </p>
      {summary.secondaryText && (
        <p style={{ fontSize: 12, color: "#5B6478", margin: 0, marginTop: 6, lineHeight: 1.6, wordBreak: "keep-all" }}>
          {summary.secondaryText}
        </p>
      )}
    </section>
  );
}
