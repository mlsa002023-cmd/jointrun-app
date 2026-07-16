# Implementation Notes — STEP 2 HOME 정리 (2026-07-16)

## 배경

Claude Design의 UX Refactoring 산출물(Component Audit / React Structure Proposal / KPI Mapping)을 `docs/sprint-plan.md` 기준으로 대조한 결과, STEP 2(HOME)에서 만든 신규 컴포넌트(`RelativeChangeCard`·`PatternInsightCard`·`TodayActionCard`·`TodayStatusCard`·`RecordSection`)는 목표 IA대로 구현되어 있었지만, `JOINTRUNShell.jsx`의 레거시 인라인 마크업이 제거되지 않은 채 그 앞에 남아 있었다. 그 결과 CLAUDE.md의 "진단·처방·지시 표현 금지" 원칙을 위반하는 문구(진단, 소견 등)와 사업계획서 규제 포지셔닝과 충돌하는 카드(Risk Forecast™, Finger Age™)가 실제 배포본에 그대로 남아 있는 상태였다. 이 문서는 그 정리 작업의 변경 내역을 기록한다.

## 대조에서 발견된 문제

| 항목 | 실제 위치 | 문제 |
|---|---|---|
| ARO 기기 카드("스마트 보조기 정렬") | HOME 최상단(환영 헤더 바로 다음) | 브랜드 위계상 측정 중심 인상을 줌 |
| "AI 소견 분석"/"AI 한 줄 맞춤 진단" | 오늘의 회복 미션 3번 항목 | "진단" — 카피 가이드 정면 위반 |
| Risk Forecast™(24시간 통증 위험도) | Report 화면 | "예측" 표현, 위험 배지 |
| Finger Age™ + 위험/경고 배지 | Report 화면 | 진단 등급처럼 보이는 경고형 UI |
| "대학병원 제출용 소견 PDF" 카드 | Report 화면 | Out of Scope, "소견" 의료 의견서 뉘앙스 |
| "소견서 출력" 버튼 (중복 2건) | Timeline 하단 + Shell 소견서 발급 모달 | 위와 동일 |

## 변경 내역

### 1. ARO 카드 삭제
- [`src/components/JOINTRUNShell.jsx`](../src/components/JOINTRUNShell.jsx): HOME 렌더에서 "스마트 보조기 정렬" 인라인 카드 블록 삭제.
- 이 카드가 유일한 진입점이었던 Calibrator 모달(`showCalibrator` state, `PremiumModule` 임포트)도 함께 제거 — 트리거가 없어지면 도달 불가능한 코드가 되므로.
- `PremiumModule.jsx` 파일 자체는 삭제하지 않고 보존 — 기기 조율 기능은 다음 스프린트에서 "후순위 화면"으로 재배치 예정(이번 스프린트 범위 아님).

### 2. 소견서(Doctor Report) 플로우 제거
- [`src/components/JOINTRUNShell.jsx`](../src/components/JOINTRUNShell.jsx): "DOCTOR REPORT MODAL"(Clinical Diagnostic Referral Sheet) 블록, `showDoctorReport` state, `triggerDoctorReportPrint` 함수 삭제.
- [`src/components/tabs/TimelineModule.jsx`](../src/components/tabs/TimelineModule.jsx): "소견서 출력" 버튼 삭제("주간 회복 변화" 텍스트는 유지), `triggerDoctorReportPrint` prop 제거.
- [`src/components/tabs/ReportModule.jsx`](../src/components/tabs/ReportModule.jsx): "대학병원 제출용 소견 PDF" 카드 삭제.

### 3. Risk Forecast™ / Finger Age™ 제거
- [`src/data/mockProfiles.js`](../src/data/mockProfiles.js): `BIOMARKER_METRICS`에서 두 항목 삭제. 이 두 항목에서만 발생하던 "danger"/"위험" 상태가 함께 사라짐 — 남은 3개 지표(Finger Score™/Morning Stiffness™/Pain Trend™)는 최대 "warning"/"경고"까지만 존재.
- [`src/components/tabs/home/TodayStatusCard.jsx`](../src/components/tabs/home/TodayStatusCard.jsx): 삭제된 Finger Age™를 가리키던 "관절 기능 나이" 설명 문구 정리.

### 4. 진단형 카피 교체
- [`src/data/mockProfiles.js`](../src/data/mockProfiles.js) `DEFAULT_STEPS[2]`: "AI 소견 분석"/"어제 대비 개선 정도 및 AI 한 줄 맞춤 진단" → "AI 코치 확인"/"어제 대비 변화를 AI 코치와 함께 확인". 코치 탭으로 이동하는 기존 동작은 유지.
- [`src/components/OnboardingScreen.jsx`](../src/components/OnboardingScreen.jsx): "첫 만남 진단" → "관심 부위 확인" (구현 중 추가 발견 — 걱정 부위를 고르는 단순 선택 UI에 "진단" 라벨이 붙어 있었음).
- [`src/components/tabs/CoachModule.jsx`](../src/components/tabs/CoachModule.jsx): 토스트 "AI 코치 소견이 도착했습니다" → "AI 코치 답변이 도착했습니다" (구현 중 추가 발견).

