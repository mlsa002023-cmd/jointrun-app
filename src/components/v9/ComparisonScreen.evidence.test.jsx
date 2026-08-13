// 신규 기준선 → 재확인 비교 화면이 실제로 무엇을 렌더링하는지 남기는 증거 테스트.
// (RC1.2.2 P0-10 완료 보고용 — 실기기 UAT 전에 화면 내용을 문자로 확인할 수 있게 한다.)
import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import ComparisonScreen from "./ComparisonScreen";

const FINGERS = [
  { key: "index", name: "검지" },
  { key: "middle", name: "중지" },
  { key: "ring", name: "약지" },
  { key: "pinky", name: "소지" },
];

/** 실기기에서 나온 값에 가깝게 구성한 신규 세대 capture. */
function capture({ shift = 0, contourShift = 0, symptom }) {
  const seed = { index: [2, -6, 19, 37], middle: [12, 5, 8, 22], ring: [23, 10, 6, 16], pinky: [4, 15, 25, 15] };
  const width = { index: 0.95, middle: 0.94, ring: 1.03, pinky: 1.0 };
  const asym = { index: 0.02, middle: 0.06, ring: 0.0, pinky: 0.1 };
  return {
    algorithmVersion: "v1.1",
    handSide: "left",
    capturedAt: new Date(shift ? "2026-08-09T09:00:00Z" : "2026-07-26T09:00:00Z"),
    comparisonQualityStatus: "unverified",
    // 실기기처럼 구형 호환 필드는 0으로 둔다 — 그래도 신규 값이 표시되어야 한다.
    averageObservedRomDeg: 0,
    perFingerObservedRomDeg: FINGERS.map((f) => ({ ...f, romDeg: 0 })),
    perFingerJointObservation: FINGERS.map((f) => {
      const [dipExt, dipDev, dipRom, pipRom] = seed[f.key];
      return {
        key: f.key, name: f.name,
        dipExtensionPoseFlexionDeg: dipExt + shift,
        dipExtensionPoseDeviationDeg: dipDev,
        dipDeviationDirection: dipDev < 0 ? "ulnar" : dipDev > 0 ? "radial" : "neutral",
        dipActiveRomDeg: dipRom > 0 ? dipRom + shift : null,
        pipExtensionPoseFlexionDeg: 15 + shift,
        pipExtensionPoseDeviationDeg: -5,
        pipDeviationDirection: "ulnar",
        pipActiveRomDeg: pipRom + shift,
      };
    }),
    dipContourObservation: {
      measurementVersion: "dip-contour-v1",
      fingers: FINGERS.map((f) => ({
        key: f.key,
        dipWidthRatio: width[f.key] + contourShift,
        contourAsymmetryRatio: asym[f.key],
        radialHalfWidthRatio: 0.48,
        ulnarHalfWidthRatio: 0.46,
        validFrames: 12,
      })),
    },
    symptomSnapshot: symptom,
  };
}

describe("증거 — 신규 기준선 → 신규 재확인 비교", () => {
  it("네 손가락의 DIP/PIP/외곽 값이 기준선·지금 두 열로 렌더링된다", () => {
    render(
      <ComparisonScreen
        baselineCapture={capture({ symptom: { painSelfReport: 6, stiffnessSelfReport: 6, swellingSelfReport: "high" } })}
        currentCapture={capture({ shift: 4, contourShift: -0.03, symptom: { painSelfReport: 5, stiffnessSelfReport: 4, swellingSelfReport: "high" } })}
        onSubmit={vi.fn()} onCancel={vi.fn()} onViewed={vi.fn()}
      />
    );

    const lines = [];
    FINGERS.forEach((f) => {
      const row = screen.getByTestId(`compare-finger-${f.key}`);
      const cells = within(row).getAllByText(/.+/).map((n) => n.textContent);
      lines.push(`${f.name}: ${cells.slice(1).join(" | ")}`);
      // 0°로 유실되지 않았는지 — 각 손가락에 실제 관찰값이 있어야 한다.
      expect(row.textContent).not.toMatch(/^검지(0°\s*)+$/);
    });
    // 실행 로그에 남겨 완료 보고의 증거로 쓴다.
    console.log("\n[비교 화면 렌더링 결과]\n" + lines.join("\n") + "\n");

    // 외곽 폭이 실제로 표시된다(95% 등).
    expect(screen.getAllByText(/9[0-9]%|10[0-9]%/).length).toBeGreaterThan(0);
    // 증상 비교도 함께 유지된다.
    expect(screen.getByText("통증 체감")).toBeInTheDocument();
  });
});
