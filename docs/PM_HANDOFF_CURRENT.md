# PM_HANDOFF_CURRENT

JOINTRUN 앱 현재 상태 인수인계 문서. 교체 가능한 실행 담당자가 이 파일과 커밋을 source of truth로 삼는다.

## 저장소 / 브랜치 / 배포

- 저장소: `mlsa002023-cmd/jointrun-app`
- 작업 브랜치: `feat/v9-design-integration`
- 현재 HEAD SHA: `d66e3d4`
- Draft PR: #17 (Draft 유지 — main 병합 안 함)
- 공식 Staging: https://jointrun-staging.firebaseapp.com
- Staging 배포 SHA: `d66e3d4` (Firebase Hosting `jointrun-staging`, **hosting만** 배포)
- main·Production·운영 Firebase: **미변경**

## 완료된 작업

### P0-11.1 (승인 기준점 `989b673`)
- DIP 캘리퍼 좌표 정합, 분석 캔버스 절대 픽셀 → normalized video coordinate
- DIP landmark ↔ 캘리퍼 중심 정합, 손 이동 시 최신 geometry 추적
- 손 미검출·포즈 전환 시 stale overlay 제거, transient geometry 저장 0건

### P0-14 FINAL (`d66e3d4`) — 3-포즈 관찰 프로토콜
- 동작 3개 유지, OK 포즈 유지(‘정밀 조절력’ 목적 제거하고 측면 외곽 관찰로 재정의)
  1. `front_spread` 정면 관절·외곽 관찰
  2. `ok_fan_lateral` OK 부채꼴 측면 외곽 관찰(손가락별 부분 성공 허용)
  3. `max_comfortable_fist` 개인이 가능한 범위의 굽힘 관찰(캘리퍼 없음)
- 공통 상태머신 `aligning → holding → confirmed`(최소 1.5초 + 유효 프레임, debounce,
  잘못된 자세 자동 승인 금지) — 순수 모듈 `poseHoldMachine` / 자세 판정 `poseProtocol.evaluatePoseFrame`
- 측면 외곽: P0-11.1 scan-line·normalized 좌표 재사용, 해부학적 방향 미부여(sideA/sideB·unsigned 비대칭)
- 정면·측면 데이터 별도 저장(`contourObservations.front` / `.fanLateral`), 같은 viewType·같은
  `poseProtocolVersion`끼리만 비교, 다르면 `pose_protocol_mismatch`로 차단(기준선은 “이전 방식 기록”)
- 버전: `CAPTURE_PROTOCOL_VERSION v1.1`, `ALGORITHM_VERSION v1.2`,
  `POSE_PROTOCOL_VERSION front-fan-fist-v1`, DIP contour `dip-contour-v2`
- 개인정보: 사진·영상·raw landmark·displayGeometry·좌표를 저장하지 않음. 저장 직전
  재귀 금지키 검사(`captureSanitize`)로 fail-closed. Firestore Rules 최상위 금지 필드 확대.

## 테스트 결과 (HEAD `d66e3d4`)

- unit: **368/368** 통과
- Firestore Rules(emulator): **47/47** 통과 (P0-14 신규 금지 필드·contourObservations 형태 포함)
- lint: **0 errors** (경고는 기존 react-refresh 계열)
- build: 성공
- Chromium E2E(Staging): 통과
- WebKit E2E(로컬 부팅 회귀 + Staging): 통과
- Staging E2E: 통과, 배포 SHA `d66e3d4` 확인, console error 0 / pageerror 0

## 미배포 / 대기

- **Firestore Rules는 아직 배포하지 않았다.** 규칙 변경은 emulator 47/47로 검증됐으나 배포는
  대표의 명시적 승인이 필요한 절차라서 보류했다(신규 필드는 additive라 기존 규칙에서도 저장은 통과).
- **대표 실기기(iPhone Safari) UAT 대기.** 자동 WebKit 검증은 실기기 검증이 아니다.

## 대표 실기기 UAT 확인 항목 (1회)

1. 정면 단계 — 네 DIP 캘리퍼가 관절에 붙고, 손을 움직이면 따라온다
2. OK 측면 단계 — 손날·엄지검지·부채꼴 안내가 이해되고, 유효 손가락 DIP에 측면 캘리퍼가
   표시되며, 가려진 손가락에 떠 있는 캘리퍼가 없다
3. 굽힘 단계 — 가능한 범위로 쥐는 안내가 나오고, 캘리퍼가 표시되지 않는다
4. 결과 — 정면·측면·굽힘이 분리되고, 실패값이 0이 아니라 “관찰 어려움”으로 표시된다

## 다음 앱 작업 (아직 시작하지 않음)

- **P0-13 FINAL** — 로그인 없는 체험 / 한줄 결과 / 로그인 후 기준선 승격 / 2주·4주 반복·캘린더 구조
- 아직 미착수(P0-14 완료 후 앱 재동결 상태): P0-13 공개 체험, `/try`, 게스트 측정·기준선 승격,
  캘린더·이메일·카카오 알림, 결제, main 병합, Production 배포

## 제출 문서 작업 비민감 방침 (참고)

