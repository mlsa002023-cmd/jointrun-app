# JOINTRUN Master Plan v3 (Claude Code Execution Guide)

## 문서 사용법 (사람이 한 번만 읽는 부분)

1. 이 문서 전체를 레포에 `docs/sprint-plan.md`로 저장한다.
2. "전역 개발 원칙" 섹션만 별도로 `CLAUDE.md`에 저장한다 (아래 부트스트랩 메시지 사용).
3. STEP 0부터 순서대로, **한 번에 하나씩만** Claude Code에 실행시킨다.
4. 각 STEP은 "완료 기준"을 스스로 통과했을 때만 완료로 인정한다.

**CLAUDE.md 부트스트랩 메시지 (최초 1회):**

```
레포 루트에 CLAUDE.md 파일을 만들어줘. docs/sprint-plan.md의
"전역 개발 원칙" 섹션 내용을 그대로 담아줘. 앞으로 모든 세션에서
이 원칙을 항상 지키겠다고 확인해줘.
```

---

## 프로젝트 목표

JOINTRUN은 **AI 측정 앱이 아니라 관절 기록 플랫폼**이다.

> 사용자가 "측정"을 위해 앱을 여는 것이 아니라
> **오늘 내 상태를 확인하기 위해 앱을 여는 경험**을 만든다.

이번 작업에서는 기존 SCAN 기능을 변경하지 않는다.

---

## 전역 개발 원칙 (CLAUDE.md)

모든 작업은 아래 원칙을 반드시 따른다.

**Architecture**
- Clean Architecture 유지
- UI / ViewModel / Repository 계층 분리
- UI에는 비즈니스 로직 작성 금지
- ViewModel에는 UI 코드 작성 금지
- Repository만 Firestore 접근 가능
- State 기반 UI 렌더링
- 기존 코드 우선 재사용

**UI**
- Design System 기반, 화면별 스타일 중복 금지
- 공용 컴포넌트 사용

**Domain**
- Pattern Detection은 Domain Service (`PatternDetector`)
- Firestore 모델과 UI 모델 분리
- Repository는 Interface 우선 설계, 구현체가 이를 따름

**Copy (사용자 노출 문구)**
- 패턴 기반 문구는 관찰형만 사용
- 진단·처방·지시 표현 금지 ("병원 가세요", "염증입니다" 등)

**Quality**
- Build 성공
- Lint 오류 0
- 기존 SCAN 회귀 테스트 통과
- 완료 기준 미충족 시 "완료" 선언 금지

---

## Sprint Definition of Done

아래 조건을 모두 만족해야 Sprint가 종료된다.

- HOME이 기록 중심으로 변경됨
- Timeline 통합 완료
- Event Marker 저장 가능
- Pattern Feedback 표시
- Report 조회 가능
- KPI 이벤트 연결 완료
- Architecture Review 완료 (Critical Issue 0)
- SCAN 기능 정상 동작 (회귀 없음)

이후 기능(PDF 생성·공유, Notification, AI 기반 추천, 결제/거래, 손가락 외 관절 확장)은 다음 스프린트로 미룬다.

---

## 개발 순서

```
0 Audit
 ↓
0.5 Design System
 ↓
1 Domain/Data Layer
 ↓
2 HOME
 ↓
3 Timeline
 ↓
4 Event Marker
 ↓
5 Pattern Feedback
 ↓
6 Report
 ↓
7 Analytics
 ↓
8 Architecture Review
```

---

## STEP 0 — Audit

**목표**: 현재 구현 상태를 정확히 파악한다.

**작업**: 확인만 수행한다. 코드는 수정하지 않는다.

항목별로 아래를 기록한다.
- 상태 (완료 / 부분완료 / 미착수)
- 근거 파일 경로
- 관련 브랜치
- 기술부채
- 재사용 가능 코드
- 리팩토링 필요 여부

결과는 `docs/audit-YYYYMMDD.md`로 저장한다.

**완료 기준**
- Audit 문서 생성됨
- 모든 항목 판정 완료
- 다음 단계 우선순위 제안 포함

---

## STEP 0.5 — Design System

**목표**: 공용 디자인 시스템 구축

