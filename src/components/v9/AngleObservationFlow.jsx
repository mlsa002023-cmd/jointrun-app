// RC1.2.1 §2 — 첫 기준선과 2주·4주 재확인이 동일한 관찰 프로토콜을 쓰도록 통합한 흐름.
//
//   mode="baseline": 판단 이유 → 사용할 손 → 손 각도 관찰 기록 → 완료 → Home(symptom_pending)
//   mode="recheck" : 기준선과 같은 손 확인 → 손 각도 관찰 기록 → 증상·상황 입력 → 비교 → 체감 변화
//
// 두 모드 모두 같은 MotionScanPage(captureMode)와 같은 저장 규칙을 쓴다. 원본 사진·영상·랜드마크,
// 점수·추천은 어느 모드에서도 저장하지 않는다.
import { useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useV9Repository } from "../../hooks/useV9Repository";
import { trackKpiEvent } from "../../lib/analytics";
import { V9_ANALYTICS_EVENTS, CAPTURE_TYPE } from "../../lib/v9EventTypes";
import TriggerSelectScreen from "./TriggerSelectScreen";
import CapturePrepScreen from "./CapturePrepScreen";
import RecheckHandConfirmScreen from "./RecheckHandConfirmScreen";
import SymptomSnapshotForm from "./SymptomSnapshotForm";
import ComparisonScreen from "./ComparisonScreen";
import MotionScanPage from "../MotionScanPage";

const overlay = { position: "fixed", inset: 0, zIndex: 300, overflowY: "auto", background: "#F4F6FA" };

export default function AngleObservationFlow({ mode = "baseline", event, recheck, onClose, onGoToNextAction, onCompleted }) {
  const { currentUser } = useAuth();
  const repository = useV9Repository();
  const uid = currentUser?.uid;
  const isRecheck = mode === "recheck";

  // 재확인은 기준선과 같은 손을 써야 비교가 성립한다 — 기준선 handSide를 그대로 이어받는다.
  const baselineHandSide = event?.baselineHandSide ?? null;

  const [step, setStep] = useState(isRecheck ? "handConfirm" : (event?.id ? "prep" : "trigger"));
  const [eventId, setEventId] = useState(event?.id ?? null);
  const [handSide, setHandSide] = useState(isRecheck ? baselineHandSide : null);
  const [captureId, setCaptureId] = useState(null);
  const [baselineCapture, setBaselineCapture] = useState(null);
  const [currentCapture, setCurrentCapture] = useState(null);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const track = (name, params) => trackKpiEvent(name, uid, params);

  const runStep = async (fn) => {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try { await fn(); } catch (err) {
      console.error("[AngleObservationFlow] 저장 실패:", err);
      setError("저장하지 못했습니다. 네트워크 연결을 확인하고 다시 시도해주세요.");
    } finally { setSubmitting(false); }
  };

  const handleTriggerSubmit = ({ primaryTrigger, secondaryTriggers }) => runStep(async () => {
    const newEventId = eventId ?? (await repository.startEvent({ primaryTrigger, secondaryTriggers, contextNote: "" }));
    setEventId(newEventId);
    track(V9_ANALYTICS_EVENTS.TRIGGER_SELECTED, { primaryTrigger });
    setStep("prep");
  });

  const handlePrepSubmit = ({ handSide: side }) => {
    setHandSide(side);
    track(V9_ANALYTICS_EVENTS.HAND_SIDE_SELECTED, { handSide: side });
    track(V9_ANALYTICS_EVENTS.ANGLE_RECORD_STARTED, { eventId, mode });
    setStep("measure");
  };

  // 각도 관찰 저장. baseline은 symptom_pending으로, recheck는 증상 입력 단계로 이어진다.
  const handleAngleMeasured = async (angleData) => {
    const newCaptureId = await repository.saveAngleCapture(eventId, {
      ...angleData,
      captureType: isRecheck ? CAPTURE_TYPE.RECHECK : CAPTURE_TYPE.BASELINE,
    });
    setCaptureId(newCaptureId);
  };

  // 재확인: 각도 저장 후 증상 입력 → 완료 처리 → 비교 화면
  const handleRecheckSymptomSubmit = (symptomSnapshot) => runStep(async () => {
    await repository.completeRecheckWithSymptom(eventId, recheck.id, captureId, symptomSnapshot);
    track(V9_ANALYTICS_EVENTS.SYMPTOM_SNAPSHOT_SAVED, { eventId });
    track(V9_ANALYTICS_EVENTS.RECHECK_COMPLETED, { dueType: recheck.dueType });
    const [baseline, current] = await Promise.all([
      repository.getCapture(eventId, event.baselineCaptureId),
      repository.getCapture(eventId, captureId),
    ]);
    setBaselineCapture(baseline);
    setCurrentCapture(current);
    setStep("comparison");
  });

  const handleComparisonSubmit = ({ comparable, nonComparableReasons, userPerceivedChange }) => runStep(async () => {
    await repository.saveComparison(eventId, {
      baselineCaptureId: event.baselineCaptureId,
      currentCaptureId: captureId,
      comparable,
      nonComparableReasons,
      userPerceivedChange,
    });
    onCompleted?.();
    onClose();
  });

  const banner = error && (
    <div style={{ position: "fixed", left: 16, right: 16, bottom: 16, zIndex: 400, background: "#FDF1EE", border: "1px solid #F3C7BB", borderRadius: 14, padding: 14 }}>
      <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#B3462E" }}>{error}</p>
      <button onClick={() => setError(null)} style={{ marginTop: 10, minHeight: 44, width: "100%", background: "#B3462E", color: "white", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700 }}>
        확인 (입력한 내용은 그대로 있어요 — 다시 저장해보세요)
      </button>
    </div>
  );

  if (step === "measure") {
    return (
      <MotionScanPage
        captureMode
        handSide={handSide}
        onAngleMeasured={handleAngleMeasured}
        onGoToNextAction={() => {
          if (isRecheck) { setStep("symptom"); return; } // 재확인은 이어서 증상 입력
          onClose();
          onGoToNextAction?.();
        }}
        triggerFeedback={() => {}}
        currentUser={currentUser}
      />
    );
  }

  return (
    <div style={overlay}>
      {step === "trigger" && <TriggerSelectScreen onSubmit={handleTriggerSubmit} onCancel={onClose} />}
      {step === "prep" && <CapturePrepScreen onSubmit={handlePrepSubmit} onCancel={onClose} />}
      {step === "handConfirm" && (
        <RecheckHandConfirmScreen
          handSide={baselineHandSide}
          dueType={recheck?.dueType}
          onSubmit={() => {
            track(V9_ANALYTICS_EVENTS.ANGLE_RECORD_STARTED, { eventId, mode });
            setStep("measure");
          }}
          onCancel={onClose}
        />
      )}
      {step === "symptom" && <SymptomSnapshotForm onSubmit={handleRecheckSymptomSubmit} onCancel={onClose} />}
      {step === "comparison" && (
        <ComparisonScreen
          baselineCapture={baselineCapture}
          currentCapture={currentCapture}
          onSubmit={handleComparisonSubmit}
          onCancel={onClose}
          onViewed={({ comparable }) => track(V9_ANALYTICS_EVENTS.COMPARISON_VIEWED, { eventId, comparable })}
        />
      )}
      {banner}
    </div>
  );
}
