import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { execSync } from "node:child_process";

// RC1.2.2 P0-6 — 배포된 번들이 정확히 어느 커밋인지 확인할 수 있어야 한다.
// (미커밋 작업 트리로 배포하면 dirty가 붙어 바로 드러난다.)
function resolveBuildSha() {
  if (process.env.BUILD_SHA) return process.env.BUILD_SHA;
  try {
    const sha = execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
    // --untracked-files=no 필수 — vite는 ESM config를 읽을 때 vite.config.js.timestamp-*.mjs를
    // 잠시 만들어 두는데, 그걸 세면 항상 dirty로 오탐지된다. 배포된 코드와 커밋의 차이는
    // "추적 중인 파일의 수정"으로 판단한다.
    const dirty = execSync("git status --porcelain --untracked-files=no", { encoding: "utf8" }).trim().length > 0;
    return dirty ? `${sha}-dirty` : sha;
  } catch {
    return "unknown";
  }
}

export default defineConfig({
  plugins: [react()],
  define: {
    __BUILD_SHA__: JSON.stringify(resolveBuildSha()),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
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
