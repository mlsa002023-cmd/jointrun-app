# V9 정렬 감사 — Gap Matrix

**작성일**: 2026-07-23
**브랜치**: `feat/v9-home-app-alignment` (app / homepage 각각)
**기준 문서**: 대표 제공 실행 패키지(`JOINTRUN_OS_1.0_자동화패키지.zip`) 중 `03_CLAUDE_CODE_BRIEF.md`, `06_QA_GATE.md`, `10_MESSAGE_MATRIX.md`, `00_PROJECT_INSTRUCTIONS.md`. (별도 실행 프롬프트가 지시한 `02_HOME_GAP_MATRIX.md`/`03_HOMEPAGE_COPY_FINAL.md`/`04_APP_PRD_V9.md`/`05_DATA_ANALYTICS_SPEC.md`/`08_QA_ACCEPTANCE_GATE.md`는 이 zip 안에 실존하지 않아 — 채택 불가. 아래 "미해결 사항" 참조.)

---

## 1. 기술 스택 / 배포 구조

| 항목 | jointrun-app | jointrun-homepage |
|---|---|---|
| 스택 | Vite + React 18 + Firebase(Auth/Firestore) + Tailwind, no router (custom tab state) | 순수 정적 HTML/CSS/JS, 빌드 도구 없음 |
| 배포 | Vercel (`vercel.json` 확인) | GitHub Pages (`CNAME` → www.jointrun.kr), CI 없음 |
| 결제 | 없음. `docs/sprint-plan.md`가 "결제/거래"를 명시적으로 향후 스프린트로 유보 | 없음. 가격 언급 자체가 없음 |
| 분석 | GA4 + Microsoft Clarity + 자체 `trackEvent`/`trackKpiEvent` | 없음 (스크립트 확인 안 됨) |
| AI | `src/services/anthropicCoach.js` — 브라우저에서 Anthropic API 직접 호출, 시스템 프롬프트가 여전히 "온수 스트레칭/보조기 착용 권장" 등 지시형 표현 사용 중 | 없음 |

## 2. 핵심 흐름 Gap — 이것이 가장 큰 항목

현재 두 레포는 **"Finger Health Score라는 합성 점수를 측정·조회하는 앱"** 이라는 정체성으로 만들어져 있습니다. V9가 요구하는 정체성은 **"트리거 → 기준선 → 2주/4주 재확인 → 과거 나와 비교 → Decision Log → Outcome"** 이라는 판단 루프입니다. 이 둘은 부분 수정으로 연결되지 않고, **핵심 데이터 모델과 홈페이지 전체 구조를 다시 짜야 하는 수준의 전환**입니다.

| V9 요구 흐름 단계 | 현재 상태 | Gap |
|---|---|---|
| 트리거 선택(통증/뻣뻣함, 변형 우려, 기능저하, 붓기/열감, 치료 시작) | 없음. `MotionScanPage.jsx`는 트리거 없이 바로 3-포즈 촬영 시작 | **신규 구현 필요** |
| 가이드 촬영 품질(정렬/거리/조명/각도/흔들림) | `motionAnalyzer.js`가 포즈 모양(주먹/OK/펼침) 일치 여부만 검증. 조명·거리·흔들림 체크 **전무** | **신규 구현 필요** |
| 증상·상황 기록(체감값과 선택 맥락 분리) | `checkins`(붓기/피로)는 있으나 "왜 지금 촬영하는가"라는 맥락 필드 없음 | **부분 존재, 재설계 필요** |
| 첫 기준선(Personal Baseline) | Firestore에 `baseline` 개념 자체가 없음. 모든 스캔이 동등한 `scans/{id}` | **데이터 모델 신규 필요** |
| 2주·4주 재확인 예약/알림 | 없음 | **신규 구현 필요** |
| 같은 조건 재촬영 안내 | 없음 | **신규 구현 필요** |
| 과거/현재 비교 | `relativeChange.js`, `TimelineModule`이 유사 기능 수행 중이나 "기준선 대비"가 아니라 "최근 추세"로 계산됨 | **부분 존재, 기준 재정의 필요** |
| Decision Log(무엇을 왜 선택) | `EventMarkerModal`이 근접값(병원 방문 등 5개 타입)은 있으나 "선택 이유" 자유 기록/구조화 필드 없음 | **부분 존재, 확장 필요** |
| Outcome(결과 관찰) | 없음 | **신규 구현 필요** |
| 타임라인/PDF 리포트 | 타임라인 있음(`TimelineModule`). PDF/공유 리포트는 없음 | **부분 존재** |

