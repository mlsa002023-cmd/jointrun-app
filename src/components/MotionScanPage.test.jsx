// MotionScanPage 완료 화면 P0 UX 보정 검증.
//
// 실제 카메라/MediaPipe 없이 dev 전용 "시뮬레이션으로 건너뛰기" 경로로 완료 화면에 진입해
// 다음을 검증한다:
//   - 상단에 '홈으로' 버튼이 없다
//   - 하단에 '다음 단계로' 버튼이 있고 최소 높이 56px
//   - 저장 중에는 비활성, 저장 성공 후에만 홈 이동 가능
//   - 저장 실패 시 결과 화면을 유지하고 홈으로 이동하지 않는다
//   - absoluteScoreUiEnabled=false일 때 점수·강직지수·VAS·자동추천이 렌더링되지 않는다
import { render, screen, fireEvent, act } from "@testing-library/react";
import { forwardRef } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

// CameraView는 getUserMedia를 건드리므로 스텁 처리(시뮬레이션 경로는 카메라를 켜지 않는다).
vi.mock("./CameraView", () => {
  const Stub = forwardRef(() => null);
  Stub.displayName = "CameraViewStub";
  return { default: Stub };
});

// 분석 이벤트는 GA 사이드이펙트를 피하고 호출을 검증하기 위해 목으로 대체.
const trackKpiEvent = vi.fn();
vi.mock("../lib/analytics", () => ({ trackKpiEvent: (...a) => trackKpiEvent(...a) }));

// FEATURE_FLAGS는 테스트에서 flag를 뒤집을 수 있도록 hoisted 목으로 제공.
const { mockFlags } = vi.hoisted(() => ({ mockFlags: { absoluteScoreUiEnabled: false, pricingExperiment: false } }));
// RC1.2.1 §4 — QA gate는 테스트에서 전환할 수 있어야 한다. 기본은 허용(시뮬레이션으로 완료 화면
// 진입이 필요하기 때문)이고, "일반 사용자에게 QA 도구가 안 보인다"는 별도 테스트에서 false로 바꾼다.
const { mockQa } = vi.hoisted(() => ({ mockQa: { allowed: true } }));
vi.mock("../config/featureFlags", () => ({
  FEATURE_FLAGS: mockFlags,
  MOCK_CAPTURE_ENABLED: false,
  shouldShowQaTools: () => mockQa.allowed,
}));

import MotionScanPage from "./MotionScanPage";

function renderScan(overrides = {}) {
  const props = {
    onScanCompleted: vi.fn().mockResolvedValue(undefined),
    triggerFeedback: vi.fn(),
    onGoToNextAction: vi.fn(),
    currentUser: { uid: "u1" },
    ...overrides,
  };
  render(<MotionScanPage {...props} />);
  return props;
}

// RC1.2 captureMode(각도 관찰) 렌더 헬퍼.
function renderCapture(overrides = {}) {
  const props = {
    captureMode: true,
    handSide: "right",
    onAngleMeasured: vi.fn().mockResolvedValue(undefined),
    onGoToNextAction: vi.fn(),
    triggerFeedback: vi.fn(),
    currentUser: { uid: "u1" },
    ...overrides,
  };
  render(<MotionScanPage {...props} />);
  return props;
}

// dev 전용 "시뮬레이션으로 건너뛰기"로 완료 화면에 진입한다.
async function enterCompleted() {
  const simBtn = await screen.findByText("시뮬레이션으로 건너뛰기");
  await act(async () => { fireEvent.click(simBtn); });
}

beforeEach(() => {
  trackKpiEvent.mockClear();
  mockFlags.absoluteScoreUiEnabled = false;
  mockQa.allowed = true;
});

