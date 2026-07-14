// 브랜드 팔레트(작업지시서 §0: UI = Blue #2563EB + Cyan 강조, Health = Green) +
// 이미 화면에서 쓰이고 있는 상태 색(good/stable/warning/danger, ReportModule 기준).
// JOINTRUNShell.jsx의 인라인 style에서는 이 상수를, 그 외 컴포넌트는 tailwind.config.js의
// 동일한 값을 참조하는 유틸리티 클래스(bg-brand 등)를 쓴다 — 값의 출처는 하나다.
export const color = {
  brand: "#2563EB",
  brandCyan: "#06B6D4",
  health: "#16A34A",

  status: {
    good: { bg: "#EFF6FF", border: "#BFDBFE", text: "#1D4ED8" },
    stable: { bg: "#FFFBEB", border: "#FDE68A", text: "#B45309" },
    warning: { bg: "#FFF7ED", border: "#FED7AA", text: "#C2410C" },
    danger: { bg: "#FEF2F2", border: "#FECACA", text: "#B91C1C" },
  },

  surface: "#FFFFFF",
  surfaceMuted: "#F8FAFC",
  border: "#E2E8F0",

  text: {
    primary: "#0F172A",
    secondary: "#334155",
    muted: "#64748B",
    faint: "#94A3B8",
  },
};