**생성**
```
design/tokens/
  color.ts       # Blue #2563EB, Cyan 강조, Health Green
  spacing.ts
  radius.ts
  typography.ts
  motion.ts

components/
  JTCard
  JTButton
  JTSection
  JTListItem
  JTEmptyState
  JTSkeleton
```

레퍼런스 톤: Bevel Health(카드형 요약), aqryl(리스트/스트릭). 색상·간격을 컴포넌트에 하드코딩하지 않고 토큰을 참조한다.

**완료 기준**
- 모든 화면이 새 스타일 작성 없이 공용 컴포넌트만 사용 가능

---

## STEP 1 — Domain / Data Layer

**Repository Interface** — 먼저 Interface, 그 다음 구현체.

```kotlin
interface RecordRepository {
    suspend fun getRecentScans(): List<Scan>
    suspend fun getEvents(): List<Event>
    suspend fun getTimeline(): List<TimelineItem>  // scans+events 병합, 시간순 정렬
    suspend fun addEvent(event: Event)
}

class FirestoreRecordRepository : RecordRepository { /* 구현 */ }
```

ViewModel은 `RecordRepository` 인터페이스에만 의존하고 Firestore를 직접 알지 못한다.

**Domain Service**
```
PatternDetector
```
지원 상태: `Stable` / `Declining` / `Volatile` / `Insufficient`(데이터 부족)

**State**
```
HomeState
TimelineState
ReportState
```

**완료 기준**
- `RecordRepository` 인터페이스와 `FirestoreRecordRepository` 구현체 분리됨
- UI 없이 Repository와 PatternDetector가 단위 테스트/로그로 검증 가능
- `getTimeline()`이 HOME과 Timeline 양쪽에서 재사용 가능한 형태로 동작

---

## STEP 2 — HOME

**목표**: 측정 앱 → 기록 Dashboard

**구조**
```
Home
 ↓ Today Status (상대 변화 문장, 절대 점수 아님)
 ↓ Relative Change
 ↓ Timeline Preview
 ↓ Today Action (PatternDetector 결과)
 ↓ Scan Button (하단, 축소)
```

**규칙**: Finger Score 절대값을 첫 화면 메인으로 노출하지 않는다. 예: "최근 3주 평균과 유사합니다."

**완료 기준**
- 숫자보다 문장이 먼저 보임
- 신규 사용자(스캔 3회 미만) 안내 문구 존재
- 카피 가이드(진단·처방 금지) 준수

---

## STEP 3 — Timeline

**목표**: Decision Log 구현

**기능**: scans + events → 시간순 병합 → 하나의 Timeline. 이벤트 선택 시 전후 변화 Mini Graph 표시.

**테스트 데이터**: Event Marker(4단계)가 아직 없으므로, Firestore 콘솔 수동 입력 대신 시드 스크립트를 사용한다.

```
tools/seed/timelineSeed.ts   →  npm run seed
```

**완료 기준**
- 측정과 (시드) 이벤트가 같은 리스트에 시간순으로 표시됨
- 비교 그래프 표시 (데이터 부족 시 안내 문구)

---

## STEP 4 — Event Marker

기존 `feature/event-marker-ui` 브랜치 작업을 최대한 재사용한다.

**기능**: 8개 Event 타입 + Custom, 2 Tap 저장

**완료 기준**
- 저장 즉시 Timeline에 반영됨 (3단계 시드 데이터 대신 실제 데이터로 재확인)

---

## STEP 5 — Pattern Feedback

`PatternDetector`(1단계에서 생성) 사용. UI에서 새로 판정 로직을 만들지 않는다 — 호출만 한다.

**문구 예시 (관찰형만 허용)**
- "최근 3주 평균과 유사합니다." (Stable)
- "최근 2주간 평소보다 뻣뻣한 날이 증가했습니다." (Declining)
- "최근 기록의 변동성이 증가했습니다." (Volatile)
- "아직 비교할 기록이 충분하지 않습니다." (Insufficient)

**금지 문구**: "병원 방문 권장", "염증입니다" 등 진단·처방·지시형 표현

**완료 기준**
- 문자열 전체 검색으로 가이드 위반 0건 확인
- HOME과 Report가 동일한 `PatternDetector` 인스턴스/모듈을 호출

---

## STEP 6 — Report

조회 전용.

**포함**: 월간 변화, 평균, Event 요약
**제외**: PDF 생성, 공유 (다음 스프린트)

