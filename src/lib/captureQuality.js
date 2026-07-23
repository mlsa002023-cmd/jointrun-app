// ─────────────────────────────────────────────
// captureQuality
// 04_APP_PRD_V9.md S04 — 가이드 촬영 품질 체크(거리·각도·흔들림·밝기·프레이밍).
// 기존 motionAnalyzer.js의 포즈(주먹/OK/펼침) 판정과는 목적이 다르다 — 여기는 "비교 가능한
// 조건으로 찍혔는가"만 본다. 진단/건강 판정과 무관하며, 실패 사유는 사용자에게 그대로 노출한다
// (05_DATA_ANALYTICS_SPEC.md: "내부 품질값은 비교 가능성 판단에만 쓰고 건강점수처럼 노출하지 않는다").
//
// 순수 함수만: landmark 좌표(0~1 정규화, MediaPipe 표준)와 숫자만 받고 DOM/카메라에 접근하지 않는다.
// 카메라 프레임에서 실제 값을 뽑는 부분(샘플링)은 별도 side-effecting 헬퍼로 분리했다.
// ─────────────────────────────────────────────

const FRAME_EDGE_MARGIN = 0.03; // 이 값보다 가장자리에 가까우면 "프레임을 벗어남"으로 판단
const MIN_HAND_SPAN = 0.18; // 손이 프레임에서 차지하는 비율이 이보다 작으면 "너무 멀다"
const MAX_HAND_SPAN = 0.92; // 이보다 크면 "너무 가깝다"
const SHAKE_VARIANCE_THRESHOLD = 0.015; // 최근 프레임 중심점 표준편차 임계값(정규화 좌표 기준)
const BRIGHTNESS_TOO_DARK = 60; // 0~255 스케일
const BRIGHTNESS_TOO_BRIGHT = 235;