describe("MotionScanPage 완료 화면 — P0 UX 보정", () => {
  it("상단에 '홈으로' 버튼이 없고, 하단에 '다음 단계로' 버튼이 있다", async () => {
    renderScan();
    await enterCompleted();

    expect(screen.queryByText("홈으로")).toBeNull();
    const next = await screen.findByRole("button", { name: "다음 단계로 이동" });
    expect(next).toBeInTheDocument();
    // 다시 측정하기 보조 액션은 유지
    expect(screen.getByLabelText("다시 측정하기")).toBeInTheDocument();
  });

  it("'다음 단계로' 버튼의 최소 높이가 56px 이상이다", async () => {
    renderScan();
    await enterCompleted();
    const next = await screen.findByRole("button", { name: "다음 단계로 이동" });
    expect(parseInt(next.style.minHeight, 10)).toBeGreaterThanOrEqual(56);
  });

  it("저장 성공 후에만 '다음 단계로'가 활성화되고 홈 이동이 가능하다", async () => {
    // 저장을 수동으로 resolve할 수 있는 deferred promise
    let resolveSave;
    const onScanCompleted = vi.fn(() => new Promise((res) => { resolveSave = res; }));
    const onGoToNextAction = vi.fn();
    renderScan({ onScanCompleted, onGoToNextAction });
    await enterCompleted();

    // 저장 중: 버튼 비활성 + 클릭해도 홈 이동 안 됨
    const savingBtn = await screen.findByRole("button", { name: "저장 중입니다" });
    expect(savingBtn).toBeDisabled();
    fireEvent.click(savingBtn);
    expect(onGoToNextAction).not.toHaveBeenCalled();

    // 저장 성공 → 활성화
    await act(async () => { resolveSave(); });
    const next = await screen.findByRole("button", { name: "다음 단계로 이동" });
    expect(next).not.toBeDisabled();

    // 이제 클릭하면 홈 이동
    fireEvent.click(next);
    expect(onGoToNextAction).toHaveBeenCalledTimes(1);
    expect(trackKpiEvent).toHaveBeenCalledWith("scan_result_next_clicked", "u1");
  });

  it("저장 실패 시 결과 화면을 유지하고 홈으로 이동하지 않으며 재시도를 노출한다", async () => {
    const onScanCompleted = vi.fn().mockRejectedValue(new Error("network"));
    const onGoToNextAction = vi.fn();
    renderScan({ onScanCompleted, onGoToNextAction });
    await enterCompleted();

    // 오류 상태: 재시도 버튼 + 결과(관찰값) 유지
    await screen.findByRole("button", { name: "측정 결과 다시 저장" });
    // P0-8 — 결과 화면은 DIP 끝마디 관찰을 먼저 보여준다(평균 ROM 메인 표시 제거).
    expect(screen.getByText(/끝마디\(DIP\) 관찰/)).toBeInTheDocument(); // 결과 화면 유지
    expect(screen.queryByRole("button", { name: "다음 단계로 이동" })).toBeNull();
    expect(onGoToNextAction).not.toHaveBeenCalled();
    expect(trackKpiEvent).toHaveBeenCalledWith("scan_result_save_failed", "u1");
  });

  it("중복 저장을 차단한다(onScanCompleted는 한 번만 호출)", async () => {
    let resolveSave;
    const onScanCompleted = vi.fn(() => new Promise((res) => { resolveSave = res; }));
    renderScan({ onScanCompleted });
    await enterCompleted();
    await act(async () => { resolveSave(); });
    // 완료까지 한 번만 저장 호출
    expect(onScanCompleted).toHaveBeenCalledTimes(1);
  });

  it("absoluteScoreUiEnabled=false일 때 점수·강직지수·VAS·자동추천이 렌더링되지 않는다", async () => {
    renderScan();
    await enterCompleted();
    await screen.findByRole("button", { name: "다음 단계로 이동" });

    expect(screen.queryByText("강직지수")).toBeNull();
    expect(screen.queryByText("VAS")).toBeNull();
    expect(screen.queryByText(/Finger Score/i)).toBeNull();
    expect(screen.queryByText(/관찰:/)).toBeNull(); // buildRecommendation 자동추천 문구
    // 대신 관찰값 + 비진단 문구가 보인다
    expect(screen.getByText(/끝마디\(DIP\) 관찰/)).toBeInTheDocument();
    expect(screen.getByText(/질환 진단이나 악화 여부를 의미하지 않습니다/)).toBeInTheDocument();
  });

  it("absoluteScoreUiEnabled=true(내부 flag)일 때만 레거시 점수 뷰가 보인다", async () => {
    mockFlags.absoluteScoreUiEnabled = true;
    renderScan();
    await enterCompleted();
    await screen.findByRole("button", { name: "다음 단계로 이동" });
    expect(screen.getByText("강직지수")).toBeInTheDocument();
    expect(screen.getByText("VAS")).toBeInTheDocument();
  });

  it("완료 화면 진입 시 scan_result_viewed를 기록한다", async () => {
    renderScan();
    await enterCompleted();
    await screen.findByRole("button", { name: "다음 단계로 이동" });
    expect(trackKpiEvent).toHaveBeenCalledWith("scan_result_viewed", "u1");
  });
});

