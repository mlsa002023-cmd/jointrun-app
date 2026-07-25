import React from "react";
import ReactDOM from "react-dom/client";
// RC1.2.2 P0-3 — App은 정적 import다. 예전에는 dynamic import를 썼는데, 그러면 로그인
// 화면을 띄우는 데 별도 chunk를 한 번 더 받아와야 하고, 그 요청이나 평가가 실패하면
// 원인을 구분할 수 없는 app_import_failed 하나로 뭉뚱그려졌다. 정적 import + 단일 청크로
// 첫 화면에 필요한 네트워크 왕복을 없앤다. MediaPipe만 카메라 진입 시점에 lazy-load한다.
import JOINTRUNApp from "./App.jsx";
import { registerServiceWorker } from "./registerServiceWorker.js";
import { initAnalytics } from "./lib/analytics.js";
import "./index.css";

// RC1.2.2 P0-3 — 사용자 화면에는 원문 stack·비밀값 없이 이 코드들만 보여준다.
const DIAG = {
  RENDER: "render_error",
  EVAL: "app_module_evaluation_failed",
};

function BootFailure({ code }) {
  return (
    <div
      style={{
        minHeight: "100vh", display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", background: "#f8fafc",
        padding: 24, textAlign: "center",
        fontFamily: "-apple-system,BlinkMacSystemFont,'Noto Sans KR',sans-serif",
      }}
    >
      <p style={{ fontSize: 16, fontWeight: 600, color: "#0f172a", marginBottom: 8 }}>
        앱을 불러오지 못했습니다
      </p>
      <p style={{ fontSize: 13, color: "#94a3b8", marginBottom: 20 }}>진단 코드: {code}</p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        style={{
          padding: "10px 24px", borderRadius: 8, background: "#2563eb", color: "white",
          border: "none", fontSize: 14, fontWeight: 600, cursor: "pointer",
        }}
      >
        새로고침
      </button>
    </div>
  );
}

class BootErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    // 개발 로그에도 name과 정리된 message만 남긴다(stack 원문·설정값 미포함).
    console.error("[Bootstrap] 렌더링 오류:", error?.name, safeMessage(error));
  }

  render() {
    if (this.state.hasError) return <BootFailure code={DIAG.RENDER} />;
    return this.props.children;
  }
}

/** 오류 message에서 로그로 남겨도 안전한 만큼만 잘라낸다. */
function safeMessage(error) {
  const raw = typeof error?.message === "string" ? error.message : "";
  return raw.slice(0, 120);
}

window.addEventListener("error", (event) => {
  console.error("[Bootstrap] window error:", event.error?.name || "Error", safeMessage(event.error));
});
window.addEventListener("unhandledrejection", (event) => {
  console.error("[Bootstrap] unhandled rejection:", safeMessage(event.reason));
});

const root = ReactDOM.createRoot(document.getElementById("root"));

try {
  // 이 시점에 index.html의 watchdog을 해제한다 — main 모듈이 실행됐다는 뜻이므로
  // bootstrap_timeout 화면이 나중에 덮어쓰지 않게 한다.
  window.__JOINTRUN_BOOTED__ = true;

  root.render(
    <React.StrictMode>
      <BootErrorBoundary>
        <JOINTRUNApp />
      </BootErrorBoundary>
    </React.StrictMode>
  );
  registerServiceWorker();
  initAnalytics();
} catch (err) {
  console.error("[Bootstrap] 초기 렌더링 실패:", err?.name, safeMessage(err));
  root.render(<BootFailure code={DIAG.EVAL} />);
}
