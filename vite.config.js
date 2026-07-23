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
    target: "es2020",
    rollupOptions: {
      external: [],
      output: {
        manualChunks: {
          react: ["react", "react-dom"],
          firebase: ["firebase/app", "firebase/auth", "firebase/firestore"],
          charts: ["recharts"],
          lucide: ["lucide-react"],
        },
      },
    },
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
