# JOINTRUN Architecture Review — 2026-07-16

STEP 8 of `docs/sprint-plan.md`. 지난 리뷰(`architecture-review-20260714.md`, STEP 0~7 레트로핏 직후)와 오늘 사이에 있었던 작업을 대상으로 한다: STEP 2 HOME 잔여 정리(ARO/소견 PDF/Risk Forecast·Finger Age/진단성 카피 제거), STEP 4 Timeline 즉시 반영 버그 수정, STEP 7 `session_start` 추가, 서비스 워커 캐시 버전 무효화, 그리고 Report 탭 "이번 달" 콘텐츠(월간 요약·추이·Event 요약·대표 변화) 신규 추가.

체크리스트는 이번 요청에서 지정한 8개 항목.

---

## 1. UI에서 Firestore/데이터 직접 접근 없음

**결과: Critical 0, Minor 1건 (기존과 동일, 악화 없음)**

- `grep -rl "from.*lib/firestore" src/components src/hooks src/data` → `src/data/recordRepository.js`(정상, DataSource 계층 자신) + `src/components/JOINTRUNShell.jsx`.
- `JOINTRUNShell.jsx`가 여전히 `saveScanRecord`/`saveCheckIn`/`saveProfileSnapshot`/`getProfileSnapshot`/`getEventHistory`/`getLatestConditionCheckIn`/`recordHabitActivity`/`getHabitActivity`/`flushPendingEvents`를 `lib/firestore`에서 직접 import한다 — **20260714 리뷰에서 이미 Minor로 판정된 동일 항목**이고, 오늘 세션에서 이 부분은 건드리지 않았다(제거한 건 `Printer` import·소견서 모달 관련 코드뿐). 범위·성격 변화 없음.
- `src/firebase/config.js`가 `firebase/app`·`firebase/auth`·`firebase/firestore`를 직접 import하지만 이는 SDK 초기화 전용 파일(app/auth/db 인스턴스 생성)로, 쿼리 로직이 없어 위반 아님.
- 오늘 신규 추가된 파일(`monthlyTrend.js`, `monthlyEventSummary.js`, `eventComparison.js`의 `findMostNotableEvent`, `useMonthlyReportData.js`, `report/*` 컴포넌트) 중 Firestore를 직접 아는 코드는 0건 — 전부 이미 정규화된 `scans`/`timelineItems`를 인자로 받아 순수 함수로 처리한다.

## 2. Repository 중복 없음

**결과: 통과**

- `createRecordRepository` 정의는 `src/data/recordRepository.js` 1곳뿐. `useRecordRepository.js`가 `useMemo`로 감싸는 유일한 경로도 그대로. 오늘 추가한 어떤 파일도 별도 Repository나 Firestore 접근 경로를 새로 만들지 않았다 — `useMonthlyReportData`는 기존 `useTimelineData()`(→ 기존 Repository)를 그대로 재사용한다.

## 3. Custom Hooks 과대화 없음 (useMonthlyReportData, useTimelineData 포함)

**결과: 통과**

라인 수 기준:

| Hook | 라인 수 | 책임 |
|---|---|---|
| `useRecordRepository.js` | 9 | Repository 인스턴스 메모이제이션 |
| `useMonthlyReportData.js` | 19 | 월간 파생 데이터 4종 조합(fetch 없음) |
| `useReportData.js` | 21 | scans fetch |
| `useTimelineData.js` | 35 | scans+events fetch, 병합, 저장 이벤트 구독 |
| `useHomeData.js` | 38 | scans fetch, scanCount/트렌드 판정 |

전부 30줄 안팎, 단일 책임 유지. `useMonthlyReportData`는 fetch를 직접 하지 않고 `useTimelineData()` 호출 + 4개 순수 함수(`detectMonthlyPattern`/`computeMonthlyTrend`/`summarizeMonthlyEvents`/`findMostNotableEvent`) 위임으로만 구성되어 "과대화" 없음 — 로직은 각 `lib/*.js` 파일에 분리돼 있다.

## 4. PatternDetector 재사용 여부 (detectMonthly가 기존 구조를 깨지 않았는지)

**결과: 통과**

- `PatternDetector.detect()` 호출은 여전히 `PatternInsightCard.jsx` 1곳뿐 — HOME(`HomeModule`)과 REPORT(`ReportModule`)가 이 카드를 공유해서 쓰는 기존 구조 그대로.
- `PatternDetector.detectMonthly()` 호출은 신규 `useMonthlyReportData.js` 1곳뿐.
- `detectPattern()` 시그니처에 세 번째 인자(`{ windowDays, patterns }`, 둘 다 기본값 존재)를 추가했지만 **기본값이 기존 상수(`WINDOW_DAYS=14`, `PATTERNS`)와 동일**해서 기존 호출부(`PatternDetector.detect(scans)`)는 인자를 안 바꿔도 동작·출력이 100% 동일 — 실제로 `PatternDetector.test.js`(기존 테스트, 오늘 수정 안 함)가 그대로 통과함으로 재확인됨.
- 판정 로직(평균 비교 8%, 변동계수 12% 임계값) 자체는 `detectPattern()` 본문 하나뿐 — `detectMonthlyPattern()`은 윈도우 크기와 문구만 바꿔 얇게 위임하는 래퍼라 판정 로직 중복 없음.

