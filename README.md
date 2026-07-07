# JOINTRUN — Movement Intelligence Platform


AI 기반 근골격계 디지털 헬스케어 플랫폼 -손가락 관절 건강 모니터링 플랫폼.
MediaPipe HandLandmarker + Anthropic AI Coach + Firebase Auth 통합.

## 화이트 화면 수정 내역 (v1.0.1)

수정된 문제 3가지:

1. Firebase 환경변수 없을 때 앱 전체 crash → 데모 모드 폴백으로 해결

2. AuthContext가 Firebase crash에 의존 → 독립적 동작으로 해결

3. Anthropic API 헤더 누락 → `anthropic-dangerous-direct-browser-access` 헤더 추가

---

## 빠른 시작

### 1단계 — 의존성 설치
```bash
npm install
```

### 2단계 — 환경변수 설정
```bash
cp .env.example .env.local
# .env.local 파일을 열어 실제 값 입력
```

### 3단계 — 개발 서버 실행
```bash
npm run dev
```

### 4단계 — 프로덕션 빌드
```bash
npm run build
```

---

## 환경변수 설정 가이드

### Firebase (로그인 기능 — 선택사항)
1. https://console.firebase.google.com 접속
2. 프로젝트 생성 → 웹 앱 추가
3. 프로젝트 설정 → 앱 구성에서 키 복사
4. Authentication → Google 로그인 활성화
5. Firestore Database → 생성

Firebase 없이도 앱은 "데모 모드"로 완전히 동작합니다.

### Anthropic AI Coach (선택사항)
1. https://console.anthropic.com 접속
2. API Keys → Create Key
3. .env.local에 VITE_ANTHROPIC_API_KEY 설정

API 키 없으면 로컬 폴백 응답으로 자동 전환됩니다.

---

## Vercel 배포

```bash
npm install -g vercel
vercel --prod
```

Vercel 대시보드 → Settings → Environment Variables에서
.env.example의 모든 변수를 입력하세요.

---

## 기술 스택

- React 18 + Vite
- Tailwind CSS 3
- Firebase Auth + Firestore
- MediaPipe HandLandmarker (CDN)
- Anthropic claude-sonnet-4-6
- Recharts
- lucide-react
- PWA (manifest + service worker)
<<<<<<< HEAD

---

## 프로젝트 구조

```
src/
├── components/     # 화면 단위 컴포넌트 (AuthScreen, CameraView, MotionScanPage 등)
├── contexts/       # React Context (AuthContext 등)
├── firebase/       # Firebase 초기화 및 설정
├── lib/            # 분석 로직 (motionAnalyzer, handTracker, firestore, analytics)
└── ...
```

> 폴더 구조를 pages/hooks/services/types 단위로 세분화하는 작업은 별도로 진행 예정입니다.

---

## 기여

이 프로젝트는 브랜치 전략(`main`/`develop`/`feature/*`/`release/*`/`hotfix/*`)과
커밋 컨벤션(`feat:`, `fix:`, `refactor:` 등)을 따릅니다.
자세한 내용은 [CONTRIBUTING.md](./CONTRIBUTING.md)를 확인하세요.
