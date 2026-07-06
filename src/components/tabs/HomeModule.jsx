import { useState, useEffect } from "react";
import { Check, Flame } from "lucide-react";

function HomeModule({ currentProfile, recoverySteps, setRecoverySteps, setActiveTab, triggerFeedback, onUpdateProfile, onCheckIn }) {
  const [activeStepId, setActiveStepId] = useState(1);
  const [timer, setTimer] = useState(180);
  const [timerRunning, setTimerRunning] = useState(false);

  useEffect(() => {
    const next = recoverySteps.find(s => !s.isCompleted);
    if (next) setActiveStepId(next.id);
  }, [recoverySteps]);

  useEffect(() => {
    if (!timerRunning) return;
    if (timer <= 0) { setTimerRunning(false); triggerFeedback("온수 잼잼 요법 완료!"); return; }
    const t = setTimeout(() => setTimer(p => p - 1), 1000);
    return () => clearTimeout(t);
  }, [timerRunning, timer]);

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
  const score = currentProfile.fingerScore;

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-br from-teal-50 to-slate-50 border border-teal-200 rounded-2xl p-3.5 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="text-[9px] text-slate-400 uppercase font-mono">Finger Score™</p>
            <div className="flex items-end gap-1">
              <span className="text-2xl font-black text-teal-700 font-mono">{score}</span>
              <span className="text-xs text-slate-500 mb-0.5">/100</span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[9px] text-slate-400">관절 기능 나이</p>
            <p className="text-lg font-black text-slate-800 font-mono">{currentProfile.fingerAge}<span className="text-xs font-normal">세</span></p>
          </div>
        </div>
        <div className="w-full bg-slate-200 rounded-full h-2">
          <div className="bg-teal-500 h-2 rounded-full transition-all" style={{ width: `${score}%` }} />
        </div>
        <div className="flex justify-between text-[8px] text-slate-400 mt-0.5">
          <span>주의</span><span>양호</span><span>최상</span>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-3 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1">
            <Flame className="w-4 h-4 text-orange-500" />오늘의 회복 미션
          </h4>
          <span className="text-[10px] text-teal-600 font-bold">{completedCount}/{recoverySteps.length}</span>
        </div>
        <div className="space-y-1.5">
          {recoverySteps.map(step => (
            <div key={step.id} className={`flex items-center gap-2 p-2 rounded-xl transition-all ${step.isCompleted ? "bg-teal-50 border border-teal-200" : activeStepId === step.id ? "bg-orange-50 border border-orange-200" : "bg-slate-50 border border-slate-100"}`}>
              <button onClick={() => !step.isCompleted && completeStep(step.id)} className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[8px] font-black border transition-all ${step.isCompleted ? "bg-teal-500 border-teal-500 text-white" : "border-slate-300 text-slate-400 hover:border-teal-400"}`}>
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

      <div className="bg-white border border-slate-200 rounded-2xl p-3 shadow-sm">
        <h4 className="text-xs font-bold text-slate-900 mb-2">오늘의 AI 처방</h4>
        <div className="bg-teal-50 border border-teal-200 rounded-xl p-2.5 text-[10px] text-slate-700 leading-relaxed">
          {currentProfile.painIndex > 6 ? `${currentProfile.name} 님, 오늘 통증 수치가 높습니다. 무리한 손 사용을 줄이고 3분 온수 잼잼 요법을 즉시 시작해 주세요.` : `${currentProfile.name} 님, 오늘 관절 상태가 안정적입니다. 스마트 보조기를 착용한 채로 가볍게 20초 스캔을 진행해 회복 데이터를 누적해 보세요.`}
        </div>
      </div>
    </div>
  );
}

export default HomeModule;