## 의도적으로 다루지 않은 것

- **React 폴더 구조**: Design 산출물은 `src/screens/` 신규 트리를 제안했지만, 이 저장소는 이미 `src/components/tabs/*` · `src/data/` · `src/hooks/use*Data.js` 컨벤션을 쓰고 있어(CLAUDE.md 명시) 그대로 유지했다. `TimelineItem` 판별 유니언 제안도 기존 `mergeTimeline.js`의 `kind: 'scan'|'event'` 필드를 그대로 재사용했고 새 타입을 도입하지 않았다.
- **컴포넌트 간 액션 중복**: PrimaryScanCTA · 오늘의 회복 미션(1·2·6번) · ConditionCheckinCard가 같은 행동(스캔/기록)을 서로 다른 UI로 중복 노출하는 문제는 원 감사에서 지적됐지만, 이번 작업은 카피/노출 제거 범위로 한정했다. 구조 재설계는 다음 스프린트로 미룬다.
- **ARO 기기 조율 기능의 재배치**: 이번엔 HOME에서 삭제만 하고 빈 자리로 남겼다. "후순위 화면(Report 하위 등)으로 이동"은 다음 스프린트에서 별도 설계.

## 검증

- `npm run build` 성공
- `npm run lint` — 0 errors (기존 경고 22건은 이번 변경과 무관, 그대로 유지)
- `npm test` — 7 files / 21 tests 통과
- 브라우저 수동 확인: 온보딩 → HOME(Empty State) → Report → Timeline. ARO 카드·소견 PDF·Risk Forecast™·Finger Age™·소견서 버튼이 화면에서 사라졌고, Report에 남은 3개 바이오마커가 정상 렌더링됨을 확인. 콘솔 에러 없음.
- 전체 소스 기준 "진단"/"소견" 문자열 재검색 — 남은 항목은 전부 카피 가이드라인을 설명하는 코드 주석/AI 시스템 프롬프트뿐, 사용자 노출 문구는 없음.

---

# Implementation Notes — STEP 4 Timeline 즉시 반영 버그 + STEP 7 session_start (2026-07-16)

## 배경

STEP 1/3/4/5/6/7을 실제 코드 기준으로 감사한 결과 발견된 두 가지 갭 중, 이번 세션에서는 STEP 4의 Timeline 반영 지연 버그와 STEP 7의 `session_start` 누락만 수정한다. STEP 1의 `getTimeline()` 미사용, STEP 6의 Report 콘텐츠(월간 변화/평균/Event 요약) 부재는 이번엔 손대지 않고 남겨둔다.

## 1. STEP 4 — Timeline/RecentTimelinePreview 즉시 반영 버그 수정

**원인**: `useTimelineData()`는 `TimelineModule`과 `RecentTimelinePreview`에서 각각 독립적으로 호출되며, 마운트 시 1회만 fetch한다(`useEffect(..., [repository])`). `EventMarkerModal`은 `JOINTRUNShell`이 별도 오버레이로 띄우는 구조라, 저장 후 모달이 닫혀도 이미 마운트돼 있던 `TimelineModule`/`RecentTimelinePreview`는 리마운트되지 않아 새로 저장한 이벤트가 화면에 보이지 않았다(Timeline 탭에 머문 채 "기록 추가"를 누르는 경우 재현).

**수정**: 리마운트나 재조회 대신, 저장 시점에 이미 마운트된 훅 인스턴스의 로컬 상태를 직접 갱신하는 pub/sub 방식을 도입했다(요청하신 두 방식 중 "저장 이벤트 구독" 쪽).

- [`src/lib/recordEvents.js`](../src/lib/recordEvents.js) *(신규)*: 최소 pub/sub — `subscribeToEventSaved(callback)` / `emitEventSaved(event)`. Repository/Firestore와 무관한 순수 클라이언트 상태 전파 채널.
- [`src/hooks/useTimelineData.js`](../src/hooks/useTimelineData.js): 마운트 시 `subscribeToEventSaved`를 구독해, 새 이벤트가 오면 로컬 `events` state에 prepend. `mergeScansAndEvents`가 매번 날짜순으로 재정렬하므로 prepend 순서 자체는 결과에 영향 없음.
- [`src/components/EventMarkerModal.jsx`](../src/components/EventMarkerModal.jsx): `repository.addEvent()` 성공 직후 `emitEventSaved(saved)` 호출 추가(기존 `onSaved` 콜백과 별개로, 병행 호출).
- [`src/hooks/useTimelineData.test.jsx`](../src/hooks/useTimelineData.test.jsx): `emitEventSaved`로 저장을 시뮬레이션했을 때 리마운트 없이 `timelineItems`가 갱신되는지 확인하는 회귀 테스트 추가.

**검증**: 브라우저에서 Timeline 탭에 머문 채로 "기록 추가" → "운동 시작" 저장 → 모달이 닫히고 "전체 기록"에 "7월 16일 운동 시작"이 즉시 표시됨을 확인(탭 전환 없이). `RecentTimelinePreview`는 동일한 `useTimelineData()` 훅을 쓰므로 같은 수정으로 커버되지만, 이 환경엔 카메라가 없어 스캔을 완료할 수 없어 그 경로 자체는 직접 스크린샷으로 확인하지 못했다 — 대신 위 단위 테스트로 훅 레벨에서 검증했다.

