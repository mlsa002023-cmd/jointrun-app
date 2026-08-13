# JOINTRUN 데이터 모델·분석 이벤트 명세

## 1. 핵심 엔터티

### User
- userId
- createdAt
- ageBand: 40s/50s/60s/70s/other
- consentVersion
- consentedAt
- notificationConsent
- deletedAt

### PersonalBaseline
- baselineId
- userId
- eventId
- capturedAt
- handSide
- captureId
- symptomSnapshot
- captureProtocolVersion
- schemaVersion
- appVersion

### Event
- eventId
- userId
- primaryTrigger
- secondaryTriggers[]
- occurredAt
- status
- contextNote
- baselineId
- nextRecheckDueAt
- createdAt/updatedAt

### Capture
- captureId
- eventId
- type: baseline/recheck
- imageRef
- handSide
- qualityStatus: pass/retry/unreliable
- qualityFlags[]
- landmarksRef
- lightingScoreInternal
- blurScoreInternal
- alignmentScoreInternal
- captureProtocolVersion
- algorithmVersion
- appVersion
- capturedAt

내부 품질값은 비교 가능성 판단에만 쓰고 사용자에게 건강점수처럼 노출하지 않는다.

### SymptomSnapshot
- painSelfReport: 0-10
- stiffnessSelfReport: 0-10
- swellingSelfReport: none/mild/high/unknown
- warmthSelfReport: none/present/unknown
- functionDifficulty: none/mild/moderate/high
- note
- recordedAt

### Recheck
- recheckId
- eventId
- dueType: week2/week4/custom
- dueAt
- status: scheduled/due/completed/skipped/expired
- captureId
- symptomSnapshot
- completedAt

### Comparison
- comparisonId
- eventId
- baselineCaptureId
- currentCaptureId
- comparable: true/false
- nonComparableReasons[]
- userPerceivedChange
- symptomDeltaDisplay
- viewedAt

### DecisionLog
- decisionId
- eventId
- actionTypes[]
- reasonTypes[]
- startedAt
- note
- loggedAt

### Outcome
- outcomeId
- eventId
- perceivedOutcome: less_discomfort/same/more_discomfort/unclear
- nextPlan: continue/change/stop/consult/undecided
- note
- loggedAt

### Report
- reportId
- eventId
- reportType: week4/timeline/clinic_share
- generatedAt
- version
- fileRef

### Offer/Subscription
- offerId
- offerType: free/week4/premium
- price
- currency
- featureFlag
- checkoutStatus
- purchasedAt
- cancelledAt

## 2. Firestore 권장 컬렉션
- users/{userId}
- users/{userId}/events/{eventId}
- users/{userId}/events/{eventId}/captures/{captureId}
- users/{userId}/events/{eventId}/rechecks/{recheckId}
- users/{userId}/events/{eventId}/decisions/{decisionId}
- users/{userId}/events/{eventId}/outcomes/{outcomeId}
- users/{userId}/reports/{reportId}
- users/{userId}/consents/{consentId}
- analytics_events/{eventLogId}

## 3. 분석 이벤트
| 이벤트 | 발생 시점 | 필수 속성 |
|---|---|---|
| onboarding_viewed | 첫 진입 | appVersion |
| consent_completed | 동의 완료 | consentVersion |
| trigger_selected | 트리거 저장 | primaryTrigger, secondaryCount |
| capture_started | 카메라 시작 | eventId, captureType |
| capture_quality_failed | 품질 실패 | reason, attemptNumber |
| capture_completed | 유효 촬영 저장 | eventId, captureType, qualityStatus |
| symptom_saved | 증상 저장 | eventId, fieldsCompleted |
| baseline_created | 첫 기준선 완료 | eventId, baselineId |
| recheck_scheduled | 재확인 생성 | dueType, dueAt |
| recheck_started | 재확인 진입 | dueType, daysFromDue |
| recheck_completed | 재확인 완료 | dueType, comparable |
| comparison_viewed | 비교 화면 열람 | eventId, comparable |
| decision_logged | 관리 선택 저장 | actionTypeCount |
| outcome_logged | 결과 저장 | perceivedOutcome, nextPlan |
| decision_loop_completed | 전체 루프 완료 | eventId, durationDays |
| offer_viewed | 가격 노출 | offerType, placement |
| checkout_started | 결제 시작 | offerType, price |
| purchase_completed | 결제 완료 | offerType, price |
| subscription_started | 구독 시작 | plan, price |
| report_generated | 리포트 생성 | reportType |
| data_export_requested | 내보내기 요청 | format |
| deletion_requested | 삭제 요청 | scope |

## 4. KPI 계산
### Scan Completion
`capture_completed 고유 세션 / capture_started 고유 세션`
목표 가설: 80% 이상

### Event-to-Recheck
`2주 또는 4주 허용 창 안에 recheck_completed된 적격 Event / 재확인 예정일이 지난 적격 Event`
목표 가설: 35% 이상

### 과거 비교 사용
`comparison_viewed한 재방문 사용자 / 재확인을 완료한 재방문 사용자`
목표 가설: 60% 이상

### Premium 전환
`subscription_started 사용자 / 4주 리포트 완료 사용자`
목표 가설: 5% 이상

### Decision Loop
`trigger_selected → baseline_created → recheck_completed → comparison_viewed → decision_logged → outcome_logged`를 같은 eventId로 완료한 수
North Star Metric

## 5. 개인정보·보안 원칙
- 이미지와 건강 관련 입력은 목적별 최소수집
- 이미지 원본과 파생 데이터의 보관기간 분리
- 사용자 삭제 요청 시 원본·파생·리포트·분석 식별자를 함께 처리
- 동의 버전과 철회 이력 저장
- 클라이언트에서 서비스 계정·비밀키 노출 금지
- Firestore Security Rules에서 사용자 본인 데이터만 접근
- 운영 로그에 원본 이미지나 자유서술 메모를 남기지 않음
- 병원·파트너 공유는 별도 명시 동의와 만료 링크를 사용
