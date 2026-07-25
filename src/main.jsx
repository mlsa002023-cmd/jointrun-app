import React from "react";
import ReactDOM from "react-dom/client";
import { registerServiceWorker } from "./registerServiceWorker.js";
import { initAnalytics } from "./lib/analytics.js";
import "./index.css";

const root = ReactDOM.createRoot(document.getElementById("root"));

// RC1.2.2 P0-2 — App.jsx 트리 안에서 렌더링 중 던져진 오류를 잡아 흰 화면 대신
// 진단 코드가 보이는 화면을 띄운다. 비밀값·원문 stack은 사용자에게 노출하지 않는다.
class BootErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error("[Bootstrap] React 렌더링 오류:", error, info);
  }

  render() {
    if (this.state.hasError) return <BootFailure code="render_error" />;
    return this.props.children;
  }
}

function BootFailure({ code }) {
  return (
    <div
      style={{
        minHeight: "100vh", display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", background: "#f8fafc",
        padding: 24, textAlign: "center", fontFamily: "-apple-system,BlinkMacSystemFont,'Noto Sans KR',sans-serif",
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

// RC1.2.2 P0-2 — 페이지 어디서든 잡히지 않은 오류를 콘솔에 남겨 원격 디버깅 시
// (vercel curl로도 볼 수 없는) 실기기 실패 원인을 나중에라도 추적할 단서로 삼는다.
window.addEventListener("error", (event) => {
  console.error("[Bootstrap] window error:", event.error || event.message);
});
window.addEventListener("unhandledrejection", (event) => {
  console.error("[Bootstrap] unhandled rejection:", event.reason);
});

// RC1.2.2 P0-2 — App.jsx를 동적 import해서, import 자체가 실패해도(네트워크·번들
// 문제 등) 흰 화면 대신 안내 화면을 보여준다.
import("./App.jsx")
  .then(({ default: JOINTRUNApp }) => {
    root.render(
      <React.StrictMode>
        <BootErrorBoundary>
          <JOINTRUNApp />
        </BootErrorBoundary>
      </React.StrictMode>
    );
    registerServiceWorker();
    initAnalytics();
  })
  .catch((err) => {
    console.error("[Bootstrap] App.jsx import 실패:", err);
    root.render(<BootFailure code="app_import_failed" />);
  });
