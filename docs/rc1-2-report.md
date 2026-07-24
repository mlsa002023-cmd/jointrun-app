# RC1.2 완료 보고 — V10 Core Flow Unification & Product Truth Cleanup

**브랜치**: `feat/v9-design-integration` (base `f06e012`)
**RC1.2 커밋**: `544b763`(audit) → `992d6bc`(통합) → `f2f90b1`(Rules·테스트) → 본 보고
**중지 조건 준수**: main 병합·운영 배포·운영 Firebase 사용·원본 미디어/랜드마크 저장 추가 없음.

## 1. 무엇을 바꿨나 (한 줄 요약)

손 각도 측정을 독립 레거시 스캔에서 **V10 첫 기준선의 관찰 기록 단계**로 연결하고, 저장
데이터·화면 문구·개인정보 약속을 V10 약속과 일치시켰다. 새 기능 확장 없음.

## 2. 변경 파일

| 파일 | 변경 |
|---|---|
| `docs/rc1-2-product-truth-audit.md` | (신규) 구현 전 감사표 |
| `src/lib/v9EventTypes.js` | EVENT_STATUS.SYMPTOM_PENDING, CAPTURE_TYPE.OBSERVATIONAL_ANGLE, 분석 이벤트 8종 |
| `src/lib/firestoreV9.js` | saveObservationalAngleCapture / confirmBaselineWithSymptom, OPEN_STATUSES에 symptom_pending |
| `src/lib/recheckSchedule.js` | symptom_pending agenda 상태 |
| `src/data/v9Repository.js` | saveAngleCapture / confirmBaselineWithSymptom 래퍼 |
| `src/components/v9/BaselineAngleFlow.jsx` | (신규) Trigger→Hand→Angle 오케스트레이터 |
| `src/components/MotionScanPage.jsx` | captureMode(각도만, 점수·프로필·rawFrames 없음), 카피 정리, DEBUG QA 게이팅 |
| `src/components/JOINTRUNShell.jsx` | 첫 기준선→BaselineAngleFlow, symptom_pending→SymptomSnapshotForm, 모션스캔 탭 V10 라우팅 |
| `src/components/tabs/home/TodayStatusCard.jsx` | "오늘의 정밀 지표/Finger Score" → "내 변화 기록 → Timeline"(flag off) |
| `firestore.rules` | 관찰 capture 금지필드 거부, symptomSnapshot 1회 부착, symptom_pending 상태 |
| `tests/rules/firestoreRules.test.js` | RC1.2 Rules 5종 |
| `src/lib/firestoreV9.rc12.test.js` · `MotionScanPage.test.jsx` · `v9/CapturePrepScreen.test.jsx` | (신규) 데이터·UI 테스트 |

## 3. Product Truth Audit

`docs/rc1-2-product-truth-audit.md` 참고. 핵심 불일치 4가지(저장·계산·프로필이 여전히 점수
파이프라인 / rawFrames 저장 / MotionScan-Loop 분리 / DEBUG 노출)를 이번에 모두 정합화.

## 4. 전체 흐름 (연속 캡처로 검증됨)

브라우저(390×844, dev 시뮬레이션 각도 경로)로 끝까지 확인:

1. **Trigger** — "오늘 왜 기록하려고 하나요?" (판단 이유)
2. **Hand** — "어느 손을 기록할까요?" 오른손(필수)
3. **Angle** — "손 각도 관찰 기록" (관찰 기록 시작)
4. **Result** — "측정 기록 완료": 관찰된 손가락 각도(118/125/110/105°) · 관찰된 ROM 122° ·
   **사용 손 오른손** · 측정 날짜 · 촬영 품질 **"3개 동작 기록 완료"** · 비진단 문구.
   점수·강직지수·VAS·자동추천·DEBUG **0건**.
5. **Next** — 하단 "다음 단계로" → Home
6. **Home symptom_pending** — "측정한 순간의 증상을 함께 기록해 주세요 / 증상·상황 기록하기"
7. **Symptom** — 같은 Event의 SymptomSnapshotForm(통증5·뻣뻣함6 등)
8. **Baseline** — 저장 후 Home "다음 재확인까지 D-14 / 기준선 · 7/24 / 2주 · 8/7(예정)",
   Timeline에 "첫 기준선 · 오른손" + 2주/4주 예정. 점수 누출 0.

측정 후 별도의 두 번째 첫 기준선 촬영을 반복하지 않는다(no_baseline로 되돌아가지 않음).

## 5. Firestore 실제 저장 payload 예시

### 관찰 각도 capture (`users/{uid}/v9Events/{eventId}/captures/{captureId}`)
```json
{
  "schemaVersion": "v1.0",
  "eventId": "<eventId>",
  "type": "baseline",
  "handSide": "right",
  "perFingerObservedRomDeg": [
    { "key": "index", "name": "검지", "romDeg": 118 },
    { "key": "middle", "name": "중지", "romDeg": 125 },
    { "key": "ring", "name": "약지", "romDeg": 110 },
    { "key": "pinky", "name": "소지", "romDeg": 105 }
  ],
  "averageObservedRomDeg": 122,
  "qualityStatus": "pass",
  "qualityFlags": [],
  "symptomSnapshot": null,
  "captureProtocolVersion": "v1.0",
  "algorithmVersion": "v1.0",
  "appVersion": "1.0.0",
  "capturedAt": "<serverTimestamp>"
}
```
저장되지 않는 것: 원본 사진·영상, rawFrames(랜드마크 프레임), landmarksRef, Finger
Health Score, finger/inflammation/stiffness 점수, camera-derived VAS, recommendation,
health grade. (실시간 랜드마크는 각도 계산에만 쓰고 즉시 폐기)

