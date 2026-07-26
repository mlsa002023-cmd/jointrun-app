// RC1.2.2 P0-9 §8 — DIP 외곽 폭 관찰 표시. QA 허용 계정에만 먼저 노출한다.
//
// 카피 원칙: 관찰값만 적는다. 붓기·염증·질환 원인을 판정하지 않고, "측정 완료" 같은
// 단정도 하지 않는다. 관찰에 실패하면 값을 0으로 보여주지 않고 재측정을 안내한다(§6).

/** 비율을 백분율 문자열로. 값이 없으면 표시하지 않는다. */
function ratio(v) {
  return Number.isFinite(v) ? `${Math.round(v * 100)}%` : "—";
}

/** 좌우 비대칭은 크기와 방향으로 적는다(부호를 그대로 노출하지 않는다). */
function asymmetryText(v) {
  if (!Number.isFinite(v)) return "—";
  const pct = Math.round(Math.abs(v) * 100);
  if (pct < 5) return `${pct}% 치우침 없음`;
  return `${pct}% ${v > 0 ? "엄지쪽" : "새끼쪽"}`;
}

export default function DipContourResult({ observation, flags = [], onRetake }) {
  const fingers = observation?.fingers ?? [];

  if (!fingers.length) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-3" data-testid="dip-contour-retake">
        <p className="text-[11px] font-black text-amber-900 mb-1">끝마디 외곽 폭 관찰값</p>
        <p className="text-[11px] text-amber-800 leading-relaxed mb-2">
          이번 촬영에서는 외곽을 안정적으로 구분하지 못했습니다. 배경과 손이 잘 구분되는 곳에서
          손가락을 벌린 채 다시 촬영해 주세요.
        </p>
        {flags.length > 0 && (
          <p className="text-[9px] text-amber-700 font-mono mb-2">{flags.join(", ")}</p>
        )}
        {onRetake && (
          <button
            type="button"
            onClick={onRetake}
            className="text-[11px] font-black text-amber-900 underline"
            style={{ minHeight: 44 }}
          >
            다시 촬영하기
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="mb-3" data-testid="dip-contour-result">
      <p className="text-[11px] font-bold text-slate-500 mb-2">끝마디 외곽 폭 관찰값</p>

      <div className="flex flex-col gap-2 mb-2">
        {fingers.map((f) => (
          <div
            key={f.key}
            className="bg-slate-50 rounded-xl border border-slate-200 p-2.5"
            data-testid={`dip-contour-row-${f.key}`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-black text-[#122A5C]">{f.name}</span>
              <span className="text-[9px] text-slate-400">{f.validFrames}프레임</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <div className="text-[9px] text-slate-500 leading-tight">끝마디<br />외곽 폭</div>
                <div className="text-sm font-black text-[#122A5C] font-mono">{ratio(f.dipWidthRatio)}</div>
              </div>
              <div>
                <div className="text-[9px] text-slate-500 leading-tight">좌우 윤곽<br />비대칭</div>
                <div className="text-[12px] font-black text-[#122A5C]">{asymmetryText(f.contourAsymmetryRatio)}</div>
              </div>
              <div>
                <div className="text-[9px] text-slate-500 leading-tight">엄지쪽 /<br />새끼쪽 반폭</div>
                <div className="text-[12px] font-black text-[#122A5C] font-mono">
                  {ratio(f.radialHalfWidthRatio)} / {ratio(f.ulnarHalfWidthRatio)}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <p className="text-[10px] text-slate-500 leading-relaxed bg-[#F4F6FA] border border-[#E1E7EF] rounded-xl p-2.5">
        인접 마디 대비 비율로 관찰한 값입니다. 이 값은 질환이나 붓기의 원인을 판정하지 않습니다.
      </p>
    </div>
  );
}
