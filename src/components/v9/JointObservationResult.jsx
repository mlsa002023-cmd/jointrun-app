// RC1.2.2 P0-8 §8 — 관찰 결과 표시.
// 평균 ROM을 메인에서 빼고 DIP 끝마디를 먼저 보여준다. PIP는 보조 관찰값으로 함께 적는다.
//
// 카피 원칙: 관찰된 사실만 서술한다. 정상범위·진단·악화 판정 문구를 쓰지 않는다.
import { DEVIATION_DIRECTION } from "../../lib/jointObservation";

const DIRECTION_LABEL = {
  [DEVIATION_DIRECTION.RADIAL]: "엄지쪽",
  [DEVIATION_DIRECTION.ULNAR]: "새끼쪽",
  [DEVIATION_DIRECTION.NEUTRAL]: "치우침 없음",
};

function deg(v) {
  return Number.isFinite(v) ? `${Math.round(v)}°` : "—";
}

// RC1.2.2 P0-10 — 가동범위를 관찰하지 못한 경우(주먹에서 끝마디가 가려져 굴곡을 신뢰할 수
// 없을 때)는 0°가 아니라 관찰 불가로 적는다. 0°는 "전혀 안 움직인다"로 오해된다.
function romText(v) {
  return Number.isFinite(v) ? `${Math.round(v)}°` : "관찰 어려움";
}

/** 부호 있는 편위각을 "크기 + 방향"으로 적는다. 부호를 그대로 노출하지 않는다. */
function deviationText(deviationDeg, direction) {
  if (!Number.isFinite(deviationDeg)) return "—";
  const label = DIRECTION_LABEL[direction] ?? "";
  if (direction === DEVIATION_DIRECTION.NEUTRAL) return `${Math.abs(Math.round(deviationDeg))}° 치우침 없음`;
  return `${Math.abs(Math.round(deviationDeg))}° ${label}`;
}

export default function JointObservationResult({ joints }) {
  if (!joints?.length) {
    return (
      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 mb-3">
        <div className="text-[11px] text-slate-500">관절별 관찰값을 계산하지 못했습니다.</div>
      </div>
    );
  }

  return (
    <div className="mb-3" data-testid="joint-observation">
      <p className="text-[11px] font-bold text-slate-500 mb-2">
        끝마디(DIP) 관찰 — 손가락별
      </p>

      <div className="flex flex-col gap-2 mb-3">
        {joints.map((f) => (
          <div key={f.key} className="bg-slate-50 rounded-xl border border-slate-200 p-2.5" data-testid={`joint-row-${f.key}`}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-black text-[#122A5C]">{f.name}</span>
              {!f.dipObserved && (
                <span className="text-[9px] text-slate-400 font-bold">끝마디 관찰 어려움</span>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <div className="text-[9px] text-slate-500 leading-tight">최대한 편 상태<br />끝마디 굽힘</div>
                <div className="text-sm font-black text-[#122A5C] font-mono">
                  {deg(f.dipExtensionPoseFlexionDeg)}
                </div>
              </div>
              <div>
                <div className="text-[9px] text-slate-500 leading-tight">끝마디<br />좌우 치우침</div>
                <div className="text-[12px] font-black text-[#122A5C]">
                  {deviationText(f.dipExtensionPoseDeviationDeg, f.dipDeviationDirection)}
                </div>
              </div>
              <div>
                <div className="text-[9px] text-slate-500 leading-tight">끝마디<br />활동 범위</div>
                <div className={`font-black text-[#122A5C] ${Number.isFinite(f.dipActiveRomDeg) ? "text-sm font-mono" : "text-[11px]"}`}>
                  {romText(f.dipActiveRomDeg)}
                </div>
              </div>
            </div>

            {/* 2순위 — PIP 중간마디는 보조 관찰값으로 한 줄에 요약한다. */}
            <div className="mt-1.5 pt-1.5 border-t border-slate-200 text-[9px] text-slate-500">
              중간마디(PIP) · 편 상태 {deg(f.pipExtensionPoseFlexionDeg)}
              {" · "}치우침 {deviationText(f.pipExtensionPoseDeviationDeg, f.pipDeviationDirection)}
              {" · "}활동 범위 {romText(f.pipActiveRomDeg)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
