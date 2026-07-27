// ─────────────────────────────────────────────
// observationTrend — 신규 V9 capture 기반 "관찰 추이" 데이터 (P0-14 UAT FIX-1 §5)
//
// 레거시 scans("모션스캔 2회") 대신, 같은 측정 방식으로 기록된 최소 2시점이 있을 때만
// 관찰 추이를 만든다. 조건(§5):
//   - 같은 poseProtocolVersion
//   - 같은 handSide
//   - baseline + recheck 를 모두 포함
//   - 비교 가능한 파생 관찰값(perFingerJointObservation)이 있는 capture
//
// 순수 함수 — 저장/화면에 접근하지 않는다. 원본 좌표·이미지는 다루지 않는다.
// ─────────────────────────────────────────────

import { toValidDate } from "./dateValue";

function hasComparableObservation(capture) {
  return Array.isArray(capture?.perFingerJointObservation) && capture.perFingerJointObservation.length > 0;
}

/**
 * getHistoryDetailed(details)에서 같은 측정 방식·같은 손의 비교 가능한 시점들을 모은다.
 * @returns {{ available:boolean, poseProtocolVersion:string|null, handSide:string|null,
 *             timepoints: Array<{eventId,type,capturedAt,poseProtocolVersion,handSide}> }}
 *          최소 2시점(baseline+recheck)이 없으면 available:false, timepoints:[].
 */
export function computeObservationTimepoints(details) {
  const caps = [];
  (details ?? []).forEach((d) => {
    (d?.captures ?? []).forEach((c) => {
      if (!hasComparableObservation(c)) return;
      if (!c.poseProtocolVersion || !c.handSide) return;
      caps.push({
        eventId: d.id,
        type: c.type, // baseline | recheck
        poseProtocolVersion: c.poseProtocolVersion,
        handSide: c.handSide,
        capturedAt: c.capturedAt,
      });
    });
  });

  const groups = new Map();
  caps.forEach((c) => {
    const key = `${c.poseProtocolVersion}|${c.handSide}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(c);
  });

  for (const [key, list] of groups) {
    const hasBaseline = list.some((c) => c.type === "baseline");
    const hasRecheck = list.some((c) => c.type === "recheck");
    if (list.length >= 2 && hasBaseline && hasRecheck) {
      const [poseProtocolVersion, handSide] = key.split("|");
      // 오래된 → 최신 순(추이 표시용).
      const timepoints = [...list].sort((a, b) => {
        const da = toValidDate(a.capturedAt);
        const db = toValidDate(b.capturedAt);
        if (da && db) return da.getTime() - db.getTime();
        if (da && !db) return -1;
        if (!da && db) return 1;
        return 0;
      });
      return { available: true, poseProtocolVersion, handSide, timepoints };
    }
  }
  return { available: false, poseProtocolVersion: null, handSide: null, timepoints: [] };
}
