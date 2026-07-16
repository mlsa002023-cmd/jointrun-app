// src/registerServiceWorker.js
// main.jsx(엔트리 파일)에서 아래처럼 호출하세요:
//
//   import { registerServiceWorker } from "./registerServiceWorker";
//   registerServiceWorker();
//
export function registerServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  // 개발 서버(vite dev)에는 CACHE_VERSION이 빌드 스탬핑되지 않은 __CACHE_VERSION__ 원본이 그대로
  // 있고, 무엇보다 SW의 cache-first 전략이 Vite HMR과 충돌해 코드를 고쳐도 반영이 안 된 것처럼
  // 보이는 문제를 일으킨다 — 프로덕션 빌드(dist)에서만 등록한다.
  if (import.meta.env.DEV) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker
      // updateViaCache: "none" — 브라우저 HTTP 캐시가 아니라 항상 네트워크에서 service-worker.js
      // 바이트를 새로 확인하게 해서, 배포마다 stamp-sw-version.js가 새겨넣은 새 CACHE_VERSION을
      // 곧바로 인식하고 install/activate를 다시 태우게 한다.
      .register("/service-worker.js", { updateViaCache: "none" })
      .then((reg) => {
        console.log("[SW] 등록 완료:", reg.scope);
      })
      .catch((err) => {
        console.error("[SW] 등록 실패:", err);
      });
  });
}