## 2. STEP 7 — session_start 이벤트 추가

- [`src/components/JOINTRUNShell.jsx`](../src/components/JOINTRUNShell.jsx): 로그인 사용자가 확인되는 시점(`currentUser?.uid` 변경)마다 `trackKpiEvent("session_start", currentUser.uid)`를 1회 발생시키는 `useEffect`를 추가. 기존 "오프라인 이벤트 동기화" effect와 동일한 패턴(`[currentUser?.uid]` 의존성)을 따랐다.
- 다른 KPI 이벤트(`return_scan`/`timeline_created`/`event_marker_created`/`history_comparison_viewed`)와 동일하게 `uid`가 없으면 전송하지 않는다 — 비로그인 세션은 집계하지 않는 기존 정책 유지.
- **미검증**: 이 저장소엔 `.env`/Firebase 프로젝트 설정이 없어 Firebase DebugView로 실제 전송을 확인할 수는 없었다(기존 4개 이벤트도 동일한 한계). 코드 경로상 발생 조건만 확인.

## 이번에 다루지 않은 것 (다음에 별도 처리)

- STEP 1 — `getTimeline()` 미사용 (Repository 인터페이스에는 있지만 UI가 `getRecentScans`+`getEvents`를 직접 호출해 우회)
- STEP 6 — Report의 월간 변화/평균/Event 요약 콘텐츠 부재

## 검증

- `npm run build` 성공
- `npm run lint` — 0 errors (경고 23건, 신규 `session_start` effect의 `exhaustive-deps` 경고 1건 추가 — 기존 동일 패턴의 다른 effect들과 같은 이유로 의도적)
- `npm test` — 7 files / 22 tests 통과(신규 테스트 1건 포함)
- 브라우저 수동 확인: Timeline 탭에서 기록 추가 → 즉시 반영 확인, 콘솔 에러 없음

---

# Implementation Notes — 서비스 워커 캐시 버전 무효화 (2026-07-16)

## 배경

STEP 4/7 수정을 브라우저로 검증하던 중, 소스는 이미 고쳐졌는데도 이전 세션에서 고친 카피("첫 만남 진단" 등)가 화면에 그대로 남아있는 현상을 겪었다. 원인은 PWA 서비스 워커([public/service-worker.js](../public/service-worker.js))의 `CACHE_VERSION`이 `"jointrun-v1"`로 하드코딩돼 있었던 것 — 배포마다 값이 바뀌지 않으니 `activate` 핸들러의 "현재 버전과 다른 캐시 삭제" 로직이 아무것도 지우지 못했고, 정적 자산은 캐시 우선(cache-first) 전략이라 예전 배포 시점에 캐시된 파일을 계속 그대로 서빙했다. 실배포를 확인할 때마다 최신 코드인지 확신할 수 없는 근본 원인이라, 요청에 따라 "버전 기반 캐시 이름"으로 바로 수정했다.

## 변경 내역

- [`public/service-worker.js`](../public/service-worker.js): `CACHE_VERSION = "jointrun-v1"` → `CACHE_VERSION = "__CACHE_VERSION__"` 플레이스홀더로 변경. 저장소에 커밋되는 원본은 항상 이 플레이스홀더 상태를 유지한다.
- [`scripts/stamp-sw-version.js`](../scripts/stamp-sw-version.js) *(신규)*: `npm run build` 직후 실행되는 postbuild 스크립트. `dist/service-worker.js`에서 `CACHE_VERSION = "__CACHE_VERSION__"`의 **따옴표를 포함한 값만** 빌드 시각 기반 버전(`jointrun-<ISO 타임스탬프>`)으로 치환한다 — 파일 상단 설명 주석에도 우연히 같은 단어가 나와서, 따옴표 없이 매칭했다가 주석이 잘못 치환되는 버그를 만들고 바로 잡았다(교훈: 플레이스홀더 문자열을 설명 주석에 그대로 쓰지 말 것).
- [`package.json`](../package.json): `"build": "vite build"` → `"build": "vite build && node scripts/stamp-sw-version.js"`.
- [`src/registerServiceWorker.js`](../src/registerServiceWorker.js): 두 가지 보강.
  - `import.meta.env.DEV`일 때는 서비스 워커를 아예 등록하지 않음 — 이번에 겪은 "코드를 고쳤는데 dev 서버에서 반영이 안 되는" 문제의 재발 방지(dev에는 Vite HMR이 있으니 SW가 필요 없고, 오히려 캐시가 HMR과 충돌한다).
  - `register()`에 `{ updateViaCache: "none" }` 추가 — 브라우저가 `service-worker.js` 자체를 HTTP 캐시로 판단하지 않고 매번 네트워크에서 새로 확인하게 해서, 새 배포의 `CACHE_VERSION`을 곧바로 인식하게 한다.
- [`.claude/launch.json`](../.claude/launch.json): `npm run preview`(포트 4173, 프로덕션 빌드 서빙)를 로컬에서 검증할 수 있도록 `preview` 설정 추가.