## 5. 공용 컴포넌트(JTCard 등) 재사용 여부

**결과: 통과 — 6종 전부 사용 중, 오늘 자로 채택 범위 확대**

| 컴포넌트 | 사용 파일 수 (20260714 리뷰 시점 → 현재) |
|---|---|
| JTCard | 7 → 10 |
| JTSection | 3 → 4 |
| JTListItem | 2 → 3 |
| JTEmptyState | 4 → 5 |
| JTButton | 4 → 4 |
| JTSkeleton | 4 → 5 |

증가분은 대부분 오늘 신규 작성한 `report/*` 4개 컴포넌트(`MonthlySummaryCard`/`MonthlyTrendChart`/`MonthlyEventSummary`/`MonthlyHighlightCard`)가 `JTCard`/`JTSection`/`JTListItem`/`JTEmptyState`/`JTSkeleton`을 그대로 갖다 쓴 결과 — 새 스타일 마크업을 직접 작성하지 않았다(STEP 0.5 완료 기준 그대로 유지).

## 6. SOLID 위반 여부

**결과: Critical 0, 기존 Minor 1건 그대로(JOINTRUNShell)**

- **SRP**: 오늘 추가한 4개 `lib/*.js`(월간 집계/그룹핑/선택)와 `useMonthlyReportData`는 각각 책임이 하나씩이라 위반 없음. `JOINTRUNShell.jsx`(411줄 — 오늘 레거시 마크업 제거로 이전보다 83줄 감소)는 여전히 탭 라우팅·KPI 판정·모달 여러 개·바텀 네비게이션을 한 파일에서 다루는 대형 컴포넌트라 SRP상 이상적이진 않지만, 이는 20260714 리뷰 시점부터 있던 기존 구조이고 오늘은 오히려 줄어드는 방향으로 움직였다 — 새 위반 아님.
- **OCP**: `detectPattern(scans, now, { windowDays, patterns })`는 기존 코드를 수정하지 않고 옵션으로 확장한 좋은 예 — 기본 동작 변경 없이 월간 케이스를 추가했다.
- **DIP**: 새 코드 전부 Repository/Hook 계층을 통해서만 데이터를 받고, Firestore를 직접 알지 못한다.
- **ISP**: `PatternDetector`가 `detect`/`detectMonthly` 두 메서드를 노출하지만 각 소비자는 필요한 것 하나만 쓴다 — 인터페이스 오염 없음.

## 7. 남은 TODO 존재 여부

**결과: 통과 — 0건** (`TODO`/`FIXME`/`XXX` 전체 검색, `src/` 기준)

## 8. Performance

### 8-1. 불필요한 리렌더링

**결과: 특이사항 없음.** `ReportModule`은 `monthly.loading`으로 스켈레톤/본문을 가르는 표준 패턴이고, 새 프레젠테이션 컴포넌트(`MonthlySummaryCard` 등)는 전부 얕은 primitive/plain-object props만 받는 리프 컴포넌트라 불필요한 리렌더링 유발 지점 없음.

### 8-2. useMemo/useCallback 과용

**결과: 과용 없음 — 오히려 신규 코드엔 전혀 안 씀.** 기존 코드의 `useMemo`/`useCallback` 사용처(`useRecordRepository`의 uid 기반 메모이제이션, `AuthContext`/`MotionScanPage`/`JOINTRUNShell`의 안정적 함수 참조용 `useCallback`)는 전부 목적이 뚜렷한 최소 사용. 오늘 추가한 `useMonthlyReportData`는 `summary`/`trend`/`eventGroups`/`highlight`를 매 렌더마다 재계산하지만, 입력이 최대 30건짜리 배열이고 계산이 단순 루프/평균이라 메모이제이션 비용 대비 이득이 없는 규모 — 과용도 과소 최적화 문제도 아님.

### 8-3. React key 안정성

**결과: 특이사항 없음.** `MonthlyEventSummary`의 `key={group.type}`는 타입별로 유일해 안정적. `MonthlyTrendChart`의 `<Cell key={i}>`는 index key지만, `TimelineModule.jsx:113`의 기존 Finger Score™ 차트와 정확히 동일한 패턴(Recharts `Cell`은 막대 위치별 색상 오버레이라 재정렬되지 않는 고정 배열) — 새로 도입한 안티패턴이 아니라 기존 관례를 그대로 따른 것.

### 8-4. 데이터 중복 호출

**결과: Medium 1건 — 오늘 작업으로 새로 생김.**

`ReportModule`이 `useReportData()`와 `useMonthlyReportData()`를 둘 다 호출하는데:
- `useReportData()` → 자체적으로 `getRecentScans(30)` 호출 (기존, `PatternInsightCard`용)
- `useMonthlyReportData()` → 내부에서 `useTimelineData()` 호출 → 또 별도로 `getRecentScans(30)` + `getEvents(30)` 호출

