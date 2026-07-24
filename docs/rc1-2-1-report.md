# RC1.2.1 완료 보고 — Release Hardening & Recheck Consistency

**브랜치**: `feat/v9-design-integration` (base `b109893`)
**RC1.2.1 커밋**: `10fa227` / 태그 `rc1.2.1`
**중지 조건 준수**: main 병합·운영 배포·운영 Firebase 사용·원본 미디어/랜드마크 저장 추가 없음.

## 1. 기준선 확정 원자성 (§1)

### transaction 구조

`confirmBaselineWithSymptom(uid, eventId, captureId, symptomSnapshot)` — 네 쓰기를 **하나의
Firestore `runTransaction`**으로 묶는다.

```
runTransaction:
  read  eventRef, captureRef            ← 상태·capturedAt 확인
  guard event.status === symptom_pending ← 아니면 null 반환(중복 확정 방지)
  1) tx.update(captureRef, { symptomSnapshot })   // 이미 있으면 건너뜀(1회 부착)
  2) tx.update(eventRef,   { status: baseline_created, baselineCaptureId, nextRecheckDueAt })
  3) tx.set(week2Ref, { dueType: week2, dueAt: capturedAt + 14d, status: scheduled })
  4) tx.set(week4Ref, { dueType: week4, dueAt: capturedAt + 28d, status: scheduled })
```

- **중간 실패 → 전체 rollback**: transaction 내부 예외 시 1~4가 모두 커밋되지 않는다.
- **retry 가능**: 실패 후 다시 호출하면 그대로 성공한다(부분 상태가 남지 않으므로).
- **중복 Recheck 금지**: 문서 ID가 `week2-{captureId}` / `week4-{captureId}`로 **결정적**이라
  재시도해도 같은 문서를 다시 쓸 뿐 새 문서가 늘지 않는다. 게다가 `symptom_pending` 가드로
  두 번째 호출은 아예 no-op이 된다.
- **capturedAt 기준**: 일정은 "지금"이 아니라 **Capture의 capturedAt**에서 +14일/+28일.
- **baselineComparisonQualityStatus 보존**: 확정 시 덮어쓰지 않는다.

재확인도 동일하게 `completeRecheckWithSymptom`(capture symptom 부착 + recheck completed +
Event rechecked)을 하나의 transaction으로 처리하고, 이미 completed면 no-op이다.

### 실패·재시도 테스트 결과 (에뮬레이터, 실제 transaction 의미론)

| 테스트 | 결과 |
|---|---|
| week2 기록 직후 강제 실패 → Event 상태·capture 증상·week2 모두 원복 | 통과 |
| 실패 후 재시도 → 성공, capturedAt(7/1) 기준 week2=7/15, week4=7/29 | 통과 |
| 중복 실행 → 두 번째는 null 반환, Recheck 총 2건 유지 | 통과 |

## 2. 재확인 각도 흐름 통일 (§2)

`BaselineAngleFlow` → **`AngleObservationFlow`**(`mode="baseline" | "recheck"`)로 정리.

| 단계 | baseline | recheck |
|---|---|---|
| 1 | 판단 이유 선택 | 기준선과 **같은 손 확인**(RecheckHandConfirmScreen) |
| 2 | 사용할 손 선택 | — (기준선 handSide 자동 승계) |
| 3 | 손 각도 관찰 기록 | 손 각도 관찰 기록 (동일 MotionScanPage captureMode) |
| 4 | → Home symptom_pending | 증상·상황 입력 |
| 5 | (Home에서 증상 → 확정) | 비교 화면 → 체감 변화 선택 |

재확인 capture 저장 항목: `handSide`, `perFingerObservedRomDeg`, `averageObservedRomDeg`,
`symptomSnapshot`, `recordingStatus`, `comparisonQualityStatus`, 버전 메타.
**원본 사진·영상·랜드마크·점수·추천은 저장하지 않는다**(테스트로 확인).

비교 화면은 **평균 ROM + 손가락별 각도 + 증상값**을 나란히 보여주고, 자동으로 호전·악화를
판정하지 않는다(문구·로직 모두 없음).

