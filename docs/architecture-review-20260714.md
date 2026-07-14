# JOINTRUN Architecture Review — 2026-07-14

STEP 8 of `JOINTRUN_마스터플랜_v3_실행지침서.md`. Checked after STEP 0~7's retrofit (DataSource → Repository → Hook → UI) was complete and merged into `develop`.

Checklist per the master plan's own STEP 8 ask, plus the "공용 컴포넌트 재사용 여부" follow-up from this review itself.

---

## 1. UI 컴포넌트의 Firestore 직접 접근 금지

**결과: Critical 0, Minor 1건**

- `grep -rl "from.*lib/firestore" src/components src/hooks src/data` → `src/data/recordRepository.js`(정상, DataSource 계층 자신) + `src/components/JOINTRUNShell.jsx`.
- `JOINTRUNShell.jsx`가 여전히 `lib/firestore`에서 `saveScanRecord`, `saveCheckIn`, `saveProfileSnapshot`, `getProfileSnapshot`, `getEventHistory`, `getLatestConditionCheckIn`, `recordHabitActivity`, `getHabitActivity`, `flushPendingEvents`를 직접 import한다.
- **판정: Minor(비차단).** 마스터플랜 STEP 1이 정의한 `RecordRepository` 인터페이스는 `getRecentScans`/`getEvents`/`getTimeline`/`addEvent` 4개뿐이며, 이번 스프린트에서 실제로 요청받은 리팩토링 범위도 "HOME/Timeline/Report/EventMarker가 보는 scan+event 조회·기록"이다. 스캔 완료 저장, 체크인, 프로필 스냅샷, 습관 활동 기록은 그 4개 메서드 밖의 책임이라 이번 스프린트에서 Repository로 옮기지 않았다. SCAN 자체를 건드리지 않는다는 이번 스프린트의 원칙과도 맞물려 있어, 임의로 확장하면 오히려 회귀 위험이 커진다.
- **다음 스프린트 제안**: `recordRepository`를 `saveScan`/`saveCheckIn`/`saveProfile`/`getProfile`/`recordHabit`/`getHabit`까지 확장하거나, 별도의 `sessionRepository`로 분리해 `JOINTRUNShell`이 `lib/firestore`를 전혀 모르게 만드는 것.

## 2. Repository는 정확히 한 곳에서만 정의

**결과: 통과**

- `createRecordRepository`는 `src/data/recordRepository.js` 1곳에서만 정의되고, `src/hooks/useRecordRepository.js`가 `useMemo`로 감싸 훅으로 노출하는 유일한 경로다.

## 3. UI가 Repository를 직접 호출하지 않고 Hook을 통해서만 접근

**결과: 통과 (의도된 예외 1건 문서화)**

- `HomeModule`/`TimelineModule`/`ReportModule`/`RecentTimelinePreview`는 모두 `useHomeData`/`useTimelineData`/`useReportData`를 통해서만 데이터를 받는다.
- `EventMarkerModal.jsx`만 `useRecordRepository()`를 직접 호출해 `repository.addEvent()`를 쓴다. 이는 마스터플랜이 스스로 예외로 둔 지점("쓰기 작업은 훅이 아니라 직접 호출해도 무방")과 일치하며, 읽기 전용 데이터 흐름(Hook)과 쓰기 동작(Repository 직접 호출)을 구분한 것으로 의도된 설계다.

## 4. PatternDetector가 한 곳에서만 판정 로직을 가짐

**결과: 통과**

- `PatternDetector.detect()` 호출은 `PatternInsightCard.jsx` 1곳뿐이며, HOME과 REPORT 양쪽 모두 이 카드를 공유해서 쓴다. 판정 로직 중복 없음.

## 5. 공용 컴포넌트(JT*) 재사용 여부

**결과: 발견 → 이번 리뷰에서 수정 완료**

- 발견 당시: `JTSection 0개 파일`, `JTListItem 0개 파일` — 두 컴포넌트가 STEP 0.5에서 만들어졌지만 어디에도 채택되지 않은 죽은 코드였다.
- **조치:**
  - `src/components/tabs/ProfileModule.jsx` — 3개 메뉴 버튼(걱정 부위 설정/AI 코치/커뮤니티)을 `JTListItem`으로 교체(아이콘·라벨·서브라벨·chevron 패턴이 정확히 일치), 로그아웃 버튼은 `JTButton variant="ghost"`로 교체.
  - `src/components/tabs/home/RecordSection.jsx` — 컨디션 체크인 카드와 회복 미션 카드(제목+trailing count 패턴) 2곳을 `JTSection`으로 교체.
  - `src/components/tabs/TimelineModule.jsx` — "전체 기록" 카드를 `JTSection`으로 교체.
- 수정 후 재검증: `JTCard 7개`, `JTButton 4개`, `JTSection 3개`, `JTListItem 2개`, `JTEmptyState 4개`, `JTSkeleton 4개` 파일 — 6개 컴포넌트 전부 최소 1곳 이상에서 사용 중.
- 시각적 회귀 없음 — PROFILE/HOME/TIMELINE 3개 화면을 브라우저에서 재확인, 스타일·레이아웃·동작 100% 동일.

## 6. TODO / FIXME / XXX 잔존 여부

**결과: 통과 — 0건**

## 7. Lint / Build / Test 게이트

**결과: 통과**

- `npm run lint` — 0 errors, 22 warnings(전부 이번 스프린트 이전부터 있던 기존 코드의 `exhaustive-deps`/`no-unused-vars`류 경고, 새로 추가된 오류 없음).
- `npm run build` — 성공 (2367 modules, 2.28s).
- `npm run test` — 21/21 통과 (recordRepository, PatternDetector, useHomeData, useTimelineData, useReportData, EventMarkerModal, UI 컴포넌트 8종).

---

## 종합 판정

**Critical Issue: 0건.** Minor Issue 1건(JOINTRUNShell의 잔여 직접 Firestore 접근)은 이번 스프린트 범위 밖 항목이라 비차단으로 분류, 다음 스프린트 후속 과제로 기록.

→ Sprint Definition of Done 8개 항목 중 7번(Architecture Review)은 이 문서로 완료.