export function computeHandBoundingBox(landmarks) {
  const xs = landmarks.map((p) => p.x);
  const ys = landmarks.map((p) => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  return {
    minX, maxX, minY, maxY,
    width: maxX - minX,
    height: maxY - minY,
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
  };
}

/** 거리: 손이 프레임에서 차지하는 비율로 판정한다(landmark만으로 계산, 실측 거리 아님). */
export function checkDistance(landmarks) {
  const box = computeHandBoundingBox(landmarks);
  const span = Math.max(box.width, box.height);
  if (span < MIN_HAND_SPAN) return "too_far";
  if (span > MAX_HAND_SPAN) return "too_close";
  return "ok";
}

/** 프레이밍: 손 일부가 화면 가장자리에 걸쳐 잘렸는지. */
export function checkFraming(landmarks) {
  const box = computeHandBoundingBox(landmarks);
  const cutOff =
    box.minX <= FRAME_EDGE_MARGIN ||
    box.minY <= FRAME_EDGE_MARGIN ||
    box.maxX >= 1 - FRAME_EDGE_MARGIN ||
    box.maxY >= 1 - FRAME_EDGE_MARGIN;
  return cutOff ? "out_of_frame" : "ok";
}

/** 흔들림: 최근 프레임들의 손 중심점이 얼마나 흔들렸는지(표준편차)로 판정한다. */
export function checkShake(recentLandmarkFrames) {
  if (recentLandmarkFrames.length < 3) return "ok"; // 판정에 필요한 최소 샘플이 없으면 통과 처리(재시도 루프에서 자연히 더 쌓임)
  const centers = recentLandmarkFrames.map((lm) => computeHandBoundingBox(lm));
  const meanX = centers.reduce((s, c) => s + c.centerX, 0) / centers.length;
  const meanY = centers.reduce((s, c) => s + c.centerY, 0) / centers.length;
  const variance =
    centers.reduce((s, c) => s + (c.centerX - meanX) ** 2 + (c.centerY - meanY) ** 2, 0) / centers.length;
  return Math.sqrt(variance) > SHAKE_VARIANCE_THRESHOLD ? "unstable" : "ok";
}

/** 밝기: 0~255 평균 밝기값(별도 샘플링 헬퍼가 계산해 전달)을 구간 판정만 한다. */
export function checkLighting(avgBrightness) {
  if (avgBrightness == null) return "unknown"; // 샘플링 실패 시 차단하지 않고 unknown으로 통과
  if (avgBrightness < BRIGHTNESS_TOO_DARK) return "too_dark";
  if (avgBrightness > BRIGHTNESS_TOO_BRIGHT) return "too_bright";
  return "ok";
}

const FAILURE_MESSAGES = {
  too_far: "손이 너무 멀어요. 카메라에 조금 더 가까이 대주세요.",
  too_close: "손이 너무 가까워요. 카메라에서 조금 떨어뜨려 주세요.",
  out_of_frame: "손 전체가 화면 안에 들어오지 않았어요. 손을 화면 가운데로 옮겨주세요.",
  unstable: "손이 흔들리고 있어요. 잠시 움직임을 멈춰주세요.",
  too_dark: "조명이 어두워요. 밝은 곳에서 다시 촬영해주세요.",
  too_bright: "빛이 너무 강해요. 조명을 등지고 다시 촬영해주세요.",
};

/**
 * 개별 체크 결과를 종합해 최종 촬영 품질 상태를 정한다.
 * distance/framing 실패는 비교 자체가 불가능한 수준이라 "retry"(재촬영 우선),
 * 나머지 단일 실패는 "retry", 두 가지 이상 겹치면 "unreliable"(비교 신뢰 불가로 표시하되 저장은 허용).
 */
export function evaluateCaptureQuality({ distance, framing, shake, lighting }) {
  const flags = [];
  if (distance !== "ok") flags.push(distance);
  if (framing !== "ok") flags.push(framing);
  if (shake !== "ok") flags.push(shake);
  if (lighting !== "ok" && lighting !== "unknown") flags.push(lighting);

  if (flags.length === 0) return { status: "pass", flags: [], message: null };
  const status = flags.length >= 2 ? "unreliable" : "retry";
  const message = FAILURE_MESSAGES[flags[0]] ?? "촬영 조건을 다시 확인해주세요.";
  return { status, flags, message };
}

/**
 * S09 "과거의 나와 비교" — 기준선과 현재 촬영을 나란히 볼 수 있는 조건인지 판정한다.
 * 자동으로 좋아짐/나빠짐을 판정하지 않는다 — 조건 일치 여부만 본다(그 다음은 사용자 보고).
 */
export function evaluateComparability(baselineCapture, currentCapture) {
  const reasons = [];
  if (!baselineCapture || !currentCapture) return { comparable: false, reasons: ["missing_capture"] };
  if (baselineCapture.handSide !== currentCapture.handSide) reasons.push("hand_side_mismatch");
  if (currentCapture.qualityStatus === "unreliable") reasons.push("current_quality_unreliable");
  if (baselineCapture.qualityStatus === "unreliable") reasons.push("baseline_quality_unreliable");
  return { comparable: reasons.length === 0, reasons };
}

/**
 * 비디오 프레임의 평균 밝기(0~255)를 추정한다. 실패해도 예외를 던지지 않고 null을 반환해
 * 밝기 체크가 전체 촬영 흐름을 막지 않게 한다(checkLighting의 "unknown" 경로로 이어짐).
 * 원본 프레임을 저장하지 않는다 — 작은 오프스크린 캔버스에 그려 픽셀만 읽고 버린다.
 */
export function sampleFrameBrightness(video, sampleSize = 16) {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = sampleSize;
    canvas.height = sampleSize;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(video, 0, 0, sampleSize, sampleSize);
    const { data } = ctx.getImageData(0, 0, sampleSize, sampleSize);
    let sum = 0;
    for (let i = 0; i < data.length; i += 4) {
      sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    }
    return sum / (data.length / 4);
  } catch (e) {
    console.warn("sampleFrameBrightness 실패:", e);
    return null;
  }
}
