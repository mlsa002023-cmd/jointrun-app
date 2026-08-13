// observationFormat — 표기 규칙 (RC1.2.2 P0-12.1)
import { describe, it, expect } from "vitest";
import { fmtDeg, fmtPercent, fmtDeviation, fmtAsymmetry, roundDeg, MISSING } from "./observationFormat";

describe("각도·비율", () => {
  it("실제 0은 0°로, 누락은 —로 적는다", () => {
    expect(fmtDeg(0)).toBe("0°");
    expect(fmtDeg(null)).toBe(MISSING);
    expect(fmtDeg(undefined)).toBe(MISSING);
    expect(fmtDeg(NaN)).toBe(MISSING);
  });

  it("비율은 퍼센트 정수로 적는다", () => {
    expect(fmtPercent(0.95)).toBe("95%");
    expect(fmtPercent(null)).toBe(MISSING);
  });

  it("요약과 표가 같은 반올림값을 쓴다", () => {
    // 18.4와 18.6은 화면에서 18°/19°로 보인다 — 요약도 이 값으로 차이를 내야 한다.
    expect(roundDeg(18.4)).toBe(18);
    expect(roundDeg(18.6)).toBe(19);
    expect(fmtDeg(18.4)).toBe("18°");
  });
});

describe("좌우 값 — 음수 부호를 노출하지 않는다 (§3)", () => {
  it("편위각은 크기와 방향으로 적는다", () => {
    expect(fmtDeviation(-7, "ulnar")).toBe("7° 새끼쪽");
    expect(fmtDeviation(7, "radial")).toBe("7° 엄지쪽");
    expect(fmtDeviation(0, "neutral")).toBe("0° 치우침 없음");
  });

  it("윤곽 비대칭도 부호 대신 방향으로 적는다", () => {
    expect(fmtAsymmetry(-0.07)).toBe("7% 새끼쪽");
    expect(fmtAsymmetry(0.07)).toBe("7% 엄지쪽");
  });

  it("아주 작은 좌우 차이는 방향을 단정하지 않는다", () => {
    expect(fmtAsymmetry(0.02)).toBe("2% 치우침 없음");
    expect(fmtAsymmetry(-0.02)).toBe("2% 치우침 없음");
  });

  it("어떤 입력에도 마이너스 기호를 출력하지 않는다", () => {
    [-0.3, -0.07, -0.01, 0, 0.5].forEach((v) => {
      expect(fmtAsymmetry(v)).not.toMatch(/-/);
    });
    [-30, -7, -1, 0, 12].forEach((v) => {
      expect(fmtDeviation(v)).not.toMatch(/-/);
    });
  });

  it("값이 없으면 —로 적는다", () => {
    expect(fmtAsymmetry(null)).toBe(MISSING);
    expect(fmtDeviation(undefined)).toBe(MISSING);
  });
});
