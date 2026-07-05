// ─────────────────────────────────────────────
// CameraView
// 역할: 카메라 권한 요청, <video> 표시, <canvas> 오버레이 마운트만 담당.
// MediaPipe/AI를 전혀 import하지 않는다 — video/canvas DOM 노드만 부모에게 넘겨준다.
//
// 중요: video/canvas는 `active` 값과 무관하게 항상 DOM에 존재한다.
// (opacity로만 숨김 — 조건부 렌더링(status === "ready" && <video/>) 금지)
// 이렇게 해야 부모가 어느 시점에 ref를 잡아도 null이 되는 문제가 생기지 않는다.
// ─────────────────────────────────────────────

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";

function waitForFrame(video, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const start = performance.now();
    const check = () => {
      if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
        resolve();
        return;
      }
      if (performance.now() - start > timeoutMs) {
        reject(new Error("카메라 프레임 대기 시간 초과"));
        return;
      }
      requestAnimationFrame(check);
    };
    check();
  });
}

/**
 * props:
 * - active: boolean — true가 되면 getUserMedia를 시작한다.
 * - onReady(video, canvas): 카메라가 실제로 프레임을 그리기 시작하면 호출.
 * - onError(err): 권한 거부, HTTPS 아님, 카메라 없음 등 실패 시 호출.
 * - onStateChange(state): "idle" | "starting" | "on" | "error" 변화를 부모 UI에 알림.
 *
 * ref로 { getVideo(), getCanvas() } 를 노출한다 — 상위(MotionScanPage)가
 * rAF 루프에서 detectHands(video, ts)를 호출하고 canvas에 스켈레톤을 그릴 때 사용.
 */
const CameraView = forwardRef(function CameraView(
  { active, onReady, onError, onStateChange },
  ref
) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [cameraState, setCameraState] = useState("idle");
  // 실제로 잡힌 카메라가 전면(user)인 경우에만 화면을 좌우 반전(미러링)한다.
  // 후면(environment) 카메라는 반전하면 실제 손 방향과 어긋나 보이므로 반전하지 않는다.
  const [isMirrored, setIsMirrored] = useState(false);

  useImperativeHandle(ref, () => ({
    getVideo: () => videoRef.current,
    getCanvas: () => canvasRef.current,
  }));

  useEffect(() => {
    onStateChange?.(cameraState);
  }, [cameraState, onStateChange]);

  useEffect(() => {
    if (active) {
      start();
    } else {
      stop();
    }
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  async function start() {
    // video 엘리먼트는 이미 항상 마운트되어 있으므로 이 시점에 절대 null이 아니다.
    if (!videoRef.current) return;
    setCameraState("starting");
    try {
      // 후면 카메라 우선: 한 손으로 폰을 들고 반대편 손을 촬영하려면 반드시 후면(environment)이어야 함.
      // 후면 카메라가 없는 기기(노트북 등)에서는 getUserMedia가 실패할 수 있으므로
      // environment 시도 → 실패 시 user(전면)로 자동 폴백.
      let stream;
try {
  // exact 대신 ideal — 너무 엄격한 제약으로 인한 OverconstrainedError를 피한다.
  // 해상도는 별도 시도로 분리해서, 해상도 문제로 facingMode까지 실패하지 않게 한다.
  stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
  });
  const settings = stream.getVideoTracks()[0]?.getSettings?.();
  if (settings?.facingMode && settings.facingMode !== "environment") {
    // ideal 요청이 받아들여졌지만 실제로는 전면이 잡힌 경우 — deviceId로 재시도.
    const devices = await navigator.mediaDevices.enumerateDevices();
    const backCam = devices.find(
      (d) => d.kind === "videoinput" && /back|rear|environment/i.test(d.label)
    );
    if (backCam) {
      stream.getTracks().forEach((t) => t.stop());
      stream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: backCam.deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } },
      });
    }
  }
} catch (envErr) {
  console.warn("[CameraView] 후면 카메라 사용 불가, 전면으로 폴백:", envErr);
  stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
  });
}
      streamRef.current = stream;

      // 폴백이 일어났을 수 있으므로, 요청한 값이 아니라 실제로 잡힌 트랙의 facingMode를 확인한다.
      const actualFacing = stream.getVideoTracks()[0]?.getSettings?.().facingMode;
      setIsMirrored(actualFacing === "user");

      const v = videoRef.current;
      v.srcObject = stream;
      v.muted = true;
      v.playsInline = true;
      await v.play();
      await waitForFrame(v);
      setCameraState("on");
      onReady?.(v, canvasRef.current);
    } catch (err) {
      console.error("[CameraView] 카메라 시작 실패:", err);
      setCameraState("error");
      onError?.(err);
    }
  }

  function stop() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraState("idle");
  }

  const visible = cameraState === "on";

  return (
    <div style={{ position: "absolute", inset: 0, background: "#000" }}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: isMirrored ? "scaleX(-1)" : "none",
          opacity: visible ? 1 : 0,
          transition: "opacity 150ms linear",
          background: "#000",
        }}
      />
      {/* canvas에는 랜드마크만 그린다 — 카메라 영상을 canvas로 다시 그리지 않는다. */}
      <canvas
        ref={canvasRef}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          transform: isMirrored ? "scaleX(-1)" : "none",
          pointerEvents: "none",
          opacity: visible ? 1 : 0,
        }}
      />
    </div>
  );
});

export default CameraView;
