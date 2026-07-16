// Domain Service — 마스터플랜 §1이 요구하는 "PatternDetector" 이름의 얇은 래퍼.
// 판정 로직 자체는 src/lib/detectPattern.js에 이미 있고 그대로 재사용한다 — 여기서 새로
// 판정 로직을 만들지 않는다(§5 "PatternDetector를 호출만 하고 새 판정 로직을 만들지 마" 준수).
import { detectPattern, detectMonthlyPattern } from "../lib/detectPattern";

export const PatternDetector = {
  detect: detectPattern,
  detectMonthly: detectMonthlyPattern,
};