## 3. 품질 상태 의미 분리 (§3)

```
recordingStatus         : completed | incomplete       ← 3개 동작 기록을 마쳤는가
comparisonQualityStatus : unverified | pass | unreliable ← 비교 조건을 실제로 검증했는가
```

각도 흐름은 조명·거리·흔들림을 검증하지 않으므로 **항상 `unverified`**를 쓴다(`pass` 미사용).
`readCaptureQuality(capture)` adapter가 legacy `qualityStatus`를 마이그레이션 없이 읽는다.

**이 과정에서 실제 버그를 하나 발견해 수정**했다: `evaluateComparability`가 `unverified`를
`pass가 아님` → "촬영 조건이 불안정했어요"로 잘못 경고하고 있었다. 이제 `unverified`는 경고가
아니라 **"조명·거리·흔들림 등 동일 조건 여부는 아직 검증하지 않았습니다"**라는 중립 안내로
표시된다(사실과 다른 경고·안심을 모두 피함).

## 4. QA 모드 fail-closed (§4)

`evaluateQaAccess({ qaModeEnabled, allowedEmails, userEmail })` 순수 함수로 분리:

| 조건 | 결과 |
|---|---|
| QA 모드 OFF | false |
| QA 모드 ON + **allowlist 비어 있음** | **false (fail-closed)** ← 기존 "비면 전원 허용" 폐기 |
| QA 모드 ON + allowlist에 없는 이메일 | false |
| QA 모드 ON + allowlist 포함(대소문자 무시) | true |

로컬 DEV만 예외로 허용하고, 그 외에는 위 두 조건을 모두 만족해야 한다. 각도 시뮬레이션
버튼과 `runSimulation()` 함수 자체도 `shouldShowQaTools` 뒤로 옮겼다(버튼 숨김 + 함수 가드).
production 일반 사용자: DEBUG / Mock / 날짜 이동 / 테스트 기록 초기화 **모두 0건**.

## 5. V10 Home 정리 (§5)

`absoluteScoreUiEnabled=false`(production 기본)에서 다음을 **렌더링하지 않는다**:
연속 사용 일수(streak), 30초 스캔 버튼, 레거시 체크인·회복 미션, 점수 중심 Home 상태.
일반 사용자는 agenda 기반 V10 Home 카드만 본다. 하단 탭 **"모션스캔" → "기록하기"**.
기존 데이터는 삭제하지 않고 레거시 flag 뒤에서만 읽는다.

### 변경 전후 (390px)
- **전(RC1.2)**: agenda 카드 + "환영합니다/데모 사용자 님" + **0일 연속** 배지 + **30초 스캔
  시작하기** + 최근 변화/오늘의 정밀 지표 등 레거시 카드
- **후(RC1.2.1)**: agenda 카드(+QA 패널은 QA 계정만) 만 남음. 브라우저 실측 결과
  `['일 연속','30초 스캔','Finger Score','오늘의 정밀 지표','회복 미션']` **전부 0건**,
  탭 라벨 "기록하기" 확인.

## 6. baseline → recheck 전체 연속 캡처 (실측)

390×844에서 끝까지 클릭 확인:
1. Home(V10, 레거시 0건) → 첫 기준선 만들기
2. 판단 이유 → 사용 손(오른손) → 손 각도 관찰 기록 → 측정 기록 완료(관찰 각도·ROM·사용 손·
   "3개 동작 기록 완료")
3. 다음 단계로 → Home **symptom_pending**("측정한 순간의 증상을 함께 기록해 주세요")
4. 증상·상황 기록(통증5·뻣뻣함6) → **D-14 / 기준선 7/25 / 2주 8/8(예정)**
5. (QA)재확인 날짜 당기기 → 지금 재확인하기 → **"2주 재확인 · 기준선에서 사용한 손: 오른손"**
6. 재확인 기록하기 → 각도 관찰 → 다음 단계로 → 증상(통증3·뻣뻣함4) → **비교 화면**:
   촬영 날짜 / 사용 손(오른손·오른손) / **평균 ROM 122°·122°** / 검지 118°·118° / 중지 125°·
   125° / 약지 110°·110° / 소지 105°·105° / 통증 5→3 / 뻣뻣함 6→4 — 자동 판정 문구 없음.