- 자체 설문 n=70은 2026년 7월 실제 실시(“70명 목표”는 구식 표현). 증빙 없는 퍼센트는 생성·사용 금지.
- 제출 문서의 앱 주소는 **검증용 프로토타입** Staging(`jointrun-staging.firebaseapp.com`)으로 표기.
  검증 빌드 SHA는 기술 근거란·각주·부록에만 표기. vercel/jointrun.kr은 향후 계획으로만 구분.
- 비공개 제출 문서는 `local-private/`에 두고 Git 추적 금지(.gitignore 적용).

## UAT FIX-1 (완료 SHA `3601364`)

- 홈 CTA 복구 — waiting(2주/4주) 상태에서도 실행 가능한 CTA 제공("오늘 상태 메모하기" + 타임라인 보기).
- 기록하기 탭 상태별 허브 — 막다른 화면 제거, agenda 상태별 다음 행동으로 이어지는 기록 허브.
- 타임라인 압축 — 최신 루프만 기본 펼침, 이전 루프 접기, 최근 3개 노드 + 전체 보기.
- 날짜 정합 — 공통 `toValidDate`/`formatDateValue`로 통일, "Invalid Date" 노출 제거.
- 신규 관찰 추이 — V9 기준선·재확인 capture(같은 handSide·poseProtocolVersion, 2시점 이상)만으로
  관찰 시점을 표시. 레거시 scans 그래프는 `absoluteScoreUiEnabled`/QA 내부에만 유지.
- **대표 iPhone Safari UAT 대기** — 인증 이후 화면(홈 CTA·기록 허브·타임라인·관찰 추이)은 로그인이
  필요해 자동 E2E로 검증되지 않음. 실기기 로그인 UAT 필요.
- **P0-13 미착수** — 위 다음-앱-작업 항목 그대로 유지.
- **Firestore Rules 미배포** — FIX-1 자체는 `firestore.rules` 변경 없음(hosting만 배포). Rules 배포는 아래 별도 단계에서 진행.

## Staging Firestore Rules 배포 (완료)

- **대표 iPhone Safari 로그인 UAT 통과** — waiting 홈 CTA / 기록 허브 / 타임라인 펼침·접힘 /
  Invalid Date 0건 / 관찰 추이 표시 5항목 확인.
- **Staging Rules 배포 완료** — `firebase deploy --only firestore:rules --project jointrun-staging`.
  대상 projectId **jointrun-staging** 단일, 컴파일 성공·권한 오류 없음. Functions·Hosting 재배포 없음.
- 배포된 `firestore.rules`는 **emulator 47/47 검증본(`d66e3d4`)과 byte-identical**(그 이후 rules 변경 없음).
- 배포 범위: P0-14 V9 스키마 검증(Event/Capture/Recheck/Comparison/Decision/Outcome),
  저장 금지 필드 방어(rawFrames·landmarks·displayGeometry·rawLandmarks 등 + landmarksRef null만),
  contourObservations(front/fanLateral) 구조, legacy scans/raw 신규 저장 차단(기존 read 유지).
- **저장·복원 회귀(코드 레벨) 통과** — P0-14 단위 56/56(개인정보 fail-closed, 실패값 null/관찰 어려움
  (0 아님), front·fanLateral 분리, captureSanitize 재귀 금지키 검사).
- **라이브 인증 저장·복원 회귀는 대표 직접 수행 대기** — Staging 로그인(인증)이 필요해 자동화 불가.
  대표가 QA/격리 기록으로 기준선 저장→front contour→fanLateral 부분성공→max_comfortable_fist→
  새로고침/재로그인→동일 capture 복원(정면·측면·굽힘, 실패값 null/관찰 어려움, permission-denied 0,
  개인정보 저장 0)을 1회 확인.

## 리포트 화면 오해 방지 패치 (SHA `f1b5eff`, Staging Hosting 배포)

최소 보정만 — 새 리포트 계산·자동 호전/악화 판정·측정 알고리즘·Firestore 스키마 변경 없음.

- 용어: "내 손의 디지털 바이오마커" → **"내 손의 관찰 지표"** (Digital Biomarkers → Observation Metrics).
  일반 사용자 노출 "디지털 바이오마커" 0건.
- 4주 리포트 게이트: 동일 측정 방식(같은 poseProtocolVersion·handSide)의 **기준선+재확인 2시점**이
  있을 때만 "4주 리포트 보기" 활성. 그 전에는 "4주 재확인을 완료하면 관찰 기록을 한눈에 볼 수
  있어요." 안내만 표시하고 패턴·대표 변화 판정을 노출하지 않음(`computeObservationTimepoints` 재사용).
- 이번 달 기록: 현재 집계 소스(레거시 events)가 V9 Event/Capture/증상 메모를 포함하지 않아
  빈 결과가 "기록 없음"을 신뢰성 있게 뜻하지 못함 → 빈 경우 카드를 숨겨 **거짓 '이벤트 없음' 0건**.
  (V9 소스 연동은 최소 패치 범위 밖으로 보류.)
