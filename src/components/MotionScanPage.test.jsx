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
vi.mock("../config/featureFlags", () => ({
  FEATURE_FLAGS: mockFlags,
  MOCK_CAPTURE_ENABLED: false,
  shouldShowQaTools: () => false,
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

// dev 전용 "시뮬레이션으로 건너뛰기"로 완료 화면에 진입한다.
async function enterCompleted() {
  const simBtn = await screen.findByText("시뮬레이션으로 건너뛰기");
  await act(async () => { fireEvent.click(simBtn); });
}

beforeEach(() => {
  trackKpiEvent.mockClear();
  mockFlags.absoluteScoreUiEnabled = false;
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
    expect(screen.getByText("관찰된 손가락 각도")).toBeInTheDocument(); // 결과 화면 유지
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
    expect(screen.getByText("관찰된 손가락 각도")).toBeInTheDocument();
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
