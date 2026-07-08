import { useState, useEffect } from "react";
import { Check, Flame } from "lucide-react";

// "기록하기" 섹션 — 컨디션 체크인(붓기/피로도) + 오늘의 회복 미션. First Scan/Normal 공통.
function RecordSection({ currentProfile, recoverySteps, setRecoverySteps, setActiveTab, triggerFeedback, onCheckIn, onConditionCheckIn }) {
  const [activeStepId, setActiveStepId] = useState(1);
  const [swellingLevel, setSwellingLevel] = useState(0);
  const [fatigueLevel, setFatigueLevel] = useState(0);

  useEffect(() => {
    const next = recoverySteps.find(s => !s.isCompleted);
    if (next) setActiveStepId(next.id);
  }, [recoverySteps]);

  const completeStep = (id) => {
    const completedStep = recoverySteps.find(s => s.id === id);
    const next = recoverySteps.map(s => s.id === id ? { ...s, isCompleted: true } : s);
    setRecoverySteps(next);
    triggerFeedback(`${completedStep?.label} 완료!`);
    onCheckIn?.({
      stepId: id,
      stepLabel: completedStep?.label || "",
      painIndex: currentProfile.painIndex,
      morningStiffnessMin: currentProfile.morningStiffnessMin,
    });
    const nextStep = recoverySteps.find(s => s.id > id && !s.isCompleted);
    if (nextStep) setActiveStepId(nextStep.id);
  };

  const completedCount = recoverySteps.filter(s => s.isCompleted).length;

  return (
    <>
      <div className="bg-white border border-slate-200 rounded-2xl p-3 shadow-sm">
        <h4 className="text-xs font-bold text-slate-900 mb-2">기록하기 — 오늘의 컨디션 체크인</h4>
        <div className="space-y-2.5">
          <label className="block">
            <div className="flex justify-between text-[10px] text-slate-500 mb-1">
              <span>붓기 정도</span><span className="font-bold text-blue-700">{swellingLevel}/10</span>
            </div>
            <input type="range" min={0} max={10} value={swellingLevel}
              onChange={(e) => setSwellingLevel(Number(e.target.value))}
              className="w-full accent-blue-600" />
          </label>
          <label className="block">
            <div className="flex justify-between text-[10px] text-slate-500 mb-1">
              <span>피로도</span><span className="font-bold text-blue-700">{fatigueLevel}/10</span>
            </div>
            <input type="range" min={0} max={10} value={fatigueLevel}
              onChange={(e) => setFatigueLevel(Number(e.target.value))}
              className="w-full accent-blue-600" />
          </label>
          <button onClick={() => onConditionCheckIn?.(swellingLevel, fatigueLevel)}
            className="w-full bg-blue-600 text-white text-[11px] font-bold py-2 rounded-xl mt-1">
            체크인 반영하기
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-3 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1">
            <Flame className="w-4 h-4 text-orange-500" />오늘의 회복 미션
          </h4>
          <span className="text-[10px] text-blue-600 font-bold">{completedCount}/{recoverySteps.length}</span>
        </div>
        <div className="space-y-1.5">
          {recoverySteps.map(step => (
            <div key={step.id} className={`flex items-center gap-2 p-2 rounded-xl transition-all ${step.isCompleted ? "bg-blue-50 border border-blue-200" : activeStepId === step.id ? "bg-orange-50 border border-orange-200" : "bg-slate-50 border border-slate-100"}`}>
              <button onClick={() => !step.isCompleted && completeStep(step.id)} className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[8px] font-black border transition-all ${step.isCompleted ? "bg-blue-500 border-blue-500 text-white" : "border-slate-300 text-slate-400 hover:border-blue-400"}`}>
                {step.isCompleted ? <Check className="w-3 h-3" /> : step.id}
              </button>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-bold text-slate-800 truncate">{step.label}</div>
                <div className="text-[8px] text-slate-400 truncate">{step.description}</div>
              </div>
              {!step.isCompleted && activeStepId === step.id && (
                <button onClick={() => { if (step.id === 2) setActiveTab("scan"); else if (step.id === 3) setActiveTab("coach"); else completeStep(step.id); }} className="text-[8px] font-bold text-orange-600 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-lg shrink-0">
                  {step.id === 2 ? "스캔" : step.id === 3 ? "코치" : "시작"}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

export default RecordSection;
