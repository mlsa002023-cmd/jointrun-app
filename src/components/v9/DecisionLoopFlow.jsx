// ─────────────────────────────────────────────
// DecisionLoopFlow
// 04_APP_PRD_V9.md 핵심 흐름의 오케스트레이터. 두 모드를 지원한다:
//   mode="baseline" — 트리거 선택부터 첫 기준선 저장까지 (S02~S06)
//   mode="recheck"  — 이미 있는 Event의 2주/4주 재확인 1건을 완료 (S03~S06, S09)
// 각 화면(S02~S09)은 이 파일이 조립하는 개별 컴포넌트로 분리되어 있다 — 여기는 상태 전이와
// Repository 호출·분석 이벤트 발생만 담당한다(UI 계층에 비즈니스 로직을 두지 않는다는 원칙).
// ─────────────────────────────────────────────
import { useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useV9Repository } from "../../hooks/useV9Repository";
import { trackKpiEvent } from "../../lib/analytics";
import { V9_ANALYTICS_EVENTS, CAPTURE_TYPE } from "../../lib/v9EventTypes";
import TriggerSelectScreen from "./TriggerSelectScreen";
import CapturePrepScreen from "./CapturePrepScreen";
import GuidedCaptureScreen from "./GuidedCaptureScreen";
import SymptomSnapshotForm from "./SymptomSnapshotForm";
import BaselineSavedScreen from "./BaselineSavedScreen";
import ComparisonScreen from "./ComparisonScreen";

