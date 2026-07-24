// S16 요금제 — Claude Design 원본 S16-pricing 기준.
//
// 결제 연동은 하지 않는다(pricingExperiment 플래그가 꺼져 있으면 진입점 자체가 없다).
// 이 화면은 "무엇에 과금하는지"를 보여주기만 한다 — 치료 효과가 아니라 기록·비교·이력
// 보존의 가치에 과금한다는 V9 원칙을 그대로 노출한다.
import { ArrowLeft } from "lucide-react";

const PLANS = [
  {
    name: "무료 시작",
    price: "0원",
    desc: "첫 기준선 · 기본 기록",
    highlight: false,
  },
  {
    name: "4주 변화 확인 패키지",
    price: "19,900원",
    desc: "2주·4주 재확인 · 전후 리포트",
    highlight: true,
  },
  {
    name: "Premium 구독",
    price: "월 9,900원",
    desc: "무제한 기록 · 장기 타임라인",
    highlight: false,
  },
];

export default function PricingScreen({ onClose }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 300, overflowY: "auto", background: "#FFFFFF" }}>
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", padding: "24px 24px 32px" }}>
        <button
          onClick={onClose}
          style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", color: "#5B6478", fontSize: 12, fontWeight: 700, cursor: "pointer", padding: "6px 0", alignSelf: "flex-start", minHeight: 48 }}
        >
          <ArrowLeft style={{ width: 15, height: 15 }} />뒤로
        </button>

        <h1 style={{ fontSize: 24, fontWeight: 900, color: "#16213D", margin: "8px 0 24px", letterSpacing: "-0.02em" }}>
          요금제
        </h1>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              style={{
                border: plan.highlight ? "2px solid #1F9E96" : "1px solid #E1E7EF",
                borderRadius: 18,
                padding: "20px 22px",
                background: "#FFFFFF",
              }}
            >
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#5B6478" }}>{plan.name}</p>
              <p style={{ margin: "8px 0 0", fontSize: 26, fontWeight: 900, color: "#16213D", letterSpacing: "-0.02em" }}>
                {plan.price}
              </p>
              <p style={{ margin: "8px 0 0", fontSize: 14, color: "#5B6478", lineHeight: 1.5 }}>{plan.desc}</p>
            </div>
          ))}
        </div>

        <p style={{ marginTop: 24, fontSize: 12.5, color: "#8A93A6", lineHeight: 1.6 }}>
          치료 효과가 아니라 기록·비교·이력 보존의 가치에 과금합니다. 가격과 구성은 파일럿 결과에
          따라 조정될 수 있습니다.
        </p>
      </div>
    </div>
  );
}
