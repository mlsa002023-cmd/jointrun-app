// ─────────────────────────────────────────────
// HandTracker
// 역할: MediaPipe HandLandmarker 초기화 + detectForVideo() 래핑만 담당.
// 카메라(video 엘리먼트)가 어디서 왔는지는 전혀 모른다 — 그냥 video를 인자로 받아 landmark만 반환한다.
// CameraView와 서로 import하지 않는다 (완전 분리).
// ─────────────────────────────────────────────

const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";
const WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";

export const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
];

let landmarkerInstance = null;
let initPromise = null;

async function createLandmarker(delegate) {
  const { FilesetResolver, HandLandmarker } = await import("@mediapipe/tasks-vision");
  const vision = await FilesetResolver.forVisionTasks(WASM_URL);
  return HandLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: MODEL_URL, delegate },
    runningMode: "VIDEO",
    numHands: 1,
  });
}

/**
 * MediaPipe HandLandmarker를 초기화한다. GPU 델리게이트를 우선 시도하고,
 * 실패하면 CPU로 자동 폴백한다. 이미 초기화되어 있으면 그 인스턴스를 재사용한다.
 * 동시에 여러 곳에서 호출돼도 초기화가 한 번만 일어나도록 initPromise로 가드한다.
 */
export async function initHandTracker() {
  if (landmarkerInstance) return landmarkerInstance;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      landmarkerInstance = await createLandmarker("GPU");
    } catch (gpuErr) {
      console.warn("[HandTracker] GPU delegate 실패, CPU로 재시도:", gpuErr);
      landmarkerInstance = await createLandmarker("CPU");
    }
    return landmarkerInstance;
  })();

  try {
    return await initPromise;
  } finally {
    initPromise = null;
  }
}

/** 한 프레임에 대해 손 랜드마크를 감지한다. 초기화 전에 호출하면 null. */
export function detectHands(video, timestampMs) {
  if (!landmarkerInstance || !video) return null;
  return landmarkerInstance.detectForVideo(video, timestampMs);
}

export function isHandTrackerReady() {
  return !!landmarkerInstance;
}

/** 언마운트 시 반드시 호출 — GPU/WASM 리소스 해제. */
export function disposeHandTracker() {
  if (landmarkerInstance) {
    try { landmarkerInstance.close?.(); } catch { /* noop */ }
    landmarkerInstance = null;
  }
}