## 검증

- `npm run build` → `dist/service-worker.js`에 `CACHE_VERSION = "jointrun-2026-07-15T22-06-44-410Z"` 형태로 정확히 스탬핑됨, 원본 `public/service-worker.js`는 플레이스홀더 그대로 유지 확인.
- `npm run lint` 0 errors, `npm test` 22/22 통과.
- 브라우저로 실제 재현: ①`npm run build` 후 `vite preview`로 서빙 → SW 등록, `caches.keys()`로 `jointrun-<시각1>-shell` 확인. ②재빌드(새 타임스탬프) 후 서버 재시작·새로고침 → `caches.keys()`가 `jointrun-<시각1>-*`는 사라지고 `jointrun-<시각2>-shell`/`-runtime`만 남은 것을 확인 — 배포마다 이전 캐시가 자동으로 무효화됨을 실증. 콘솔 에러 없음.

---

# Implementation Notes — Report 탭 "이번 달" 콘텐츠 추가 (2026-07-16)

## 배경

STEP 6 감사에서 지적된 "Report에 월간 변화/평균/Event 요약 콘텐츠가 없다"는 갭을 메운다. 코드를 새로 짜기 전에 기존 로직 재사용 가능 여부부터 확인했고(별도 사전 조사), 그 결과에 따라 아래처럼 구현했다.

## 재사용 조사에서 확정된 사항

- **PatternDetector**는 `WINDOW_DAYS=14`가 모듈 상수로 박혀 있고, "declining" 메시지 자체에 "최근 2주간"이라는 텍스트가 있어 그대로는 월간 요약에 못 쓴다 — 판정 로직(평균 비교 8%, 변동계수 12%)은 그대로 두고 **윈도우 크기와 문구만 옵션으로 분리**했다.
- **mergeScansAndEvents**(mergeTimeline.js)는 손대지 않았다. 이미 `kind`/`type`/`date`를 담아 반환하므로 Event 요약은 그 결과를 필터+groupBy만 하면 됐다.
- **computeEventComparison**(eventComparison.js)도 그대로 재사용 — "대표 변화 1건"은 그 위에 "여러 이벤트 중 델타가 가장 큰 것 선택" 로직만 얹었다.
- **design/tokens/color.js는 어떤 컴포넌트에서도 import되지 않는 미사용 파일**이라는 것을 이번에 확인했다. 같은 값이 `tailwind.config.js`의 커스텀 색상에 중복 정의돼 있고, 실제 화면은 Tailwind 클래스나 하드코딩 hex를 쓴다. 이번 월간 그래프는 사용자 지시에 따라 `color.js`를 새로 도입하지 않고 **TimelineModule과 동일하게 hex를 직접 지정**했다(`#3b82f6`/`#bfdbfe`, Finger Score™ 추이 차트와 동일 배색). `color.js`를 앱 전체에 실제로 연결하는 작업은 스코프가 크므로 **다음 Architecture Review(STEP 8) 안건으로 남긴다** — 미사용 파일을 그대로 둘지, 실제로 도입할지, 아니면 제거할지 결정 필요.

## 변경 내역

### windowDays 매개변수 추가
- [`src/lib/detectPattern.js`](../src/lib/detectPattern.js): `detectPattern(scans, now, { windowDays, patterns })` — 세 번째 인자를 옵션 객체로 추가, 기본값은 기존과 동일(`WINDOW_DAYS=14`, 기존 `PATTERNS`)이라 HOME/Report의 기존 "패턴 관찰" 카드는 동작 변화 없음. "2주"가 박혀있던 기존 문구 대신 쓸 `MONTHLY_PATTERNS`(4종 관찰형 문구, 카피 가이드라인 그대로 적용)를 추가하고, 이번 달 일수를 윈도우로 넘기는 `detectMonthlyPattern(scans, now)` 헬퍼를 새로 export.
- [`src/domain/PatternDetector.js`](../src/domain/PatternDetector.js): `PatternDetector.detectMonthly`로 얇게 재노출(§5 "PatternDetector를 호출만 하고 새 판정 로직을 만들지 마" 준수 — 판정 로직 자체는 추가하지 않음).

### 신규 lib 함수 (모두 기존 데이터 구조 위에서 집계/선택만)
- [`src/lib/monthlyTrend.js`](../src/lib/monthlyTrend.js) *(신규)*: `computeMonthlyTrend(scans, now)` — 이번 달 스캔을 주차별로 묶어 평균. 그래프용 숫자만 반환, 문장이 없어 카피 가이드라인 대상 아님.
- [`src/lib/monthlyEventSummary.js`](../src/lib/monthlyEventSummary.js) *(신규)*: `summarizeMonthlyEvents(timelineItems, now)` — `mergeScansAndEvents` 결과에서 이번 달 이벤트만 걸러 타입별 그룹핑.
- [`src/lib/eventComparison.js`](../src/lib/eventComparison.js)에 `findMostNotableEvent(timelineItems, scans, now)` 추가 — 이번 달 이벤트 각각에 기존 `computeEventComparison`을 돌려 전후 델타가 가장 큰 것 1건 선택.

