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

// RC1.2.2 P0 — "/"·"/index.html"은 더 이상 앱 셸로 미리 캐싱하지 않는다. 배포마다
// JS 번들 해시가 바뀌는데, 이전 배포 시점의 index.html이 캐시에 남아있으면 그 안의
// 옛 해시 스크립트 경로가 새 배포 서버에는 없어 "Failed to fetch dynamically imported
// module" 백색 화면으로 이어진다(§fetch 네비게이션 핸들러 참고). 이 앱은 로그인 등에
// 어차피 네트워크가 필수라 오프라인 shell 폴백의 실익도 없다.
const APP_SHELL_URLS = [
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

  // RC1.2.2 P0 — 페이지 네비게이션은 항상 네트워크에서 받는다. 캐시된 index.html로
  // 폴백하지 않는다(위 APP_SHELL_URLS 주석 참고 — 옛 배포의 해시 스크립트 경로를
  // 가리키는 index.html을 서빙하면 새 배포 서버에서 그 파일을 못 찾아 백색 화면이 된다).
  if (request.mode === "navigate") {
    event.respondWith(fetch(request));
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
