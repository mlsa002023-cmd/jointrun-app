
rules_version = '2';

// Firebase 콘솔 > Firestore Database > 규칙 탭에 붙여넣으세요.
service cloud.firestore {
  match /databases/{database}/documents {

    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;

      match /scans/{scanId} {
        allow read, create: if request.auth != null && request.auth.uid == userId;
        allow update, delete: if false; // 스캔 기록은 수정/삭제 불가 (데이터 무결성)
      }

      match /checkins/{checkinId} {
        allow read, create: if request.auth != null && request.auth.uid == userId;
        allow update, delete: if false;
      }

      match /profile/{docId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }
  }
}

<!doctype html>
<html lang="ko-KR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover, maximum-scale=1.0, user-scalable=no" />
    <title>JOINTRUN - 손가락 관절 건강 플랫폼</title>
    <meta name="description" content="5년을 막는 일. MediaPipe 기반 손가락 관절 가동 범위 측정과 AI 코칭으로 관절 변형을 조기에 예방합니다." />

    <!-- PWA -->
    <link rel="manifest" href="/manifest.json" />
    <meta name="theme-color" content="#0f172a" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="JOINTRUN" />
    <link rel="apple-touch-icon" href="/icons/icon-180.png" />
    <link rel="icon" type="image/png" sizes="32x32" href="/icons/icon-32.png" />
    <link rel="icon" type="image/png" sizes="16x16" href="/icons/icon-16.png" />

    <!-- iOS 카메라 스캔 화면 회전 방지 등에 도움 -->
    <meta name="format-detection" content="telephone=no" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>

{
  "name": "jointrun",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "firebase": "10.14.1",
    "lucide-react": "0.383.0",
    "react": "18.3.1",
    "react-dom": "18.3.1",
    "recharts": "2.12.7"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "4.3.4",
    "autoprefixer": "10.4.20",
    "postcss": "8.4.49",
    "tailwindcss": "3.4.15",
    "vite": "5.4.11"
  }
}

export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};

# JOINTRUN v1.0 — 배포 버전

MediaPipe 기반 손 스캔 엔진 + Anthropic AI 코치 + Firebase Auth/Firestore + PWA가 통합된
Vite/React 프로젝트입니다. 베타테스트를 시작할 수 있는 수준으로 구성되어 있습니다.

## 폴더 구조
```
jointrun/
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── vercel.json
├── index.html
├── .env.example
├── firestore.rules
├── public/
│   ├── manifest.json
│   ├── service-worker.js
│   └── icons/               ← 업로드하신 아이콘에서 생성된 16~512px + maskable
└── src/
    ├── main.jsx              ← 엔트리 포인트
    ├── index.css             ← Tailwind + 모바일 최적화 CSS
    ├── JOINTRUN_UNIFIED.jsx  ← 메인 앱 (로그인 게이트 포함)
    ├── registerServiceWorker.js
    ├── firebase/config.js
    ├── contexts/AuthContext.jsx
    ├── components/AuthScreen.jsx   ← 이메일 + Google 로그인
    └── lib/
        ├── firestore.js      ← 스캔/체크인/프로필 저장·조회
        └── analytics.js      ← GA4 + Microsoft Clarity
```

## 1. 설치
```bash
cd jointrun
npm install
```

## 2. Firebase 프로젝트 설정
1. https://console.firebase.google.com → 프로젝트 추가 → **JOINTRUN**
2. **Authentication → Sign-in method**에서 아래 둘 다 활성화
   - 이메일/비밀번호
   - Google (프로젝트 지원 이메일 지정 필요)
3. **Firestore Database** → 데이터베이스 만들기 → 프로덕션 모드, 리전은 `asia-northeast3`(서울) 권장
4. Firestore 규칙 탭에 `firestore.rules` 내용 붙여넣고 게시
5. 프로젝트 설정 → 일반 → "웹 앱 추가" → SDK 설정값 확인
6. Google 로그인을 쓰려면 **승인된 도메인**에 배포할 Vercel 도메인(예: `jointrun.vercel.app`)을 추가해야 합니다 (Authentication → Settings → 승인된 도메인)

## 3. 환경변수 설정
```bash
cp .env.example .env
```
`.env`에 Firebase 값을 채워 넣으세요. GA/Clarity는 선택 사항입니다.