### Hook
- [`src/hooks/useMonthlyReportData.js`](../src/hooks/useMonthlyReportData.js) *(신규)*: `useTimelineData()`(기존 fetch+merge)를 그대로 재사용해 위 세 함수 + `PatternDetector.detectMonthly`를 조합. 새로운 fetch/병합 로직 없음.
- [`src/hooks/useMonthlyReportData.test.jsx`](../src/hooks/useMonthlyReportData.test.jsx) *(신규)*: 이번 달/다른 달 스캔·이벤트가 섞인 픽스처로 4가지 결과(요약·추이·그룹핑·대표 변화)가 모두 이번 달 데이터만 반영하는지 검증.

### UI (src/components/tabs/report/ 신설 — home/과 동일 컨벤션)
- `MonthlySummaryCard.jsx` — ① 월간 요약 문장, `JTCard` 재사용.
- `MonthlyTrendChart.jsx` — ② 월간 평균 추이 그래프, `JTCard` + Recharts, TimelineModule과 동일한 hex 배색.
- `MonthlyEventSummary.jsx` — ③ Event 요약, `JTSection`/`JTListItem`/`JTEmptyState` 재사용.
- `MonthlyHighlightCard.jsx` — ④ 대표 변화 1건, `JTCard` — "이 기록 전 평균 X점 · 이 기록 후 평균 Y점" 식으로 EventDetailModal과 동일하게 원인·처방 표현 없이 관찰형으로만 서술.
- [`src/components/tabs/ReportModule.jsx`](../src/components/tabs/ReportModule.jsx): 기존 바이오마커 리스트 아래에 "이번 달" 구획을 신설해 위 4개를 순서대로 배치. PDF/공유 버튼, KPI 이벤트, 재방문 유도 장치는 추가하지 않음(Report는 조회 전용·낮은 재방문 압력이 의도된 설계).

## 검증

- `npm run lint` 0 errors(신규 경고 없음), `npm run build` 성공.
- `npm test` — 8 files / 24 tests 통과(신규 `useMonthlyReportData.test.jsx` 2건 포함, 그 안에서 windowDays 분리·월별 필터링·그룹핑·대표 변화 선택 델타 계산까지 전부 구체적인 수치로 검증됨).

---

## 다음 검토 대상

- **[`src/services/anthropicCoach.js`](../src/services/anthropicCoach.js) — AI 코치 시스템 프롬프트.** SCAN 결과 화면의 "처방:" 문구(2026-07-16, 별도 커밋)와 같은 부류의 우려 지점 — 시스템 프롬프트가 "3분 온수 잼잼 요법, 스마트 보조기 활용, 생활 습관 개선을 권장하세요"라고 AI에게 지시한다. 다만 정적 UI 문구가 아니라 사용자가 직접 질문하는 대화형 AI 코치의 가드레일이라 성격이 다르고("의학적 진단은 하지 말고 전문의 상담을 권장하라"는 안전장치도 같은 프롬프트 안에 있음), 이번 세션 범위에서는 손대지 않기로 함. 대화형 AI의 가드레일 설계는 별도 세션에서 검토 예정.
- 브라우저 수동 확인: Report 탭에 "이번 달" 구획이 예상한 순서(요약→그래프→이벤트 요약→대표 변화)대로 렌더링되고, 데이터가 없는 상태에서 4개 모두 관찰형 안내 문구로 정상 대체됨을 확인. 콘솔 에러 없음.

---

# Implementation Notes — P0 B2C Safety Cleanup (2026-07-16)

B2C 검증용 공개 전 신뢰·안전 리스크 제거 작업. 새 기능 추가 없이 문구 교정·조건 분기·제거/숨김만 수행했다. `main`에서 분기한 `feature/p0-b2c-safety-cleanup` 브랜치에 작업별로 6개 커밋(+검증/문서 커밋)으로 나눠 올렸다.

## 작업1 — 의료 효능 문구 전체 교체

- `index.html` meta description, `AuthScreen.jsx` 회원가입 태그라인을 지시받은 문구로 정확히 교체.
- `motionAnalyzer.js`의 `buildRecommendation()` — 온수 요법/보조기 착용 권장, "즉시 ... 후 전문의 상담을 권장합니다" 등 처방·지시형 문구 3단계 전부를 관찰형으로 재작성. `MotionScanPage.jsx`의 "처방:" 라벨도 "관찰:"로 통일.
- AI 코치를 "기록 도우미"로 리프레이밍(작업 지시서의 "전문 관절 건강 AI 코치 → 기록 도우미" 매핑 적용): `anthropicCoach.js` 시스템 프롬프트(전문성 주장·특정 치료/기기 권장 제거, "진단 회피·전문의 상담 권유" 안전장치는 유지), `CoachModule.jsx`(제목/환영 메시지/토스트/quick chips/API 실패 시 폴백 문구 — 폴백은 가짜 진단성 답변 대신 단순 "답변을 가져오지 못했다" 메시지로 교체), `ProfileModule.jsx` 진입 라벨.
- `getTodayAction.js`: "루틴을 그대로 유지하세요" → "최근 기록을 확인해보세요"(지시받은 표 매핑 그대로).
- 지시받은 grep 키워드 목록엔 없었지만 동일 카테고리 위반이라 함께 정리한 것: `mockProfiles.js`의 DEFAULT_STEPS("AI 소견 분석/진단", "관절 윤활/유연 회복", "관절 회복력 축적"), `OnboardingScreen.jsx`("첫 만남 진단" → "관심 부위 확인").
- `BLUEPRINT_SECTIONS`(mockProfiles.js)에 "예방"/"5년" 등이 일부 남아있지만 이 배열은 어디에도 import되어 렌더링되지 않는 dead 데이터라 손대지 않음(검증 grep도 "사용자 노출 문자열" 기준이라 여기 포함 안 됨).

