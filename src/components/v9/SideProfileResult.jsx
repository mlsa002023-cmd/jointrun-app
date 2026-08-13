// P0-14 §11 — 측면 끝마디 관찰 결과.
// "측면 외곽 프로파일 관찰값"만 보여준다. 해부학적 방향(dorsal/palmar)을 붙이지 않고,
// 비대칭은 방향 없는 크기(%)로만 표시한다(§6). 일반 화면에는 프로파일 비율과 비대칭만 —
// 양쪽 반폭·MAD·quality flag는 QA 상세에서만 본다(§11).

function pct(v) {
  return Number.isFinite(v) ? `${Math.round(v * 100)}%` : "—";
}

export default function SideProfileResult({ observation, qaDetail = false }) {
  const fingers = observation?.fingers ?? [];
  const observed = fingers.filter((f) => f.sideProfileObserved);
  const failed = fingers.filter((f) => !f.sideProfileObserved);

  return (
    <div className="mb-3" data-testid="side-profile-result">
      <p className="text-[11px] font-bold text-slate-500 mb-2">측면 끝마디(DIP) 외곽 프로파일 관찰</p>

      {observed.length === 0 ? (
        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-[11px] text-slate-500">
          이번에는 측면 외곽을 안정적으로 구분하지 못했어요.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {observed.map((f) => (
            <div key={f.key} className="bg-slate-50 rounded-xl border border-slate-200 p-2.5" data-testid={`side-row-${f.key}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-black text-[#122A5C]">{f.name}</span>
                <span className="text-[9px] text-slate-400 font-bold">관찰됨</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="text-[9px] text-slate-500 leading-tight">측면 외곽<br />프로파일 비율</div>
                  <div className="text-sm font-black text-[#122A5C] font-mono">
                    {pct(f.dipSideProfileRatio)}
                  </div>
                </div>
                <div>
                  <div className="text-[9px] text-slate-500 leading-tight">좌우<br />비대칭(크기)</div>
                  <div className="text-[12px] font-black text-[#122A5C]">{pct(f.sideProfileAsymmetryRatio)}</div>
                </div>
              </div>
              {qaDetail && (
                <div className="mt-1.5 pt-1.5 border-t border-slate-200 text-[9px] text-slate-500 font-mono">
                  A {pct(f.sideAHalfProfileRatio)} · B {pct(f.sideBHalfProfileRatio)} · frames {f.validFrames ?? "—"} · mad {f.stabilityMad ?? "—"}
                </div>
              )}
            </div>
          ))}
          {failed.length > 0 && (
            <div className="text-[10px] text-slate-400">
              {failed.map((f) => f.name).join("·")} 측면 외곽은 관찰 어려움
            </div>
          )}
        </div>
      )}
    </div>
  );
}
