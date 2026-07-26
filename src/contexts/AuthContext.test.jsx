// AuthContext — RC1.2.2 P0-5 인증 흐름 회귀 테스트.
//
// 핵심 회귀: onAuthStateChanged가 최초 1회(보통 로그인 안 된 상태의 null)만 반영되고
// 그 뒤 로그인 성공 이벤트를 무시하면, Google 계정을 골라 로그인이 실제로 끝나도 앱은
// 로그인 화면에 머문다. 실기기에서 관찰된 증상이 정확히 이것이라 테스트로 고정한다.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";

// ── firebase/auth 목 ──
const authListeners = { next: null, error: null };
let redirectResultValue = null;
let redirectResultError = null;
const popupMock = vi.fn();
const redirectMock = vi.fn();
const setPersistenceMock = vi.fn(() => Promise.resolve());

vi.mock("firebase/auth", () => ({
  onAuthStateChanged: (_auth, next, error) => {
    authListeners.next = next;
    authListeners.error = error;
    return () => { authListeners.next = null; };
  },
  getRedirectResult: () =>
    redirectResultError ? Promise.reject(redirectResultError) : Promise.resolve(redirectResultValue),
  setPersistence: setPersistenceMock,
  browserLocalPersistence: "local",
  signInWithPopup: (...a) => popupMock(...a),
  signInWithRedirect: (...a) => redirectMock(...a),
  signInWithEmailAndPassword: vi.fn(() => Promise.resolve({ user: { uid: "email-user" } })),
  createUserWithEmailAndPassword: vi.fn(() => Promise.resolve({ user: { uid: "new-user" } })),
  signOut: vi.fn(() => Promise.resolve()),
  updateProfile: vi.fn(() => Promise.resolve()),
  sendPasswordResetEmail: vi.fn(() => Promise.resolve()),
  GoogleAuthProvider: class { setCustomParameters() {} },
}));

vi.mock("firebase/firestore", () => ({
  doc: vi.fn(() => ({})),
  setDoc: vi.fn(() => Promise.resolve()),
  getDoc: vi.fn(() => Promise.resolve({ exists: () => true })),
  serverTimestamp: vi.fn(() => "ts"),
}));

vi.mock("../firebase/config", () => ({
  FIREBASE_ENABLED: true,
  db: {},
  initFirebase: () => ({ ok: true, auth: { name: "auth" }, db: {}, error: null }),
  getAuthInstance: () => ({ name: "auth" }),
  isFirestoreReady: () => true,
}));

const { AuthProvider, useAuth, normalizeAuthErrorCode, AUTH_ERROR_MESSAGES } =
  await import("./AuthContext.jsx");

let ctx = null;
function Probe() {
  ctx = useAuth();
  return <div data-testid="uid">{ctx.currentUser ? ctx.currentUser.uid : "none"}</div>;
}

function renderProvider() {
  return render(<AuthProvider><Probe /></AuthProvider>);
}

/** onAuthStateChanged 최초 응답(로그인 안 된 상태)을 흘려보낸다. */
async function emitInitialSignedOut() {
  await act(async () => { authListeners.next(null); });
}

beforeEach(() => {
  ctx = null;
  redirectResultValue = null;
  redirectResultError = null;
  popupMock.mockReset();
  redirectMock.mockReset();
  setPersistenceMock.mockClear();
  window.innerWidth = 1280; // 기본은 데스크톱(popup 우선 경로)
  Object.defineProperty(navigator, "userAgent", {
    value: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
    configurable: true,
  });
});

afterEach(() => { vi.useRealTimers(); });

describe("onAuthStateChanged — 로그인 성공 반영", () => {
  it("최초 null 응답 이후에 오는 로그인 성공 이벤트도 currentUser에 반영한다", async () => {
    renderProvider();
    await emitInitialSignedOut();
    expect(screen.getByTestId("uid").textContent).toBe("none");

    // 로그인 성공(팝업/리다이렉트 어느 쪽이든 SDK는 이 이벤트로 알려준다)
    await act(async () => { authListeners.next({ uid: "google-user" }); });
    expect(screen.getByTestId("uid").textContent).toBe("google-user");
  });

  it("로그인에 성공하면 이전 오류 안내가 지워진다", async () => {
    renderProvider();
    await emitInitialSignedOut();
    await act(async () => { ctx.setAuthError("popup_closed"); });
    expect(ctx.authError).toBe("popup_closed");

    await act(async () => { authListeners.next({ uid: "u1" }); });
    expect(ctx.authError).toBeNull();
  });

  it("로그아웃 이벤트도 반영된다", async () => {
    renderProvider();
    await act(async () => { authListeners.next({ uid: "u1" }); });
    expect(screen.getByTestId("uid").textContent).toBe("u1");
    await act(async () => { authListeners.next(null); });
    expect(screen.getByTestId("uid").textContent).toBe("none");
  });

  it("세션 유지를 위해 browserLocalPersistence를 명시한다", async () => {
    renderProvider();
    await emitInitialSignedOut();
    expect(setPersistenceMock).toHaveBeenCalledWith({ name: "auth" }, "local");
  });
});