## 작업2 — 시뮬레이션 모드 운영환경 차단

- `MotionScanPage.jsx`의 `runSimulation()`에 `if (!import.meta.env.DEV) return;` 가드 추가. "시뮬레이션으로 건너뛰기"(idle 화면)/"시뮬레이션 스캔 실행"(camera_error·ai_error 화면) 버튼 둘 다 `import.meta.env.DEV`로 조건부 렌더. 운영환경에서 모델/카메라 실패 시 기술적 에러 메시지 대신 "지금은 측정할 수 없습니다. 잠시 후 다시 시도해주세요." 안내로 대체(재시도만 가능, 시뮬레이션 경로 없음 → 기록 생성 없이 종료). 관련 토스트("...시뮬레이션 모드로 전환합니다")도 DEV/prod 분기.
- `runSimulation()`의 `onScanCompleted` 페이로드에 `isSimulated: true` 추가 → `JOINTRUNShell.jsx`의 `handleScanCompleted()`가 이 플래그면 `saveScanRecord`/`saveProfileSnapshot`(Firestore 저장)과 `recordActivity`·`return_scan` KPI 이벤트를 전부 건너뛴다. 로컬 상태 미리보기(`addOptimisticScan` 등)는 dev에서 UI 흐름 확인용으로 그대로 유지(Firebase가 아니라 순수 로컬 state이므로).
- **검증**: `npm run build` 후 `dist/assets/*.js`를 grep한 결과 "시뮬레이션" 문자열이 0건 — Vite가 `import.meta.env.DEV` 분기를 프로덕션 번들에서 완전히 제거함을 직접 확인(작업6의 "필터링으로만 숨김" 방식과 달리, 이건 빌드 시점에 코드 자체가 사라짐).

## 작업3 — 데이터 없을 때 중립값 50 제거

- `fingerHealthScore.js`: `DEFAULT_FINGER_HEALTH_SCORE`를 50 → `null`로 변경. `computeMobilityScore`/`computeStabilityScore`/`computeInflammationScore`/`computeRecoveryScore` 전부 데이터 없음 → `{ value: null }`로 통일(기존엔 0과 50이 섞여 있었음 — 둘 다 "모름"을 가짜 숫자로 표현하던 문제라 같이 정리).
- `computeFingerHealthScore()`는 4개 하위 점수 중 하나라도 `null`이면 가중합하지 않고 `total`도 `null`로 둔다 — 지시서의 두 옵션("결측 지표 제외 후 계산" vs "전체를 측정 전으로 처리") 중 후자를 선택. 이유: Mobility/Stability는 스캔 완료 직후 항상 값이 있고, 이 함수가 실제로 `null`을 받는 경우는 Inflammation/Recovery(체크인 필요) 뿐이라 "일부만 반영된 점수"를 보여주는 것보다 "측정 전"이 더 정확한 정보라 판단.
- `JOINTRUNShell.jsx`: `NEUTRAL_SUBSCORE(50)` → `UNMEASURED_SUBSCORE(null)`. 체크인 완료 토스트를 조건 분기(총점이 아직 `null`이면 "스캔을 완료하면 볼 수 있어요" 안내로 대체). 소견서 모달의 Finger Score 표시도 `null` 방어.
- `ReportModule.jsx` / `mockProfiles.js`: Finger Score™ 값이 `null`이면 배지·숫자 대신 "측정 전" 표시. status 로직에도 `null` 분기 추가(기존엔 `null > 75`가 falsy로 새어나가 "경고"로 잘못 표시될 뻔한 잠재 버그였음 — 발견해서 같이 고침).
- `fingerHealthScore.test.js`(신규) — 이 저장소는 lib 단위 테스트 관례가 약했지만, 점수 계산 로직의 회귀 위험이 높아 6개 케이스로 null 전파를 검증하는 테스트를 새로 추가했다.

## 작업4 — Stiffness 스키마 충돌 정리

