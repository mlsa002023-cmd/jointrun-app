import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
  },
  preview: {
    port: 4173,
    host: true,
  },
  build: {
    outDir: "dist",
    sourcemap: false,
    // RC1.2.2 P0-3 — 실기기 Safari(WebKit) 부팅 실패를 진단하면서 보수적인 타깃으로 내렸다.
    // es2020은 iOS Safari 14~15에서 optional chaining 등 일부 문법·API 지원이 애매한 구간이
    // 있어, 지원 범위가 명확한 safari15로 고정한다.
    target: "safari15",
    // manualChunks를 제거하고 Rollup 기본 전략을 쓴다. 예전 수동 분할(react/firebase/
    // charts/lucide)은 첫 로그인 화면 하나를 띄우는 데도 여러 chunk를 받아오게 만들어
    // 실패 지점을 늘렸고, react 청크가 0.06 kB로 사실상 비는 등 의도대로 동작하지도 않았다.
    // 이제 첫 화면은 단일 엔트리 청크로 로드되고, MediaPipe만 카메라 진입 시 동적 로드된다.
  },
  optimizeDeps: {
    exclude: ["@mediapipe/tasks-vision"],
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.js"],
    // tests/rules는 Firestore 에뮬레이터가 떠 있어야만 통과하는 별도 테스트라 일반
    // `npm run test`에는 포함하지 않는다 — vitest.rules.config.js + `npm run test:rules`로 따로 실행한다.
    exclude: ["**/node_modules/**", "**/.git/**", "tests/rules/**"],
  },
});