## 3. 점수·Inflammation·추천 로직 — 삭제/은닉 대상 전수 목록

`src/lib/fingerHealthScore.js`(`SCORE_VERSION v2.0`)를 정점으로 아래 파일들이 전부 절대 점수를 계산·저장·표시합니다:

- `src/lib/fingerHealthScore.js` — Mobility/Stability/**Inflammation**/Recovery 4개 하위점수 + 가중합 `computeFingerHealthScore`
- `src/lib/motionAnalyzer.js` — 손가락별 0-100 점수, `buildRecommendation()`
- `src/components/MotionScanPage.jsx`, `src/components/JOINTRUNShell.jsx` — 점수 계산·저장 호출
- `src/data/mockProfiles.js`의 `BIOMARKER_METRICS()` — "Finger Score™", "Pain Trend™" 노출
- `src/components/tabs/ReportModule.jsx`, `MonthlyTrendChart.jsx`("Finger Score™" 제목), `TimelineModule.jsx`, `home/RecentTimelinePreview.jsx`, `EventDetailModal.jsx` — 원점수 렌더링
- `src/lib/getTodayAction.js` — 규칙 기반 "오늘의 행동" 자동 추천
- `src/services/anthropicCoach.js` — AI가 여전히 구체적 처치를 "권장"
- **`src/data/mockProfiles.js`의 `BLUEPRINT_SECTIONS`** — 사용되지 않는 죽은 코드지만 "Finger Age™", "Finger Reserve™", "Risk Forecast™(24시간 내 통증 예측)" 등 금지 문구가 여전히 남아있음

홈페이지(`jointrun-homepage/index.html`)는 이 5개 지표 모델(Mobility/Stability/**Inflammation**/Recovery/Habit) 자체가 Hero부터 시작해 전체 구조의 중심입니다. 히어로 문구, `#score` 섹션, 사용 방법(How it works) 5단계, 심지어 "Inflammation 지표가 7일 평균보다 11% 높아요. 3분 온수 스트레칭을 추천해요" 같은 처방형 문장까지 모두 이 점수 모델 위에 지어져 있습니다.

**중요 — 과거 기록과의 충돌**: 이전 대화에서 "Finger Health Score는 반드시 Mobility/Stability/Inflammation/Recovery/Habit 5개 지표만 사용"이라는 브랜드 규칙을 확정한 적이 있습니다(메모리 기록 `jointrun_homepage`). V9는 이 점수 모델 자체를 없애는 방향이라 **이 결정을 뒤집는 것**입니다. 대표님 확인이 필요합니다 (아래 CEO 결정 항목 참조).

## 4. 분석 이벤트 Gap

| 현재 이벤트 | V9 요구 이벤트 |
|---|---|
| `session_start`, `return_scan`, `timeline_created`, `event_marker_created`, `history_comparison_viewed` | `capture_started`, `capture_completed`, `baseline_created`, `recheck_due`, `recheck_completed`, `comparison_viewed`, `decision_logged`, `outcome_logged`, `four_week_completed`, `premium_started`, `dropoff_reason_submitted` |

**완전히 다른 이벤트 세트입니다.** 겹치는 것은 `comparison_viewed`(≈`history_comparison_viewed`) 정도. KPI 5개(Scan Completion 80%+, Event-to-Recheck 35%+, 비교 화면 사용 60%+, 4주 완주 Premium 전환 5%+, 전문가 유용성 70%+) 중 지금 계산 가능한 것은 사실상 없습니다 — Recheck·Baseline·Decision Log 이벤트 자체가 없기 때문입니다.

개인정보 검토: 현재 이벤트 payload에는 PII/이미지/자유서술이 섞이지 않음(코드 확인 완료). Microsoft Clarity는 세션 리플레이라 화면에 보이는 memo 텍스트를 시각적으로 캡처할 가능성은 코드 검토만으로 확인 불가 — 별도 설정 점검 필요.

## 5. 가격/결제

V9 요구: 무료 기준선 → 4주 패키지 19,900원 → Premium 월 9,900원.
현재: **가격 개념, 결제 연동, feature flag 무엇도 존재하지 않음.** `docs/sprint-plan.md`가 결제를 명시적으로 다음 스프린트로 유보한 상태 그대로입니다. 실제 결제(PG 연동)는 이번 범위 밖(exec prompt도 "가격은 feature flag로 가역성 유지"라고만 요구 — 실결제 붙이라는 지시 아님)이라고 해석했습니다.

## 6. 삭제/통합/신규 구현 목록 (요약)

