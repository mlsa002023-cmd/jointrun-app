import { defineConfig } from "vite";

// firestoreRules.test.js 전용 설정 — Firestore 에뮬레이터가 떠 있어야 통과한다.
// `npm run test`(vite.config.js)와 분리해, 에뮬레이터 없이 돌리는 일반 테스트에 영향이 없게 한다.
export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["tests/rules/**/*.test.js"],
  },
});
