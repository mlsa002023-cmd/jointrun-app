// public/service-worker.js
// JOINTRUN PWA 서비스 워커
// - 앱 셸(정적 자산)은 캐시 우선(cache-first)
// - Firebase/Anthropic API 등 네트워크 요청은 네트워크 우선(network-first), 실패 시 캐시 폴백
// - 네비게이션 요청 오프라인 시 캐시된 index.html 로 폴백

// __CACHE_VERSION__은 `npm run build`가 scripts/stamp-sw-version.js를 통해 배포마다
// 고유한 값으로 치환한다(dist/service-worker.js에서만). public/ 원본은 그대로 두고,
// `npm run dev`에서는 서비스 워커 자체를 등록하지 않으므로(registerServiceWorker.js)
// 이 플레이스홀더가 실제로 브라우저에 로드될 일은 없다.
const CACHE_VERSION = "__CACHE_VERSION__";
const APP_SHELL_CACHE = `${CACHE_VERSION}-shell`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

const APP_SHELL_URLS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

// 캐싱을 건너뛸 대상: Firebase Auth/Firestore, Anthropic API, MediaPipe 모델(용량이 커서 브라우저 HTTP 캐시에 맡김)
const NEVER_CACHE_PATTERNS = [
  /firestore\.googleapis\.com/,
  /identitytoolkit\.googleapis\.com/,
  /securetoken\.googleapis\.com/,
  /api\.anthropic\.com/,
  /storage\.googleapis\.com\/mediapipe-models/,
  /cdn\.jsdelivr\.net/,
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(APP_SHELL_CACHE).then((cache) => cache.addAll(APP_SHELL_URLS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith("jointrun-") && key !== APP_SHELL_CACHE && key !== RUNTIME_CACHE)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return; // 쓰기 요청(Firestore write 등)은 그대로 네트워크로 통과

  const url = new URL(request.url);

  // Firebase / API / MediaPipe 요청은 서비스 워커가 개입하지 않고 네트워크로 직행
  if (NEVER_CACHE_PATTERNS.some((re) => re.test(url.href))) {
    return;
  }

  // 페이지 네비게이션: 네트워크 우선, 실패 시 캐시된 index.html
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match("/index.html"))
    );
    return;
  }

  // 그 외 정적 자산: 캐시 우선, 없으면 네트워크 후 런타임 캐시에 저장
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((response) => {
          if (response.ok && url.origin === self.location.origin) {
            const clone = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => cached);
    })
  );
});
