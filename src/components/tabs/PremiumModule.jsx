import { useState } from "react";

function PremiumModule({ currentProfile, triggerFeedback }) {
  const [angle, setAngle] = useState(15);
  const [preset, setPreset] = useState("생업");
  const presets = { "수면": 10, "생업": 15, "재활": 25 };

  return (
    <div className="space-y-3">
      <div className="text-center">
        <p className="text-[9px] text-slate-400 uppercase font-mono">Premium Control</p>
        <h2 className="text-sm font-bold text-slate-900">스마트 보조기 정밀 조율</h2>
      </div>
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-1.5">
          {Object.entries(presets).map(([label, val]) => (
            <button key={label} onClick={() => { setPreset(label); setAngle(val); triggerFeedback(`${label} 프리셋 적용: ${val}°`); }} className={`min-h-11 flex items-center justify-center rounded-xl text-[10px] font-bold border transition-all ${preset === label ? "bg-blue-500 text-white border-blue-500" : "bg-slate-50 border-slate-200 text-slate-600"}`}>
              {label}
            </button>
          ))}
        </div>
        <div>
          <div className="flex justify-between mb-1">
            <span className="text-[10px] text-slate-500 font-bold">압박 고정각</span>
            <span className="text-xs font-black text-blue-600 font-mono">{angle}°</span>
          </div>
          <input type="range" min={5} max={35} value={angle} onChange={e => setAngle(Number(e.target.value))} className="w-full accent-blue-600" />
          <div className="flex justify-between text-[8px] text-slate-400 mt-0.5"><span>5° 최소</span><span>35° 최대</span></div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-2.5 text-[10px] text-blue-800 leading-relaxed">
          {angle <= 12 ? "수면 중 무의식 꺾임 방지를 위한 최소 지지 모드입니다." : angle <= 20 ? `${currentProfile.job} 업무 시 최적 압박 각도입니다. 관절 보호와 움직임을 균형 있게 유지합니다.` : "강도 높은 재활 지지 모드입니다. 통증이 있을 시 즉시 각도를 낮추세요."}
        </div>
      </div>
    </div>
  );
}

export default PremiumModule;