- **삭제/은닉**: `BLUEPRINT_SECTIONS` 죽은 코드(즉시 삭제 가능, 리스크 없음), 절대 점수 UI 노출(`legacyScoreExperiment` 플래그 뒤로), AI Coach의 처방형 문구
- **재설계**: Firestore 스키마(`scans` → `baselines`/`rechecks`/`comparisons` 개념 추가, `schemaVersion` 상향), `EventMarkerModal`(Decision Log로 확장), 홈페이지 전체 정보구조
- **신규**: 트리거 선택 UI, 촬영 품질 가드(조명/거리/흔들림), 2·4주 재확인 스케줄링, Outcome 기록, 가격 페이지(flag), 신규 분석 이벤트 11종, 데이터 마이그레이션 스크립트

## 7. 위험도 / 의존성

- **High**: 점수 모델 제거는 과거 확정 브랜드 결정을 뒤집음 + 실사용 데이터가 있다면 기존 `scans.scores` 하위호환 필요
- **High**: 홈페이지는 현재 살아있는 마케팅 사이트(www.jointrun.kr) — 구조 전체 교체는 SEO/기존 방문자 영향
- **Medium**: 앱의 Firestore 스키마 변경은 기존 사용자 데이터 마이그레이션 필요 (아직 실사용자 규모 확인 안 됨)
- **Medium**: 실행 프롬프트가 지시한 정확한 카피/PRD/QA 기준 문서(`03_HOMEPAGE_COPY_FINAL.md` 등)가 실제로 존재하지 않아, 정확한 최종 문구·화면별 수용기준 없이 진행하면 임의 카피 작성이 됨

## 8. 제안 커밋 순서 (합의 시)

1. `chore: BLUEPRINT_SECTIONS 죽은 코드 삭제` (무위험)
2. `feat: Personal Baseline/Recheck/DecisionLog/Outcome 데이터 모델 추가 (schemaVersion 상향, 기존 데이터 보존)`
3. `feat: 트리거 선택 + 촬영 품질 가드 UI`
4. `feat: 기준선 저장 + 2·4주 재확인 스케줄`
5. `feat: 비교 화면 재정의 (기준선 대비)`
6. `feat: Decision Log/Outcome 확장`
7. `feat: 신규 분석 이벤트 11종 + KPI 쿼리`
8. `feat: 점수 UI legacyScoreExperiment 플래그 은닉`
9. `feat: 가격 페이지(flag)`
10. 홈페이지: Hero/구조/카피 전면 교체 (별도 레포, 별도 브랜치)

## 9. 테스트 전략 / 롤백

- Unit: 상태 전이, 재확인 날짜 계산, KPI 계산, feature flag on/off
- Integration: 기준선 생성→재확인→비교→Decision Log→Outcome 전체 경로
- Regression: 기존 로그인/촬영/타임라인/리포트가 flag off 상태에서 그대로 동작하는지
- 롤백: 모든 신규 UI는 feature flag 뒤에 두어 flag off 시 즉시 현재 상태로 복귀 가능. Firestore는 필드 추가만 하고 기존 필드를 삭제하지 않아 스키마 롤백 불필요.

---

## 미해결 사항 (진행 전 확인 필요)

1. 실행 프롬프트가 지시한 소스 문서 5개(`02_HOME_GAP_MATRIX.md`, `03_HOMEPAGE_COPY_FINAL.md`, `04_APP_PRD_V9.md`, `05_DATA_ANALYTICS_SPEC.md`, `08_QA_ACCEPTANCE_GATE.md`)가 첨부 zip 안에 없습니다. zip에는 대신 `03_CLAUDE_CODE_BRIEF.md`(저를 위한 실제 지시서, 흐름/데이터모델/이벤트명은 있으나 홈페이지 최종 카피·화면별 PRD·QA 수용기준 상세본은 없음)가 들어있습니다. 정확한 홈페이지 최종 문구와 화면별 상세 요구사항 없이 진행하면 제가 임의로 카피를 창작하게 됩니다.
2. 이전에 확정하셨던 "Finger Health Score = Mobility/Stability/Inflammation/Recovery/Habit 5개 지표" 브랜드 규칙과 V9의 "절대 점수 없음" 방향이 정면 충돌합니다.
3. 범위가 앱 데이터모델 재설계 + 홈페이지 전면 개편 + 결제 플래그 + 분석 이벤트 11종 + E2E 테스트로, 실제로는 수 주 분량입니다. 한 번에 다 구현하고 "완료"라 보고하면 얕은 결과물이 될 위험이 큽니다.
