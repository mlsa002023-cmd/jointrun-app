import { describe, it, expect } from "vitest";
import { PatternDetector } from "./PatternDetector";

describe("PatternDetector", () => {
  it("delegates to detectPattern without re-implementing judgment logic", () => {
    const result = PatternDetector.detect([]);
    expect(result).toEqual({ status: "insufficient", message: "패턴을 판단하기엔 아직 기록이 부족합니다." });
  });
});
