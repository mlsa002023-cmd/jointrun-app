import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { FEATURE_FLAGS, MOCK_CAPTURE_ENABLED } from "./featureFlags";

describe("FEATURE_FLAGS — production 기본값", () => {
  it("absoluteScoreUiEnabled는 환경변수를 설정하지 않으면 false다(테스트 환경 = 배포 환경과 동일 조건)", () => {
    expect(FEATURE_FLAGS.absoluteScoreUiEnabled).toBe(false);
  });

  it("pricingExperiment도 기본값은 false다", () => {
    expect(FEATURE_FLAGS.pricingExperiment).toBe(false);
  });

  it("MOCK_CAPTURE_ENABLED는 별도 opt-in 없이는 false다(테스트 러너는 import.meta.env.DEV=true지만 VITE_ENABLE_MOCK_CAPTURE는 설정 안 함)", () => {
    expect(MOCK_CAPTURE_ENABLED).toBe(false);
  });
});

describe("FEATURE_FLAGS — 런타임 조작 경로 회귀 방지", () => {
  it("소스 코드가 URL 파라미터(location)나 localStorage를 읽지 않는다 — 사용자가 devtools로 값을 바꿀 방법이 없어야 한다", () => {
    // 설명 주석 안에는 왜 안전한지 설명하느라 "localStorage"/"location.search" 같은 단어 자체가
    // 등장한다 — 그래서 주석 줄(//로 시작)은 걷어내고 실제 코드 줄만 검사한다.
    const source = readFileSync(path.resolve(process.cwd(), "src/config/featureFlags.js"), "utf-8");
    const codeOnly = source
      .split("\n")
      .filter((line) => !line.trim().startsWith("//"))
      .join("\n");
    expect(codeOnly).not.toMatch(/localStorage/);
    expect(codeOnly).not.toMatch(/location\.(search|hash)/);
    expect(codeOnly).not.toMatch(/URLSearchParams/);
  });
});
