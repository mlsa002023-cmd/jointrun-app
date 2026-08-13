// ─────────────────────────────────────────────
// reportGate — 4주 리포트 "보기" 활성화 여부 (P0-14 UAT FIX-1 §2)
//
// 리포트가 실제로 보여줄 "대상 루프"(FourWeekReport와 동일하게, 가장 최근 기준선 이벤트) 안에서
// 같은 측정 방식(같은 poseProtocolVersion·handSide)의 기준선+재확인 2시점이 있을 때만 연다.
//
// 왜 computeObservationTimepoints(details)를 그대로 쓰지 않는가:
//   computeObservationTimepoints는 관찰 추이(TimelineModule)용으로 여러 이벤트에 걸쳐 시점을
//   모은다. 이를 게이트에 그대로 쓰면 서로 다른 판단 루프의 기준선과 재확인이 교차 페어링되어,
//   재확인이 없는(또는 아직 확정 전인) 미완료 루프에서도 리포트가 열려 빈 리포트가 노출된다.
//   대상 이벤트 하나로 범위를 좁혀 그 교차 페어링을 막는다(게이트 ⟺ FourWeekReport 대상 일치).
// ─────────────────────────────────────────────

import { computeObservationTimepoints } from "./observationTrend";

/**
 * getHistoryDetailed(details) 기준으로 4주 리포트를 열어도 되는지 판정한다.
 * FourWeekReport가 대상으로 삼는 이벤트(가장 최근 baselineCaptureId 보유)와 동일한 루프만 본다.
 * @returns {boolean} 대상 루프 안에 비교 가능한 기준선+재확인 2시점이 있으면 true.
 */
export function isReportEventReady(details) {
  const target = (details ?? []).find((e) => e?.baselineCaptureId);
  if (!target) return false;
  return computeObservationTimepoints([target]).available;
}