**완료 기준**
- 조회만 가능, 내보내기/공유 버튼 없음(또는 비활성)

---

## STEP 7 — Analytics

기존 `feature/kpi-analytics` 브랜치 작업을 검토 후 재사용한다.

**연결 이벤트**
- `return_scan`
- `timeline_created` (North Star)
- `event_marker_created`
- `session_start`
- `history_comparison_viewed`

**검증**: Firebase DebugView에서 5개 이벤트 확인. `timeline_created`는 사용자당 정확히 1회만 발생하는지 반드시 확인.

**완료 기준**
- 5개 이벤트 정상 전송
- DebugView로 `timeline_created` 중복 없음 확인

---

## STEP 8 — Architecture Review

Claude가 스스로 아래를 점검한다.

- UI에서 Firestore 직접 접근 없음
- Repository 중복 없음
- ViewModel 과대화 없음
- `PatternDetector` 재사용 여부
- 공용 컴포넌트 재사용 여부
- SOLID 위반 여부
- 남은 TODO 존재 여부

결과는 `docs/architecture-review-YYYYMMDD.md`로 저장. **Critical Issue 0개일 때만 Sprint 완료로 선언한다.**

---

## 브랜치 전략

```
main
develop
feature/design-system
feature/domain-layer
feature/home-dashboard
feature/timeline
feature/event-marker      # 기존 feature/event-marker-ui 이어받기
feature/pattern-feedback
feature/report
feature/analytics         # 기존 feature/kpi-analytics 이어받기
release/v1
```

각 feature는 완료 후 `develop`으로 병합. `main`은 `release/v1`을 거쳐서만 갱신. 기존 브랜치는 새로 파지 않고 이어서 사용한다.

---

## 단계별 공통 규칙

각 STEP 종료 시 반드시 수행한다.

1. Build
2. Lint
3. Unit Test
4. Regression Test (SCAN)
5. 완료 기준 체크
6. 변경 파일 요약
7. 다음 단계 영향 분석

완료 기준을 충족하지 못하면 **완료로 선언하지 않는다.**

---

## Claude Code 실행 문구 (STEP별, 한 번에 하나씩)

```
[0] STEP 0 Audit을 수행해줘. docs/sprint-plan.md 기준으로 진행하고,
결과를 docs/audit-YYYYMMDD.md로 저장해줘. 코드는 수정하지 마.

[CLAUDE.md] (문서 맨 위 부트스트랩 메시지 사용)

[0.5] STEP 0.5 Design System을 구축해줘. docs/sprint-plan.md 기준.

[1] STEP 1 Domain/Data Layer를 구축해줘. RecordRepository 인터페이스부터
정의하고 FirestoreRecordRepository로 구현해줘. PatternDetector와
State(HomeState/TimelineState/ReportState)도 이 단계에서 만들어줘.
아직 UI는 만들지 마.

[2] STEP 2 HOME UI를 구현해줘. 1단계 Data Layer를 바인딩하고
Design System 컴포넌트를 사용해줘.

[3] STEP 3 Timeline을 구현해줘. tools/seed/timelineSeed.ts를 만들고
npm run seed로 테스트 데이터를 넣어서 병합 화면을 확인하자.

[4] feature/event-marker-ui 브랜치를 검토하고 STEP 4 완료 기준에 맞게
마무리해줘. 실제 데이터로 Timeline 반영을 재확인해줘.

[5] STEP 5 Pattern Feedback을 구현해줘. PatternDetector를 호출만 하고
새 판정 로직을 만들지 마. 금지 문구 검색해줘.

[6] STEP 6 Report(조회 전용)를 구현해줘. PDF/공유 버튼은 넣지 마.

[7] feature/kpi-analytics 브랜치를 검토하고 STEP 7 이벤트 5종을 연결해줘.
DebugView로 timeline_created 중복 여부 확인해줘.

[8] STEP 8 Architecture Review를 수행해줘. 결과를
docs/architecture-review-YYYYMMDD.md로 저장해줘.

[각 STEP 종료 시 공통] "단계별 공통 규칙" 7가지를 수행하고,
완료 기준을 통과했을 때만 완료라고 알려줘.

[Sprint 마무리] Sprint Definition of Done 8가지를 확인해줘.
전부 통과했을 때만 "Sprint 완료"라고 말해줘.
```
