# RC1.2 Product Truth Audit

**기준**: `feat/v9-design-integration` @ `f06e012` (RC1.2 착수 시점)
**목적**: 멘토 데모·UAT 전에 "화면에 보이는 것 / 실제 계산되는 것 / Firestore에 저장되는 것 /
개인정보 약속"이 V10 약속과 일치하는지 감사한다. 구현 전 현재 실제 동작을 정직하게 기록한다.

## 감사표

| 항목 | V10 약속 | 현재 실제 동작 (f06e012) | 위험 | 수정안 | 우선순위 |
|---|---|---|---|---|---|
| 화면에 보이는 값(완료 화면) | 관찰 각도·ROM·날짜·사용 손·실제 품질 | flag off 기본에서 각도·ROM·날짜·"품질=3동작 정상 인식 고정" 표시(RC1.1 P0에서 점수 은닉 완료). **사용 손 미표시**, 품질 문구가 실제 판정이 아니라 고정 문자열 | 낮음 | 사용 손 표시 추가, 품질은 실제 판정 있을 때만 "비교 가능" | P0 |
| 실제 계산되는 값 | 각도·ROM(관찰) | perFinger rom, avgRom 계산 + **health score(mobility/stability/inflammation/recovery), stiffnessMin, painIndex도 계산** | 중간 | V10 경로에서는 각도·ROM만 계산, 점수 계산은 legacy flag 뒤로 | P0 |
| Firestore 저장 값 | Event/Capture에 관찰 각도 필드만 | **users/{uid}/scans 독립 컬렉션에 저장**(metrics, **scores**, **recommendation**), 그리고 **scans/{id}/raw 하위에 rawFrames(landmark 프레임) 저장** | **높음** | V10 Event의 관찰 capture로 저장, scores/recommendation/rawFrames 저장 금지 | **P0** |
| 프로필 갱신 값 | 없음(점수 프로필 갱신 안 함) | **profile.fingerHealthScore / painIndex / morningStiffnessMin 갱신** | 중간 | V10 경로에서 프로필 점수 갱신 제거 | P0 |
| 원본 사진·영상 | 저장 안 함 | 저장 안 함(카메라 원본 미저장) — OK | 없음 | 유지 | — |
| 원본 랜드마크 프레임 | 저장 안 함 | **rawFrames(포즈별 20프레임 world landmark)를 scans/{id}/raw에 저장** | **높음** | 저장 금지, 계산 직후 메모리 폐기 | **P0** |
| Finger Score / Inflammation | production 미노출·미저장 | 완료 화면 노출은 flag 뒤로 은닉됨(RC1.1). 그러나 **계산·저장은 여전히 실행**. Home "오늘의 정밀 지표 / Finger Score 등 자세히 보기" 카드가 flag 무관 항상 노출 | 중간 | 계산·저장 제거(V10), Home 카드를 "내 변화 기록→Timeline"으로 교체 | P0 |
| 강직지수·VAS | production 미노출·미저장 | 완료 화면 노출은 flag 뒤(RC1.1). stiffnessMin/painIndex 계산·metrics 저장은 지속 | 중간 | V10 경로에서 계산·저장 제거 | P0 |
| 자동 행동 추천 | production 미노출·미저장 | buildRecommendation 계산 + saveScanRecord에 recommendation 저장 | 중간 | V10 경로 저장·표시 제거 | P0 |
| DEBUG·QA의 production 노출 | 일반 사용자 미노출 | **MotionScanPage 촬영 화면 우상단 DEBUG 버튼이 모든 사용자에게 노출**(setDebugVisible 토글, dev 기본 on). 손 각도 내부 계산값·gesture 오버레이 노출 가능 | **높음** | DEBUG 버튼·오버레이를 shouldShowQaTools 뒤로 | **P0** |
| Mock Capture·날짜 이동 | QA gate 뒤 | 이미 shouldShowQaTools/MOCK_CAPTURE_ENABLED 게이트 적용됨(RC1.1) | 낮음 | 각도 측정 경로도 동일 gate 사용 | P1 |
| MotionScan ↔ V10 Loop 연결 | 각도 측정이 첫 기준선 관찰 단계 | **완전 분리**. MotionScan은 독립 scans 컬렉션. V10 baseline은 별도 DecisionLoopFlow(GuidedCaptureScreen, pass/fail만, 각도 없음) | **높음** | 각도 측정을 V10 Event의 관찰 capture로 연결, 측정 후 symptom_pending → 증상 → baseline_created | **P0** |
| 손 방향(handSide) | 측정 전 필수 선택, 결과·Timeline·Report 표시 | MotionScan은 handSide 수집 안 함. V10 GuidedCapture 경로만 handSide 저장 | 중간 | 각도 측정 전 왼손/오른손 필수 선택, capture에 저장, 결과·타임라인 표시 | P0 |
| 촬영 품질 문구 근거 | 실제 품질 판정 있을 때만 "비교 가능" | 완료 화면에 "3개 동작 모두 정상 인식 · 비교 가능" **고정 표시**(실제 품질 판정 아님) | 중간 | 실제 판정 없으면 "3개 동작 기록 완료"만 표시 | P0 |

## 핵심 결론

1. **가장 큰 진실 불일치**: 화면은 이미 점수를 숨겼지만(RC1.1), **저장·계산·프로필 갱신은 여전히
   레거시 점수 파이프라인**을 탄다. 그리고 **rawFrames(랜드마크)가 실제로 저장**되고 있어 "원본
   미저장" 약속과 어긋난다. → RC1.2에서 저장 계층을 V10 관찰 모델로 교체.
2. **MotionScan이 V10 Loop와 분리**되어 있어, 각도 측정이 첫 기준선을 만들지 못한다. → 각도 측정을
   Event의 관찰 capture로 연결하고 measurement→symptom_pending→증상→baseline_created 흐름으로 통합.
3. **DEBUG 오버레이가 일반 사용자에게 노출** 가능 → QA gate로 격리.
4. 기존 `scans` 컬렉션 데이터는 삭제하지 않고, **신규 V10 기록부터 최소수집 정책** 적용. 기존 데이터
   처리·삭제는 별도 의사결정안으로 보고(§10).

## 감사 근거 파일

- `src/components/MotionScanPage.jsx` — finishScan(점수·metrics 계산), DEBUG 토글, 완료 화면
- `src/components/JOINTRUNShell.jsx` — handleScanCompleted(profile 갱신, saveScanRecord, recordActivity)
- `src/lib/firestore.js` — saveScanRecord(scores/rawFrames/recommendation 저장)
- `src/lib/firestoreV9.js` — V9 Event/Capture 모델(현재 각도 필드 없음)
- `src/components/tabs/home/TodayStatusCard.jsx` — "오늘의 정밀 지표 / Finger Score" 카드
- `src/lib/recheckSchedule.js` — agenda 상태(현재 symptom_pending 없음)
