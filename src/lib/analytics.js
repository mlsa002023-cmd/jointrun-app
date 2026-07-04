// src/lib/analytics.js
// Google Analytics(GA4) + Microsoft Clarity를 런타임에 스크립트 삽입 방식으로 로드합니다.
// .env 에 VITE_GA_MEASUREMENT_ID / VITE_CLARITY_PROJECT_ID 가 설정된 경우에만 로드됩니다.
// 개인정보 보호를 위해 로그인 이메일 등 PII는 절대 이벤트로 전송하지 마세요.

export function initAnalytics() {
  initGoogleAnalytics();
  initClarity();
}

function initGoogleAnalytics() {
  const id = import.meta.env.VITE_GA_MEASUREMENT_ID;
  if (!id || document.getElementById("ga4-script")) return;

  const script = document.createElement("script");
  script.id = "ga4-script";
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${id}`;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = gtag;
  gtag("js", new Date());
  gtag("config", id, { anonymize_ip: true });
}

function initClarity() {
  const id = import.meta.env.VITE_CLARITY_PROJECT_ID;
  if (!id || window.clarity) return;

  (function (c, l, a, r, i, t, y) {
    c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments); };
    t = l.createElement(r); t.async = 1; t.src = "https://www.clarity.ms/tag/" + i;
    y = l.getElementsByTagName(r)[0]; y.parentNode.insertBefore(t, y);
  })(window, document, "clarity", "script", id);
}

// 페이지/탭 전환 등 커스텀 이벤트 전송 헬퍼
export function trackEvent(eventName, params = {}) {
  if (typeof window.gtag === "function") {
    window.gtag("event", eventName, params);
  }
}
