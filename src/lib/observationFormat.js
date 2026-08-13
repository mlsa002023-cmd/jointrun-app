// ─────────────────────────────────────────────
// ObservationFormat — 관찰값 표기 규칙 한 곳 (RC1.2.2 P0-12.1)
//
// 결과 화면·비교 화면·한줄 요약이 모두 이 함수만 쓴다. 화면마다 따로 반올림하거나 부호를
// 다르게 보여주면 같은 기록이 다른 값처럼 읽히기 때문이다.
//
// 규칙:
//   - 실제 0은 "0°", 값 누락은 "—" (둘을 섞지 않는다)
//   - 좌우 값은 부호를 노출하지 않고 "크기 + 방향"으로 적는다
//   - 요약이 숫자를 말할 때도 화면에 보이는 반올림값끼리 비교한다(상세표와 어긋나지 않게)
// ─────────────────────────────────────────────

export const MISSING = "—";

/** 이 퍼센트 미만의 좌우 차이는 방향을 단정하지 않는다. */
export const ASYMMETRY_NEUTRAL_PERCENT = 5;

export const DIRECTION_LABEL = {
  radial: "엄지쪽",
  ulnar: "새끼쪽",
  neutral: "치우침 없음",
};

/** 각도 — 화면에 실제로 찍히는 정수값. 요약도 이 값을 기준으로 차이를 낸다. */
export function roundDeg(v) {
  return Number.isFinite(v) ? Math.round(v) : null;
}

export function fmtDeg(v) {
  const r = roundDeg(v);
  return r === null ? MISSING : `${r}°`;
}

/** 비율 — 퍼센트 정수. */
export function roundPercent(v) {
  return Number.isFinite(v) ? Math.round(v * 100) : null;
}

export function fmtPercent(v) {
  const r = roundPercent(v);
  return r === null ? MISSING : `${r}%`;
}

/**
 * 부호 있는 각도 → "크기 + 방향". 음수 부호를 사용자에게 노출하지 않는다.
 * direction이 없으면 부호로 방향을 유도한다(+ = 엄지쪽).
 */
export function fmtDeviation(deg, direction) {
  const r = roundDeg(deg);
  if (r === null) return MISSING;
  const dir = direction ?? (r > 0 ? "radial" : r < 0 ? "ulnar" : "neutral");
  if (dir === "neutral") return `${Math.abs(r)}° 치우침 없음`;
  return `${Math.abs(r)}° ${DIRECTION_LABEL[dir] ?? ""}`.trim();
}

/**
 * 윤곽 비대칭(비율) → "크기 + 방향". -7% 를 "7% 새끼쪽"으로 적는다.
 * 결과 화면과 비교 화면이 반드시 이 함수를 함께 쓴다(§3).
 */
export function fmtAsymmetry(ratio, direction) {
  const r = roundPercent(ratio);
  if (r === null) return MISSING;
  // 아주 작은 좌우 차이를 "엄지쪽/새끼쪽"이라 단정하면 정밀도를 과장하게 된다.
  // 이 구간에서는 방향을 말하지 않는다.
  if (Math.abs(r) < ASYMMETRY_NEUTRAL_PERCENT) return `${Math.abs(r)}% 치우침 없음`;
  const dir = direction ?? (r > 0 ? "radial" : "ulnar");
  if (dir === "neutral") return `${Math.abs(r)}% 치우침 없음`;
  return `${Math.abs(r)}% ${DIRECTION_LABEL[dir] ?? ""}`.trim();
}

/** 외곽 폭 라벨 — 무엇 대비 비율인지 문구에 드러낸다(§4). */
export const CONTOUR_WIDTH_LABEL = "인접 마디 대비 외곽 폭";
export const CONTOUR_ASYMMETRY_LABEL = "좌우 윤곽 비대칭";
