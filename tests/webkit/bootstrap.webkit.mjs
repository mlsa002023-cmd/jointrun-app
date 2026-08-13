// tests/webkit/bootstrap.webkit.mjs
// RC1.2.2 P0-3 — WebKit(실기기 Safari 엔진) 부팅 회귀 테스트.
//
// 왜 필요한가: 실기기에서 백색 화면(app_import_failed)이 났을 때 Chromium과 jsdom
// 단위 테스트는 모두 통과하고 있었다. 원인은 Firebase 초기화가 모듈 최상위에서 throw되어
// App 모듈 evaluation 전체가 실패한 것이었고, 이건 실제 브라우저 엔진으로 production
// 번들을 열어봐야만 드러난다.
//
// 실행: npm run test:webkit
//
// playwright는 devDependencies에 넣지 않았다 — 설치 시 브라우저 바이너리를 내려받아
// Vercel 빌드가 느려지고 불안정해지기 때문이다. 이 테스트를 돌릴 때만 로컬에 설치한다:
//   npm i --no-save playwright && npx playwright install webkit
let webkit;
try {
  ({ webkit } = await import("playwright"));
} catch {
  console.error(
    "playwright가 설치돼 있지 않습니다. 아래를 먼저 실행하세요:\n" +
    "  npm i --no-save playwright && npx playwright install webkit"
  );
  process.exit(1);
}
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, extname } from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = new URL("../../", import.meta.url).pathname;
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

let failures = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "  ok" : "  FAIL"} — ${name}${ok || !detail ? "" : ` :: ${detail}`}`);
  if (!ok) failures += 1;
}

/** dist 디렉터리를 정적으로 서빙한다. missingEntry면 엔트리 JS를 404로 만들어 watchdog을 검증한다. */
function serve(dir, { missingEntry = false } = {}) {
  const server = createServer(async (req, res) => {
    const path = decodeURIComponent((req.url || "/").split("?")[0]);
    if (missingEntry && path.startsWith("/assets/") && path.endsWith(".js")) {
      res.writeHead(404).end("not found");
      return;
    }
    const file = path === "/" ? "index.html" : path.replace(/^\//, "");
    const full = join(dir, file);
    if (!existsSync(full)) {
      res.writeHead(404).end("not found");
      return;
    }
    res.writeHead(200, { "content-type": MIME[extname(full)] || "application/octet-stream" });
    res.end(await readFile(full));
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve({ server, port: server.address().port }));
  });
}

/** 주어진 환경변수로 production 빌드를 만든다. */
function buildWith(env, outDir) {
  execFileSync("npx", ["vite", "build", "--outDir", outDir, "--emptyOutDir"], {
    cwd: ROOT,
    env: { ...process.env, ...env },
    stdio: "pipe",
  });
}

/** 페이지를 열고 수집한 진단 정보를 돌려준다. */
async function open(browser, url, { waitMs = 3500 } = {}) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 " +
      "(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  const requests = [];
  let navigations = 0;

  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
  page.on("pageerror", (e) => pageErrors.push(`${e.name}: ${e.message}`));
  page.on("request", (r) => requests.push(r.url()));
  page.on("framenavigated", (f) => { if (f === page.mainFrame()) navigations += 1; });

  await page.goto(url, { waitUntil: "load", timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(waitMs);
  const text = (await page.evaluate(() => document.body.innerText.trim())) || "";
  await context.close();
  return { text, consoleErrors, pageErrors, requests, navigations };
}

const browser = await webkit.launch();
console.log(`WebKit ${browser.version()}\n`);

// ── 1) 정상 설정: 로그인 화면이 뜨고 오류가 없어야 한다 ──
console.log("정상 Firebase 설정");
{
  const dir = join(ROOT, "dist-webkit-ok");
  buildWith({
    VITE_FIREBASE_API_KEY: "AIzaSyDummyKeyForWebkitRegression0000000",
    VITE_FIREBASE_AUTH_DOMAIN: "example.firebaseapp.com",
    VITE_FIREBASE_PROJECT_ID: "webkit-regression",
    VITE_FIREBASE_STORAGE_BUCKET: "webkit-regression.appspot.com",
    VITE_FIREBASE_MESSAGING_SENDER_ID: "000000000000",
    VITE_FIREBASE_APP_ID: "1:000000000000:web:0000000000000000000000",
    VITE_SERVICE_WORKER_ENABLED: "false",
  }, dir);
  const { server, port } = await serve(dir);
  const r = await open(browser, `http://127.0.0.1:${port}/`);

  check("로그인 화면이 렌더링된다", /로그인|회원가입/.test(r.text), r.text.slice(0, 80));
  check("백색 화면이 아니다", r.text.length > 0);
  check("app import 실패가 없다", !/app_import_failed|app_chunk|app_module_evaluation/.test(r.text));
  check("페이지 오류 0건", r.pageErrors.length === 0, r.pageErrors.join(" | "));
  // 더미 프로젝트라 identitytoolkit 400 같은 네트워크 오류는 필연이다. 부팅 경로에서
  // 나온 오류(=회귀 신호)만 0건이어야 한다.
  const bootErrors = r.consoleErrors.filter((t) => /\[Bootstrap\]|\[Firebase\]|\[Auth\]/.test(t));
  check("부팅 관련 console error 0건", bootErrors.length === 0, bootErrors.join(" | "));
  check(
    "로그인 화면에서 MediaPipe를 요청하지 않는다",
    !r.requests.some((u) => /vision_bundle|tasks-vision|mediapipe/i.test(u))
  );
  server.close();
}

