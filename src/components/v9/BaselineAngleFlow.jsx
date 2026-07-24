// RC1.2 §0/§2 — V10 첫 기준선을 만드는 각도 관찰 흐름.
//
//   판단 이유 선택(TriggerSelect) → 사용할 손 선택(CapturePrep) → 손 각도 관찰 기록(MotionScan)
//   → 측정 기록 완료 → '다음 단계로' → Home symptom_pending
//
// 각도 관찰은 V10 Event의 baseline capture로 저장한다(점수·프로필·rawFrames 없음). 증상 기록은
// 이 흐름에서 하지 않고 Home의 symptom_pending 카드에서 이어서 확정한다(별도 촬영 반복 없음).
import { useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useV9Repository } from "../../hooks/useV9Repository";
import { trackKpiEvent } from "../../lib/analytics";
import { V9_ANALYTICS_EVENTS } from "../../lib/v9EventTypes";
import TriggerSelectScreen from "./TriggerSelectScreen";
import CapturePrepScreen from "./CapturePrepScreen";
import MotionScanPage from "../MotionScanPage";

export default function BaselineAngleFlow({ event, onClose, onGoToNextAction }) {
  const { currentUser } = useAuth();
  const repository = useV9Repository();
  const uid = currentUser?.uid;

  // 이미 활성 Event가 있으면 그 eventId를 재사용한다(중복 생성 금지). 없으면 트리거 선택 후 생성.
  const [step, setStep] = useState(event?.id ? "prep" : "trigger");
  const [eventId, setEventId] = useState(event?.id ?? null);
  const [handSide, setHandSide] = useState(null);

  const track = (name, params) => trackKpiEvent(name, uid, params);

  const handleTriggerSubmit = async ({ primaryTrigger, secondaryTriggers }) => {
    // 활성 Event가 없을 때만 draft Event를 만든다.
    const newEventId = eventId ?? (await repository.startEvent({ primaryTrigger, secondaryTriggers, contextNote: "" }));
    setEventId(newEventId);
    track(V9_ANALYTICS_EVENTS.TRIGGER_SELECTED, { primaryTrigger });
    setStep("prep");
  };

  const handlePrepSubmit = ({ handSide: side }) => {
    setHandSide(side);
    track(V9_ANALYTICS_EVENTS.HAND_SIDE_SELECTED, { handSide: side });
    track(V9_ANALYTICS_EVENTS.ANGLE_RECORD_STARTED, { eventId });
    setStep("measure");
  };

  // MotionScan(captureMode)이 각도를 측정하면 관찰 capture로 저장한다. 성공해야 저장 게이트가 열린다.
  const handleAngleMeasured = async (angleData) => {
    await repository.saveAngleCapture(eventId, angleData);
  };

  if (step === "trigger") {
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 300, overflowY: "auto", background: "#F4F6FA" }}>
        <TriggerSelectScreen onSubmit={handleTriggerSubmit} onCancel={onClose} />
      </div>
    );
  }

  if (step === "prep") {
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 300, overflowY: "auto", background: "#F4F6FA" }}>
        <CapturePrepScreen onSubmit={handlePrepSubmit} onCancel={onClose} />
      </div>
    );
  }

  // measure — MotionScanPage는 자체적으로 position:fixed 풀스크린이다.
  return (
    <MotionScanPage
      captureMode
      handSide={handSide}
      onAngleMeasured={handleAngleMeasured}
      onGoToNextAction={() => { onClose(); onGoToNextAction?.(); }}
      triggerFeedback={() => {}}
      currentUser={currentUser}
    />
  );
}