describe("Google 로그인 — popup / redirect", () => {
  it("데스크톱에서는 popup을 쓰고 성공하면 redirect로 넘어가지 않는다", async () => {
    popupMock.mockResolvedValue({ user: { uid: "popup-user" } });
    renderProvider();
    await emitInitialSignedOut();

    await act(async () => { await ctx.loginWithGoogle(); });
    expect(popupMock).toHaveBeenCalledTimes(1);
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("모바일/WebKit에서는 처음부터 redirect를 쓴다", async () => {
    Object.defineProperty(navigator, "userAgent", {
      value: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1",
      configurable: true,
    });
    redirectMock.mockResolvedValue(undefined);
    renderProvider();
    await emitInitialSignedOut();

    await act(async () => { await ctx.loginWithGoogle(); });
    expect(redirectMock).toHaveBeenCalledTimes(1);
    expect(popupMock).not.toHaveBeenCalled();
  });

  it("popup 응답이 오지 않으면 타임아웃 후 redirect로 전환한다", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    popupMock.mockReturnValue(new Promise(() => {})); // 영원히 pending
    redirectMock.mockResolvedValue(undefined);
    renderProvider();
    await act(async () => { authListeners.next(null); });

    let pending;
    await act(async () => { pending = ctx.loginWithGoogle(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(21000); });
    await act(async () => { await pending; });

    expect(redirectMock).toHaveBeenCalledTimes(1);
    expect(ctx.authError).toBe("popup_result_timeout");
  });

  it("popup이 차단되면 redirect로 전환한다", async () => {
    popupMock.mockRejectedValue(Object.assign(new Error("blocked"), { code: "auth/popup-blocked" }));
    redirectMock.mockResolvedValue(undefined);
    renderProvider();
    await emitInitialSignedOut();

    await act(async () => { await ctx.loginWithGoogle(); });
    expect(redirectMock).toHaveBeenCalledTimes(1);
    expect(ctx.authError).toBe("popup_blocked");
  });

  it("사용자가 팝업을 닫으면 redirect로 넘어가지 않고 안내만 남긴다", async () => {
    popupMock.mockRejectedValue(Object.assign(new Error("closed"), { code: "auth/popup-closed-by-user" }));
    renderProvider();
    await emitInitialSignedOut();

    await act(async () => { await ctx.loginWithGoogle(); });
    expect(redirectMock).not.toHaveBeenCalled();
    expect(ctx.authError).toBe("popup_closed");
  });

  it("조용히 실패하지 않는다 — 실패하면 항상 오류 코드가 남는다", async () => {
    popupMock.mockRejectedValue(Object.assign(new Error("nope"), { code: "auth/unauthorized-domain" }));
    renderProvider();
    await emitInitialSignedOut();

    await act(async () => { await ctx.loginWithGoogle(); });
    expect(ctx.authError).toBe("unauthorized_domain");
  });
});

describe("getRedirectResult 처리", () => {
  it("redirect 결과의 사용자를 currentUser에 반영한다", async () => {
    redirectResultValue = { user: { uid: "redirect-user" } };
    renderProvider();
    await waitFor(() => expect(screen.getByTestId("uid").textContent).toBe("redirect-user"));
  });

  it("redirect 결과 처리에 실패하면 redirect_result_failed를 남긴다", async () => {
    redirectResultError = Object.assign(new Error("bad"), { code: "auth/internal-error" });
    renderProvider();
    await waitFor(() => expect(ctx.authError).toBe("redirect_result_failed"));
  });
});

describe("이메일/비밀번호 로그인 회귀", () => {
  it("이메일 로그인은 그대로 동작한다", async () => {
    renderProvider();
    await emitInitialSignedOut();
    await act(async () => { await ctx.login("a@b.com", "pw123456"); });
    expect(ctx.authError).toBeNull();
  });

  it("비밀번호 오류는 사용자 문구로 안내한다", () => {
    const code = normalizeAuthErrorCode({ code: "auth/wrong-password" });
    expect(code).toBe("invalid_credentials");
    expect(AUTH_ERROR_MESSAGES[code]).toContain("비밀번호");
  });

  it("오류 문구에 Firebase 원문·코드가 노출되지 않는다", () => {
    Object.values(AUTH_ERROR_MESSAGES).forEach((msg) => {
      expect(msg).not.toMatch(/auth\/|Firebase|apiKey/i);
    });
  });
});