## 7. Firestore payload 예시

### baseline capture
```json
{
  "schemaVersion": "v1.0", "eventId": "<eventId>", "type": "baseline",
  "handSide": "right",
  "perFingerObservedRomDeg": [{"key":"index","name":"검지","romDeg":118}, ...],
  "averageObservedRomDeg": 122,
  "recordingStatus": "completed",
  "comparisonQualityStatus": "unverified",
  "qualityFlags": [],
  "symptomSnapshot": null,
  "captureProtocolVersion": "v1.0", "algorithmVersion": "v1.0", "appVersion": "1.0.0",
  "capturedAt": "<serverTimestamp>"
}
```

### 확정 후 Event + rechecks (결정적 ID)
```json
// v9Events/{eventId}
{ "status": "baseline_created", "baselineCaptureId": "<captureId>",
  "baselineHandSide": "right", "baselineComparisonQualityStatus": "unverified",
  "nextRecheckDueAt": "<capturedAt + 14d>" }

// rechecks/week2-{captureId}
{ "schemaVersion":"v1.0", "dueType":"week2", "dueAt":"<capturedAt+14d>",
  "status":"scheduled", "captureId":null, "completedAt":null }
// rechecks/week4-{captureId}  (dueAt = capturedAt + 28d)
```

### recheck capture
```json
{ "schemaVersion":"v1.0", "eventId":"<eventId>", "type":"recheck",
  "handSide":"right",                       // 기준선과 동일
  "perFingerObservedRomDeg":[...], "averageObservedRomDeg":128,
  "recordingStatus":"completed", "comparisonQualityStatus":"unverified",
  "symptomSnapshot": { "painSelfReport": 3, ... },
  "capturedAt":"<serverTimestamp>" }
```

저장되지 않는 것(모든 모드): 원본 사진·영상, rawFrames/landmarks, landmarksRef,
Finger Health Score, inflammation/stiffness, camera-derived VAS, recommendation, health grade.

## 8. 테스트 결과

- 단위/컴포넌트: **101 통과**(RC1.2 대비 +4: QA fail-closed 4종, 품질/재확인 4종, 기존 조정)
- Rules Emulator: **32 통과**(RC1.2 대비 +5: transaction rollback/재시도/중복0, 상태전환 2종)
- lint **0 error**(경고 21, 기존), build **성공**

## 9. 남은 P0 / P1 / P2

- **P0 남음: 없음**
- **P1**
  1. 실기기 카메라 실측(이 환경은 카메라 차단 → 시뮬레이션 경로로만 검증).
  2. 비교 조건(조명·거리·흔들림) **실제 검증 로직**을 붙여 `comparisonQualityStatus`를
     `pass/unreliable`로 판정하게 하기 — 현재는 정직하게 `unverified`로만 남긴다.
  3. AngleObservationFlow 재확인 경로의 저장 실패 재시도 UX(현재 배너+재시도, 데모에서는 미재현).
- **P2**
  1. 레거시 `scans` 컬렉션 데이터 처리(RC1.2 보고 §10 제안 유지 — 대표 승인 후 dry-run).
  2. 재확인 안내 화면(RecheckHandConfirmScreen) 디자인 정교화.

## 10. Preview UAT 수동 설정

`docs/uat-preview-setup-runbook.md` 그대로. **RC1.2.1에서 바뀐 점 1가지**:
`VITE_QA_ALLOWED_EMAILS`를 **반드시 설정**해야 한다. 비워두면 이제 QA 도구가 아무에게도
보이지 않는다(fail-closed). Preview 환경변수:
`VITE_QA_MODE_ENABLED=true` + `VITE_QA_ALLOWED_EMAILS=<검수 계정 이메일>` + Staging Firebase 6개 값.
Rules는 이번 `firestore.rules`를 Staging에 배포해야 한다(`firebase deploy --only firestore:rules`).
