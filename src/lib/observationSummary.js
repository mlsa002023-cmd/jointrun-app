// ─────────────────────────────────────────────
// ObservationSummary — 규칙 기반 한줄 요약 (RC1.2.2 P0-12)
//
// LLM·외부 생성형 AI를 쓰지 않는다. 같은 입력이면 항상 같은 문장이 나오는 결정적 규칙만 쓴다.
//
// 절대 하지 않는 것:
//   - 정상 기준·타인 데이터·의학적 임계값과 비교
//   - 진단·악화·호전·치료효과 판정
//   - 누락값을 0으로 해석하거나 추정해서 문장 만들기
//   - 세대(algorithmVersion)가 다른 기록을 직접 비교
//
// 하는 것: 같은 기록 안에서 상대적으로 두드러진 부위를 최대 2개 고르고, 관찰된 사실만 적는다.
// ─────────────────────────────────────────────

import { toObservationView, hasGenerationMismatch } from "./captureObservationAdapter";

export const SUMMARY_MODE = { BASELINE: "baseline", RECHECK: "recheck" };

export const SUMMARY_CODE = {
  BASELINE_FOCUS: "baseline_dip_flexion_and_deviation_focus",
  BASELINE_SINGLE_FOCUS: "baseline_single_focus",
  BASELINE_NO_FOCUS: "baseline_no_focus",
  BASELINE_CONTOUR_UNAVAILABLE: "baseline_contour_unavailable",
  QUALITY_INSUFFICIENT: "quality_insufficient",
  RECHECK_DIFFERENCES: "recheck_differences",
  RECHECK_SIMILAR: "recheck_similar",
  NOT_COMPARABLE: "not_comparable",
  LEGACY_BASELINE: "legacy_baseline",
};

const CONFIDENCE = { OBSERVED: "observed", LIMITED: "limited" };

const TITLE = {
  [SUMMARY_MODE.BASELINE]: "이번 기록 한줄 요약",
  [SUMMARY_MODE.RECHECK]: "기준선과 비교한 한줄 요약",
};

/** 손가락 이름 — 기록에 이름이 없을 때의 안전한 기본값. */
const FINGER_NAME = { index: "검지", middle: "중지", ring: "약지", pinky: "소지" };

const DIRECTION_WORD = { radial: "엄지쪽", ulnar: "새끼쪽" };

function nameOf(finger) {
  return finger?.name ?? FINGER_NAME[finger?.key] ?? finger?.key ?? "손가락";
}

function isNum(v) {
  return Number.isFinite(v);
}

/** 값이 있는 손가락만 후보로 쓴다 — 누락을 0으로 보지 않는다. */
function candidates(fingers, pick) {
  return fingers
    .map((f) => ({ finger: f, value: pick(f) }))
    .filter((c) => isNum(c.value));
}

/**
 * 같은 손 안에서 "상대적으로 두드러진" 항목인지 본다.
 * 의학적 임계값을 쓰지 않는다 — 나머지 손가락 중앙값 대비 얼마나 위인지만 본다.
 */
function relativeStandout(list) {
  if (list.length < 2) return null;
  const sorted = [...list].sort((a, b) => b.value - a.value);
  const top = sorted[0];
  const rest = sorted.slice(1).map((c) => c.value);
  const restMedian = rest.length % 2
    ? rest[Math.floor(rest.length / 2)]
    : (rest[rest.length / 2 - 1] + rest[rest.length / 2]) / 2;
  // 나머지와 사실상 같으면 "두드러진다"고 말하지 않는다.
  if (!(top.value > restMedian)) return null;
  return { ...top, restMedian, margin: top.value - restMedian };
}

