// Claude Design 토큰(RC1): 터치 영역·elevation·breakpoint.
import tokens from "./tokens.json";

export const layout = {
  touchTarget: tokens.touchTarget, // 48
  elevation: tokens.elevation,
  breakpoints: tokens.breakpoints, // desktop 1280 / tablet 768 / mobile 390
};

export const FORBIDDEN_PATTERNS = tokens.forbidden;