describe("MotionScanPage captureMode(RC1.2 각도 관찰) — production 기본", () => {
  it("완료 화면에 점수·강직지수·VAS·자동추천·DEBUG가 없고, 사용 손·관찰 각도만 보인다", async () => {
    renderCapture();
    await enterCompleted();
    await screen.findByRole("button", { name: "다음 단계로 이동" });
    // 금지 항목 0건
    expect(screen.queryByText("강직지수")).toBeNull();
    expect(screen.queryByText("VAS")).toBeNull();
    expect(screen.queryByText(/Finger Score/i)).toBeNull();
    expect(screen.queryByText(/관찰:/)).toBeNull();
    // DEBUG 토글은 촬영(scanning) 화면에만 있고 완료 화면에는 없다.
    expect(screen.queryByText("DEBUG")).toBeNull();
    // 관찰값 + 사용 손 + 품질 문구
    expect(screen.getByText(/끝마디\(DIP\) 관찰/)).toBeInTheDocument();
    expect(screen.getByText("사용 손")).toBeInTheDocument();
    expect(screen.getByText("오른손")).toBeInTheDocument();
    // 실제 비교 품질 판정이 없으므로 "비교 가능" 고정표기 없이 "3개 동작 기록 완료"
    expect(screen.getByText("3개 동작 기록 완료")).toBeInTheDocument();
    expect(screen.queryByText(/비교 가능/)).toBeNull();
  });

  it("captureMode는 onScanCompleted(점수 파이프라인)를 호출하지 않고 onAngleMeasured만 호출한다", async () => {
    const onScanCompleted = vi.fn().mockResolvedValue(undefined);
    const onAngleMeasured = vi.fn().mockResolvedValue(undefined);
    renderCapture({ onScanCompleted, onAngleMeasured });
    await enterCompleted();
    await screen.findByRole("button", { name: "다음 단계로 이동" });
    expect(onAngleMeasured).toHaveBeenCalledTimes(1);
    expect(onScanCompleted).not.toHaveBeenCalled();
    // 저장 payload에 점수·rawFrames 계열 필드가 없다.
    const payload = onAngleMeasured.mock.calls[0][0];
    expect(payload.handSide).toBe("right");
    expect(payload.averageObservedRomDeg).toBeGreaterThan(0);
    for (const k of ["scanScores", "metrics", "raw", "recommendation"]) {
      expect(payload[k]).toBeUndefined();
    }
  });

  // P0-14 §11·§15F — 결과 화면이 정면/측면/굽힘으로 분리되고, 실패 측면은 0이 아니라 "관찰 어려움".
  it("결과 화면이 정면·측면·굽힘으로 분리되고 측면 결과가 표시된다", async () => {
    renderCapture();
    await enterCompleted();
    await screen.findByRole("button", { name: "다음 단계로 이동" });
    expect(screen.getByText("정면 끝마디 관찰")).toBeInTheDocument();
    expect(screen.getByText("측면 끝마디 관찰")).toBeInTheDocument();
    expect(screen.getByText("굽힘·활동 범위")).toBeInTheDocument();
    // 측면 결과 카드가 렌더된다.
    expect(screen.getByTestId("side-profile-result")).toBeInTheDocument();
    expect(screen.getByTestId("flexion-range")).toBeInTheDocument();
  });

  it("각도 저장 성공 후에만 '다음 단계로'가 활성화된다", async () => {
    let resolve;
    const onAngleMeasured = vi.fn(() => new Promise((r) => { resolve = r; }));
    renderCapture({ onAngleMeasured });
    await enterCompleted();
    const saving = await screen.findByRole("button", { name: "저장 중입니다" });
    expect(saving).toBeDisabled();
    await act(async () => { resolve(); });
    const next = await screen.findByRole("button", { name: "다음 단계로 이동" });
    expect(next).not.toBeDisabled();
  });

  // RC1.2.1 §4 — QA gate를 통과하지 못한 사용자(production 일반 사용자)에게는
  // 각도 시뮬레이션 진입점이 아예 렌더링되지 않는다.
  it("QA gate 미통과 사용자에게는 시뮬레이션 버튼이 0건이다", async () => {
    mockQa.allowed = false;
    renderCapture();
    expect(await screen.findByText("관찰 기록 시작")).toBeInTheDocument();
    expect(screen.queryByText("시뮬레이션으로 건너뛰기")).toBeNull();
    expect(screen.queryByText("DEBUG")).toBeNull();
  });
});
