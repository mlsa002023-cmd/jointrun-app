// ─────────────────────────────────────────────
// MotionScanPage
// 역할: CameraView(카메라) + HandTracker(AI) + 포즈 프로토콜(순수 모듈) + UI를 조립한다.
//
// P0-14 — 3-포즈 관찰 프로토콜(정면·측면·굽힘):
//   1. front_spread          정면 관절·외곽 관찰 (정면 DIP 캘리퍼)
//   2. ok_fan_lateral        OK 부채꼴 측면 외곽 관찰 (측면 DIP 캘리퍼, 부분 성공 허용)
//   3. max_comfortable_fist  개인이 가능한 범위의 굽힘 관찰 (캘리퍼 없음, skeleton만)
//
// 자세 판정은 poseProtocol.evaluatePoseFrame(순수), 상태 전이는 poseHoldMachine
// (aligning→holding→confirmed)이 담당한다. 이 컴포넌트는 카메라·오버레이·저장 조립만 한다.
// 원본 사진·영상·랜드마크·displayGeometry는 어디에도 저장하지 않는다(§9).
// ─────────────────────────────────────────────

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, RefreshCw, Check } from "lucide-react";
import CameraView from "./CameraView";
import { HAND_CONNECTIONS, initHandTracker, detectHands, disposeHandTracker } from "../lib/handTracker";
import { analyzeAllFingers, buildRecommendation, aggregateFingerSamples, computeFistMetric, computeOkSignMetric, detectGesture } from "../lib/motionAnalyzer";
import {
  analyzeFingerJoints, aggregateJointSamples, buildFingerJointObservations, summarizeDeviationDirection,
} from "../lib/jointObservation";
import { assessPoseMeasurement, assessMeasurement } from "../lib/measurementQuality";
import {
  measureFrameDipContours, aggregateDipContourFrames, buildDipContourPayload,
  measureFrameSideProfiles, aggregateSideProfileFrames, buildSideProfilePayload,
  stripTransientGeometry, CONTOUR_FRAME_TARGET, SIDE_PROFILE_FINGERS, MIN_VALID_FRAMES,
} from "../lib/dipContour";
import {
  POSES, evaluatePoseFrame, meanFingerCurlRatio, FAN_MIN_VALID_FINGERS,
} from "../lib/poseProtocol";
import { createHoldState, stepHold, POSE_STATUS, DEFAULT_HOLD_OPTIONS } from "../lib/poseHoldMachine";
import JointObservationResult from "./v9/JointObservationResult";
import DipContourResult from "./v9/DipContourResult";
import SideProfileResult from "./v9/SideProfileResult";
import ObservationSummaryCard from "./v9/ObservationSummaryCard";
import { buildObservationSummary, SUMMARY_MODE } from "../lib/observationSummary";
import { deriveOverlayModel, drawCaliperOverlay } from "../lib/dipCaliperOverlay";
import { computeMobilityScore, computeStabilityScore } from "../lib/fingerHealthScore";
import { FEATURE_FLAGS, shouldShowQaTools } from "../config/featureFlags";
import { trackKpiEvent } from "../lib/analytics";
import { V9_ANALYTICS_EVENTS, VIEW_TYPE, RECORDING_STATUS } from "../lib/v9EventTypes";

// 15초 이상 부채꼴 자세를 맞추기 어려우면 부분 기록 옵션을 노출한다(§5).
const FAN_PARTIAL_AFTER_MS = 15000;

function PoseIcon({ poseId, className = "" }) {
  const stroke = "currentColor";
  if (poseId === VIEW_TYPE.OK_FAN_LATERAL) {
    // OK + 부채꼴(측면) 아이콘
    return (
      <svg viewBox="0 0 64 64" className={className} fill="none">
        <circle cx="22" cy="38" r="9" stroke={stroke} strokeWidth="3" />
        <path d="M34 22 L40 40" stroke={stroke} strokeWidth="3" strokeLinecap="round" />
        <path d="M42 20 L46 40" stroke={stroke} strokeWidth="3" strokeLinecap="round" />
        <path d="M50 22 L52 42" stroke={stroke} strokeWidth="3" strokeLinecap="round" />
      </svg>
    );
  }
  if (poseId === VIEW_TYPE.MAX_COMFORTABLE_FIST) {
    return (
      <svg viewBox="0 0 64 64" className={className} fill="none">
        <rect x="16" y="26" width="32" height="24" rx="10" stroke={stroke} strokeWidth="3" />
        <path d="M24 26 V18" stroke={stroke} strokeWidth="3" strokeLinecap="round" />
        <path d="M32 26 V16" stroke={stroke} strokeWidth="3" strokeLinecap="round" />
        <path d="M40 26 V18" stroke={stroke} strokeWidth="3" strokeLinecap="round" />
        <path d="M14 36 Q10 38 12 44" stroke={stroke} strokeWidth="3" strokeLinecap="round" />
      </svg>
    );
  }
  // front_spread(기본) — 손가락 편 손
  return (
    <svg viewBox="0 0 64 64" className={className} fill="none">
      <path d="M32 58 Q18 58 16 44 L14 30" stroke={stroke} strokeWidth="3" strokeLinecap="round" />
      <path d="M20 30 L18 12" stroke={stroke} strokeWidth="3" strokeLinecap="round" />
      <path d="M28 28 L27 8" stroke={stroke} strokeWidth="3" strokeLinecap="round" />
      <path d="M36 28 L38 8" stroke={stroke} strokeWidth="3" strokeLinecap="round" />
      <path d="M44 30 L48 12" stroke={stroke} strokeWidth="3" strokeLinecap="round" />
      <path d="M50 34 L56 22" stroke={stroke} strokeWidth="3" strokeLinecap="round" />
      <path d="M32 58 Q46 58 48 44 L50 34" stroke={stroke} strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function drawSkeleton(landmarks, canvas, videoW, videoH) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (canvas.width !== videoW) canvas.width = videoW;
  if (canvas.height !== videoH) canvas.height = videoH;
  ctx.clearRect(0, 0, videoW, videoH);
  const toCanvas = (lm) => ({ x: lm.x * videoW, y: lm.y * videoH });
  ctx.strokeStyle = "#00fff7";
  ctx.lineWidth = 2;
  HAND_CONNECTIONS.forEach(([i, j]) => {
    const a = toCanvas(landmarks[i]), b = toCanvas(landmarks[j]);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  });
  landmarks.forEach((lm, idx) => {
    const p = toCanvas(lm);
    ctx.beginPath();
    ctx.arc(p.x, p.y, idx === 0 ? 5 : 3, 0, 2 * Math.PI);
    ctx.fillStyle = idx === 0 ? "#ff6b6b" : "#c084fc";
    ctx.fill();
  });
}

// 현재 video 프레임을 오프스크린 캔버스에 그려 픽셀을 읽고, 외곽 관찰만 돌려준다.
// ImageData는 이 함수를 벗어나지 않는다(§9). 해상도는 계산에 충분한 선에서 낮춘다.
const DIP_CONTOUR_MAX_WIDTH = 480;

function measureContourFromVideo(video, landmarks, canvasRef, measureFn) {
  try {
    const vw = video?.videoWidth ?? 0;
    const vh = video?.videoHeight ?? 0;
    if (!vw || !vh || !landmarks) return null;
    const scale = Math.min(1, DIP_CONTOUR_MAX_WIDTH / vw);
    const w = Math.round(vw * scale);
    const h = Math.round(vh * scale);
    let canvas = canvasRef.current;
    if (!canvas) { canvas = document.createElement("canvas"); canvasRef.current = canvas; }
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, w, h);
    const imageData = ctx.getImageData(0, 0, w, h);
    return measureFn(imageData, landmarks);
  } catch {
    return null; // 캔버스 접근 실패는 관찰 생략으로 처리(촬영 자체를 막지 않음).
  }
}

