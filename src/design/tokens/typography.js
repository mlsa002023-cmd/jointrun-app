// Claude Design 토큰(RC1): 본문 17px 최소 기준 포함.
// 기존 화면(레거시, 11~16px)은 이번 스프린트 범위 밖 — 신규 V9 화면부터 이 스케일을 쓴다.
import tokens from "./tokens.json";

export const typography = {
  size: {
    caption: tokens.type.caption, // 13
    body: tokens.type.body, // 17 — 접근성 최소 기준
    emphasis: tokens.type.emphasis, // 20
    h2: tokens.type.h2, // 28
    h1Mobile: tokens.type.h1Mobile, // 28
    h1Desktop: tokens.type.h1Desktop, // 52
    display: tokens.type.display, // 44

    // 레거시 호출부 호환(구 label/subtitle/title/heading 이름) — 값만 새 토큰으로 매핑.
    label: tokens.type.caption,
    subtitle: tokens.type.caption,
    title: tokens.type.body,
    heading: tokens.type.emphasis,
  },
  weight: {
    regular: 400,
    medium: 500,
    bold: 700,
    black: 900,
  },
  fontFamily: tokens.font.family,
  monoFontFamily: tokens.font.mono,
};