- 관찰 추이(TimelineModule): 동일 측정 방식 2시점 규칙·1시점 placeholder 그대로 유지.
- 검증: unit 382/382, lint 0 errors, build 성공, Staging E2E 부팅 헬스(console/pageerror 0, projectId,
  not-dirty) WebKit·Chromium 통과. 배포 번들에 SHA `f1b5eff` 확인.

## 최종 앱 동결

- 앱 기능 구현 동결. **P0-13 미착수 유지**(2026-08-14 제출 이후 검토).
- 새 PR 생성 금지 · main·Production 변경 금지.
- **다음 우선순위: 사업계획서·활동보고서 V11**(앱 코드 아님).

## 실기기 UAT 최종 (iPhone Safari, staging SHA `a26102b`)

**판정: RELEASE CANDIDATE** — 핵심 사용자 흐름 + 발견 P0 전부 실기기 검증·재검증 완료. 남아 있던 4개 항목(4주 재확인·네트워크 오류 원자성·크로스 유저 격리·개인정보 금지필드)도 모두 라이브(실기기 또는 Rules emulator)로 닫음. **Production 배포·main 병합만 대표 최종 결정 대기.**

### 검증된 핵심 흐름 (실기기 스크린샷 증거)
첫 기준선(왼손) → 앱 종료·재로그인 상태 복원 → 2주 재확인(실제 카메라, 같은 손) → 비교(과거의 나와 비교) → Decision Log(병원 상담) → Outcome → 4주 리포트 언락. 손 일관성(왼손↔왼손), 진단/악화 표현 없음, 관찰형 문구 유지.

### 발견·수정한 문제 (모두 재검증 완료)
- **P0-ENV-1**: 수동 hosting 배포가 `VITE_FIREBASE_*` 누락 → 데모 모드(무저장). 런북 절차대로 설정 주입해 실 Firebase 복구.
- **P0-REPORT-1**: 4주 리포트가 교차 루프 페어링으로 미완료 루프에서 열림. `isReportEventReady()`로 대상 루프 스코프 한정(재현 테스트 포함).
- **하단 네비**: raised FAB "항상 활성" + 정렬 어긋남 → 균일·정렬, 활성 탭만 강조.
- **P1 리포트 최근기록**: 2주 재확인 값을 건너뛰던 폴백을 4주→2주→기준선으로 수정.
- **사용성 6종**: 구버전 파란색→네이비 통일, 홈 헤드라인 확대, 영문 라벨 제거, 버튼 48px, 촬영 실패 안내 평이화(비교 요약-우선은 기존 구현).

### Rules emulator 라이브 검증 (추가 완료)
- 이식형 OpenJDK(Temurin 21)로 `npm run test:rules` 실행 → **Firestore 에뮬레이터 47/47 통과**.
- 이로써 다음이 **rules 계층에서 라이브 검증됨**:
  - **크로스 유저 격리**: "다른 사용자의 v9Event는 읽을 수 없다 / 다른 userId 경로 쓰기 거부" `assertFails` 통과.
  - **개인정보 금지필드 거부**: rawFrames·landmarks·landmarksRef·displayGeometry·imageData·contourPath·rawLandmarks·photo 등 쓰기 거부 통과.
  - Event/Capture/Recheck/Comparison/Decision/Outcome 스키마·enum 검증.

### 남은 4개 항목 — 전부 라이브 검증 완료
- **4주 재확인**: 실기기에서 4주 재확인 완료(리포트 "4주 재확인: 완료") + P1 최근기록 폴백(7→10) 확인.
- **네트워크 오류 원자성**: 실기기에서 시뮬 ON→저장 실패 시 **오류 배너 표시·화면 안 넘어감**(성공 오표시 없음), 시뮬 OFF→재시도 성공, 타임라인 **무중복** 확인.
  - 이 과정에서 발견·수정한 결함: 증상 저장이 `onSubmit`을 await/catch 없이 호출해 **실패가 조용히 묻히던** 문제 → submitting 가드 + 오류 배너 + 재시도로 fail-safe화(멱등이라 중복 없음). 네트워크 시뮬을 기준선 저장에도 연결.
- **크로스 유저 격리 + 개인정보 금지필드**: 이식형 JDK로 Firestore Rules emulator **47/47** 실행 — "다른 사용자 문서 read/write 거부", rawFrames·landmarks·displayGeometry 등 금지필드 쓰기 거부 통과.
- 개인정보(원본 이미지·영상·랜드마크): Storage 쓰기 0 + `assertNoForbiddenCaptureKeys` fail-closed(56/56) + rules 에뮬레이터 거부 검증.

### staging 최종 상태
- **QA 모드 OFF** 재배포(allowlist 미포함 → QA 도구 전원 비노출, `evaluateQaAccess` fail-closed). 실 Firebase 연결, SW off, 콘솔 오류 0.
- QA 테스트 데이터는 보존(격리·무해). 정리는 대표 승인 시 QA-on 빌드로 가능.
- 자동 테스트: lint 0 · unit 387/387 · build 성공.

### 대표 결정/실행 대기
- Production 배포, main 병합 — 대표 최종 결정.
- (선택) 실기기 크로스 유저 격리·네트워크 오류·4주 재확인 라이브 검증.