function clearCanvas(canvas) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

export default function MotionScanPage({
  onScanCompleted, triggerFeedback, onGoToNextAction, currentUser,
  captureMode = false, onAngleMeasured, handSide = null,
}) {
  const cameraRef = useRef(null);
  const rafRef = useRef(null);
  const finishScanRef = useRef(null);
  const lastVideoTimeRef = useRef(-1);
  const latestFingersRef = useRef(null);
  const sampleBufferRef = useRef([]); // { fingers, worldLandmarks, ts } 최근 프레임 버퍼
  const SAMPLE_WINDOW_MS = 1500;
  const rawFramesRef = useRef({}); // { front_spread:[...], max_comfortable_fist:[...] } — 관절 계산용 world landmark
  const CONTOUR_TICK_MS = 100; // 외곽 측정 ~10fps throttle (§16)
  const RAW_FRAMES_PER_POSE = 20;
  // 정면(front) 외곽 관찰 프레임·유효 카운트.
  const dipContourFramesRef = useRef([]);
  const dipValidCountsRef = useRef({});
  // 측면(fanLateral) 외곽 관찰 프레임·유효 카운트.
  const sideContourFramesRef = useRef([]);
  const sideValidCountsRef = useRef({});
  const contourCanvasRef = useRef(null);
  const lastContourTickRef = useRef(0);
  const caliperModelRef = useRef(null);
  // front_spread에서 추정한 평균 curl 비율 — fist 단계의 "변화" 기준(previousPoseData).
  const spreadCurlRef = useRef(null);

  // phase: idle | camera_starting | ai_loading | scanning | camera_error | ai_error | completed
  const [phase, setPhase] = useState("idle");
  const [errorMessage, setErrorMessage] = useState(null);
  const [handDetected, setHandDetected] = useState(false);
  const [liveMetrics, setLiveMetrics] = useState(null);
  const [gripMetric, setGripMetric] = useState(null);
  const [debugInfo, setDebugInfo] = useState(null);
  const qaAllowed = shouldShowQaTools(currentUser);
  const [debugVisible, setDebugVisible] = useState(() => {
    try { return !!import.meta.env.DEV; } catch { return false; }
  });
  const debugVisibleRef = useRef(debugVisible);
  useEffect(() => { debugVisibleRef.current = debugVisible; }, [debugVisible]);
  const [history, setHistory] = useState([]);
  const [scanResult, setScanResult] = useState(null);
  const [saveState, setSaveState] = useState("idle");
  const scanPayloadRef = useRef(null);
  const savingRef = useRef(false);
  const nextClickedRef = useRef(false);

  // ── 포즈 상태 ──
  const [poseIndex, setPoseIndex] = useState(0);
  const [poseStatus, setPoseStatus] = useState(POSE_STATUS.ALIGNING);
  const [holdProgress, setHoldProgress] = useState(0);
  const [coachMsg, setCoachMsg] = useState(null);
  const [poseJustConfirmed, setPoseJustConfirmed] = useState(false);
  const [fanPartialAvailable, setFanPartialAvailable] = useState(false);
  const poseIndexRef = useRef(0);
  const poseResultsRef = useRef({}); // { [poseId]: aggregatedFingers }
  const poseConfirmedRef = useRef(false);
  const holdStateRef = useRef(createHoldState());
  const poseStartMsRef = useRef(0);
  const coachCodeRef = useRef(null);
  const poseStatusRef = useRef(POSE_STATUS.ALIGNING);
  const holdProgressRef = useRef(0);
  const confirmPoseRef = useRef(null);

  const cameraActive = phase === "camera_starting" || phase === "ai_loading" || phase === "scanning";

  const currentPose = POSES[poseIndex] ?? POSES[0];

  // ── 부채꼴(측면) 자동 완료에 필요한 최소 유효 손가락 수 충족 여부(§5) ──
  const fanFingersSufficient = useCallback(() => {
    const enough = SIDE_PROFILE_FINGERS.filter((k) => (sideValidCountsRef.current[k] ?? 0) >= MIN_VALID_FRAMES);
    return enough.length >= FAN_MIN_VALID_FINGERS;
  }, []);

  // ── 포즈 확정 → 다음 포즈 또는 완료 ──
  const confirmPose = useCallback((aggregated, { partial = false } = {}) => {
    if (poseConfirmedRef.current) return;
    poseConfirmedRef.current = true;

    const pose = POSES[poseIndexRef.current];
    setPoseJustConfirmed(true);
    setFanPartialAvailable(false);
    triggerFeedback(`${pose.title} 완료`);
    trackKpiEvent(V9_ANALYTICS_EVENTS.POSE_CONFIRMED, currentUser?.uid, {
      poseId: pose.id,
      recordingStatus: partial ? RECORDING_STATUS.INCOMPLETE : RECORDING_STATUS.COMPLETED,
    });

    // 이 포즈의 대표 손가락값(ROM 계산용)과 원본 world landmark(관절 계산용)를 보존한다.
    const confirmed = { ...poseResultsRef.current, [pose.id]: aggregated };
    poseResultsRef.current = confirmed;
    rawFramesRef.current = {
      ...rawFramesRef.current,
      [pose.id]: sampleBufferRef.current.slice(-RAW_FRAMES_PER_POSE).map((s) => ({ worldLandmarks: s.worldLandmarks, ts: s.ts })),
    };
    // front_spread 확정 시, fist 단계 "변화" 기준을 위한 평균 curl 비율을 저장한다.
    if (pose.id === VIEW_TYPE.FRONT_SPREAD) {
      const curls = sampleBufferRef.current.map((s) => meanFingerCurlRatio(s.worldLandmarks)).filter((v) => Number.isFinite(v));
      spreadCurlRef.current = curls.length ? curls.reduce((a, b) => a + b, 0) / curls.length : null;
    }
    if (pose.id === VIEW_TYPE.OK_FAN_LATERAL && partial) {
      trackKpiEvent(V9_ANALYTICS_EVENTS.FAN_LATERAL_PARTIAL_RECORDED, currentUser?.uid, {
        poseId: pose.id,
        validFingerCount: SIDE_PROFILE_FINGERS.filter((k) => (sideValidCountsRef.current[k] ?? 0) >= MIN_VALID_FRAMES).length,
        recordingStatus: RECORDING_STATUS.INCOMPLETE,
      });
    }

    const fanPartial = pose.id === VIEW_TYPE.OK_FAN_LATERAL && (partial || !fanFingersSufficient());

    setTimeout(() => {
      setPoseJustConfirmed(false);
      const nextIdx = poseIndexRef.current + 1;
      if (nextIdx >= POSES.length) {
        finishScanRef.current?.(confirmed, rawFramesRef.current, { fanPartial });
        return;
      }
      poseIndexRef.current = nextIdx;
      setPoseIndex(nextIdx);
      // 다음 포즈로 상태머신·버퍼 초기화.
      sampleBufferRef.current = [];
      holdStateRef.current = createHoldState();
      poseConfirmedRef.current = false;
      poseStartMsRef.current = performance.now();
      coachCodeRef.current = null;
      poseStatusRef.current = POSE_STATUS.ALIGNING;
      holdProgressRef.current = 0;
      caliperModelRef.current = null;
      setPoseStatus(POSE_STATUS.ALIGNING);
      setHoldProgress(0);
      setCoachMsg(null);
    }, 400);
  }, [triggerFeedback, currentUser, fanFingersSufficient]);

  useEffect(() => { confirmPoseRef.current = confirmPose; }, [confirmPose]);

  // 부채꼴 부분 기록(15초 이상 어려울 때) — 성공한 손가락만 기록하고 넘어간다(§5).
  const recordFanPartial = useCallback(() => {
    if (poseConfirmedRef.current) return;
    const aggregated = aggregateFingerSamples(sampleBufferRef.current.map((s) => s.fingers));
    confirmPoseRef.current?.(aggregated, { partial: true });
  }, []);

  // ── scanning 진입 시 1회 초기화 ──
  useEffect(() => {
    if (phase !== "scanning") return;
    poseIndexRef.current = 0;
    poseResultsRef.current = {};
    rawFramesRef.current = {};
    dipContourFramesRef.current = [];
    dipValidCountsRef.current = {};
    sideContourFramesRef.current = [];
    sideValidCountsRef.current = {};
    spreadCurlRef.current = null;
    caliperModelRef.current = null;
    holdStateRef.current = createHoldState();
    poseConfirmedRef.current = false;
    poseStartMsRef.current = performance.now();
    coachCodeRef.current = null;
    poseStatusRef.current = POSE_STATUS.ALIGNING;
    holdProgressRef.current = 0;
    sampleBufferRef.current = [];
    setPoseIndex(0);
    setPoseStatus(POSE_STATUS.ALIGNING);
    setHoldProgress(0);
    setCoachMsg(null);
    setFanPartialAvailable(false);
  }, [phase]);

  const stopDetectLoop = useCallback(() => {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    lastVideoTimeRef.current = -1;
  }, []);

  useEffect(() => () => { stopDetectLoop(); disposeHandTracker(); }, [stopDetectLoop]);

  // ── detect 루프 ──
  const detectLoop = useCallback(() => {
    const video = cameraRef.current?.getVideo();
    const canvas = cameraRef.current?.getCanvas();
    if (!video || !canvas) { rafRef.current = requestAnimationFrame(detectLoop); return; }

    if (video.readyState >= 2 && video.currentTime !== lastVideoTimeRef.current) {
      lastVideoTimeRef.current = video.currentTime;
      const result = detectHands(video, performance.now());
      if (result?.landmarks?.length > 0) {
        setHandDetected(true);
        const worldLandmarks = result.worldLandmarks[0];
        const imageLandmarks = result.landmarks[0];
        const fingers = analyzeAllFingers(worldLandmarks);
        latestFingersRef.current = fingers;
        if (qaAllowed && debugVisibleRef.current) {
          setLiveMetrics(fingers);
          setGripMetric(computeFistMetric(worldLandmarks));
          const avgFlexion = fingers.reduce((s, f) => s + f.flexion, 0) / fingers.length;
          setDebugInfo({
            thumbDist: computeOkSignMetric(worldLandmarks), fingers, avgFlexion,
            gesture: detectGesture(fingers, worldLandmarks),
          });
        }

        const now = performance.now();
        sampleBufferRef.current.push({ fingers, worldLandmarks, ts: now });
        sampleBufferRef.current = sampleBufferRef.current.filter((s) => now - s.ts <= SAMPLE_WINDOW_MS);

        const pose = POSES[poseIndexRef.current];
        let contourMeasurement = null;

        // ── 포즈별 외곽 관찰 + 오버레이 ── (§8)
        const dueForContour = now - lastContourTickRef.current >= CONTOUR_TICK_MS;
        if (pose.measuresContour === "front") {
          if (dueForContour) {
            lastContourTickRef.current = now;
            const measured = measureContourFromVideo(video, imageLandmarks, contourCanvasRef, measureFrameDipContours);
            contourMeasurement = measured;
            if (measured && dipContourFramesRef.current.length < CONTOUR_FRAME_TARGET) {
              dipContourFramesRef.current.push(stripTransientGeometry(measured));
              measured.forEach((m) => { if (m.ok) dipValidCountsRef.current[m.key] = (dipValidCountsRef.current[m.key] ?? 0) + 1; });
            }
            caliperModelRef.current = measured ? deriveOverlayModel(measured, dipValidCountsRef.current, true) : null;
          }
        } else if (pose.measuresContour === "fanLateral") {
          if (dueForContour) {
            lastContourTickRef.current = now;
            const measured = measureContourFromVideo(video, imageLandmarks, contourCanvasRef, measureFrameSideProfiles);
            contourMeasurement = measured;
            if (measured) {
              // 부분 성공 허용 — 목표 프레임 상한 없이 계속 모으되(15초 옵션까지), 저장 좌표는 떼어낸다.
              sideContourFramesRef.current.push(stripTransientGeometry(measured));
              measured.forEach((m) => { if (m.ok) sideValidCountsRef.current[m.key] = (sideValidCountsRef.current[m.key] ?? 0) + 1; });
            }
            caliperModelRef.current = measured
              ? deriveOverlayModel(measured, sideValidCountsRef.current, true, { fingerKeys: SIDE_PROFILE_FINGERS, label: "측면 외곽" })
              : null;
          }
        } else {
          // max_comfortable_fist — 캘리퍼 없음(§7·§8). skeleton만.
          caliperModelRef.current = null;
        }
        // ── 자세 판정(순수) + 상태머신 ──
        const previousPoseData = pose.id === VIEW_TYPE.MAX_COMFORTABLE_FIST
          ? { spreadCurlRatio: spreadCurlRef.current }
          : null;
        const evalResult = evaluatePoseFrame({
          poseId: pose.id, imageLandmarks, worldLandmarks,
          contourMeasurement, previousPoseData,
        });

        const prev = holdStateRef.current;
        const next = stepHold(prev, { valid: evalResult.valid, now, options: DEFAULT_HOLD_OPTIONS });
        holdStateRef.current = next;

        // 상태 전이 분석 이벤트.
        if (prev.status === POSE_STATUS.ALIGNING && next.status === POSE_STATUS.HOLDING) {
          trackKpiEvent(V9_ANALYTICS_EVENTS.POSE_HOLDING_STARTED, currentUser?.uid, { poseId: pose.id });
        }
        // 상태·진행률·코치문구는 "의미 있게 바뀔 때만" setState(§16).
        if (next.status !== poseStatusRef.current) {
          poseStatusRef.current = next.status;
          setPoseStatus(next.status);
          if (next.status === POSE_STATUS.ALIGNING) {
            trackKpiEvent(V9_ANALYTICS_EVENTS.POSE_ALIGNING_STARTED, currentUser?.uid, { poseId: pose.id });
          }
        }
        const roundedProgress = Math.round(next.holdProgress * 20) / 20;
        if (roundedProgress !== holdProgressRef.current) { holdProgressRef.current = roundedProgress; setHoldProgress(roundedProgress); }

        // 코치 문구 — 한 번에 하나만(§3). holding/confirmed면 holdMessage, 아니면 교정 문구.
        const showHold = next.status === POSE_STATUS.HOLDING || next.status === POSE_STATUS.CONFIRMED;
        const nextCoachCode = showHold ? "__hold__" : evalResult.coachCode;
        if (nextCoachCode !== coachCodeRef.current) {
          coachCodeRef.current = nextCoachCode;
          setCoachMsg(showHold ? pose.holdMessage : evalResult.coachMessage);
          if (!showHold && evalResult.coachCode) {
            trackKpiEvent(V9_ANALYTICS_EVENTS.POSE_COACHING_SHOWN, currentUser?.uid, { poseId: pose.id, coachCode: evalResult.coachCode });
          }
        }

        // ── 확정 판정 ── 잘못된 자세는 절대 자동 승인하지 않는다(상태머신이 valid에서만 confirmed).
        if (!poseConfirmedRef.current && next.status === POSE_STATUS.CONFIRMED) {
          const isFan = pose.id === VIEW_TYPE.OK_FAN_LATERAL;
          if (!isFan || fanFingersSufficient()) {
            const aggregated = aggregateFingerSamples(sampleBufferRef.current.map((s) => s.fingers));
            confirmPoseRef.current?.(aggregated);
          }
          // fan인데 손가락이 아직 부족하면 확정을 미루고 계속 측면 프레임을 모은다.
        }

        // 15초 이상 부채꼴이 안 잡히면 부분 기록 옵션 노출(§5).
        if (pose.id === VIEW_TYPE.OK_FAN_LATERAL && !poseConfirmedRef.current
            && now - poseStartMsRef.current > FAN_PARTIAL_AFTER_MS && !fanPartialAvailable) {
          setFanPartialAvailable(true);
        }

        // ── 그리기: skeleton + (포즈별) 캘리퍼 ──
        drawSkeleton(imageLandmarks, canvas, video.videoWidth || 640, video.videoHeight || 480);
        if (caliperModelRef.current) {
          drawCaliperOverlay(canvas.getContext("2d"), caliperModelRef.current, {
            qaDetail: qaAllowed && debugVisibleRef.current,
            scale: Math.max(1, (video.videoWidth || 640) / 640),
            canvas,
          });
        }
      } else {
        // 손 미검출 — 오버레이 즉시 제거(§8).
        setHandDetected(false);
        setLiveMetrics(null);
        setDebugInfo(null);
        caliperModelRef.current = null;
        clearCanvas(canvas);
      }
    }
    rafRef.current = requestAnimationFrame(detectLoop);
  }, [qaAllowed, currentUser, fanFingersSufficient, fanPartialAvailable]);

  const handleCameraReady = useCallback(async () => {
    setPhase("ai_loading");
    triggerFeedback("MediaPipe 모델을 불러오는 중...");
    try {
      await initHandTracker();
    } catch (err) {
      console.error("[MotionScanPage] HandTracker 초기화 실패:", err);
      setErrorMessage(`AI 모델(WASM) 초기화에 실패했습니다. (${err?.message || "알 수 없는 오류"})`);
      setPhase("ai_error");
      triggerFeedback(import.meta.env.DEV ? "AI 모델 초기화 실패 — 시뮬레이션 모드로 전환합니다." : "지금은 측정할 수 없습니다.");
      return;
    }
    setPhase("scanning");
    triggerFeedback("카메라 연결 완료! 손을 화면에 비춰주세요.");
    rafRef.current = requestAnimationFrame(detectLoop);
  }, [detectLoop, triggerFeedback]);

  const handleCameraError = useCallback((err) => {
    setErrorMessage(`카메라에 접근할 수 없습니다. (${err?.message || "권한 거부"})`);
    setPhase("camera_error");
    triggerFeedback(import.meta.env.DEV ? "카메라 접근 불가 — 시뮬레이션 모드로 전환합니다." : "카메라에 접근할 수 없습니다.");
  }, [triggerFeedback]);

  const startScan = () => { setErrorMessage(null); setPhase("camera_starting"); };

  const restart = () => {
    stopDetectLoop();
    setScanResult(null);
    setErrorMessage(null);
    setHandDetected(false);
    setLiveMetrics(null);
    setSaveState("idle");
    scanPayloadRef.current = null;
    savingRef.current = false;
    nextClickedRef.current = false;
    setPhase("idle");
  };

  const handleGoNext = () => {
    if (saveState !== "saved" || nextClickedRef.current) return;
    nextClickedRef.current = true;
    trackKpiEvent("scan_result_next_clicked", currentUser?.uid);
    onGoToNextAction?.();
  };

  /**
   * 3개 포즈가 모두 확정되면 호출된다.
   * 관절별 관찰 = 정면(신전) 프레임 + 굽힘 프레임. 정면 외곽 = front contour, 측면 외곽 = side profile.
   * 프레임·좌표는 여기서 계산에만 쓰고 저장하지 않는다(§9).
   */
  const finishScan = useCallback((confirmedResults, rawFrames, { fanPartial = false } = {}) => {
    const front = confirmedResults[VIEW_TYPE.FRONT_SPREAD];
    const fist = confirmedResults[VIEW_TYPE.MAX_COMFORTABLE_FIST];
    if (!front || !fist) return;

    const fingerKeys = front.map((f) => f.key);
    const perFinger = fingerKeys.map((key, idx) => {
      const s = front[idx];
      const f = fist[idx];
      const rom = Math.max(0, f.flexion - s.flexion); // 굽힘 활동 범위 = 굴곡 - 신전 잔여
      const okAgg = confirmedResults[VIEW_TYPE.OK_FAN_LATERAL];
      const okScore = okAgg?.[idx]?.score ?? Math.round((f.score + s.score) / 2);
      const score = Math.round((f.score + s.score + okScore) / 3);
      return { key, name: s.name, rom: Math.round(rom), score };
    });
    const avgRom = Math.round(perFinger.reduce((sum, f) => sum + f.rom, 0) / perFinger.length);

    // 관절별 관찰(§4·§7): 신전=front_spread, 굴곡=max_comfortable_fist 프레임.
    const framesOf = (poseId) => (rawFrames?.[poseId] ?? []).map((f) => f.worldLandmarks).filter(Boolean);
    const extensionFrames = framesOf(VIEW_TYPE.FRONT_SPREAD);
    const flexionFrames = framesOf(VIEW_TYPE.MAX_COMFORTABLE_FIST);
    const extensionAgg = aggregateJointSamples(extensionFrames.map(analyzeFingerJoints));
    const flexionAgg = aggregateJointSamples(flexionFrames.map(analyzeFingerJoints));
    const jointObservations = buildFingerJointObservations(extensionAgg, flexionAgg);
    const deviationDirection = jointObservations.length ? summarizeDeviationDirection(jointObservations) : null;
    const measurement = assessMeasurement({
      extension: assessPoseMeasurement(extensionFrames, extensionAgg),
      flexion: assessPoseMeasurement(flexionFrames, flexionAgg),
    });

    // 정면 외곽 관찰 집계 + 측면 외곽 관찰 집계.
    const frontAgg = aggregateDipContourFrames(dipContourFramesRef.current);
    const dipContour = buildDipContourPayload(frontAgg);
    const sideAgg = aggregateSideProfileFrames(sideContourFramesRef.current);
    const sideProfile = buildSideProfilePayload(sideAgg);
    dipContourFramesRef.current = [];
    sideContourFramesRef.current = [];

    // 부채꼴 부분 기록이거나 관절 관찰이 불완전하면 recordingStatus=incomplete(§10).
    const fanRecordingStatus = fanPartial ? RECORDING_STATUS.INCOMPLETE : RECORDING_STATUS.COMPLETED;
    const recordingStatus = (measurement.ok && !fanPartial) ? RECORDING_STATUS.COMPLETED : RECORDING_STATUS.INCOMPLETE;

    // 한줄 요약(저장 payload와 같은 필드 — 같은 source of truth). 측면 관찰도 함께 넘긴다.
    const summaryCapture = {
      perFingerJointObservation: jointObservations,
      dipContourObservation: dipContour,
      contourObservations: {
        front: dipContour ? { viewType: VIEW_TYPE.FRONT_SPREAD, fingers: dipContour.fingers } : null,
        fanLateral: sideProfile ? { viewType: VIEW_TYPE.OK_FAN_LATERAL, fingers: sideProfile.fingers } : null,
      },
      poseProtocolVersion: "front-fan-fist-v1",
      deviationDirection, handSide,
      comparisonQualityStatus: "unverified",
      recordingStatus,
    };
    const summary = buildObservationSummary({ mode: SUMMARY_MODE.BASELINE, currentCapture: summaryCapture });

    const result = {
      summary, romDeg: avgRom, handSide, joints: jointObservations, deviationDirection,
      measurementOk: measurement.ok, dipContour, dipContourFlags: frontAgg.flags,
      sideProfile, sideProfileFlags: sideAgg.flags, recordingStatus,
      fingers: perFinger.map((f) => ({ key: f.key, name: f.name, flexion: f.rom, score: f.score })),
    };
    setScanResult(result);

    if (captureMode) {
      trackKpiEvent(V9_ANALYTICS_EVENTS.LEGACY_SCORE_PATH_BLOCKED, currentUser?.uid);
      triggerFeedback(`측정 완료 · 관찰 ROM ${avgRom}°`);
      scanPayloadRef.current = {
        handSide,
        perFingerJointObservation: jointObservations,
        deviationDirection,
        dipContourObservation: dipContour,           // 정면(호환 + front source)
        sideProfileObservation: sideProfile,         // 측면(fanLateral)
        fanRecordingStatus,
        recordingStatus,
        perFingerObservedRomDeg: perFinger.map((f) => ({ key: f.key, name: f.name, romDeg: f.rom })),
        averageObservedRomDeg: avgRom,
        qualityFlags: [...measurement.flags, ...frontAgg.flags, ...sideAgg.flags],
      };
    } else {
      const avgScore = Math.round(perFinger.reduce((sum, f) => sum + f.score, 0) / perFinger.length);
      const stiffnessMin = Math.round((100 - avgScore) * 0.5);
      const painIndex = Math.round((100 - avgScore) / 15);
      const mobility = computeMobilityScore(perFinger);
      const stability = computeStabilityScore(front, confirmedResults[VIEW_TYPE.OK_FAN_LATERAL] ?? front, fist);
      result.avgScore = avgScore; result.stiffnessMin = stiffnessMin; result.painIndex = painIndex;
      setScanResult({ ...result });
      setHistory((prev) => [{ ts: Date.now(), avgScore, avgFlexion: avgRom, fingers: result.fingers }, ...prev].slice(0, 14));
      triggerFeedback(`스캔 완료! Finger Score: ${avgScore}점, ROM: ${avgRom}°`);
      scanPayloadRef.current = {
        metrics: { perFinger, romDeg: avgRom, stiffnessMin, painIndex },
        scanScores: { mobility, stability },
        raw: rawFrames,
        recommendation: buildRecommendation(mobility.value, avgRom, { includeScoreLabel: true }),
      };
    }

    stopDetectLoop();
    setSaveState("idle");
    setPhase("completed");
  }, [triggerFeedback, stopDetectLoop, captureMode, handSide, currentUser]);

  const persistScan = useCallback(async () => {
    if (savingRef.current || !scanPayloadRef.current) return;
    savingRef.current = true;
    setSaveState("saving");
    try {
      if (captureMode) {
        await onAngleMeasured?.(scanPayloadRef.current);
        trackKpiEvent(V9_ANALYTICS_EVENTS.ANGLE_RECORD_SAVED, currentUser?.uid);
      } else {
        await onScanCompleted(scanPayloadRef.current);
      }
      setSaveState("saved");
    } catch (err) {
      console.error("[MotionScanPage] 저장 실패:", err);
      setSaveState("error");
      trackKpiEvent("scan_result_save_failed", currentUser?.uid);
    } finally {
      savingRef.current = false;
    }
  }, [captureMode, onAngleMeasured, onScanCompleted, currentUser]);

  useEffect(() => {
    if (phase === "completed" && saveState === "idle" && scanPayloadRef.current) {
      trackKpiEvent("scan_result_viewed", currentUser?.uid);
      trackKpiEvent(V9_ANALYTICS_EVENTS.OBSERVATION_SUMMARY_VIEWED, currentUser?.uid, {
        mode: "baseline",
        summaryCode: scanResult?.summary?.summaryCode ?? null,
        comparable: scanResult?.summary?.comparable ?? false,
      });
      persistScan();
    }
  }, [phase, saveState, persistScan, currentUser, scanResult]);

  useEffect(() => { finishScanRef.current = finishScan; }, [finishScan]);

  const runSimulation = () => {
    if (!qaAllowed) return;
    const simFingers = [
      { key: "index", name: "검지", flexion: 118, score: 82 },
      { key: "middle", name: "중지", flexion: 125, score: 88 },
      { key: "ring", name: "약지", flexion: 110, score: 72 },
      { key: "pinky", name: "소지", flexion: 105, score: 68 },
    ];
    const simJoints = [
      { key: "index",  name: "검지", dipExtensionPoseFlexionDeg: 16, dipExtensionPoseDeviationDeg: -8, dipDeviationDirection: "ulnar",   dipMaxFlexionDeg: 62, dipActiveRomDeg: 46, pipExtensionPoseFlexionDeg: 10, pipExtensionPoseDeviationDeg: 3,  pipDeviationDirection: "radial",  pipMaxFlexionDeg: 92, pipActiveRomDeg: 82, dipObserved: true, pipObserved: true },
      { key: "middle", name: "중지", dipExtensionPoseFlexionDeg: 8,  dipExtensionPoseDeviationDeg: -3, dipDeviationDirection: "ulnar",   dipMaxFlexionDeg: 68, dipActiveRomDeg: 60, pipExtensionPoseFlexionDeg: 5,  pipExtensionPoseDeviationDeg: 1,  pipDeviationDirection: "neutral", pipMaxFlexionDeg: 95, pipActiveRomDeg: 90, dipObserved: true, pipObserved: true },
      { key: "ring",   name: "약지", dipExtensionPoseFlexionDeg: 24, dipExtensionPoseDeviationDeg: -14, dipDeviationDirection: "ulnar",  dipMaxFlexionDeg: 58, dipActiveRomDeg: 34, pipExtensionPoseFlexionDeg: 18, pipExtensionPoseDeviationDeg: -6, pipDeviationDirection: "ulnar",   pipMaxFlexionDeg: 88, pipActiveRomDeg: 70, dipObserved: true, pipObserved: true },
      { key: "pinky",  name: "소지", dipExtensionPoseFlexionDeg: 12, dipExtensionPoseDeviationDeg: 2,  dipDeviationDirection: "radial",  dipMaxFlexionDeg: 55, dipActiveRomDeg: 43, pipExtensionPoseFlexionDeg: 9,  pipExtensionPoseDeviationDeg: 0,  pipDeviationDirection: "neutral", pipMaxFlexionDeg: 84, pipActiveRomDeg: 75, dipObserved: true, pipObserved: true },
    ];
    const simDeviationDirection = summarizeDeviationDirection(simJoints);
    const simSide = {
      measurementVersion: "dip-contour-v2",
      fingers: [
        { key: "middle", name: "중지", sideProfileObserved: true, dipSideProfileRatio: 1.12, sideProfileAsymmetryRatio: 0.06, sideAHalfProfileRatio: 0.58, sideBHalfProfileRatio: 0.54, validFrames: 9, stabilityMad: 0.02, relativeVariation: 0.02 },
        { key: "ring", name: "약지", sideProfileObserved: false, validFrames: 3 },
        { key: "pinky", name: "소지", sideProfileObserved: true, dipSideProfileRatio: 1.05, sideProfileAsymmetryRatio: 0.04, sideAHalfProfileRatio: 0.53, sideBHalfProfileRatio: 0.52, validFrames: 8, stabilityMad: 0.02, relativeVariation: 0.02 },
      ],
      qualityFlags: [],
    };
    setScanResult({ romDeg: 122, handSide, fingers: simFingers, joints: simJoints, deviationDirection: simDeviationDirection, measurementOk: true, sideProfile: simSide, recordingStatus: "completed",
      summary: buildObservationSummary({
        mode: SUMMARY_MODE.BASELINE,
        currentCapture: { perFingerJointObservation: simJoints, handSide, comparisonQualityStatus: "unverified", recordingStatus: "completed", poseProtocolVersion: "front-fan-fist-v1", contourObservations: { fanLateral: { fingers: simSide.fingers } } },
      }) });
    triggerFeedback("시뮬레이션 측정 완료!");

    if (captureMode) {
      scanPayloadRef.current = {
        handSide,
        perFingerJointObservation: simJoints,
        deviationDirection: simDeviationDirection,
        sideProfileObservation: simSide,
        fanRecordingStatus: "incomplete",
        recordingStatus: "completed",
        perFingerObservedRomDeg: simFingers.map((f) => ({ key: f.key, name: f.name, romDeg: f.flexion })),
        averageObservedRomDeg: 122,
        qualityFlags: [],
      };
    } else {
      const mobility = computeMobilityScore(simFingers.map((f) => ({ rom: f.flexion })));
      const stability = computeStabilityScore(simFingers);
      scanPayloadRef.current = {
        metrics: { perFinger: simFingers, romDeg: 122, stiffnessMin: 32, painIndex: 6 },
        scanScores: { mobility, stability },
        raw: null,
        recommendation: buildRecommendation(mobility.value, 122, { includeScoreLabel: true }),
        isSimulated: true,
      };
    }
    setSaveState("idle");
    setPhase("completed");
  };

  const ringR = 17;
  const ringCirc = 2 * Math.PI * ringR;
  const holding = poseStatus === POSE_STATUS.HOLDING || poseStatus === POSE_STATUS.CONFIRMED;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "#000", display: "flex", flexDirection: "column" }}>
      <div style={{ position: "relative", flex: 1, overflow: "hidden" }}>
        <CameraView ref={cameraRef} active={cameraActive} onReady={handleCameraReady} onError={handleCameraError} />

        {phase === "scanning" && (
          <>
            <div className="absolute inset-4 border border-dashed border-blue-500/30 rounded-xl pointer-events-none" />
            <div className="absolute inset-x-0 top-0 h-1/3 pointer-events-none z-10 bg-gradient-to-b from-transparent via-blue-400/25 to-transparent animate-scan-sweep" />

            <div className="absolute top-2 left-2 right-2 flex justify-between items-center z-20">
              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full transition-colors ${handDetected ? "bg-blue-500 text-slate-950" : "bg-slate-700 text-slate-400"}`}>
                {handDetected ? "손 감지됨" : "손을 화면에 보여주세요"}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="text-[9px] text-blue-400 font-mono bg-slate-950/80 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" /> LIVE
                </span>
                {qaAllowed && (
                  <button type="button" onClick={() => setDebugVisible((v) => !v)}
                    className={`text-[9px] font-mono px-2 py-0.5 rounded-full border transition-colors ${debugVisible ? "bg-amber-400 text-slate-950 border-amber-400" : "bg-slate-950/80 text-slate-400 border-slate-700"}`}>
                    DEBUG
                  </button>
                )}
              </span>
            </div>

            <div className="absolute top-9 left-2 right-2 z-20 bg-slate-950/85 backdrop-blur-sm rounded-xl p-2.5 border border-blue-500/20">
              <div className="flex items-center gap-2.5">
                <div className="relative w-11 h-11 shrink-0">
                  <svg viewBox="0 0 40 40" className="absolute inset-0 w-full h-full -rotate-90">
                    <circle cx="20" cy="20" r={ringR} fill="none" stroke="#1e293b" strokeWidth="3" />
                    <circle cx="20" cy="20" r={ringR} fill="none" stroke="#60a5fa" strokeWidth="3"
                      strokeDasharray={ringCirc} strokeDashoffset={ringCirc * (1 - holdProgress)}
                      strokeLinecap="round" className="transition-all duration-200 ease-linear" />
                  </svg>
                  <PoseIcon poseId={currentPose.id} className="absolute inset-0 w-full h-full p-1.5 text-blue-300" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-black text-white leading-tight">{currentPose.title}</p>
                  {poseJustConfirmed ? (
                    <p className="text-[11px] font-black text-blue-300 flex items-center gap-1 animate-pulse mt-0.5">
                      <Check className="w-3.5 h-3.5" /> 완료되었습니다!
                    </p>
                  ) : (
                    <p className="text-[10px] text-white/90 leading-snug mt-0.5">{currentPose.mainGuide}</p>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  {POSES.map((p, i) => (
                    <span key={p.id} className={`w-1.5 h-1.5 rounded-full transition-colors ${i === poseIndex ? "bg-blue-400" : i < poseIndex ? "bg-blue-700" : "bg-slate-700"}`} />
                  ))}
                </div>
              </div>

              {!poseJustConfirmed && (
                <div className="mt-1.5 pt-1.5 border-t border-blue-500/15">
                  <p className="text-[9px] text-blue-200/80 leading-snug">{currentPose.subGuide}</p>
                  {currentPose.safetyNote && (
                    <p className="text-[9px] text-amber-300/90 leading-snug mt-0.5">⚠︎ {currentPose.safetyNote}</p>
                  )}
                  {/* 한 번에 하나의 코치 문구(§3) — holding이면 유지 안내, 아니면 교정 안내. */}
                  {coachMsg && (
                    <p className={`text-[11px] font-bold mt-1 ${holding ? "text-blue-300" : "text-amber-300"}`} data-testid="pose-coach">
                      {coachMsg}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* 부채꼴 부분 기록 옵션(15초 이상 어려울 때) — §5 */}
            {fanPartialAvailable && !poseJustConfirmed && (
              <div className="absolute bottom-16 left-2 right-2 z-30 flex justify-center">
                <button type="button" onClick={recordFanPartial}
                  className="bg-blue-500 text-slate-950 font-bold text-[12px] px-4 rounded-xl shadow-md"
                  style={{ minHeight: 44 }}>
                  관찰 가능한 손가락만 기록하고 계속하기
                </button>
              </div>
            )}

            {/* liveMetrics·debug 오버레이는 QA 계정에만 노출한다(§8·§11 — 실시간 수치 미노출). */}
            {qaAllowed && debugVisible && liveMetrics && (
              <div className="absolute bottom-2 left-2 right-2 z-20 bg-slate-950/80 rounded-xl p-2 grid grid-cols-4 gap-1">
                {liveMetrics.map((f) => (
                  <div key={f.key} className="text-center">
                    <div className="text-[8px] text-slate-400">{f.name}</div>
                    <div className="text-[10px] font-black text-blue-400 font-mono">{Math.round(f.flexion)}°</div>
                    <div className="text-[7px] text-slate-500">{Math.round(f.deviation)}° {f.deviationDir === "radial" ? "요측" : "척측"}</div>
                  </div>
                ))}
              </div>
            )}
            {qaAllowed && debugVisible && (
              <div className="absolute bottom-24 left-2 right-2 z-30 bg-black/90 border border-amber-400/40 rounded-lg p-2 font-mono text-[10px] leading-relaxed text-lime-400 shadow-lg">
                {debugInfo ? (
                  <>
                    <div>pose : {currentPose.id} · {poseStatus} · {Math.round(holdProgress * 100)}%</div>
                    <div>gripMetric : {gripMetric != null ? gripMetric.toFixed(2) : "—"}</div>
                    <div>fan valid : {SIDE_PROFILE_FINGERS.map((k) => `${k[0]}${sideValidCountsRef.current[k] ?? 0}`).join(" ")}</div>
                    <div className="text-amber-300 font-bold">gesture : {debugInfo.gesture}</div>
                  </>
                ) : (
                  <div className="text-slate-500">손이 감지되지 않았습니다.</div>
                )}
              </div>
            )}
          </>
        )}

        {phase === "ai_loading" && (
          <div className="absolute top-2 left-2 right-2 z-20 flex justify-center">
            <span className="text-[10px] font-bold px-3 py-1 rounded-full bg-slate-950/85 text-blue-300 flex items-center gap-2">
              <span className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
              AI 모델 로딩중
            </span>
          </div>
        )}
        {phase === "camera_starting" && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/60">
            <span className="text-[10px] font-bold px-3 py-1 rounded-full bg-slate-950/85 text-slate-300">카메라 연결중...</span>
          </div>
        )}

        {phase === "idle" && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-slate-950 px-6">
            <div className="text-center mb-2">
              <h2 className="text-base font-bold text-white">손 관찰 기록{handSide ? ` · ${handSide === "left" ? "왼손" : "오른손"}` : ""}</h2>
              <p className="text-[10px] text-slate-400 leading-normal mt-1">정면·측면·굽힘 3단계로 손을 관찰해 기록합니다.</p>
            </div>
            <div className="w-16 h-16 rounded-full bg-blue-500/10 border border-blue-500/30 flex items-center justify-center">
              <Camera className="w-8 h-8 text-blue-400" />
            </div>
            <p className="text-[10px] text-slate-400 text-center leading-relaxed">카메라 앞에 손을 가볍게 펼쳐 주세요.<br />원본 카메라 영상·이미지·랜드마크는 저장하지 않으며, 관찰된 값만 기록에 사용됩니다.</p>
            <button onClick={startScan} className="bg-blue-500 hover:bg-blue-400 text-slate-950 font-black px-5 py-2 rounded-xl text-xs shadow-md transition-all">
              관찰 기록 시작
            </button>
            {qaAllowed && (
              <button onClick={runSimulation} className="text-[10px] text-slate-500 underline">시뮬레이션으로 건너뛰기</button>
            )}
          </div>
        )}

        {(phase === "camera_error" || phase === "ai_error") && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/95 px-6">
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-center max-w-xs">
              <p className="text-sm font-bold text-amber-700">{phase === "camera_error" ? "카메라를 켤 수 없어요" : "지금은 준비 중이에요"}</p>
              <p className="text-[13px] text-amber-700 mt-2 leading-relaxed">
                {phase === "camera_error"
                  ? "화면 위 주소창의 카메라 아이콘을 눌러 “허용”으로 바꾼 뒤, 아래 버튼을 눌러 다시 찍어주세요."
                  : "잠시 후 아래 버튼을 눌러 다시 찍어주세요. 계속 안 되면 앱을 닫았다가 다시 열어주세요."}
              </p>
              <div className="flex flex-col gap-2 mt-4">
                <button onClick={restart} className="w-full min-h-[48px] flex items-center justify-center bg-[#122A5C] text-white font-extrabold text-[15px] rounded-xl">다시 찍기</button>
                {qaAllowed && (
                  <button onClick={runSimulation} className="w-full min-h-[44px] flex items-center justify-center bg-white border border-amber-300 text-amber-700 font-bold text-xs rounded-xl">시뮬레이션 스캔 실행 (QA)</button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── completed — §11 결과 순서: 완료 → 요약 → 정면 → 측면 → 굽힘 → 손/날짜/품질 → 다음 ── */}
        {phase === "completed" && scanResult && (
          <div className="absolute inset-0 z-30 overflow-y-auto bg-slate-950/97 p-3"
            style={{ paddingBottom: "calc(104px + env(safe-area-inset-bottom))", WebkitOverflowScrolling: "touch" }}
            data-testid="scan-result-scroll">
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-1.5 text-[#122A5C] text-xs font-bold">
                  <Check className="w-4 h-4 text-[#1F9E96]" /> 측정 기록 완료
                </div>
                <button onClick={restart} aria-label="다시 측정하기" className="text-[11px] text-slate-500 hover:text-slate-800 flex items-center gap-1 font-bold" style={{ minHeight: 44, padding: "0 6px" }}>
                  <RefreshCw className="w-3 h-3" /> 다시 측정하기
                </button>
              </div>

              {FEATURE_FLAGS.absoluteScoreUiEnabled ? (
                <>
                  <div className="grid grid-cols-4 gap-2 mb-3">
                    {scanResult.fingers.map((f) => (
                      <div key={f.key} className="bg-slate-50 p-2 rounded-xl border border-slate-200 text-center">
                        <div className="text-[8px] text-slate-400 font-bold">{f.name}</div>
                        <div className="text-sm font-black text-blue-700 font-mono">{f.score}</div>
                        <div className="text-[7px] text-slate-400">{Math.round(f.flexion)}°</div>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <div className="bg-slate-50 p-2 rounded-xl border border-slate-200 text-center">
                      <div className="text-[8px] text-slate-400">ROM</div>
                      <div className="text-xs font-black font-mono">{scanResult.romDeg}°</div>
                    </div>
                    <div className="bg-slate-50 p-2 rounded-xl border border-slate-200 text-center">
                      <div className="text-[8px] text-slate-400">강직지수</div>
                      <div className="text-xs font-black font-mono">{scanResult.stiffnessMin}분</div>
                    </div>
                    <div className="bg-slate-50 p-2 rounded-xl border border-slate-200 text-center">
                      <div className="text-[8px] text-slate-400">VAS</div>
                      <div className="text-xs font-black text-orange-600 font-mono">{scanResult.painIndex}단계</div>
                    </div>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 p-2.5 rounded-xl text-[10px] text-slate-700 leading-relaxed">
                    <strong className="text-slate-900">관찰:</strong> {buildRecommendation(scanResult.avgScore, scanResult.romDeg, { includeScoreLabel: true })}
                  </div>
                </>
              ) : (
                <>
                  {/* 2. 한줄 요약 */}
                  <ObservationSummaryCard summary={scanResult.summary} />

                  {/* 3. 정면 끝마디 관찰 */}
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-wide mt-1 mb-1.5">정면 끝마디 관찰</p>
                  <JointObservationResult joints={scanResult.joints} />
                  {qaAllowed && (
                    <DipContourResult observation={scanResult.dipContour} flags={scanResult.dipContourFlags} onRetake={restart} />
                  )}

                  {/* 4. 측면 끝마디 관찰 */}
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-wide mt-2 mb-1.5">측면 끝마디 관찰</p>
                  <SideProfileResult observation={scanResult.sideProfile} qaDetail={qaAllowed} />

                  {/* 5. 굽힘·활동 범위 */}
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-wide mt-2 mb-1.5">굽힘·활동 범위</p>
                  <div className="flex flex-col gap-1.5 mb-3" data-testid="flexion-range">
                    {scanResult.joints?.map((f) => (
                      <div key={f.key} className="bg-slate-50 rounded-xl border border-slate-200 p-2 flex items-center justify-between">
                        <span className="text-[11px] font-black text-[#122A5C]">{f.name}</span>
                        <span className="text-[10px] text-slate-600">
                          끝마디 {Number.isFinite(f.dipActiveRomDeg) ? `${Math.round(f.dipActiveRomDeg)}°` : "관찰 어려움"}
                          {" · "}중간마디 {Number.isFinite(f.pipActiveRomDeg) ? `${Math.round(f.pipActiveRomDeg)}°` : "관찰 어려움"}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* 6. 사용 손·날짜·촬영 품질 */}
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                      <div className="text-[9px] text-slate-500">사용 손</div>
                      <div className="text-sm font-black text-[#16213D]">{scanResult.handSide === "left" ? "왼손" : scanResult.handSide === "right" ? "오른손" : "—"}</div>
                    </div>
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                      <div className="text-[9px] text-slate-500">측정 날짜</div>
                      <div className="text-sm font-black text-[#16213D]">{new Date().toLocaleDateString("ko-KR", { month: "long", day: "numeric" })}</div>
                    </div>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 mb-3">
                    <div className="text-[9px] text-slate-500">촬영 품질</div>
                    <div className="text-[12px] font-bold text-[#16213D]">
                      {scanResult.recordingStatus === "incomplete" ? "일부 관찰 (기록 완료)" : "3개 동작 기록 완료"}
                    </div>
                  </div>
                  <div className="bg-[#F4F6FA] border border-[#E1E7EF] p-2.5 rounded-xl text-[11px] text-slate-600 leading-relaxed">
                    동일한 촬영 조건에서 기록된 관찰값입니다. 질환 진단이나 악화 여부를 의미하지 않습니다.
                  </div>
                </>
              )}
            </div>

            {FEATURE_FLAGS.absoluteScoreUiEnabled && history.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-2xl p-3 mt-3">
                <p className="text-[10px] font-bold text-slate-700 mb-2">최근 스캔 기록 (14회)</p>
                <div className="flex gap-1 overflow-x-auto">
                  {history.slice(0, 14).map((h, i) => (
                    <div key={i} className="shrink-0 text-center">
                      <div className="w-6 h-6 rounded bg-blue-100 flex items-center justify-center text-[8px] font-black text-blue-700">{h.avgScore}</div>
                      <div className="text-[7px] text-slate-400">{new Date(h.ts).toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" })}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {phase === "scanning" && (
        <div className="flex gap-2 p-2 bg-slate-950">
          <button onClick={restart} className="w-full px-3 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all">스캔 종료</button>
        </div>
      )}

      {phase === "completed" && (
        <div style={{ background: "#FFFFFF", borderTop: "1px solid #E1E7EF", padding: "12px 16px calc(12px + env(safe-area-inset-bottom))" }}>
          {saveState === "error" ? (
            <>
              <p role="alert" style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 700, color: "#B3462E", lineHeight: 1.5 }}>
                저장하지 못했습니다. 네트워크 연결을 확인하고 다시 시도해주세요. (측정 결과는 그대로 보관됩니다)
              </p>
              <button type="button" onClick={persistScan} aria-label="측정 결과 다시 저장" className="jt-primary-cta"
                style={{ width: "100%", minHeight: 56, background: "#B3462E", color: "white", border: "none", borderRadius: 14, fontSize: 16, fontWeight: 800, cursor: "pointer" }}>
                다시 저장
              </button>
            </>
          ) : (
            <button type="button" onClick={handleGoNext} disabled={saveState !== "saved"} aria-busy={saveState === "saving"}
              aria-label={saveState === "saving" ? "저장 중입니다" : "다음 단계로 이동"} className="jt-primary-cta"
              style={{ width: "100%", minHeight: 56, border: "none", borderRadius: 14, fontSize: 16, fontWeight: 800, color: "white",
                background: saveState === "saved" ? "#122A5C" : "#B9C1D4", cursor: saveState === "saved" ? "pointer" : "default" }}>
              {saveState === "saving" ? "저장 중…" : "다음 단계로"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
