// ─────────────────────────────────────────────
// captureSanitize — 개인정보 최소수집 저장 가드 (P0-14 §9·§15E)
//
// 개인정보 보호는 "허용 목록으로만 payload를 조립한다"는 원칙(by construction)이 1차 방어선이고,
// 이 모듈은 그 payload를 저장 직전에 재귀로 훑어 금지 키가 단 하나도 없음을 보장하는 2차 방어선이다.
// (Firestore Rules는 최상위 키만 얕게 검사하므로, 중첩 구조에 좌표가 섞여 들어가는 실수는
//  여기서 fail-closed로 막는다.)
//
// 저장 금지(§9): 사진·영상·ImageData·canvas·segmentation mask·contour path·raw landmark·
// displayGeometry·정규화 transient geometry(xNorm/yNorm 등)·pose별 원본 프레임, 그리고
// 기존 금지(점수·추천·건강점수·통증/강직 지수·metrics·landmarksRef).
// ─────────────────────────────────────────────

// 정확히 일치하면 금지하는 키(소문자 비교).
const FORBIDDEN_EXACT = new Set([
  "scores", "recommendation", "fingerhealthscore", "painindex", "stiffnessmin", "metrics",
  "landmarksref", "landmarks", "rawframes", "photo", "image", "images", "video", "videos",
  "imagedata", "canvas", "mask", "masks", "segmentationmask", "contourpath",
  // 표시용 임시 geometry의 좌표 필드(저장 버퍼로 새어 들어가면 안 됨).
  "displaygeometry", "transientgeometry", "xnorm", "ynorm", "dipcenter",
  "radialedge", "ulnaredge", "sideedgea", "sideedgeb", "axisstart", "axisend",
]);

// 부분 문자열로 금지하는 패턴(정상 필드명과 겹치지 않는 것만). 실제 관찰 필드에는
// "landmark"/"displaygeometry"/"segmentation"/"rawframe"/"rawlandmark"가 없다.
const FORBIDDEN_SUBSTR = ["landmark", "displaygeometry", "segmentation", "rawframe", "rawlandmark"];

function isForbiddenKey(key) {
  const k = String(key).toLowerCase();
  if (FORBIDDEN_EXACT.has(k)) return true;
  return FORBIDDEN_SUBSTR.some((s) => k.includes(s));
}

/**
 * payload(및 모든 중첩 객체·배열)를 재귀로 훑어 금지 키가 있으면 그 경로 목록을 돌려준다.
 * @returns {string[]} 위반 경로(예: ["contourObservations.front.fingers[0].displayGeometry"]). 없으면 [].
 */
export function findForbiddenKeys(value, path = "") {
  const hits = [];
  const walk = (v, p) => {
    if (Array.isArray(v)) {
      v.forEach((item, i) => walk(item, `${p}[${i}]`));
      return;
    }
    if (v && typeof v === "object") {
      Object.keys(v).forEach((key) => {
        const childPath = p ? `${p}.${key}` : key;
        if (isForbiddenKey(key)) hits.push(childPath);
        walk(v[key], childPath);
      });
    }
  };
  walk(value, path);
  return hits;
}

/**
 * 금지 키가 하나라도 있으면 예외를 던진다(fail-closed). 저장 경로에서 addDoc 직전에 호출한다.
 * 값은 로그·메시지에 담지 않는다(키 경로만).
 */
export function assertNoForbiddenCaptureKeys(payload) {
  const hits = findForbiddenKeys(payload);
  if (hits.length > 0) {
    throw new Error(`[captureSanitize] 저장 금지 필드가 감지되어 저장을 중단했습니다: ${hits.join(", ")}`);
  }
  return payload;
}