// ── 2) 잘못된 apiKey(실기기 장애 재현): 흰 화면이 아니라 명확한 오류 화면 ──
console.log("\n잘못된 Firebase apiKey (실기기 장애 재현 케이스)");
{
  const dir = join(ROOT, "dist-webkit-badkey");
  buildWith({
    // 실제 장애와 동일한 형태 — apiKey 자리에 App ID 형식의 값이 들어간 경우.
    VITE_FIREBASE_API_KEY: "1:000000000000:web:0000000000000000000000",
    VITE_FIREBASE_AUTH_DOMAIN: "example.firebaseapp.com",
    VITE_FIREBASE_PROJECT_ID: "webkit-regression",
    VITE_FIREBASE_STORAGE_BUCKET: "webkit-regression.appspot.com",
    VITE_FIREBASE_MESSAGING_SENDER_ID: "000000000000",
    VITE_FIREBASE_APP_ID: "1:000000000000:web:0000000000000000000000",
    VITE_SERVICE_WORKER_ENABLED: "false",
  }, dir);
  const { server, port } = await serve(dir);
  const r = await open(browser, `http://127.0.0.1:${port}/`);

  check("백색 화면이 아니다", r.text.length > 0, "(빈 화면)");
  check("firebase_init_failed 진단 코드가 보인다", r.text.includes("firebase_init_failed"), r.text.slice(0, 80));
  check("재시도 버튼이 있다", r.text.includes("재시도"));
  check("app_import_failed로 뭉뚱그리지 않는다", !r.text.includes("app_import_failed"));
  server.close();
}

// ── 3) 엔트리 JS를 못 받는 경우: watchdog이 bootstrap_timeout을 띄우고 자동 복구는 1회만 ──
console.log("\n엔트리 JS 404 (watchdog)");
{
  const dir = join(ROOT, "dist-webkit-ok");
  const { server, port } = await serve(dir, { missingEntry: true });
  // 8초 watchdog → 자동 복구 1회(reload) → 다시 8초 후 오류 화면. 그 뒤까지 기다린다.
  const r = await open(browser, `http://127.0.0.1:${port}/`, { waitMs: 21000 });

  check("백색 화면이 아니다", r.text.length > 0, "(빈 화면)");
  check(
    "부팅 실패 안내가 보인다",
    /앱 초기화를 완료하지 못했습니다|앱을 불러오지 못했습니다/.test(r.text),
    r.text.slice(0, 80)
  );
  check("진단 코드가 표시된다", /진단 코드:/.test(r.text), r.text.slice(0, 80));
  check("자동 새로고침은 최대 1회(무한 루프 없음)", r.navigations <= 3, `navigations=${r.navigations}`);
  server.close();
}

await browser.close();
console.log(`\n${failures === 0 ? "모든 WebKit 회귀 검사 통과" : `${failures}건 실패`}`);
process.exit(failures === 0 ? 0 : 1);
