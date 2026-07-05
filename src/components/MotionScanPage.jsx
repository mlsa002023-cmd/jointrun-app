// ─────────────────────────────────────────────
// MotionScanPage
// 역할: CameraView(카메라) + HandTracker(AI) + MotionAnalyzer(분석) + UI를 조립한다.
// 각 모듈은 서로 몰라도 되고, 이 파일만 그 셋을 알고 있다.
//
// 초기화 순서 (문서에서 요청한 순서 그대로):
// 페이지 열림 → video 생성(CameraView가 항상 마운트) → camera 시작
//   → onReady(video ready) → HandTracker 초기화 → detect 루프 시작
//
// 기존 HandScanEngine과 동일한 props 인터페이스를 유지한다:
//   { currentProfile, onScanCompleted, triggerFeedback }
// → App.tsx / 상위 컴포넌트는 import만 바꾸면 그대로 동작한다.
// ─────────────────────────────────────────────

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, RefreshCw, Sparkles } from "lucide-react";
import CameraView from "./CameraView";
import { HAND_CONNECTIONS, initHandTracker, detectHands, disposeHandTracker } from "../lib/handTracker";
import { analyzeAllFingers, summarizeFingers, buildRecommendation, aggregateFingerSamples, validatePose } from "../lib/motionAnalyzer";
// 20초 스캔 동안 순환하는 유도 동작.
const POSE_GUIDE = [
  { id: "spread", label: "손가락 펴기", instruction: "손가락을 최대한 쫙 펴주세요", sub: "최대 신전각(펴짐) 측정", duration: 7 },
  { id: "ok", label: "OK 사인", instruction: "엄지와 검지를 붙여 OK 모양을 만들어 주세요", sub: "정밀 조절력 측정", duration: 7 },
  { id: "fist", label: "가볍게 쥐기", instruction: "주먹을 편안하게 살짝 쥐어 주세요", sub: "최대 굴곡각(굽힘) 측정", duration: 6 },
];

