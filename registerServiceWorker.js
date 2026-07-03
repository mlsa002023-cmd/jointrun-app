// src/registerServiceWorker.js
// main.jsx(엔트리 파일)에서 아래처럼 호출하세요:
//
//   import { registerServiceWorker } from "./registerServiceWorker";
//   registerServiceWorker();
//
export function registerServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/service-worker.js")
      .then((reg) => {
        console.log("[SW] 등록 완료:", reg.scope);
      })
      .catch((err) => {
        console.error("[SW] 등록 실패:", err);
      });
  });
}