/** baseline 후보 항목들 — §4 우선순위 순서. */
function baselineFocusItems(view) {
  const fingers = view?.fingers ?? [];
  const items = [];

  const dipFlex = relativeStandout(candidates(fingers, (f) => f.dipExtensionPoseFlexionDeg));
  if (dipFlex) {
    items.push({
      key: dipFlex.finger.key,
      phrase: `${nameOf(dipFlex.finger)} 끝마디 말림`,
      rank: 1,
      margin: dipFlex.margin,
    });
  }

  const dipDev = relativeStandout(candidates(fingers, (f) => Math.abs(f.dipExtensionPoseDeviationDeg)));
  if (dipDev) {
    const dir = DIRECTION_WORD[dipDev.finger.dipDeviationDirection];
    items.push({
      key: dipDev.finger.key,
      phrase: dir
        ? `${nameOf(dipDev.finger)}의 ${dir} 치우침`
        : `${nameOf(dipDev.finger)} 끝마디 좌우 치우침`,
      rank: 2,
      margin: dipDev.margin,
    });
  }

  const asym = relativeStandout(candidates(fingers, (f) => Math.abs(f.contour?.contourAsymmetryRatio)));
  if (asym) {
    items.push({
      key: asym.finger.key,
      phrase: `${nameOf(asym.finger)} 끝마디 좌우 윤곽 차이`,
      rank: 3,
      margin: asym.margin,
    });
  }

  // P0-14 §11 — 측면 외곽은 "측면 관찰이 유효한 경우에만" 후보로 쓴다(sideContour가 있을 때만).
  const side = relativeStandout(candidates(fingers, (f) => f.sideContour?.dipSideProfileRatio));
  if (side) {
    items.push({
      key: side.finger.key,
      phrase: `${nameOf(side.finger)} 끝마디 측면 외곽`,
      rank: 4,
      margin: side.margin,
    });
  }

  const width = relativeStandout(candidates(fingers, (f) => f.contour?.dipWidthRatio));
  if (width) {
    items.push({
      key: width.finger.key,
      phrase: `${nameOf(width.finger)} 끝마디 외곽 폭`,
      rank: 5,
      margin: width.margin,
    });
  }

  // DIP 후보가 하나도 없을 때만 PIP를 보조 후보로 쓴다(§4-5).
  if (!items.length) {
    const pipFlex = relativeStandout(candidates(fingers, (f) => f.pipExtensionPoseFlexionDeg));
    if (pipFlex) {
      items.push({
        key: pipFlex.finger.key,
        phrase: `${nameOf(pipFlex.finger)} 중간마디 굽힘`,
        rank: 6,
        margin: pipFlex.margin,
      });
    }
  }

  // 우선순위(rank) 먼저, 같은 순위면 상대 격차가 큰 쪽. 서로 다른 손가락으로 최대 2개.
  const chosen = [];
  items.sort((a, b) => a.rank - b.rank || b.margin - a.margin);
  items.forEach((it) => {
    if (chosen.length >= 2) return;
    if (chosen.some((c) => c.key === it.key)) return;
    chosen.push(it);
  });
  return chosen;
}

/** 촬영 품질이 요약을 만들 만한지 — 관찰 필드 자체가 없거나 unreliable이면 만들지 않는다. */
function qualityInsufficient(capture, view) {
  if (!view || !view.fingers?.length) return true;
  if (capture?.comparisonQualityStatus === "unreliable") return true;
  if (capture?.recordingStatus === "incomplete") return true;
  return false;
}

function hasAnyContour(view) {
  return (view?.fingers ?? []).some((f) => f.contour);
}

function buildBaselineSummary(capture) {
  const view = toObservationView(capture);
  const base = { title: TITLE[SUMMARY_MODE.BASELINE], comparable: false, focusFingerKeys: [] };

  if (qualityInsufficient(capture, view)) {
    return {
      ...base,
      headline: "이번 촬영은 한줄 요약을 만들기 어려워 관찰 기록만 저장했어요.",
      secondaryText: "다음 측정에서는 같은 손과 같은 자세로 비교합니다.",
      summaryCode: SUMMARY_CODE.QUALITY_INSUFFICIENT,
      confidence: CONFIDENCE.LIMITED,
    };
  }

  const focus = baselineFocusItems(view);
  const secondaryText = "다음 측정에서는 같은 손과 같은 자세로 비교합니다.";

  if (!focus.length) {
    // 각도는 있는데 외곽만 못 읽은 경우는 그 사실을 그대로 알린다.
    if (!hasAnyContour(view)) {
      return {
        ...base,
        headline: "끝마디 각도는 기록됐지만 외곽 폭은 안정적으로 구분하지 못했어요.",
        secondaryText,
        summaryCode: SUMMARY_CODE.BASELINE_CONTOUR_UNAVAILABLE,
        confidence: CONFIDENCE.LIMITED,
      };
    }
    return {
      ...base,
      headline: "손가락별 끝마디 관찰값이 기준선으로 저장됐어요.",
      secondaryText,
      summaryCode: SUMMARY_CODE.BASELINE_NO_FOCUS,
      confidence: CONFIDENCE.OBSERVED,
    };
  }

  if (focus.length === 1) {
    return {
      ...base,
      headline: `이번 기준선에서는 ${focus[0].phrase}을 다음 측정에서 우선 비교합니다.`,
      secondaryText,
      focusFingerKeys: [focus[0].key],
      summaryCode: SUMMARY_CODE.BASELINE_SINGLE_FOCUS,
      confidence: CONFIDENCE.OBSERVED,
    };
  }

  return {
    ...base,
    headline: `이번 기준선에서는 ${focus[0].phrase}과 ${focus[1].phrase}이 상대적으로 크게 기록됐어요.`,
    secondaryText: `다음 측정에서는 ${nameOf({ key: focus[0].key })}와 ${nameOf({ key: focus[1].key })}를 우선 비교합니다.`,
    focusFingerKeys: focus.map((f) => f.key),
    summaryCode: SUMMARY_CODE.BASELINE_FOCUS,
    confidence: CONFIDENCE.OBSERVED,
  };
}