**즉 REPORT 탭 진입 시 `getScanHistory(uid, 30)`가 두 번 호출된다.** 기능적으로는 문제없지만(각자 독립적으로 fetch해서 최종 렌더링 결과는 정확함) Firestore 읽기 비용이 불필요하게 2배다. Critical은 아니지만 다음 스프린트에서 `useReportData()`가 `useTimelineData()`를 재사용하도록 통합하거나, `useMonthlyReportData()`가 `useReportData()`의 `scans`를 인자로 받는 방식으로 정리를 권장한다.

별도로, `TimelineModule`과 `RecentTimelinePreview`가 각각 독립적으로 `useTimelineData()`를 호출하는 것은 **20260714 시점부터 있던 기존 설계**(HOME/TIMELINE 탭은 동시에 마운트되지 않으므로 탭 전환마다 재조회, 캐싱 없음)이고 오늘 새로 생긴 문제는 아니다. 다만 오늘 `useMonthlyReportData`가 세 번째 독립 호출자로 추가되면서 "탭마다 각자 재조회"라는 동일한 패턴이 REPORT 탭에도 새로 적용됐다 — 위 Medium 항목과 함께 다음 스프린트에서 캐싱/공유 레이어(예: 최상위에서 1회 fetch 후 Context로 공유, 또는 SWR류 캐시)를 검토할 시점으로 보인다.

---

## 종합 판정

**Critical Issue: 0건.**

Minor/Medium 3건, 전부 비차단:
1. (기존, 변화 없음) `JOINTRUNShell.jsx`의 잔여 직접 Firestore 접근 — 이번 스프린트 범위 밖.
2. (기존, 오늘 새 호출자 1곳 추가) `useTimelineData()`가 탭마다 독립 호출되어 캐싱 없이 재조회됨.
3. (오늘 신규) REPORT 탭에서 `getScanHistory`가 `useReportData`/`useMonthlyReportData` 양쪽에서 중복 호출됨 — 다음 스프린트 정리 권장.

→ Sprint Definition of Done 8개 항목 중 7번(Architecture Review)은 이 문서로 완료. 나머지 7개는 아래에서 확인.

---

## Sprint Definition of Done (8개 항목)

| # | 항목 | 상태 | 비고 |
|---|---|---|---|
| 1 | HOME이 기록 중심으로 변경됨 | ✅ | ARO 카드·Primary Scan CTA 상단 배치 제거(오늘 세션), RelativeChange→Pattern→TodayAction→TodayStatus→Record 순서 유지 |
| 2 | Timeline 통합 완료 | ✅ | scans+events 병합, 전후 비교 그래프, 시드 스크립트 — STEP 3 기준 충족(이전 확인) |
| 3 | Event Marker 저장 가능 | ✅ | 7타입+Custom, 2탭 저장, **오늘 즉시 반영 버그 수정**으로 저장 직후 Timeline/RecentTimelinePreview 리마운트 없이 갱신 확인 |
| 4 | Pattern Feedback 표시 | ✅ | HOME/Report 동일 `PatternDetector` 모듈 재사용(위 4번 항목), 진단성 문구 전체 재검색 0건(오늘 세션) |
| 5 | Report 조회 가능 | ✅ | 내보내기/공유 버튼 없음(비활성이 아니라 아예 제거), **오늘 월간 요약/추이/Event 요약/대표 변화 4종 추가** |
| 6 | KPI 이벤트 연결 완료 | ⚠️ 조건부 | `return_scan`/`timeline_created`/`event_marker_created`/`history_comparison_viewed`/`session_start` 5개 전부 코드상 연결 확인. **다만 이 저장소엔 `.env`/Firebase 프로젝트가 없어 Firebase DebugView로 실제 전송·`timeline_created` 중복 없음을 실측 검증하지 못함** — 코드 경로만 확인된 상태, 실제 Firebase 프로젝트가 연결된 환경에서 DebugView 확인 필요 |
| 7 | Architecture Review 완료 (Critical Issue 0) | ✅ | 이 문서, Critical 0건 |
| 8 | SCAN 기능 정상 동작 (회귀 없음) | ⚠️ 조건부 | `MotionScanPage.jsx`/`motionAnalyzer.js`/`handTracker.js`/`fingerHealthScore.js` 등 SCAN 관련 파일 이번 스프린트 기간 동안 **변경 이력 0건**(git diff 확인) + build 성공. **다만 이 저장소엔 SCAN 전용 자동화 테스트가 없고, 이 환경엔 카메라 접근이 안 돼 실제 스캔 플로우를 직접 실행해 확인하지 못했다** — 코드 미변경으로 회귀 위험은 낮지만, 실기기/브라우저에서의 수동 확인 권장 |

**결론**: Critical Issue 0건으로 Architecture Review는 통과. 다만 6번·8번이 "환경 제약으로 인한 미검증"이라 **"Sprint 완료"를 선언하려면 실제 Firebase 프로젝트에서 DebugView 확인 + 실기기에서 SCAN 수동 확인 2가지가 먼저 필요**하다 — 코드 관점에서는 8개 항목 모두 준비돼 있지만, 이 두 항목은 이 환경의 한계로 "코드는 맞다, 실측은 아직"인 상태임을 분명히 해둔다.
