# V9 Design Integration — Gap Matrix

**기준 브랜치**: `feat/v9-design-integration` (from `feat/v9-home-app-alignment` @ `a19e3ba`)
**작성일**: 2026-07-23

## 0. 먼저 밝혀야 할 것 — 첨부 자료의 실제 구성

지시서가 "Claude Design 최종 산출물 5개"로 지목한 `.dc.html` 5개 파일
(`JOINTRUN Homepage.dc.html`, `JOINTRUN App Screens.dc.html`, `JOINTRUN Design Tokens.dc.html`,
`JOINTRUN Dev Handoff.dc.html`, `JOINTRUN V9 Design System.dc.html`)은 **첨부된
`JOINTRUN 디자인 시스템 재구성.zip` 안에 실재하지 않습니다.** zip에는 대신 `export/` 폴더
하나만 있고, 그 안에는:

- `design-tokens.json` — 색상/타이포/간격/radius/breakpoint/금지표현 목록 (실제 사용)
- `logo/`, `icons/` — 로고 3종, 트리거 아이콘 5종, 타임라인 노드 3종, 상태 아이콘 4종 (실제 사용)
- `images/compare-current-placeholder.png` 1장만 존재

`asset-manifest.md`가 언급하는 `graphics/camera-guide-*.png`(3장),
`images/compare-baseline-placeholder.png`는 **매니페스트에만 적혀있고 실제로는 없습니다.**

**결론**: 저는 실제 화면 시안(Homepage 1440/390 목업, App 01~20 픽셀 레이아웃)을 한 번도
본 적이 없습니다. 갖고 있는 것은 디자인 **토큰**과 **아이콘/로고 에셋**뿐입니다. 아래 Gap
Matrix는 "시안과 픽셀 비교"가 아니라 "토큰·에셋·화면 목록 대비 현재 구현"으로 작성했습니다.
화면 레이아웃 자체는 토큰(색상·타이포·간격·radius)을 지키는 선에서 제가 직접 구성했습니다 —
실제 시안이 오면 레이아웃 자체는 다시 조정이 필요할 수 있습니다.

## 1. 디자인 토큰

| 항목 | 디자인 기준 | 현재 구현 | 차이 | 조치 | 우선순위 |
|---|---|---|---|---|---|
| 색상 | navy #122A5C, teal #1F9E96, bg #F4F6FA 등 | `src/design/tokens/color.js`가 blue #2563EB/cyan #06B6D4 (구버전, 미사용 상태로 방치됨) | 팔레트 전면 상이 | tokens.json 도입 + tailwind.config.js `blue` 스케일을 navy 파생값으로 override(전체 화면 일괄 재적용) | P0 |
| 타이포 | 본문 17px, Noto Sans KR | 화면 대부분 11~16px, 폰트 지정 없음(system-ui) | 본문 크기 미달, 폰트 상이 | 신규 V9 화면은 17px 적용 완료. **기존 레거시 화면(HomeModule 등) 전체 재타이핑은 이번 스프린트 범위 밖(P1)** — 화면 깨짐 없음만 확인 | P0(신규)/P1(레거시) |
| 간격/radius | space 4~96 스케일, card 18/24, btn 12, chip 999 | 기존 값과 근접(card 16, btn 12, chip 9999) | 미세 차이 | tokens.json 값으로 통일 | P1 |
| 로고/아이콘 | SVG 3종 로고, 트리거 5종, 타임라인 3종, 상태 4종 | 기존 앱은 lucide-react 아이콘만 사용, 로고 없음(텍스트 "JOINTRUN") | 에셋 미사용 | `public/brand/`로 복사 후 헤더·트리거·타임라인·상태 화면에 실제 적용 | P0 |
| 금지 표현 목록 | 0-100 점수/염증 게이지/등급 배지/악화예측/치료효과판정/AI처방/일일 스트릭 | 이전 스프린트에서 대부분 플래그로 은닉·검증 완료(RC0 보고 참고) | 신규 위험 없음, 재확인만 | grep 재검증만 수행 | P0(검증) |

## 2. 홈페이지

| 화면 | 디자인 기준 | 현재 구현 | 차이 | 조치 | 우선순위 |
|---|---|---|---|---|---|
| Desktop 1440 / Mobile 390 | (시안 파일 없음 — 토큰만) | RC0에서 V9 카피 전체 반영 완료, 팔레트는 구버전 blue/cyan | 팔레트만 상이, 레이아웃 시안 없어 비교 불가 | CSS 변수(`--primary` 등)를 navy/teal로 교체, 로고 SVG 적용 | P0 |
| 트리거 아이콘 | 5종 SVG 제공 | 숫자(01~05) 텍스트만 | 아이콘 없음 | 실제 SVG로 교체 | P1 |
| 반응형 375/390/768/1024/1440/1600 | 깨짐 없어야 함 | RC0에서 375/768/1440 확인 완료, 1024/1600 미확인 | 부분 확인 | 이번 세션에서 1024/1600 추가 확인 | P1 |

## 3. 앱 화면 01~20 — Keep/Improve/Remove/New