/**
 * 반복 측정 범위 안인지 판단한다. 임의 고정 임계값을 쓰지 않는다 —
 * personalRepeatBand가 없으면 "비슷/다름"을 단정하지 않고 차이만 적는다(§8).
 */
function withinRepeatBand(diff, band) {
  if (!isNum(band)) return null; // 판단 불가
  return Math.abs(diff) <= band;
}

/** 재확인 차이 후보 — §7 우선순위 순서. */
function recheckDiffItems(baselineView, currentView, band) {
  const metrics = [
    { rank: 1, label: "끝마디 말림", pick: (f) => f.dipExtensionPoseFlexionDeg, unit: "°", band: band?.dipFlexionDeg },
    { rank: 2, label: "끝마디 좌우 치우침", pick: (f) => f.dipExtensionPoseDeviationDeg, unit: "°", band: band?.dipDeviationDeg },
    { rank: 3, label: "끝마디 활동 범위", pick: (f) => f.dipActiveRomDeg, unit: "°", band: band?.dipActiveRomDeg },
    { rank: 4, label: "끝마디 외곽 폭", pick: (f) => f.contour?.dipWidthRatio, unit: "ratio", band: band?.dipWidthRatio },
    { rank: 5, label: "좌우 윤곽 차이", pick: (f) => f.contour?.contourAsymmetryRatio, unit: "ratio", band: band?.contourAsymmetryRatio },
    { rank: 6, label: "중간마디 굽힘", pick: (f) => f.pipExtensionPoseFlexionDeg, unit: "°", band: band?.pipFlexionDeg },
  ];

  const items = [];
  (currentView?.fingers ?? []).forEach((cur) => {
    const base = (baselineView?.fingers ?? []).find((f) => f.key === cur.key);
    if (!base) return;
    metrics.forEach((m) => {
      const b = m.pick(base);
      const c = m.pick(cur);
      // 한쪽이라도 값이 없으면 비교하지 않는다(추정 금지).
      if (!isNum(b) || !isNum(c)) return;
      const diff = c - b;
      items.push({
        key: cur.key,
        name: nameOf(cur),
        label: m.label,
        rank: m.rank,
        diff,
        unit: m.unit,
        within: withinRepeatBand(diff, m.band),
      });
    });
  });
  return items;
}

// RC1.2.2 P0-12.1 §1 — headline에는 정확한 각도 숫자를 기본적으로 넣지 않는다.
// 숫자를 쓰면 상세표의 반올림값과 어긋나 "요약과 표가 다르다"는 인상을 준다.
// 차이의 크기는 상세표에서 직접 읽게 하고, 요약은 어디를 볼지만 알려준다.
function diffText() {
  return "기준선과 다르게 기록됐어요";
}