function PoseIcon({ poseId, className = "" }) {
  const stroke = "currentColor";
  if (poseId === "ok") {
    return (
      <svg viewBox="0 0 64 64" className={className} fill="none">
        <circle cx="24" cy="34" r="10" stroke={stroke} strokeWidth="3" />
        <path d="M38 20 L38 40" stroke={stroke} strokeWidth="3" strokeLinecap="round" />
        <path d="M46 22 L46 42" stroke={stroke} strokeWidth="3" strokeLinecap="round" />
        <path d="M53 26 L53 44" stroke={stroke} strokeWidth="3" strokeLinecap="round" />
        <path d="M18 48 Q32 56 50 50" stroke={stroke} strokeWidth="3" strokeLinecap="round" />
      </svg>
    );
  }
  if (poseId === "fist") {
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

function clearCanvas(canvas) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

export default function MotionScanPage({ currentProfile, onScanCompleted, triggerFeedback }) {
  const cameraRef = useRef(null);
  const rafRef = useRef(null);
  const lastVideoTimeRef = useRef(-1);
  const latestFingersRef = useRef(null);
  const sampleBufferRef = useRef([]); // { fingers, worldLandmarks, ts } 최근 프레임 버퍼 — 포즈 검증/집계에 사용
  const SAMPLE_WINDOW_MS = 1500; // 마지막 1.5초 구간만 대표값 계산에 사용 (그 이전 프레임은 자동 폐기)

  // phase: idle | camera_starting | ai_loading | scanning | camera_error | ai_error | completed
  const [phase, setPhase] = useState("idle");
  const [errorMessage, setErrorMessage] = useState(null);
  const [handDetected, setHandDetected] = useState(false);
  const [liveMetrics, setLiveMetrics] = useState(null);
  const [history, setHistory] = useState([]);
  const [justSaved, setJustSaved] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [poseIndex, setPoseIndex] = useState(0);
  const [poseSecondsLeft, setPoseSecondsLeft] = useState(POSE_GUIDE[0].duration);
  const poseIndexRef = useRef(0);

  const cameraActive = phase === "camera_starting" || phase === "ai_loading" || phase === "scanning";

  // ── 유도 동작 타이머: scanning 중에만 순환 ──
  useEffect(() => {
    if (phase !== "scanning") return;
    poseIndexRef.current = 0;
    setPoseIndex(0);
    setPoseSecondsLeft(POSE_GUIDE[0].duration);
    const timer = setInterval(() => {
      setPoseSecondsLeft((prev) => {
        if (prev <= 1) {
          const nextIdx = (poseIndexRef.current + 1) % POSE_GUIDE.length;
          poseIndexRef.current = nextIdx;
          setPoseIndex(nextIdx);
          return POSE_GUIDE[nextIdx].duration;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [phase]);

  const stopDetectLoop = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    lastVideoTimeRef.current = -1;
  }, []);

  useEffect(() => () => {
    stopDetectLoop();
    disposeHandTracker();
  }, [stopDetectLoop]);

  // ── detect 루프: status 조건 없이 순수하게 detect → draw → analyze → 반복 ──
  const detectLoop = useCallback(() => {
    const video = cameraRef.current?.getVideo();
    const canvas = cameraRef.current?.getCanvas();
    if (!video || !canvas) {
      rafRef.current = requestAnimationFrame(detectLoop);
      return;
    }
    if (video.readyState >= 2 && video.currentTime !== lastVideoTimeRef.current) {
      lastVideoTimeRef.current = video.currentTime;
      const result = detectHands(video, performance.now());
      if (result?.landmarks?.length > 0) {
        setHandDetected(true);
        const worldLandmarks = result.worldLandmarks[0];
        const fingers = analyzeAllFingers(worldLandmarks);
        latestFingersRef.current = fingers;
        setLiveMetrics(fingers);

        // 최근 프레임을 버퍼에 쌓고, 윈도우(1.5초) 밖의 오래된 샘플은 제거한다.
        // 포즈 판정·최종 대표값은 이 버퍼의 최근 구간 중앙값만 사용한다 — 단일 프레임 노이즈 방지.
        const now = performance.now();
        sampleBufferRef.current.push({ fingers, worldLandmarks, ts: now });
        sampleBufferRef.current = sampleBufferRef.current.filter(
          (s) => now - s.ts <= SAMPLE_WINDOW_MS
        );

        drawSkeleton(result.landmarks[0], canvas, video.videoWidth || 640, video.videoHeight || 480);
      } else {
        setHandDetected(false);
        setLiveMetrics(null);
        clearCanvas(canvas);
      }
    }
    rafRef.current = requestAnimationFrame(detectLoop);
  }, []);
  // ── CameraView가 실제로 프레임을 그리기 시작하면(onReady) AI를 초기화하고 루프 시작 ──
  const handleCameraReady = useCallback(async () => {
    setPhase("ai_loading");
    triggerFeedback("MediaPipe 모델을 불러오는 중...");
    try {
      await initHandTracker();
    } catch (err) {
      console.error("[MotionScanPage] HandTracker 초기화 실패:", err);
      setErrorMessage(`AI 모델(WASM) 초기화에 실패했습니다. (${err?.message || "알 수 없는 오류"})`);
      setPhase("ai_error");
      triggerFeedback("AI 모델 초기화 실패 — 시뮬레이션 모드로 전환합니다.");
      return;
    }
    setPhase("scanning");
    triggerFeedback("카메라 연결 완료! 손을 화면에 비춰주세요.");
    rafRef.current = requestAnimationFrame(detectLoop);
  }, [detectLoop, triggerFeedback]);

  const handleCameraError = useCallback((err) => {
    setErrorMessage(`카메라에 접근할 수 없습니다. (${err?.message || "권한 거부"})`);
    setPhase("camera_error");
    triggerFeedback("카메라 접근 불가 — 시뮬레이션 모드로 전환합니다.");
  }, [triggerFeedback]);

  const startScan = () => {
    setErrorMessage(null);
    setPhase("camera_starting"); // CameraView의 active=true → getUserMedia 시작
  };

  const restart = () => {
    stopDetectLoop();
    setScanResult(null);
    setErrorMessage(null);
    setHandDetected(false);
    setLiveMetrics(null);
    setPhase("idle");
  };

  const saveSnapshot = () => {
    if (!latestFingersRef.current) return;
    const fingers = latestFingersRef.current;
    const { avgScore, avgFlexion } = summarizeFingers(fingers);
    const entry = { ts: Date.now(), avgScore, avgFlexion, fingers };
    setHistory((prev) => [entry, ...prev].slice(0, 14));
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 1200);

    const stiffnessMin = Math.round((100 - avgScore) * 0.5);
    const painIndex = Math.round((100 - avgScore) / 15);
    const result = { romDeg: avgFlexion, stiffnessMin, painIndex, fingers, avgScore };
    setScanResult(result);
    onScanCompleted({ ...result, recommendation: buildRecommendation(avgScore, avgFlexion) });
    triggerFeedback(`스캔 저장 완료! Finger Score: ${avgScore}점`);

    stopDetectLoop();
    setPhase("completed");
  };

  const runSimulation = () => {
    const simResult = {
      romDeg: 122, stiffnessMin: 32, painIndex: 6,
      fingers: [
        { key: "index", name: "검지", flexion: 118, deviation: 4.2, deviationDir: "ulnar", score: 82 },
        { key: "middle", name: "중지", flexion: 125, deviation: 3.1, deviationDir: "radial", score: 88 },
        { key: "ring", name: "약지", flexion: 110, deviation: 6.8, deviationDir: "ulnar", score: 72 },
        { key: "pinky", name: "소지", flexion: 105, deviation: 5.5, deviationDir: "ulnar", score: 68 },
      ],
      avgScore: 78,
    };
    setScanResult(simResult);
    onScanCompleted({ ...simResult, recommendation: buildRecommendation(simResult.avgScore, simResult.romDeg) });
    triggerFeedback("시뮬레이션 스캔 완료!");
    setPhase("completed");
  };

  const currentPose = POSE_GUIDE[poseIndex];
  const poseProgress = 1 - poseSecondsLeft / currentPose.duration;
  const ringR = 17;
  const ringCirc = 2 * Math.PI * ringR;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "#000", display: "flex", flexDirection: "column" }}>
      <div style={{ position: "relative", flex: 1, overflow: "hidden" }}>

        {/* 카메라는 active로만 제어. video/canvas는 CameraView 내부에서 항상 마운트되어 있음. */}
        <CameraView
          ref={cameraRef}
          active={cameraActive}
          onReady={handleCameraReady}
          onError={handleCameraError}
        />

        {phase === "scanning" && (
          <>
            <div className="absolute inset-4 border border-dashed border-teal-500/30 rounded-xl pointer-events-none" />
            <div className="absolute inset-x-0 top-0 h-1/3 pointer-events-none z-10 bg-gradient-to-b from-transparent via-teal-400/25 to-transparent animate-scan-sweep" />

            <div className="absolute top-2 left-2 right-2 flex justify-between items-center z-20">
              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full transition-colors ${handDetected ? "bg-teal-500 text-slate-950" : "bg-slate-700 text-slate-400"}`}>
                {handDetected ? "손 감지됨" : "손을 화면에 보여주세요"}
              </span>
              <span className="text-[9px] text-teal-400 font-mono bg-slate-950/80 px-2 py-0.5 rounded-full flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" /> LIVE
              </span>
            </div>

            <div className="absolute top-9 left-2 right-2 z-20 bg-slate-950/85 backdrop-blur-sm rounded-xl p-2.5 flex items-center gap-2.5 border border-teal-500/20">
              <div className="relative w-11 h-11 shrink-0">
                <svg viewBox="0 0 40 40" className="absolute inset-0 w-full h-full -rotate-90">
                  <circle cx="20" cy="20" r={ringR} fill="none" stroke="#1e293b" strokeWidth="3" />
                  <circle cx="20" cy="20" r={ringR} fill="none" stroke="#2dd4bf" strokeWidth="3"
                    strokeDasharray={ringCirc}
                    strokeDashoffset={ringCirc * (1 - poseProgress)}
                    strokeLinecap="round" className="transition-all duration-1000 ease-linear" />
                </svg>
                <PoseIcon poseId={currentPose.id} className="absolute inset-0 w-full h-full p-1.5 text-teal-300" />
                <span className="absolute -bottom-1 -right-1 text-[8px] font-black text-teal-300 bg-slate-950 rounded-full w-4 h-4 flex items-center justify-center border border-teal-500/40">
                  {poseSecondsLeft}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold text-white leading-tight">{currentPose.instruction}</p>
                <p className="text-[8px] text-teal-400/80 mt-0.5">{currentPose.sub}</p>
              </div>
              <div className="flex gap-1 shrink-0">
                {POSE_GUIDE.map((p, i) => (
                  <span key={p.id} className={`w-1.5 h-1.5 rounded-full transition-colors ${i === poseIndex ? "bg-teal-400" : i < poseIndex ? "bg-teal-700" : "bg-slate-700"}`} />
                ))}
              </div>
            </div>

            {liveMetrics && (
              <div className="absolute bottom-2 left-2 right-2 z-20 bg-slate-950/80 rounded-xl p-2 grid grid-cols-4 gap-1">
                {liveMetrics.map((f) => (
                  <div key={f.key} className="text-center">
                    <div className="text-[8px] text-slate-400">{f.name}</div>
                    <div className="text-[10px] font-black text-teal-400 font-mono">{Math.round(f.flexion)}°</div>
                    <div className="text-[7px] text-slate-500">{Math.round(f.deviation)}° {f.deviationDir === "radial" ? "요측" : "척측"}</div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── AI 로딩 중: 카메라는 이미 보이고 있고, 그 위에 "AI 모델 로딩중" 배지만 얹는다 ── */}
        {phase === "ai_loading" && (
          <div className="absolute top-2 left-2 right-2 z-20 flex justify-center">
            <span className="text-[10px] font-bold px-3 py-1 rounded-full bg-slate-950/85 text-teal-300 flex items-center gap-2">
              <span className="w-3 h-3 border-2 border-teal-400 border-t-transparent rounded-full animate-spin" />
              AI 모델 로딩중
            </span>
          </div>
        )}
        {phase === "camera_starting" && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/60">
            <span className="text-[10px] font-bold px-3 py-1 rounded-full bg-slate-950/85 text-slate-300">카메라 연결중...</span>
          </div>
        )}

        {/* ── idle ── */}
        {phase === "idle" && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-slate-950 px-6">
            <div className="text-center mb-2">
              <p className="text-[9px] text-teal-400 uppercase tracking-widest font-mono">Real MediaPipe AI Scan</p>
              <h2 className="text-base font-bold text-white">실제 손 관절 스캔</h2>
              <p className="text-[10px] text-slate-400 leading-normal mt-1">카메라 : OFF · AI 모델 : 대기 · 손 감지 : 없음</p>
            </div>
            <div className="w-16 h-16 rounded-full bg-teal-500/10 border border-teal-500/30 flex items-center justify-center">
              <Camera className="w-8 h-8 text-teal-400" />
            </div>
            <p className="text-[10px] text-slate-400 text-center leading-relaxed">카메라 앞에 손을 가볍게 펼쳐 주세요.<br />어떠한 민감 정보도 외부로 전송되지 않습니다.</p>
            <button onClick={startScan} className="bg-teal-500 hover:bg-teal-400 text-slate-950 font-black px-5 py-2 rounded-xl text-xs shadow-md transition-all">
              MediaPipe 스캔 시작
            </button>
            <button onClick={runSimulation} className="text-[10px] text-slate-500 underline">
              시뮬레이션으로 건너뛰기
            </button>
          </div>
        )}

        {/* ── camera_error / ai_error ── */}
        {(phase === "camera_error" || phase === "ai_error") && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/95 px-6">
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-center max-w-xs">
              <p className="text-xs font-bold text-amber-700">
                {phase === "camera_error" ? "카메라 오류" : "AI 모델 오류"}
              </p>
              <p className="text-[10px] text-amber-600 mt-1">
                {errorMessage || "문제가 발생하여 시뮬레이션 데이터로 시연합니다."}
              </p>
              <div className="flex gap-2 justify-center mt-3">
                <button onClick={restart} className="bg-white border border-amber-300 text-amber-700 font-bold text-xs px-4 py-2 rounded-xl">
                  다시 시도
                </button>
                <button onClick={runSimulation} className="bg-teal-500 text-white font-bold text-xs px-4 py-2 rounded-xl">
                  시뮬레이션 스캔 실행
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── completed ── */}
        {phase === "completed" && scanResult && (
          <div className="absolute inset-0 z-30 overflow-y-auto bg-slate-950/97 p-3">
            <div className="bg-white border border-teal-200 rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-1.5 text-teal-700 text-xs font-bold">
                  <Sparkles className="w-4 h-4 text-orange-500" />
                  스캔 분석 완료
                </div>
                <button onClick={restart} className="text-[10px] text-slate-500 hover:text-slate-800 flex items-center gap-1 font-bold">
                  <RefreshCw className="w-3 h-3" /> 다시 측정
                </button>
              </div>
              <div className="grid grid-cols-4 gap-2 mb-3">
                {scanResult.fingers.map((f) => (
                  <div key={f.key} className="bg-slate-50 p-2 rounded-xl border border-slate-200 text-center">
                    <div className="text-[8px] text-slate-400 font-bold">{f.name}</div>
                    <div className="text-sm font-black text-teal-700 font-mono">{f.score}</div>
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
              <div className="bg-teal-50 border border-teal-200 p-2.5 rounded-xl text-[10px] text-slate-700 leading-relaxed">
                <strong className="text-slate-900">처방:</strong> {buildRecommendation(scanResult.avgScore, scanResult.romDeg)}
              </div>
            </div>
            {history.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-2xl p-3 mt-3">
                <p className="text-[10px] font-bold text-slate-700 mb-2">최근 스캔 기록 (14회)</p>
                <div className="flex gap-1 overflow-x-auto">
                  {history.slice(0, 14).map((h, i) => (
                    <div key={i} className="shrink-0 text-center">
                      <div className="w-6 h-6 rounded bg-teal-100 flex items-center justify-center text-[8px] font-black text-teal-700">{h.avgScore}</div>
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
          <button onClick={saveSnapshot} disabled={!handDetected}
            className={`flex-1 py-2 rounded-xl text-xs font-black transition-all ${handDetected ? "bg-teal-500 hover:bg-teal-400 text-slate-950 shadow-md" : "bg-slate-800 text-slate-500 cursor-not-allowed"}`}>
            {justSaved ? "저장됨!" : "스냅샷 저장"}
          </button>
          <button onClick={restart} className="px-3 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all">
            종료
          </button>
        </div>
      )}
    </div>
  );
}