| # | 화면 | 상태 | 현재 파일 | 조치 |
|---|---|---|---|---|
| 01 | 온보딩 | **Improve** | `OnboardingScreen.jsx` (구버전 "관심부위" 선택 — V9 목적과 다름) | 유지하되 다음 세션에서 V9 온보딩 카피로 교체 필요(이번엔 범위 제한상 보류, P1) |
| 02 | 개인정보·비진단 안내 | **New (미착수)** | 없음(문구가 CapturePrepScreen에 inline으로만 존재) | P1 — 독립 화면 아님, 기존 inline 문구로 최소 요건은 충족 |
| 03 | 오늘 기록하는 이유 | Keep/Improve | `v9/TriggerSelectScreen.jsx` | 트리거 아이콘 적용 |
| 04 | 촬영 준비 | Keep/Improve | `v9/CapturePrepScreen.jsx` | 토큰 색상 적용, camera-guide 이미지는 에셋 없어 보류 |
| 05 | 실시간 가이드 촬영 | Keep | `v9/GuidedCaptureScreen.jsx` | 토큰 색상만 적용 |
| 06 | 촬영 품질 오류·재촬영 | Improve | GuidedCaptureScreen 내 inline 처리 | status-error 아이콘 적용 |
| 07 | 증상·상황 기록 | Keep/Improve | `v9/SymptomSnapshotForm.jsx` | 17px 폰트 적용 |
| 08 | 첫 기준선 저장 완료 | Keep | `v9/BaselineSavedScreen.jsx` | 타임라인 노드 아이콘 적용 |
| 09 | 다음 재확인 중심 홈 | **Improve(부분)** | `JOINTRUNShell.jsx`의 agenda 카드만 추가됨, 나머지 Home은 레거시 구조 유지 | agenda 카드 토큰 적용. **Home 전체 재구성(레거시 스캔 위주 → 재확인 위주)은 P1로 유지** — 회귀 위험 대비 |
| 10 | 2주·4주 재확인 | Keep | DecisionLoopFlow mode=recheck 재사용 | 토큰만 적용 |
| 11 | 기준선과 현재 비교 | Keep/Improve | `v9/ComparisonScreen.jsx` | compare placeholder 이미지 1장만 있어 완전 적용 불가(P1) |
| 12 | Decision Log | **New** | 없음 | **이번 세션 P0 구현** |
| 13 | 결과 기록(Outcome) | **New** | 없음 | **이번 세션 P0 구현** |
| 14 | 개인 타임라인 | **New/Improve** | `TimelineModule.jsx`는 레거시 Event Marker 전용, V9 엔터티 미연결 | **이번 세션 P0 구현**(V9 Decision Loop 통합 뷰) |
| 15 | 4주 리포트 | **New** | 없음 | **이번 세션 P0 구현**(최소 버전) |
| 16 | 가격·상품 | **New(미착수)** | `pricingExperiment` 플래그만 존재, UI 없음 | P1 — 실결제 없는 상태에서 화면만 있어도 실익 낮다고 판단, 다음 세션 |
| 17 | 카메라 권한 거부 | **Improve→P0** | GuidedCaptureScreen 범용 에러 문구만 | **이번 세션 P0**: 거부/재요청 경로 추가 |
| 18 | 네트워크 오류 | **New→P0** | 없음(Firestore 실패 시 조용히 무시) | **이번 세션 P0**: 재시도 + 입력 보존 |
| 19 | 빈 기록 상태 | Keep(레거시)/New(V9) | 레거시 `EmptyHomeState`/`JTEmptyState` 존재, V9 타임라인·리포트용 빈 상태 없음 | 신규 화면에 최소 빈 상태만 추가 |
| 20 | 로딩 상태 | Keep(레거시)/New(V9) | 레거시 `JTSkeleton` 존재, V9 화면은 없음(대부분 즉시 렌더라 이번엔 영향 적음) | 무한대기 없는지만 확인 |

## 4. 기존 P0 코드와 중복 위험

- Decision Log는 기존 `EventMarkerModal`(병원방문 등 마커)과 **다른 개념**이다 — 새 `decisions` 하위 컬렉션으로 분리하고 기존 `events` 컬렉션은 건드리지 않는다(RC0 때 `v9Events`를 `events`와 분리한 것과 같은 원칙).
- Timeline은 기존 `TimelineModule.jsx`(레거시 스캔+이벤트마커)를 **대체하지 않고**, V9 Decision Loop 전용 통합 뷰를 Home 근처에 별도로 추가한다. 레거시 타임라인 탭은 그대로 둔다(회귀 방지).

## 5. 기존 점수 UI가 production에서 노출될 가능성

RC0에서 이미 `absoluteScoreUiEnabled` 플래그로 차단·검증 완료(빌드 산출물에 문자열 없음 확인). 이번 세션에서 새로 추가하는 화면(Decision Log/Outcome/Timeline/Report)에는 점수·등급·자동판정을 처음부터 넣지 않는다 — 코드 리뷰로 재확인.

## 6. 실데이터 미연결(시안 전용) 화면

이번 세션 이전 기준으로는 없음(만들어진 화면은 전부 Firestore/데모스토어에 연결되어 있었음, RC0 보고 참고). 이번에 새로 만드는 Decision Log/Outcome/Timeline/Report도 처음부터 실데이터 연결로 구현한다(시안 복제 금지 원칙에 따름).