export default function DecisionLoopFlow({ mode, event, recheck, onClose, onCompleted }) {
  const { currentUser } = useAuth();
  const repository = useV9Repository();
  const uid = currentUser?.uid;

  const [step, setStep] = useState(mode === "baseline" ? "trigger" : "prep");
  const [eventId, setEventId] = useState(event?.id ?? null);
  const [handSide, setHandSide] = useState(null);
  const [quality, setQuality] = useState(null);
  const [captureId, setCaptureId] = useState(null);
  const [recheckDueDates, setRecheckDueDates] = useState(null);
  const [baselineCapture, setBaselineCapture] = useState(null);
  const [currentCapture, setCurrentCapture] = useState(null);

  const track = (name, params) => trackKpiEvent(name, uid, params);

  const handleTriggerSubmit = async ({ primaryTrigger, secondaryTriggers }) => {
    const newEventId = await repository.startEvent({ primaryTrigger, secondaryTriggers, contextNote: "" });
    setEventId(newEventId);
    track(V9_ANALYTICS_EVENTS.TRIGGER_SELECTED, { primaryTrigger, secondaryCount: secondaryTriggers.length });
    setStep("prep");
  };

  const handlePrepSubmit = ({ handSide: side }) => {
    setHandSide(side);
    track(V9_ANALYTICS_EVENTS.CAPTURE_STARTED, { eventId, captureType: mode === "baseline" ? CAPTURE_TYPE.BASELINE : CAPTURE_TYPE.RECHECK });
    setStep("capture");
  };

  const handleCaptured = ({ qualityStatus, qualityFlags }) => {
    if (qualityStatus !== "pass") {
      track(V9_ANALYTICS_EVENTS.CAPTURE_QUALITY_FAILED, { eventId, reason: qualityFlags?.[0] ?? "unknown" });
    }
    setQuality({ qualityStatus, qualityFlags });
    setStep("symptom");
  };

  const handleSymptomSubmit = async (symptomSnapshot) => {
    track(V9_ANALYTICS_EVENTS.SYMPTOM_SAVED, { eventId, fieldsCompleted: Object.keys(symptomSnapshot).length });

    const newCaptureId = await repository.saveCapture(eventId, {
      type: mode === "baseline" ? CAPTURE_TYPE.BASELINE : CAPTURE_TYPE.RECHECK,
      handSide,
      qualityStatus: quality.qualityStatus,
      qualityFlags: quality.qualityFlags,
      symptomSnapshot,
    });
    setCaptureId(newCaptureId);
    track(V9_ANALYTICS_EVENTS.CAPTURE_COMPLETED, { eventId, captureType: mode === "baseline" ? "baseline" : "recheck", qualityStatus: quality.qualityStatus });

    if (mode === "baseline") {
      const schedule = await repository.confirmBaseline(eventId, newCaptureId, new Date());
      setRecheckDueDates(schedule);
      track(V9_ANALYTICS_EVENTS.BASELINE_CREATED, { eventId, baselineId: newCaptureId });
      track(V9_ANALYTICS_EVENTS.RECHECK_SCHEDULED, { dueType: "week2", dueAt: schedule?.week2DueAt?.toISOString?.() });
      track(V9_ANALYTICS_EVENTS.RECHECK_SCHEDULED, { dueType: "week4", dueAt: schedule?.week4DueAt?.toISOString?.() });
      setStep("saved");
      return;
    }

    // recheck 모드: 재확인 완료 처리 후 기준선 캡처를 불러와 비교 화면으로 이동.
    await repository.completeRecheck(eventId, recheck.id, newCaptureId);
    track(V9_ANALYTICS_EVENTS.RECHECK_COMPLETED, { dueType: recheck.dueType, comparable: null });

    const [baseline, current] = await Promise.all([
      repository.getCapture(eventId, event.baselineCaptureId),
      repository.getCapture(eventId, newCaptureId),
    ]);
    setBaselineCapture(baseline);
    setCurrentCapture(current);
    setStep("comparison");
  };

  const handleComparisonViewed = ({ comparable }) => {
    track(V9_ANALYTICS_EVENTS.COMPARISON_VIEWED, { eventId, comparable });
  };

  const handleComparisonSubmit = async ({ comparable, nonComparableReasons, userPerceivedChange }) => {
    await repository.saveComparison(eventId, {
      baselineCaptureId: event.baselineCaptureId,
      currentCaptureId: captureId,
      comparable,
      nonComparableReasons,
      userPerceivedChange,
    });
    setStep("saved");
  };

  const handleDone = () => {
    onCompleted?.();
    onClose();
  };

  // GuidedCaptureScreen은 이미 자체적으로 position:fixed 풀스크린이라 그대로 반환한다.
  // 나머지 화면(OnboardingScreen과 같은 패턴)은 minHeight:100vh만 쓰므로, 여기서 fixed 오버레이로
  // 감싸지 않으면 홈 화면 콘텐츠 아래에 이어 붙는 형태로 렌더링된다(뒤에 있던 실제 버그 — 스크롤을
  // 해야 보이고 하단 탭바가 화면 위에 겹쳐 보였다). 모든 하위 화면을 이 fixed 컨테이너로 감싼다.
  if (step === "capture") return <GuidedCaptureScreen handSide={handSide} onCaptured={handleCaptured} onCancel={onClose} />;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 300, overflowY: "auto", background: "#f8fafc" }}>
      {step === "trigger" && <TriggerSelectScreen onSubmit={handleTriggerSubmit} onCancel={onClose} />}
      {step === "prep" && <CapturePrepScreen onSubmit={handlePrepSubmit} onCancel={onClose} />}
      {step === "symptom" && <SymptomSnapshotForm onSubmit={handleSymptomSubmit} onCancel={onClose} />}
      {step === "comparison" && (
        <ComparisonScreen
          baselineCapture={baselineCapture}
          currentCapture={currentCapture}
          onSubmit={handleComparisonSubmit}
          onCancel={onClose}
          onViewed={handleComparisonViewed}
        />
      )}
      {step === "saved" && (
        <BaselineSavedScreen
          mode={mode}
          week2DueAt={recheckDueDates?.week2DueAt}
          week4DueAt={recheckDueDates?.week4DueAt}
          onDone={handleDone}
        />
      )}
    </div>
  );
}

// 에러 발생 시 draft 상태 이벤트가 남는 것을 막기 위한 안전장치는 두지 않는다(P1) —
// 사용자가 중간에 onClose(뒤로/취소)하면 draft 상태의 Event가 그대로 남는다. 홈 카드는
// baseline_created 이후 상태만 agenda로 보여주므로 화면에는 영향이 없지만, 미완료 draft
// 정리(soft delete/TTL)는 후속 작업으로 남긴다 — docs/V9_ALIGNMENT_GAP.md 참고.