- Google Analytics: https://analytics.google.com 에서 GA4 속성 생성 → 측정 ID(`G-XXXXXXXXXX`) 발급
- Microsoft Clarity: https://clarity.microsoft.com 에서 프로젝트 생성 → 프로젝트 ID 발급

## 4. 로컬 개발
```bash
npm run dev
```
`http://localhost:5173` 접속. 카메라 스캔 기능은 `localhost`에서는 HTTP여도 동작하지만,
실기기 테스트 시에는 HTTPS가 필요합니다(Vercel 배포 후 확인 권장).

## 5. 빌드 & Vercel 배포
```bash
npm run build
```
### Vercel 배포 절차
1. https://vercel.com → New Project → 이 저장소(또는 폴더) import
2. Framework Preset: **Vite** 자동 인식
3. Build Command: `npm run build`, Output Directory: `dist` (자동 인식됨)
4. **Environment Variables**에 `.env`의 모든 `VITE_*` 값을 동일하게 등록
5. Deploy — Vercel은 기본적으로 모든 배포에 **HTTPS**를 자동 적용합니다
6. 배포 완료 후 발급된 도메인을 Firebase Authentication의 승인된 도메인에 추가

`vercel.json`에 SPA 라우팅, 정적 자산 장기 캐시, 서비스 워커 무캐시, 기본 보안 헤더가 이미 설정되어 있습니다.

## 6. PWA 홈 화면 설치 확인
- **Android/Chrome**: 배포된 사이트 접속 → 주소창 옆 "설치" 아이콘 또는 메뉴 → "홈 화면에 추가"
- **iOS/Safari**: 공유 버튼 → "홈 화면에 추가" (Safari는 커스텀 설치 프롬프트를 지원하지 않아 수동 안내 필요)
- 설치 후 standalone 모드로 실행되며, 상태 표시줄 색상은 `#0f172a`(네이비)로 표시됩니다

## 7. 오프라인 캐시 동작
`public/service-worker.js`가 앱 셸(정적 자산)은 캐시 우선, Firebase/Anthropic API/MediaPipe 모델 요청은
항상 네트워크로 직행하도록 구성되어 있습니다. 오프라인 상태에서 접속하면 캐시된 `index.html`로 폴백됩니다.
스캔·체크인 등 실데이터는 오프라인에서 저장되지 않으니, 완전 오프라인 큐잉이 필요하면 별도 요청해 주세요.

## 8. 데이터 흐름 요약
| 이벤트 | 저장 위치 |
|---|---|
| 회원가입(이메일/Google) | `users/{uid}` |
| 정밀 스캔 완료 | `users/{uid}/scans/{scanId}` + `users/{uid}/profile/current` 갱신 |
| 회복 스텝(체크인) 완료 | `users/{uid}/checkins/{checkinId}` |
| 재로그인 | `users/{uid}/profile/current` 를 불러와 Finger Score 등 자동 복원 |

## 9. 베타테스트 전 체크리스트
- [ ] Firebase Authentication에 이메일/Google 로그인 방식 모두 켜져 있는지
- [ ] Firestore 규칙이 게시되어 본인 데이터만 읽고 쓸 수 있는지
- [ ] Vercel 환경변수에 `VITE_FIREBASE_*` 값이 모두 등록되었는지
- [ ] Google 로그인용 승인된 도메인에 실제 배포 도메인이 등록되었는지
- [ ] 크롬 개발자도구 → Application 탭에서 Manifest/Service Worker가 정상 인식되는지
- [ ] 모바일 실기기에서 카메라 권한 요청 및 스캔이 정상 동작하는지 (HTTPS 필요)
- [ ] GA4/Clarity 실시간 리포트에 접속 이벤트가 잡히는지

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {},
  },
  plugins: [],
};

{
  "rewrites": [
    { "source": "/((?!icons|manifest.json|service-worker.js|assets).*)", "destination": "/index.html" }
  ],
  "headers": [
    {
      "source": "/service-worker.js",
      "headers": [
        { "key": "Cache-Control", "value": "no-cache, no-store, must-revalidate" }
      ]
    },
    {
      "source": "/manifest.json",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=3600" }
      ]
    },
    {
      "source": "/icons/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
      ]
    },
    {
      "source": "/assets/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
      ]
    },
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Permissions-Policy", "value": "camera=(self), microphone=()" }
      ]
    }
  ]
}

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
  },
  preview: {
    port: 4173,
    host: true,
  },
  build: {
    outDir: "dist",
    sourcemap: false,
  },
});