- `fingerHealthScore.js`: `SCORE_VERSION` v1.0 → v2.0. 파일 상단 주석에 v1.0/v2.0 산식 차이를 기록(같은 점수인데 산식이 다른 데이터가 섞이는 것 방지). `computeRecoveryScore(stiffnessComponent, fatigueComponent)` → `computeRecoveryScore(fatigueComponent)` 단일 인자로 변경 — 자가보고 피로도 단독 기준으로 확정. `computeStiffnessComponent()`는 삭제하지 않고 `@deprecated`로만 표시(과거 v1.0 문서 분석 등에 필요하면 참조 가능하되 신규 계산 경로에서는 호출하지 않음 — "읽기 전용 legacy" 요건).
- `MotionScanPage.jsx`: `finishScan()`/`runSimulation()` 양쪽에서 stiffnessComponent 계산·전달 제거. `JOINTRUNShell.jsx`: `lastScanScores`에서 필드 제거, 두 `computeRecoveryScore()` 호출부를 새 시그니처로 변경.
- UI에서 Morning Stiffness 독립 지표 제거: `mockProfiles.js` BIOMARKER_METRICS에서 "Morning Stiffness™" 카드 삭제, 소견서 모달의 "아침 강직" 항목도 삭제. 체크인 단순 항목으로의 격하는 지시서상 "필요하면"이라는 조건부 옵션이라 새 UI를 추가하진 않았다(새 기능 추가 금지 원칙과도 부합).

## 작업5 — 개인정보 안내 정확성

카메라 화면의 "어떠한 민감 정보도 외부로 전송되지 않습니다" 문구를 고치기 전에 실제로 원본 영상이 저장/전송되는지 코드로 확인했다.

**확인한 사실**:
- `CameraView.jsx`: canvas에는 랜드마크(스켈레톤)만 그리고 카메라 영상 자체를 canvas로 다시 그리지 않는다(파일 자체 주석에 명시). `toDataURL`/`getImageData`/`toBlob` 등 프레임 캡처 호출이 어디에도 없음.
- `MotionScanPage.jsx`의 `rawFramesRef` — 포즈별로 저장하는 값은 `{ worldLandmarks, ts }`뿐. MediaPipe가 브라우저 로컬에서 추출한 3D 랜드마크 좌표(숫자 배열)이지 이미지/영상 프레임이 아니다.
- `firestore.js`의 `saveScanRecord()`: 메인 문서엔 `metrics`/`scores`/`recommendation`만, `rawFrames`(랜드마크 좌표)는 별도 `raw` 서브컬렉션에 저장 — 이미지 바이너리나 video 데이터를 담는 경로가 어디에도 없음.
- `handTracker.js`: MediaPipe HandLandmarker가 `video` 엘리먼트를 브라우저 로컬에서 직접 처리(`detectForVideo`)하고 랜드마크만 반환 — 외부 추론 API로 영상을 전송하는 경로 없음(모델 파일 자체만 최초 1회 CDN에서 내려받을 뿐).

→ **"원본 카메라 영상은 저장되지 않는다"는 확신할 수 있는 사실**이라 판단해, 지시받은 두 문구 중 확신 가능한 쪽을 채택했다. `MotionScanPage.jsx`의 카메라 대기 화면 안내를 "원본 카메라 영상은 저장하지 않으며, 측정 결과만 사용자 계정에 저장됩니다."로 교체.

## 작업6 — 미출시·과장 기능 노출 제거

코드/데이터는 지우지 않고 조건부 숨김으로 처리(P2에서 다시 켤 수 있도록).

- `mockProfiles.js`: `HIDDEN_BIOMARKER_NAMES` Set을 추가해 `BIOMARKER_METRICS()`가 "Finger Age™"/"Risk Forecast™"를 반환 직전에 필터링. 항목 정의 자체는 그대로 두고 `ReportModule`에 렌더링되지 않게만 함. Pain Trend™ 설명에서 "AI 스마트 보조기의 미세 압력 변화" 문구도 제거(실제 연동 안 된 표현이라 관찰형으로 교체).
- `JOINTRUNShell.jsx`: `SHOW_ARO_DEVICE_CARD = false` 플래그로 HOME의 "스마트 보조기 정렬" 카드 전체를 숨김. 유일한 진입점이 사라져 `PremiumModule.jsx`("스마트 보조기 정밀 조율")와 Calibrator 모달도 자연히 도달 불가능해짐(둘 다 삭제하지 않고 그대로 둠). 소견서 모달 내러티브의 "JOINTRUN 스마트 보조기와" 문구도 제거.
- **Finger Reserve**: `BIOMARKER_METRICS`에 애초에 포함된 적이 없어(데이터 필드로만 존재, 어떤 UI에도 렌더링된 적 없음) 별도 조치 불필요 — 확인만 하고 여기 기록해둠.
- **가상 프로필/예시 데이터가 실제처럼 보이는 문제** — 조사 결과 두 가지를 발견:
  1. `PATIENT_PROFILES_DEFAULT`(김영희/박정자/이민우 목업) fallback은 `App.jsx`의 `AuthGate`가 `currentUser` 없이는 `JOINTRUNShell`을 아예 마운트하지 않기 때문에 **실제로는 도달 불가능한 코드**임을 확인. 이 경로는 실질적 위험이 아니었다.
  2. 대신 더 실질적인 위험을 발견했다 — `AuthContext.jsx`에 `DEMO_USER`(Firebase 미설정 시 자동 로그인되는 가짜 유저, `isDemo` 플래그로 노출됨)가 이미 존재하는데, 이 `isDemo` 플래그가 그동안 **UI 어디에도 쓰이지 않고** 있었다. 만약 실배포(Vercel) 환경변수 설정이 누락되면 실제 방문자가 로그인 없이 "데모 사용자"로 자동 진입해, 저장되지 않는 가짜 데이터를 진짜 계정처럼 보게 될 수 있는 구조였다. `JOINTRUNShell.jsx` 헤더에 `isDemo`일 때만 보이는 배너("데모 모드입니다 — 예시 데이터이며 기록이 저장되지 않습니다")를 추가 — 기존에 이미 존재하던 상태값을 노출하는 조건부 렌더링이라 "새 기능 추가"가 아니라 "조건 분기"로 판단해 진행했다.
  - **실기기/실배포 확인 필요**: Vercel 프로젝트 환경변수에 `VITE_FIREBASE_*`가 정상 설정되어 있는지 대시보드에서 직접 확인 권장 — 이 저장소엔 `.env`가 없어 로컬에서는 항상 데모 모드로 뜨고, 실배포가 실제로 `FIREBASE_ENABLED=true`로 동작하는지는 이 환경에서 검증할 수 없었다.

