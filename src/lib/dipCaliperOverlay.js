// ─────────────────────────────────────────────
// DipCaliperOverlay — 촬영 중 DIP 외곽 관찰 캘리퍼 오버레이 (RC1.2.2 P0-11)
//
// 목적: "앱이 끝마디의 어느 위치를 관찰하고 있는지"를 사용자가 이해하게 하는 UI다.
// 정확도를 과장하는 장식이 아니며, 측정 계산식은 전혀 건드리지 않는다 — dipContour가
// 이미 계산한 결과의 표시용 임시 geometry만 그린다.
//
// 좌표: landmark(0~1)를 video 원본 픽셀로 환산한 값을 그대로 쓴다. canvas 비트맵이 video
// 원본 해상도이고 CSS에서 둘 다 object-fit: cover + 동일 mirror 변환을 받으므로, 이 공간에
// 그리면 화면상의 손가락 위치와 정확히 일치한다(skeleton도 같은 변환을 쓴다).
// ─────────────────────────────────────────────

import { DIP_ROI_CHAINS, CONTOUR_FLAG, MIN_VALID_FRAMES } from "./dipContour";

/**
 * 정규화 좌표(0..1) → 캔버스 픽셀. skeleton과 캘리퍼가 반드시 이 함수 하나만 쓴다.
 * 분석 해상도·기기 해상도와 무관하게 같은 위치를 가리키는 유일한 변환이다.
 */
export function normalizedPointToCanvas(point, canvas) {
  if (!point || !canvas) return null;
  const x = point.xNorm ?? point.x;
  const y = point.yNorm ?? point.y;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x: x * canvas.width, y: y * canvas.height };
}

/** 손가락별 오버레이 상태(§3). */
export const CALIPER_STATE = {
  SEARCHING: "searching",     // A. landmark 탐색 중
  LANDMARK_READY: "landmark_ready", // B. landmark 확인, contour 대기
  MEASURING: "measuring",     // C. 유효 프레임 수집 중
  DONE: "done",               // D. 손가락별 관찰 완료
  UNSTABLE: "unstable",       // 실패·불안정
};

/** 상태·실패 사유별 안내 문구. 색만으로 구분하지 않기 위해 항상 텍스트를 함께 준다(§9). */
export const CALIPER_MESSAGE = {
  [CALIPER_STATE.SEARCHING]: "손가락을 화면 안에 맞춰 주세요",
  [CALIPER_STATE.LANDMARK_READY]: "손가락을 벌리고 잠시 유지해 주세요",
  [CALIPER_STATE.DONE]: "끝마디 외곽 기록 완료",
};

const FLAG_MESSAGE = {
  [CONTOUR_FLAG.FINGER_OVERLAP]: "손가락을 조금 더 벌려 주세요",
  [CONTOUR_FLAG.LOW_CONTRAST]: "배경과 손이 잘 구분되도록 옮겨 주세요",
  [CONTOUR_FLAG.ROI_OUT_OF_BOUNDS]: "손을 화면 안쪽으로 이동해 주세요",
  [CONTOUR_FLAG.CONTOUR_BROKEN]: "잠시 움직이지 말고 유지해 주세요",
  [CONTOUR_FLAG.FRAME_VARIATION]: "잠시 움직이지 말고 유지해 주세요",
  [CONTOUR_FLAG.LANDMARK_MISSING]: "손가락을 화면 안에 맞춰 주세요",
};

const COLOR = {
  neutral: "rgba(203, 213, 225, 0.75)", // 옅은 중립색
  active: "#2DD4BF",                    // 청록 계열 — 측정 중
  done: "#1F9E96",
  warn: "#F59E0B",                      // 주황 계열 — 불안정
};

/**
 * 손가락 하나의 오버레이 상태를 정한다. 순수 함수 — 캔버스를 모른다.
 *
 * @param {object|null} measurement  measureFingerDipContour 결과(이번 프레임)
 * @param {number} validFrames       지금까지 모인 유효 프레임 수
 * @param {boolean} hasLandmarks     이번 프레임에 이 손가락 landmark가 있었는지
 */