### 증상 부착 후 Event
```json
{ "status": "baseline_created", "baselineCaptureId": "<captureId>", "baselineQualityStatus": "pass" }
```
+ rechecks 하위에 week2/week4 `scheduled` 2건 생성. capture의 symptomSnapshot이 1회 채워짐.

## 6. production 금지 문구·필드 0건 검증

- **DOM 렌더(flag off)**: MotionScanPage captureMode 단위 테스트가 완료 화면에 강직지수·VAS·
  Finger Score·자동추천·DEBUG가 **없음**을 assert. 브라우저 실측에서도 타임라인/완료 화면
  점수 누출 0(`scoreLeak: []`).
- **저장 payload**: firestoreV9.rc12 테스트가 capture에 scores/rawFrames/landmarks/
  landmarksRef/recommendation/metrics/fingerHealthScore 등이 **없음**을 assert.
- **Rules**: 위 금지필드 쓰기를 emulator에서 **거부**함을 검증(27개 통과).
- 번들에 문자열 자체는 남아 있으나(레거시 flag 뒤 코드), flag off DOM·저장 경로에는 나타나지 않음.

## 7. QA gate 검증 (§5)

- DEBUG 버튼·수치 오버레이, Mock Capture, 날짜 이동은 `shouldShowQaTools`(로컬 dev / Vercel
  Preview / `VITE_QA_MODE_ENABLED` + `VITE_QA_ALLOWED_EMAILS`) 뒤에서만 노출.
- production 일반 사용자·URL/localStorage 조작으로 활성화 불가(featureFlags 회귀 테스트가 소스에
  location/localStorage 참조가 없음을 고정).

## 8. 테스트 결과

- 단위/컴포넌트: **92 통과**(기존 81 + RC1.2 11: 데이터흐름 6, captureMode 3, handSide 2)
- Rules Emulator: **27 통과**(기존 22 + RC1.2 5)
- lint: **0 error**(경고 21, 기존)
- build: 성공

## 9. 남은 P0 / P1 / P2

- **P0 남음: 없음** — §0~§9 핵심 정합성 처리 완료.
- **P1**
  1. 실기기 카메라로 각도 측정 실측(이 환경은 카메라 차단 → dev 시뮬레이션으로만 검증). 실기기에서
     3포즈 인식·품질을 확인해야 함.
  2. symptom_pending 증상 저장 실패 시 UX — 현재 SymptomSnapshotForm은 저장 실패를 자체 배너로
     처리하지 않음(데모는 항상 성공). 실 Firebase에서 저장 게이트/재시도 보강 권장.
  3. `confirmBaselineWithSymptom` 실경로에서 baselineQualityStatus를 "pass"로 고정 — 각도 흐름은
     3포즈 인식 시 pass라 일치하나, 향후 실제 품질 판정이 생기면 그 값을 보존하도록 조정.
- **P2**
  1. 모션스캔 탭에 기준선이 이미 있을 때의 안내 화면(현재는 간단 카드) 디자인 정교화.
  2. 각도 흐름의 재확인(2·4주)도 각도 관찰로 통일할지 여부(현재 재확인은 기존 DecisionLoopFlow
     GuidedCapture 사용 — RC1.1 유지, 이번 범위 밖).

## 10. 기존 데이터 처리 제안 (별도 의사결정 필요)

- 기존 `users/{uid}/scans`(+ `scans/{id}/raw`)에는 과거 점수·rawFrames가 남아 있다. RC1.2는
  **신규 V10 기록부터** 최소수집을 적용하고 기존 데이터는 삭제하지 않았다.
- 제안: (a) 즉시 조치 없이 유지하되 신규 저장 중단(현 상태), (b) rawFrames 하위만 일괄 삭제하는
  마이그레이션(사진 아님·랜드마크 프레임 — 개인정보 민감), (c) 전체 scans 아카이브 후 삭제.
  → **대표 승인 후** dry-run 리포트를 먼저 만들고 실행할 것을 권장(운영 데이터라 이번엔 미실행).

## 11. Preview UAT에 필요한 수동 설정

`docs/uat-preview-setup-runbook.md`와 동일. 요점: Vercel Preview 환경변수에
`VITE_QA_MODE_ENABLED=true` + `VITE_QA_ALLOWED_EMAILS`(검수 계정), Staging Firebase 6개 값,
Deployment Protection, Firebase Authorized Domains에 Preview 도메인 추가. Rules는 이번
`firestore.rules`를 Staging에 배포(`firebase deploy --only firestore:rules`).

## 12. 대표 검수 체크리스트

- [ ] 첫 기준선: 이유→손→각도→완료→다음 단계로→Home symptom_pending→증상→D-14 확정이 끊김 없이 이어지는가
- [ ] 완료 화면에 사용 손이 보이고 품질이 "3개 동작 기록 완료"인가("비교 가능" 고정표기 없음)
- [ ] production(일반 계정)에서 Finger Score·Inflammation·강직지수·VAS·자동추천·DEBUG가 0건인가
- [ ] 측정 후 별도의 두 번째 첫 기준선 촬영을 반복하지 않는가
- [ ] QA Preview 허용 계정에서만 DEBUG/Mock/날짜이동이 보이는가
- [ ] 앱 재실행 후에도 symptom_pending이 복원되는가(활성 Event 조회)
