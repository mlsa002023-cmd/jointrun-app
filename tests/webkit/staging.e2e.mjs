// tests/webkit/staging.e2e.mjs
// RC1.2.2 P0-5 — Firebase Hosting Staging(https://jointrun-staging.web.app) 실배포 E2E.
// WebKit(Safari 엔진)과 Chromium 양쪽에서 로그인 화면·같은 출처 인증 경로·SW 미등록을 확인한다.
//
// 실행: npm run test:staging
//   (사전: npm i --no-save playwright && npx playwright install webkit chromium)
let webkit, chromium;
try {
  ({ webkit, chromium } = await import("playwright"));
} catch {
  console.error("playwright 미설치. `npm i --no-save playwright && npx playwright install webkit chromium`");
  process.exit(1);
}

// RC1.2.2 P0-6 — UAT 기본 주소는 firebaseapp.com이다. 앱과 인증 도우미(/__/auth/*)가
// 같은 출처가 되어 Safari/WebKit의 교차 출처 저장소 제한을 받지 않는다.
const BASE = process.env.STAGING_URL || "https://jointrun-staging.firebaseapp.com";
const EXPECTED_SHA = process.env.EXPECTED_SHA || "";
let failures = 0;
function check(name, ok, detail = "") {
  console.log(`  ${ok ? "ok" : "FAIL"} — ${name}${ok || !detail ? "" : ` :: ${detail}`}`);
  if (!ok) failures += 1;
}

async function run(engine, name) {
  console.log(`\n${name}`);
  const browser = await engine.launch();
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent:
      name === "WebKit (iPhone Safari)"
        ? "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
        : undefined,
  });
  const page = await ctx.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  const requests = [];

  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
  page.on("pageerror", (e) => pageErrors.push(`${e.name}: ${e.message}`));
  page.on("request", (r) => requests.push(r.url()));

  await page.goto(BASE, { waitUntil: "load", timeout: 45000 }).catch((e) => console.log("goto:", e.message));
  await page.waitForTimeout(6000);

  const body = (await page.evaluate(() => document.body.innerText.trim())) || "";
  check("로그인 화면이 렌더링된다", /로그인|회원가입/.test(body), body.slice(0, 60));
  check("백색 화면이 아니다", body.length > 0);
  check("부팅 진단 코드가 없다", !/app_import_failed|firebase_init_failed|bootstrap_timeout/.test(body), body.slice(0, 60));
  check("pageerror 0건", pageErrors.length === 0, pageErrors.join(" | "));
  check("console error 0건", consoleErrors.length === 0, consoleErrors.join(" | "));

  // Staging UAT에서는 SW를 등록하지 않는다.
  const swCount = await page.evaluate(() =>
    navigator.serviceWorker ? navigator.serviceWorker.getRegistrations().then((r) => r.length) : 0
  );
  check("service worker 등록 0건", swCount === 0, `등록 ${swCount}건`);

  // 로그인 화면에서는 카메라 모델을 불러오지 않는다.
  check("MediaPipe 요청 0건", !requests.some((u) => /vision_bundle|tasks-vision|mediapipe/i.test(u)));

  // 앱이 참조하는 Firebase 프로젝트가 staging인지, 운영 식별자가 섞이지 않았는지.
  const cfg = await page.evaluate(async () => {
    const res = await fetch("/__/firebase/init.json");
    return res.ok ? await res.json() : null;
  });
  check("같은 출처 /__/firebase/init.json 응답", Boolean(cfg));

  // 배포된 번들이 기대한 커밋인지(미커밋 코드로 배포되지 않았는지) 화면에서 확인한다.
  const shaText = await page.locator("[data-testid=build-sha]").first().textContent().catch(() => "");
  check("배포 SHA가 화면에 표시된다", Boolean(shaText && shaText.trim()), String(shaText));
  check("미커밋(dirty) 빌드가 아니다", !String(shaText).includes("-dirty"), String(shaText));
  if (EXPECTED_SHA) {
    check(`배포 SHA가 ${EXPECTED_SHA}`, String(shaText).includes(EXPECTED_SHA), String(shaText));
  }
  check("projectId가 jointrun-staging", cfg?.projectId === "jointrun-staging", String(cfg?.projectId));

  // 같은 출처 인증 핸들러/iframe이 살아있어야 popup·redirect가 완료된다.
  for (const p of ["/__/auth/handler", "/__/auth/iframe"]) {
    const r = await page.evaluate(async (path) => {
      const res = await fetch(path);
      return { status: res.status, type: res.headers.get("content-type") };
    }, p);
    check(`${p} 200 (같은 출처)`, r.status === 200, `status=${r.status}`);
  }

  // Google 로그인 버튼이 실제로 인증 흐름을 시작하는지(계정 선택 화면까지) 확인한다.
  const googleBtn = page.getByText("Google로 계속하기");
  if (await googleBtn.count()) {
    const before = page.url();
    await googleBtn.first().click().catch(() => {});
    await page.waitForTimeout(6000);
    const after = page.url();
    const started = after !== before || /accounts\.google\.com|__\/auth/.test(after);
    check("Google 로그인 클릭 시 인증 흐름이 시작된다(조용히 실패하지 않음)", started, `url=${after.slice(0, 70)}`);
    check("Google 계정 화면에 도달한다(redirect_uri_mismatch 없음)",
      /accounts\.google\.com/.test(after) && !/authError|error/.test(after), `url=${after.slice(0, 90)}`);
    if (name.startsWith("WebKit")) {
      // 같은 탭 전체 이동 = signInWithRedirect 경로. popup이었다면 원래 URL에 머문다.
      check("WebKit은 redirect 방식(같은 탭 이동)을 사용한다", after !== before, `url=${after.slice(0, 70)}`);
    }
  } else {
    check("Google 로그인 버튼 존재", false);
  }

  await browser.close();
}

await run(webkit, "WebKit (iPhone Safari)");
await run(chromium, "Chromium (데스크톱)");

console.log(`\n${failures === 0 ? "Staging E2E 전부 통과" : `${failures}건 실패`}`);
process.exit(failures === 0 ? 0 : 1);