export function deriveFingerState({ measurement, validFrames = 0, hasLandmarks = false, label = "끝마디 외곽" }) {
  if (validFrames >= MIN_VALID_FRAMES) {
    return { state: CALIPER_STATE.DONE, message: `${label} 기록 완료`, validFrames };
  }
  if (!hasLandmarks) {
    return { state: CALIPER_STATE.SEARCHING, message: CALIPER_MESSAGE[CALIPER_STATE.SEARCHING], validFrames };
  }
  if (measurement?.ok) {
    return {
      state: CALIPER_STATE.MEASURING,
      // §3 C — 진행 상태만 알려주고 실시간 폭 비율 숫자는 일반 사용자에게 보이지 않는다.
      message: `${label} 관찰 중 · ${validFrames}/${MIN_VALID_FRAMES}`,
      validFrames,
    };
  }
  const flag = measurement?.flags?.[0];
  if (flag) {
    return {
      state: CALIPER_STATE.UNSTABLE,
      message: FLAG_MESSAGE[flag] ?? "잠시 움직이지 말고 유지해 주세요",
      flag,
      validFrames,
    };
  }
  return { state: CALIPER_STATE.LANDMARK_READY, message: CALIPER_MESSAGE[CALIPER_STATE.LANDMARK_READY], validFrames };
}

/**
 * 네 손가락의 오버레이 상태를 만든다.
 * @param {Array|null} frameMeasurements measureFrameDipContours 결과
 * @param {object} validCounts           { index: 3, middle: 5, ... }
 * @param {boolean} handDetected
 */
export function deriveOverlayModel(frameMeasurements, validCounts = {}, handDetected = false, options = {}) {
  // P0-14 — 정면은 네 손가락(기본), 측면(fanLateral)은 중지·약지·소지만 순회한다.
  const fingerKeys = options.fingerKeys ?? Object.keys(DIP_ROI_CHAINS);
  const label = options.label ?? "끝마디 외곽";
  const fingers = fingerKeys.map((key) => {
    const chain = DIP_ROI_CHAINS[key];
    const m = frameMeasurements?.find((f) => f.key === key) ?? null;
    const hasLandmarks = handDetected && Boolean(m?.displayGeometry);
    const derived = deriveFingerState({
      measurement: m,
      validFrames: validCounts[key] ?? 0,
      hasLandmarks,
      label,
    });
    return { key, name: chain?.name ?? key, geometry: m?.displayGeometry ?? null, ...derived };
  });

  const doneCount = fingers.filter((f) => f.state === CALIPER_STATE.DONE).length;
  // 화면 혼잡도 방지(§4) — 지금 실제로 읽히는 손가락 하나만 캘리퍼를 선명하게 그린다.
  const focusKey =
    fingers.find((f) => f.state === CALIPER_STATE.MEASURING)?.key ??
    fingers.find((f) => f.state === CALIPER_STATE.UNSTABLE)?.key ??
    null;

  // 화면 상단 안내는 한 줄만 — focus 손가락 기준, 없으면 전체 상태.
  const focus = fingers.find((f) => f.key === focusKey);
  const allDone = doneCount === fingers.length;
  const statusText = allDone
    ? `${label} 기록 완료`
    : focus?.message ??
      (handDetected
        ? CALIPER_MESSAGE[CALIPER_STATE.LANDMARK_READY]
        : CALIPER_MESSAGE[CALIPER_STATE.SEARCHING]);

  return { fingers, focusKey, doneCount, allDone, statusText };
}

function colorFor(state) {
  if (state === CALIPER_STATE.DONE) return COLOR.done;
  if (state === CALIPER_STATE.MEASURING) return COLOR.active;
  if (state === CALIPER_STATE.UNSTABLE) return COLOR.warn;
  return COLOR.neutral;
}

/**
 * 캘리퍼를 캔버스에 그린다. skeleton과 같은 캔버스·같은 좌표 공간을 쓴다.
 * 폭 측정선은 항상 손가락 중심축에 수직이다 — 화면 기준 수평선을 그리지 않는다.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} model    deriveOverlayModel 결과
 * @param {object} opts     { qaDetail: boolean, scale: number }
 */
