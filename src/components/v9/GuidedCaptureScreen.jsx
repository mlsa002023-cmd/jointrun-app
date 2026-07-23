// ─────────────────────────────────────────────
// GuidedCaptureScreen — 04_APP_PRD_V9.md S04 "실시간 가이드 촬영"
//
// 기존 MotionScanPage(3포즈 ROM 측정·Finger Score 계산)와는 목적이 다르다: 여기는 "비교 가능한
// 조건으로 한 장을 남기는 것"만 한다 — 점수·건강판정 로직이 전혀 없다. 그래서 별도 컴포넌트로
// 분리했다(기존 스캔 엔진을 건드리지 않아 회귀 위험이 없다).
//
// 원본 영상/이미지는 저장하지 않는다 — 손 랜드마크 좌표만 실시간으로 품질 판정에 쓰고 버린다.
// ─────────────────────────────────────────────
import { useCallback, useEffect, useRef, useState } from "react";
import { Camera as CameraIcon, Check } from "lucide-react";
import CameraView from "../CameraView";
import { initHandTracker, detectHands, disposeHandTracker } from "../../lib/handTracker";
import { checkDistance, checkFraming, checkShake, checkLighting, evaluateCaptureQuality, sampleFrameBrightness } from "../../lib/captureQuality";
import { shouldShowQaTools } from "../../config/featureFlags";
import { useAuth } from "../../contexts/AuthContext";

const HOLD_MS = 900;
const SHAKE_BUFFER_SIZE = 8;
const BRIGHTNESS_SAMPLE_INTERVAL_MS = 600;
const MAX_ATTEMPTS_BEFORE_OVERRIDE = 4;

// ─────────────────────────────────────────────
// Mock Capture — 카메라 하드웨어 없이 트리거→기준선→재확인→비교 전체 흐름을 개발·QA 환경에서
// E2E로 검증하기 위한 화면. shouldShowQaTools(currentUser)(featureFlags.js)가 이중으로
// 차단하므로 이 컴포넌트 자체는 production 빌드에서도 번들에는 남아있을 수 있지만 절대
// 렌더링되지 않는다 — 방어를 한 겹 더 두기 위해 여기서도 한 번 더 체크한다(방어적 이중 가드).
// ─────────────────────────────────────────────
function MockCaptureScreen({ handSide, onCaptured, onCancel }) {
  const { currentUser } = useAuth();
  if (!shouldShowQaTools(currentUser)) return null; // 이중 가드 — 이 지점까지 왔어도 플래그/계정이 안 맞으면 아무것도 렌더링하지 않는다.
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 300, background: "#0f172a", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, color: "#facc15", background: "rgba(250,204,21,0.12)", border: "1px solid rgba(250,204,21,0.4)", borderRadius: 999, padding: "6px 14px", marginBottom: 20 }}>
        MOCK CAPTURE — 개발용, 실기기 카메라를 사용하지 않습니다
      </span>
      <p style={{ color: "#e2e8f0", fontSize: 14, fontWeight: 700, marginBottom: 24, textAlign: "center" }}>
        {handSide === "left" ? "왼손" : "오른손"} 샘플 캡처를 선택하세요
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%", maxWidth: 320 }}>
        <button
          type="button"
          onClick={() => onCaptured({ qualityStatus: "pass", qualityFlags: [] })}
          style={{ minHeight: 48, background: "#122A5C", color: "white", border: "none", borderRadius: 12, fontSize: 14, fontWeight: 800 }}
        >
          샘플 캡처 (품질 통과)
        </button>
        <button
          type="button"
          onClick={() => onCaptured({ qualityStatus: "unreliable", qualityFlags: ["mock_low_quality"] })}
          style={{ minHeight: 48, background: "transparent", color: "#fca5a5", border: "1px solid rgba(252,165,165,0.5)", borderRadius: 12, fontSize: 14, fontWeight: 800 }}
        >
          샘플 캡처 (품질 낮음 시뮬레이션)
        </button>
        <button
          type="button"
          onClick={onCancel}
          style={{ minHeight: 48, background: "rgba(255,255,255,0.08)", color: "#e2e8f0", border: "none", borderRadius: 12, fontSize: 13, fontWeight: 700 }}
        >
          촬영 취소
        </button>
      </div>
    </div>
  );
}

