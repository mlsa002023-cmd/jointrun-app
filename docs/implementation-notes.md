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
- 브라우저 수동 확인: Report 탭에 "이번 달" 구획이 예상한 순서(요약→그래프→이벤트 요약→대표 변화)대로 렌더링되고, 데이터가 없는 상태에서 4개 모두 관찰형 안내 문구로 정상 대체됨을 확인. 콘솔 에러 없음.
