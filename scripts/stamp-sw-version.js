#!/usr/bin/env node
// scripts/stamp-sw-version.js — `npm run build` 직후 실행.
//
// public/service-worker.js의 CACHE_VERSION은 소스에서 "__CACHE_VERSION__" 플레이스홀더로
// 남겨두고, 여기서 빌드마다 고유한 값(빌드 시각)으로 치환해 dist/service-worker.js에만 새겨넣는다.
// service-worker.js의 activate 핸들러가 "현재 CACHE_VERSION과 다른 jointrun-* 캐시"를 전부
// 지우므로, 배포할 때마다 버전이 달라지면 이전 배포의 캐시가 자동으로 무효화된다 —
// 실배포 확인 시 이전 빌드가 캐시에 남아 헷갈리는 문제를 막기 위함.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const swPath = fileURLToPath(new URL("../dist/service-worker.js", import.meta.url));

if (!existsSync(swPath)) {
  console.error(`stamp-sw-version: ${swPath} 없음 — vite build가 먼저 실행됐는지 확인하세요.`);
  process.exit(1);
}

// 사람이 읽기 쉬운 형태(devtools > Application > Cache Storage에서 바로 어느 배포인지 식별 가능).
const version = `jointrun-${new Date().toISOString().replace(/[:.]/g, "-")}`;

// 따옴표까지 포함해서 매칭 — 파일 상단 설명 주석에도 "__CACHE_VERSION__"이라는 단어가
// 나오는데, 그건 건드리면 안 되고 실제 대입문(`CACHE_VERSION = "__CACHE_VERSION__"`)만 바꿔야 한다.
const placeholder = `"__CACHE_VERSION__"`;
const content = readFileSync(swPath, "utf-8");
if (!content.includes(placeholder)) {
  console.error(`stamp-sw-version: ${placeholder} 플레이스홀더를 찾지 못했습니다.`);
  process.exit(1);
}

writeFileSync(swPath, content.replace(placeholder, `"${version}"`));
console.log(`stamp-sw-version: CACHE_VERSION → ${version}`);