// forceMock — QA 패널의 "촬영 방식" 토글에서 내려오는 값. QA 계정이라고 해서 항상 Mock
// Capture만 보게 되면 실기기 카메라 경로를 같은 계정으로 검수할 방법이 없어진다(대표 검수
// 요건 — "Mock Capture와 실제 카메라를 명확히 구분"). 그래서 QA 계정에게도 기본은 Mock이되,
// 토글로 실제 카메라 경로를 선택할 수 있게 한다. forceMock 자체는 보안 게이트가 아니다 —
// 실제 게이트는 shouldShowQaTools(currentUser)이며, 이 값이 false면 forceMock이 true여도
// 절대 MockCaptureScreen을 보여주지 않는다.
export default function GuidedCaptureScreen({ handSide, onCaptured, onCancel, forceMock = true }) {
  const { currentUser } = useAuth();
  if (shouldShowQaTools(currentUser) && forceMock) {
    return <MockCaptureScreen handSide={handSide} onCaptured={onCaptured} onCancel={onCancel} />;
  }
  return <RealGuidedCaptureScreen handSide={handSide} onCaptured={onCaptured} onCancel={onCancel} />;
}

function RealGuidedCaptureScreen({ handSide, onCaptured, onCancel }) {
  const cameraRef = useRef(null);
  const rafRef = useRef(null);
  const lastVideoTimeRef = useRef(-1);
  const landmarkBufferRef = useRef([]);
  const holdStartRef = useRef(null);
  const confirmedRef = useRef(false);
  const attemptsRef = useRef(0);
  const lastBrightnessRef = useRef(null);
  const lastBrightnessAtRef = useRef(0);

  const [phase, setPhase] = useState("camera_starting"); // camera_starting | ai_loading | guiding | camera_error | ai_error
  const [handDetected, setHandDetected] = useState(false);
  const [quality, setQuality] = useState({ status: "retry", flags: [], message: "카메라 앞에 손을 비춰주세요." });
  const [progress, setProgress] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [justCaptured, setJustCaptured] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [retryKey, setRetryKey] = useState(0); // CameraView를 강제로 remount해서 getUserMedia를 다시 요청하기 위한 key

  const stopLoop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  }, []);

  useEffect(() => () => { stopLoop(); disposeHandTracker(); }, [stopLoop]);

  const finishCapture = useCallback((finalQuality) => {
    if (confirmedRef.current) return;
    confirmedRef.current = true;
    setJustCaptured(true);
    stopLoop();
    setTimeout(() => {
      onCaptured({ qualityStatus: finalQuality.status, qualityFlags: finalQuality.flags });
    }, 500);
  }, [onCaptured, stopLoop]);

  const detectLoop = useCallback(() => {
    const video = cameraRef.current?.getVideo();
    if (!video) { rafRef.current = requestAnimationFrame(detectLoop); return; }

    if (video.readyState >= 2 && video.currentTime !== lastVideoTimeRef.current) {
      lastVideoTimeRef.current = video.currentTime;
      const result = detectHands(video, performance.now());

      if (result?.landmarks?.length > 0) {
        setHandDetected(true);
        const landmarks = result.landmarks[0];
        landmarkBufferRef.current = [...landmarkBufferRef.current, landmarks].slice(-SHAKE_BUFFER_SIZE);

        const now = performance.now();
        if (now - lastBrightnessAtRef.current > BRIGHTNESS_SAMPLE_INTERVAL_MS) {
          lastBrightnessAtRef.current = now;
          lastBrightnessRef.current = sampleFrameBrightness(video);
        }

        const evalResult = evaluateCaptureQuality({
          distance: checkDistance(landmarks),
          framing: checkFraming(landmarks),
          shake: checkShake(landmarkBufferRef.current),
          lighting: checkLighting(lastBrightnessRef.current),
        });
        setQuality(evalResult);

        if (evalResult.status === "pass" && !confirmedRef.current) {
          if (holdStartRef.current == null) holdStartRef.current = now;
          const elapsed = now - holdStartRef.current;
          setProgress(Math.min(1, elapsed / HOLD_MS));
          if (elapsed >= HOLD_MS) finishCapture(evalResult);
        } else {
          if (holdStartRef.current != null) {
            attemptsRef.current += 1;
            setAttempts(attemptsRef.current);
          }
          holdStartRef.current = null;
          setProgress(0);
        }
      } else {
        setHandDetected(false);
        setQuality({ status: "retry", flags: ["no_hand"], message: "손이 보이지 않아요. 카메라 앞에 손을 비춰주세요." });
        holdStartRef.current = null;
        setProgress(0);
      }
    }
    rafRef.current = requestAnimationFrame(detectLoop);
  }, [finishCapture]);

  const handleCameraReady = useCallback(async () => {
    setPhase("ai_loading");
    try {
      await initHandTracker();
    } catch (err) {
      console.error("[GuidedCaptureScreen] HandTracker 초기화 실패:", err);
      setPhase("ai_error");
      return;
    }
    setPhase("guiding");
    rafRef.current = requestAnimationFrame(detectLoop);
  }, [detectLoop]);

  // Phase D(RC1) — 권한 거부(NotAllowedError)와 그 외 카메라 오류(장치 없음/사용 중 등)를 구분해서
  // 안내한다. 권한 거부는 브라우저 설정 안내 + 재요청 버튼, 그 외는 일반 재시도만 제공한다.
  const handleCameraError = useCallback((err) => {
    setPermissionDenied(err?.name === "NotAllowedError");
    setPhase("camera_error");
  }, []);

  const retryCamera = useCallback(() => {
    setPermissionDenied(false);
    setPhase("camera_starting");
    setRetryKey((k) => k + 1);
  }, []);

  const forceCapture = () => {
    finishCapture({ status: quality.status === "retry" ? "unreliable" : quality.status, flags: quality.flags });
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 300, background: "#000", display: "flex", flexDirection: "column" }}>
      <div style={{ position: "relative", flex: 1, overflow: "hidden" }}>
        <CameraView key={retryKey} ref={cameraRef} active onReady={handleCameraReady} onError={handleCameraError} />

        {phase === "guiding" && (
          <>
            <div style={{ position: "absolute", inset: 16, border: "1px dashed rgba(96,165,250,0.4)", borderRadius: 16, pointerEvents: "none" }} />

            <div style={{ position: "absolute", top: 12, left: 12, right: 12, zIndex: 20, display: "flex", justifyContent: "center" }}>
              <span style={{ fontSize: 11, fontWeight: 800, padding: "6px 14px", borderRadius: 999, background: handDetected ? "rgba(37,99,235,0.9)" : "rgba(30,41,59,0.85)", color: "#fff" }}>
                {handSide === "left" ? "왼손" : "오른손"} 촬영 중
              </span>
            </div>

            <div style={{ position: "absolute", left: 16, right: 16, bottom: 96, zIndex: 20 }}>
              <div style={{ background: "rgba(15,23,42,0.88)", borderRadius: 16, padding: 16, textAlign: "center" }}>
                {justCaptured ? (
                  <p style={{ color: "#6FD8CC", fontWeight: 800, fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                    <Check size={18} /> 촬영 완료
                  </p>
                ) : (
                  <>
                    <p style={{ color: "#fff", fontWeight: 700, fontSize: 14, lineHeight: 1.5 }}>
                      {quality.status === "pass" ? "좋아요! 이 상태를 유지해주세요." : quality.message}
                    </p>
                    <div style={{ marginTop: 12, height: 6, borderRadius: 999, background: "rgba(255,255,255,0.15)", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${progress * 100}%`, background: "#6FD8CC", transition: "width 100ms linear" }} />
                    </div>
                    {attempts >= MAX_ATTEMPTS_BEFORE_OVERRIDE && (
                      <button
                        type="button"
                        onClick={forceCapture}
                        style={{ marginTop: 14, minHeight: 44, width: "100%", background: "transparent", border: "1px solid rgba(255,255,255,0.35)", color: "#fff", borderRadius: 12, fontSize: 13, fontWeight: 700 }}
                      >
                        조건이 계속 안 맞으면 그대로 저장하기
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          </>
        )}

        {phase === "ai_loading" && (
          <div style={{ position: "absolute", top: 12, left: 0, right: 0, display: "flex", justifyContent: "center", zIndex: 20 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#6FD8CC", background: "rgba(15,23,42,0.85)", padding: "6px 14px", borderRadius: 999 }}>
              AI 모델 로딩중
            </span>
          </div>
        )}

        {phase === "camera_error" && permissionDenied && (
          <div style={{ position: "absolute", inset: 0, zIndex: 30, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(2,6,23,0.95)", padding: 24 }}>
            <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 16, padding: 20, textAlign: "center", maxWidth: 300 }}>
              <p style={{ fontSize: 15, fontWeight: 800, color: "#92400e" }}>카메라 권한이 필요합니다</p>
              <p style={{ fontSize: 13, color: "#a16207", marginTop: 8, lineHeight: 1.6 }}>
                기록을 남기려면 카메라 접근을 허용해야 해요. 브라우저 주소창 옆 카메라 아이콘(또는 설정 &gt; 사이트 권한)에서 카메라를 &ldquo;허용&rdquo;으로 바꾼 뒤 다시 시도해주세요.
              </p>
              <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 14 }}>
                <button onClick={retryCamera} style={{ minHeight: 44, padding: "0 18px", background: "#122A5C", color: "white", border: "none", borderRadius: 12, fontSize: 13, fontWeight: 700 }}>
                  다시 요청하기
                </button>
                <button onClick={onCancel} style={{ minHeight: 44, padding: "0 18px", background: "transparent", border: "1px solid #d97706", color: "#92400e", borderRadius: 12, fontSize: 13, fontWeight: 700 }}>
                  나중에 하기
                </button>
              </div>
            </div>
          </div>
        )}

        {((phase === "camera_error" && !permissionDenied) || phase === "ai_error") && (
          <div style={{ position: "absolute", inset: 0, zIndex: 30, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(2,6,23,0.95)", padding: 24 }}>
            <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 16, padding: 20, textAlign: "center", maxWidth: 280 }}>
              <p style={{ fontSize: 13, fontWeight: 800, color: "#92400e" }}>
                {phase === "camera_error" ? "카메라에 접근할 수 없습니다" : "지금은 촬영할 수 없습니다"}
              </p>
              <p style={{ fontSize: 12, color: "#a16207", marginTop: 8 }}>다른 앱이 카메라를 사용 중이거나 장치를 찾을 수 없을 수 있습니다.</p>
              <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 14 }}>
                <button onClick={retryCamera} style={{ minHeight: 44, padding: "0 18px", background: "#122A5C", color: "white", border: "none", borderRadius: 12, fontSize: 13, fontWeight: 700 }}>
                  다시 시도
                </button>
                <button onClick={onCancel} style={{ minHeight: 44, padding: "0 18px", background: "transparent", border: "1px solid #d97706", color: "#92400e", borderRadius: 12, fontSize: 13, fontWeight: 700 }}>
                  촬영 취소
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div style={{ padding: 12, background: "#000" }}>
        <button
          type="button"
          onClick={onCancel}
          style={{ width: "100%", minHeight: 44, background: "rgba(255,255,255,0.08)", color: "#e2e8f0", border: "none", borderRadius: 12, fontSize: 13, fontWeight: 700 }}
        >
          <CameraIcon size={14} style={{ verticalAlign: "-2px", marginRight: 6 }} />촬영 취소
        </button>
      </div>
    </div>
  );
}