function buildRecheckSummary({ baselineCapture, currentCapture, comparisonQuality, personalRepeatBand }) {
  const baselineView = toObservationView(baselineCapture);
  const currentView = toObservationView(currentCapture);
  const base = { title: TITLE[SUMMARY_MODE.RECHECK], focusFingerKeys: [] };

  const notComparable = (headline, code) => ({
    ...base,
    headline,
    secondaryText: "기록은 그대로 보관되며 다음 측정에서 다시 확인할 수 있습니다.",
    summaryCode: code,
    confidence: CONFIDENCE.LIMITED,
    comparable: false,
  });

  if (!baselineCapture || !currentCapture || !currentView?.fingers?.length) {
    return notComparable(
      "촬영 조건 차이가 있어 이번 기록은 기준선과 직접 비교하지 않습니다.",
      SUMMARY_CODE.NOT_COMPARABLE
    );
  }
  // P0-14 §12 — 세대 또는 포즈 프로토콜이 다르면 직접 비교하지 않는다(구형 기준선 ↔ 신규 재확인).
  if (hasGenerationMismatch(baselineView, currentView)
      || (baselineView.poseProtocolVersion ?? null) !== (currentView.poseProtocolVersion ?? null)) {
    return notComparable(
      "기준선은 이전 측정 방식으로 기록되어 이번 관절값과 직접 비교하지 않습니다.",
      SUMMARY_CODE.LEGACY_BASELINE
    );
  }
  if (baselineView.handSide !== currentView.handSide) {
    return notComparable(
      "기준선과 현재 기록의 측정 조건이 달라 수치를 직접 비교하지 않습니다.",
      SUMMARY_CODE.NOT_COMPARABLE
    );
  }
  const reasons = comparisonQuality?.reasons ?? [];
  if (
    baselineCapture.comparisonQualityStatus === "unreliable" ||
    currentCapture.comparisonQualityStatus === "unreliable" ||
    reasons.includes("algorithm_version_mismatch") ||
    reasons.includes("pose_protocol_mismatch")
  ) {
    return notComparable(
      "기준선과 현재 기록의 측정 조건이 달라 수치를 직접 비교하지 않습니다.",
      SUMMARY_CODE.NOT_COMPARABLE
    );
  }

  const items = recheckDiffItems(baselineView, currentView, personalRepeatBand);
  if (!items.length) {
    return notComparable(
      "촬영 조건 차이가 있어 이번 기록은 기준선과 직접 비교하지 않습니다.",
      SUMMARY_CODE.NOT_COMPARABLE
    );
  }

  // 반복 범위를 넘은 항목을 우선하고, 없으면 차이가 큰 순으로 고른다.
  const outOfBand = items.filter((i) => i.within === false);
  const pool = outOfBand.length ? outOfBand : items;
  pool.sort((a, b) => a.rank - b.rank || Math.abs(b.diff) - Math.abs(a.diff));

  const chosen = [];
  pool.forEach((it) => {
    if (chosen.length >= 2) return;
    if (chosen.some((c) => c.key === it.key && c.label === it.label)) return;
    chosen.push(it);
  });

  const secondaryText = "같은 손에서 각 시점에 관찰된 값을 나란히 놓았습니다.";

  // 반복 범위 판단이 가능하고 전부 범위 안이면 "비슷한 범위"로 적는다.
  const bandKnown = items.some((i) => i.within !== null);
  if (bandKnown && !outOfBand.length) {
    return {
      ...base,
      headline: "끝마디 관찰값은 기준선과 비슷한 범위로 기록됐어요.",
      secondaryText,
      summaryCode: SUMMARY_CODE.RECHECK_SIMILAR,
      confidence: CONFIDENCE.OBSERVED,
      comparable: true,
    };
  }

  const phrase = (it) =>
    it.within === false
      ? `${it.name} ${it.label}은 반복 측정 범위를 넘어 다르게 기록됐어요`
      : `${it.name} ${it.label}은 ${diffText()}`;

  // 같은 항목이 여러 손가락에서 걸리면 손가락 이름을 묶어 한 문장으로 적는다
  // ("검지와 약지 끝마디 말림이 기준선과 다르게 기록됐어요").
  const sameLabel = chosen.length === 2 && chosen[0].label === chosen[1].label;
  const headline = sameLabel
    ? `${chosen[0].name}와 ${chosen[1].name} ${chosen[0].label}이 ${
        chosen.some((c) => c.within === false)
          ? "반복 측정 범위를 넘어 다르게 기록됐어요"
          : "기준선과 다르게 기록됐어요"
      }.`
    : chosen.length === 1
      ? `${phrase(chosen[0])}.`
      : `${phrase(chosen[0])}, ${phrase(chosen[1])}.`;

  return {
    ...base,
    headline,
    secondaryText,
    focusFingerKeys: [...new Set(chosen.map((c) => c.key))],
    summaryCode: SUMMARY_CODE.RECHECK_DIFFERENCES,
    confidence: CONFIDENCE.OBSERVED,
    comparable: true,
  };
}

/**
 * 한줄 요약을 만든다.
 *
 * @param {object} p
 * @param {"baseline"|"recheck"} p.mode
 * @param {object} p.baselineCapture
 * @param {object} p.currentCapture
 * @param {object} [p.comparisonQuality]   evaluateComparability 결과
 * @param {object} [p.personalRepeatBand]  { dipFlexionDeg, dipDeviationDeg, ... } 반복 측정 범위
 * @returns {{title,headline,secondaryText,focusFingerKeys,summaryCode,confidence,comparable}}
 */
export function buildObservationSummary({
  mode = SUMMARY_MODE.BASELINE,
  baselineCapture = null,
  currentCapture = null,
  comparisonQuality = null,
  personalRepeatBand = null,
} = {}) {
  if (mode === SUMMARY_MODE.RECHECK) {
    return buildRecheckSummary({ baselineCapture, currentCapture, comparisonQuality, personalRepeatBand });
  }
  return buildBaselineSummary(currentCapture ?? baselineCapture);
}
