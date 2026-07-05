// ─────────────────────────────────────────────
// MotionAnalyzer
// 역할: HandTracker가 반환한 landmark(순수 데이터)를 받아
//       PIP 굴곡각 / 측면편위 / Finger Score / 처방 문구를 계산한다.
// 카메라, MediaPipe API, React 상태를 전혀 모른다 — 순수 함수만 있음.
// 입력: worldLandmarks (MediaPipe result.worldLandmarks[0])
// ─────────────────────────────────────────────

function sub(a, b) { return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }; }
function dot(a, b) { return a.x * b.x + a.y * b.y + a.z * b.z; }
function cross(a, b) {
  return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x };
}
function norm(v) {
  const m = Math.sqrt(dot(v, v));
  return m < 1e-9 ? { x: 0, y: 0, z: 1 } : { x: v.x / m, y: v.y / m, z: v.z / m };
}

export const FINGER_CHAINS = {
  index: { mcp: 5, pip: 6, dip: 7, name: "검지" },
  middle: { mcp: 9, pip: 10, dip: 11, name: "중지" },
  ring: { mcp: 13, pip: 14, dip: 15, name: "약지" },
  pinky: { mcp: 17, pip: 18, dip: 19, name: "소지" },
};

/**
 * PIP 관절 기준 굴곡각 + 측면편위를 로컬 좌표계로 분리 계산한다.
 * e1 = 근위지골 방향, e2 = 손바닥 법선 성분, e3 = e1×e2 (좌우 방향)
 */
export function analyzePIPJoint(wl, mcp, pip, dip) {
  const proximal = sub(wl[pip], wl[mcp]);
  const distal = sub(wl[dip], wl[pip]);
  const palmNorm = norm(cross(sub(wl[5], wl[0]), sub(wl[17], wl[0])));
  const e1 = norm(proximal);
  const e2 = norm(sub(palmNorm, { x: dot(palmNorm, e1) * e1.x, y: dot(palmNorm, e1) * e1.y, z: dot(palmNorm, e1) * e1.z }));
  const e3 = cross(e1, e2);
  const fx = dot(distal, e1);
  const fy = dot(distal, e2);
  const fz = dot(distal, e3);
  const flexion = Math.atan2(fy, fx) * (180 / Math.PI);
  const deviation = Math.atan2(fz, fx) * (180 / Math.PI);
  const direction = fz > 0 ? "radial" : "ulnar";
  return { flexion: Math.max(0, flexion), deviation: Math.abs(deviation), deviationDir: direction };
}

/** 검지/중지/약지/소지 4개 손가락을 한 번에 분석해서 손가락별 점수까지 반환한다. */
export function analyzeAllFingers(worldLandmarks) {
  if (!worldLandmarks) return null;
  return Object.entries(FINGER_CHAINS).map(([key, c]) => {
    const r = analyzePIPJoint(worldLandmarks, c.mcp, c.pip, c.dip);
    const score = Math.round(
      Math.min(100, Math.max(0, (r.flexion / 80) * 60 + (1 - Math.min(r.deviation, 10) / 10) * 40))
    );
    return { key, name: c.name, ...r, score };
  });
}

/** 손가락별 결과 배열 → 평균 점수/굴곡각으로 요약. */
export function summarizeFingers(fingers) {
  const avgScore = Math.round(fingers.reduce((s, f) => s + f.score, 0) / fingers.length);
  const avgFlexion = Math.round(fingers.reduce((s, f) => s + f.flexion, 0) / fingers.length);
  return { avgScore, avgFlexion };
}

export function buildRecommendation(score, rom) {
  if (score >= 80) {
    return `손가락 가동 범위 ${rom}°로 양호합니다. 예방적 관리를 위해 보조기를 15° 각도로 설정하고 타이핑 작업 시 정기 스트레칭을 추천합니다.`;
  }
  if (score >= 60) {
    return `Finger Score ${score}점, 굴곡각 ${rom}°입니다. 3분 온수 잼잼 요법으로 관절 윤활액 분비를 촉진하고, 오늘 밤 보조기 착용을 권장합니다.`;
  }
  return `Finger Score ${score}점으로 주의가 필요합니다. 무리한 손 사용을 줄이고, 즉시 따뜻한 물에 손을 5분간 담그신 후 전문의 상담을 권장합니다.`;
}