export function drawCaliperOverlay(ctx, model, { qaDetail = false, scale = 1, canvas = null } = {}) {
  const target = canvas ?? ctx?.canvas;
  if (!ctx || !target || !model?.fingers) return;

  model.fingers.forEach((f) => {
    const raw = f.geometry;
    if (!raw?.dipCenter) return;
    // 정규화 좌표를 이 캔버스 픽셀로 옮긴다. 임의 offset·기기별 보정은 쓰지 않는다.
    // P0-14 — 정면은 radialEdge/ulnarEdge, 측면(fanLateral)은 sideEdgeA/sideEdgeB를 쓴다.
    // 계산에 쓴 중심 단면과 같은 좌표라 캘리퍼가 실제 관찰 위치와 일치한다(§6·§8).
    const g = {
      dipCenter: normalizedPointToCanvas(raw.dipCenter, target),
      axisStart: normalizedPointToCanvas(raw.axisStart, target),
      axisEnd: normalizedPointToCanvas(raw.axisEnd, target),
      radialEdge: normalizedPointToCanvas(raw.radialEdge ?? raw.sideEdgeA, target),
      ulnarEdge: normalizedPointToCanvas(raw.ulnarEdge ?? raw.sideEdgeB, target),
    };
    if (!g.dipCenter) return;

    const isFocus = f.key === model.focusKey;
    const color = colorFor(f.state);
    const lw = Math.max(1, 2 * scale);

    // 기본 상태에서는 DIP 중심점만 작게. 완료된 손가락도 축소해서 남긴다(§4).
    if (!isFocus && f.state !== CALIPER_STATE.DONE) {
      ctx.beginPath();
      ctx.arc(g.dipCenter.x, g.dipCenter.y, 3 * scale, 0, Math.PI * 2);
      ctx.fillStyle = COLOR.neutral;
      ctx.fill();
      return;
    }

    ctx.save();
    ctx.lineWidth = lw;
    ctx.strokeStyle = color;
    ctx.setLineDash(f.state === CALIPER_STATE.UNSTABLE ? [5 * scale, 4 * scale] : []);

    // 중심축(PIP→DIP→TIP 방향의 짧은 선)
    if (g.axisStart && g.axisEnd) {
      ctx.beginPath();
      ctx.moveTo(g.axisStart.x, g.axisStart.y);
      ctx.lineTo(g.axisEnd.x, g.axisEnd.y);
      ctx.stroke();
    }

    // 폭 측정선 — 중심축에 수직. radialEdge/ulnarEdge는 축의 수직 방향으로 계산된 점이다.
    if (g.radialEdge && g.ulnarEdge) {
      ctx.beginPath();
      ctx.moveTo(g.radialEdge.x, g.radialEdge.y);
      ctx.lineTo(g.ulnarEdge.x, g.ulnarEdge.y);
      ctx.stroke();

      // 양쪽 외곽 지점의 작은 끝표시(캘리퍼 발)
      const dx = g.radialEdge.x - g.ulnarEdge.x;
      const dy = g.radialEdge.y - g.ulnarEdge.y;
      const len = Math.hypot(dx, dy) || 1;
      const tx = (-dy / len) * 5 * scale;
      const ty = (dx / len) * 5 * scale;
      [g.radialEdge, g.ulnarEdge].forEach((p) => {
        ctx.beginPath();
        ctx.moveTo(p.x - tx, p.y - ty);
        ctx.lineTo(p.x + tx, p.y + ty);
        ctx.stroke();
      });
    }

    // DIP 중심점
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(g.dipCenter.x, g.dipCenter.y, (f.state === CALIPER_STATE.DONE ? 3 : 4) * scale, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();

    // 완료 체크 표시
    if (f.state === CALIPER_STATE.DONE) {
      ctx.beginPath();
      ctx.strokeStyle = COLOR.done;
      ctx.lineWidth = Math.max(1.5, 2 * scale);
      const c = g.dipCenter;
      ctx.moveTo(c.x - 5 * scale, c.y);
      ctx.lineTo(c.x - 1.5 * scale, c.y + 3.5 * scale);
      ctx.lineTo(c.x + 5 * scale, c.y - 4 * scale);
      ctx.stroke();
    }

    // QA 전용 상세(§8) — 일반 사용자에게는 절대 그리지 않는다.
    if (qaDetail) {
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.font = `${Math.round(11 * scale)}px monospace`;
      const parts = [`${f.key} ${f.validFrames}/${MIN_VALID_FRAMES}`];
      if (f.flag) parts.push(f.flag);
      ctx.fillText(parts.join(" "), g.dipCenter.x + 8 * scale, g.dipCenter.y - 8 * scale);
    }

    ctx.restore();
  });
}