**주의(중요)**: 작업6의 "숨김"은 런타임 필터링 방식이라 "Finger Age™"/"Risk Forecast™"/"스마트 보조기" 등 문자열 자체는 여전히 JS 번들 소스에 존재한다(작업2의 `import.meta.env.DEV` 분기처럼 빌드 시점에 완전히 제거되는 것과는 다르다). devtools로 번들 소스를 열어보면 문자열을 찾을 수 있지만, 실제 화면(DOM)에는 절대 렌더링되지 않는다. "코드 삭제보다 숨김 우선"이라는 지시를 문자 그대로 따른 결과이며, 완전한 바이트 단위 제거가 필요하면 별도 논의가 필요하다.

## 다음 검토 대상 (이번 P0 범위 밖, 의도적으로 손대지 않음)

- **"대학병원 제출용 소견 PDF" 카드**(ReportModule.jsx)와 소견서 발급 모달 전체(JOINTRUNShell.jsx) — "소견서"/"환자"/"Clinical Diagnostic Referral Sheet" 등 진단서 느낌의 문구가 남아있지만, 이번 작업 지시서의 6개 항목에 명시적으로 포함되지 않아 손대지 않음. Finger Score/아침 강직/스마트 보조기 관련 필드는 이번 세션에서 부분적으로 방어·정리했지만(작업3·4·6), 카드/모달 자체의 존재 여부는 다음 세션에서 별도 검토 필요.
- **`src/services/anthropicCoach.js`의 AI 코치 가드레일 설계** — 이번엔 시스템 프롬프트 문구만 정리(작업1)했고, 대화형 AI의 안전장치 자체를 더 깊게 설계하는 건 별도 세션 검토 대상(이전 세션에서도 같은 이유로 보류함).
- **`BLUEPRINT_SECTIONS`(mockProfiles.js)** — 어디에도 렌더링되지 않는 dead 데이터지만 "예방"/"5년"/"Finger Age" 등 금칙어가 남아있음. 완전히 안 쓰는 코드라 이번엔 정리하지 않았고, 언젠가 파일 자체를 삭제하는 게 더 깔끔할 수 있음.

## 검증 결과

- `npm run build` / `npm run lint`(0 errors) / `npm test`(8 files, 28 tests) 전부 통과.
- 금칙어 grep 재검증(예방/변형/위험 예측/5년/윤활/Finger Age/Finger Reserve/Risk Forecast/스마트 보조기/stiffnessComponent) — 남은 매치는 전부 (a) 코드 주석/false positive, (b) `BLUEPRINT_SECTIONS` dead 데이터(위 "다음 검토 대상" 참고), (c) 작업6에서 필터링으로 숨긴 항목의 소스 정의(런타임에 렌더링 안 됨) 뿐 — **사용자에게 실제로 보이는 화면 기준으로는 0건**.
- 브라우저로 직접 확인: 신규 계정(데모 유저, 스캔 0회) 상태에서 Report 탭에 Finger Age™/Risk Forecast™/Morning Stiffness™ 미노출, Finger Score™는 "측정 전"으로 표시(50점/경고 아님), Pain Trend™ 설명 문구 교체 확인, 데모 모드 배너 정상 표시, 콘솔 에러 없음.
- **실기기 확인 필요(이 환경에서 검증 불가)**:
  - 카메라가 필요한 실제 스캔 플로우 전체(정상 스캔 완료 → 결과 화면 → Report/Timeline 반영) — 이 샌드박스에 카메라 접근이 없어 코드 리뷰로만 검증.
  - 운영 빌드(production)에서 모델 초기화 실패 시나리오의 실제 동작 — DEV/prod 분기 로직과 프로덕션 번들에 "시뮬레이션" 문자열이 없다는 것까지는 확인했지만, 실제 배포 환경에서 MediaPipe 로드 실패를 인위로 재현해 안내 문구가 뜨는 것까지는 확인 못함.
  - Vercel 실배포의 Firebase 환경변수 설정 여부(위 작업6 "실기기/실배포 확인 필요" 참고) — 데모 배너가 실제로 뜨지 않는(=정상 설정된) 상태인지 프로덕션 URL에서 직접 확인 필요.
