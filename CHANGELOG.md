# Changelog

이 프로젝트의 모든 주요 변경 사항은 이 파일에 기록됩니다.
형식은 [Keep a Changelog](https://keepachangelog.com/ko/1.0.0/)를 따르며,
버전 관리는 [Semantic Versioning](https://semver.org/lang/ko/)을 따릅니다.

---

## [Unreleased]

### Planned
- ROM(관절 가동 범위) 분석 엔진
- Risk Forecast(부상 위험 예측) 모듈
- 사용자 대시보드 고도화
- ARO 보조기 연동

---

## [1.0.1] - 2026-07

### Fixed
- Firebase 환경변수가 없을 때 앱 전체가 crash 나던 문제 → 데모 모드 폴백으로 해결
- `AuthContext`가 Firebase crash에 의존하던 구조 → 독립적으로 동작하도록 수정
- Anthropic API 호출 시 브라우저 헤더(`anthropic-dangerous-direct-browser-access`) 누락 문제 수정

---

## [1.0.0] - 2026-07

### Added
- React 18 + Vite 기반 프로젝트 셋업
- MediaPipe HandLandmarker 기반 모션 감지 및 카메라 뷰(`CameraView`)
- Finger Score 산출 로직 (`motionAnalyzer`, `handTracker`)
- Firebase Auth 로그인 및 Firestore 사용자 기록 저장(`firestore.js`)
- 대시보드 및 모션 스캔 페이지(`MotionScanPage`)
- Anthropic AI Coach 연동 (claude-sonnet-4-6)
- PWA 지원 (manifest, service worker, 아이콘 세트)
- Vercel 배포 설정

---

## 버전 로드맵 참고

아래는 초기 CTO 개발 계획에서 제시된 단계별 목표이며, 실제 릴리스와는 번호 체계가
다를 수 있습니다 (현재 package.json 기준 최신 버전은 `1.0.0`입니다).

| 버전 | 주요 목표 |
|---|---|
| v0.1.0 | Camera, MediaPipe, Motion Detection, Demo |
| v0.2.0 | Finger Score, Dashboard, Firebase, History |
| v0.3.0 | ROM, Risk Forecast, Analytics |
| v0.5.0 | ARO Integration, Premium, User Profile |
| v1.0.0 | 정식 출시 (AI Motion Intelligence, Finger Score, Risk Forecast, Dashboard, History, Firebase, Subscription) |

자세한 로드맵은 [ROADMAP.md](./ROADMAP.md)를 참고하세요.
