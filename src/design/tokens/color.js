// Claude Design 토큰(RC1 디자인 통합, src/design/tokens/tokens.json)을 그대로 반영한다.
// 값의 출처는 tokens.json 하나 — 여기서는 화면에서 쓰기 편한 이름으로만 재노출한다.
// brand/brandCyan(구 blue-600/cyan-500)은 호출부 호환을 위해 남기고 navy/teal 값을 담는다.
import tokens from "./tokens.json";

export const color = {
  brand: tokens.color.navy, // #122A5C — 기존 brand(#2563EB) 대체
  brandCyan: tokens.color.teal, // #1F9E96 — 기존 brandCyan(#06B6D4) 대체
  health: tokens.color.teal,

  navy: tokens.color.navy,
  navy2: tokens.color.navy2,
  teal: tokens.color.teal,
  tealLight: tokens.color.tealLight,

  status: {
    good: { bg: "#EAF6F5", border: "#BFE7E3", text: tokens.color.teal },
    stable: { bg: "#FFFBEB", border: "#FDE68A", text: "#B45309" },
    warning: { bg: "#FDF1EE", border: "#F3C7BB", text: tokens.color.warn },
    danger: { bg: "#FDF1EE", border: "#F3C7BB", text: tokens.color.warn },
  },

  surface: tokens.color.surface,
  surfaceMuted: tokens.color.bg,
  border: tokens.color.line,

  text: {
    primary: tokens.color.ink,
    secondary: tokens.color.sub,
    muted: tokens.color.sub,
    faint: "#8A93A6",
  },
};
