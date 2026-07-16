# Implementation Notes — P0 B2C Safety Cleanup (2026-07-16)

B2C 검증용 공개 전 신뢰·안전 리스크 제거 작업. 새 기능 추가 없이 문구 교정·조건 분기·제거/숨김만 수행했다. `main`에서 분기한 `feature/p0-b2c-safety-cleanup` 브랜치에 작업별로 6개 커밋(+검증/문서 커밋)으로 나눠 올렸다.

## 작업1 — 의료 효능 문구 전체 교체

- `index.html` meta description, `AuthScreen.jsx` 회원가입 태그라인을 지시받은 문구로 정확히 교체.
- `motionAnalyzer.js`의 `buildRecommendation()` — 온수 요법/보조기 착용 권장, "즉시 ... 후 전문의 상담을 권장합니다" 등 처방·지시형 문구 3단계 전부를 관찰형으로 재작성. `MotionScanPage.jsx`의 "처방:" 라벨도 "관찰:"로 통일.
- AI 코치를 "기록 도우미"로 리프레이밍(작업 지시서의 "전문 관절 건강 AI 코치 → 기록 도우미" 매핑 적용): `anthropicCoach.js` 시스템 프롬프트(전문성 주장·특정 치료/기기 권장 제거, "진단 회피·전문의 상담 권유" 안전장치는 유지), `CoachModule.jsx`(제목/환영 메시지/토스트/quick chips/API 실패 시 폴백 문구 — 폴백은 가짜 진단성 답변 대신 단순 "답변을 가져오지 못했다" 메시지로 교체), `ProfileModule.jsx` 진입 라벨.
- `getTodayAction.js`: "루틴을 그대로 유지하세요" → "최근 기록을 확인해보세요"(지시받은 표 매핑 그대로).
- 지시받은 grep 키워드 목록엔 없었지만 동일 카테고리 위반이라 함께 정리한 것: `mockProfiles.js`의 DEFAULT_STEPS("AI 소견 분석/진단", "관절 윤활/유연 회복", "관절 회복력 축적"), `OnboardingScreen.jsx`("첫 만남 진단" → "관심 부위 확인").
- `BLUEPRINT_SECTIONS`(mockProfiles.js)에 "예방"/"5년" 등이 일부 남아있지만 이 배열은 어디에도 import되어 렌더링되지 않는 dead 데이터라 손대지 않음(검증 grep도 "사용자 노출 문자열" 기준이라 여기 포함 안 됨).

## 작업2 — 시뮬레이션 모드 운영환경 차단

- `MotionScanPage.jsx`의 `runSimulation()`에 `if (!import.meta.env.DEV) return;` 가드 추가. "시뮬레이션으로 건너뛰기"(idle 화면)/"시뮬레이션 스캔 실행"(camera_error·ai_error 화면) 버튼 둘 다 `import.meta.env.DEV`로 조건부 렌더. 운영환경에서 모델/카메라 실패 시 기술적 에러 메시지 대신 "지금은 측정할 수 없습니다. 잠시 후 다시 시도해주세요." 안내로 대체(재시도만 가능, 시뮬레이션 경로 없음 → 기록 생성 없이 종료). 관련 토스트("...시뮬레이션 모드로 전환합니다")도 DEV/prod 분기.
- `runSimulation()`의 `onScanCompleted` 페이로드에 `isSimulated: true` 추가 → `JOINTRUNShell.jsx`의 `handleScanCompleted()`가 이 플래그면 `saveScanRecord`/`saveProfileSnapshot`(Firestore 저장)과 `recordActivity`·`return_scan` KPI 이벤트를 전부 건너뛴다. 로컬 상태 미리보기(`addOptimisticScan` 등)는 dev에서 UI 흐름 확인용으로 그대로 유지(Firebase가 아니라 순수 로컬 state이므로).
- **검증**: `npm run build` 후 `dist/assets/*.js`를 grep한 결과 "시뮬레이션" 문자열이 0건 — Vite가 `import.meta.env.DEV` 분기를 프로덕션 번들에서 완전히 제거함을 직접 확인(작업6의 "필터링으로만 숨김" 방식과 달리, 이건 빌드 시점에 코드 자체가 사라짐).

## 작업3 — 데이터 없을 때 중립값 50 제거

- `fingerHealthScore.js`: `DEFAULT_FINGER_HEALTH_SCORE`를 50 → `null`로 변경. `computeMobilityScore`/`computeStabilityScore`/`computeInflammationScore`/`computeRecoveryScore` 전부 데이터 없음 → `{ value: null }`로 통일(기존엔 0과 50이 섞여 있었음 — 둘 다 "모름"을 가짜 숫자로 표현하던 문제라 같이 정리).
- `computeFingerHealthScore()`는 4개 하위 점수 중 하나라도 `null`이면 가중합하지 않고 `total`도 `null`로 둔다 — 지시서의 두 옵션("결측 지표 제외 후 계산" vs "전체를 측정 전으로 처리") 중 후자를 선택. 이유: Mobility/Stability는 스캔 완료 직후 항상 값이 있고, 이 함수가 실제로 `null`을 받는 경우는 Inflammation/Recovery(체크인 필요) 뿐이라 "일부만 반영된 점수"를 보여주는 것보다 "측정 전"이 더 정확한 정보라 판단.
- `JOINTRUNShell.jsx`: `NEUTRAL_SUBSCORE(50)` → `UNMEASURED_SUBSCORE(null)`. 체크인 완료 토스트를 조건 분기(총점이 아직 `null`이면 "스캔을 완료하면 볼 수 있어요" 안내로 대체). 소견서 모달의 Finger Score 표시도 `null` 방어.
- `ReportModule.jsx` / `mockProfiles.js`: Finger Score™ 값이 `null`이면 배지·숫자 대신 "측정 전" 표시. status 로직에도 `null` 분기 추가(기존엔 `null > 75`가 falsy로 새어나가 "경고"로 잘못 표시될 뻔한 잠재 버그였음 — 발견해서 같이 고침).
- `fingerHealthScore.test.js`(신규) — 이 저장소는 lib 단위 테스트 관례가 약했지만, 점수 계산 로직의 회귀 위험이 높아 6개 케이스로 null 전파를 검증하는 테스트를 새로 추가했다.

## 작업4 — Stiffness 스키마 충돌 정리

- `fingerHealthScore.js`: `SCORE_VERSION` v1.0 → v2.0. 파일 상단 주석에 v1.0/v2.0 산식 차이를 기록(같은 점수인데 산식이 다른 데이터가 섞이는 것 방지). `computeRecoveryScore(stiffnessComponent, fatigueComponent)` → `computeRecoveryScore(fatigueComponent)` 단일 인자로 변경 — 자가보고 피로도 단독 기준으로 확정. `computeStiffnessComponent()`는 삭제하지 않고 `@deprecated`로만 표시(과거 v1.0 문서 분석 등에 필요하면 참조 가능하되 신규 계산 경로에서는 호출하지 않음 — "읽기 전용 legacy" 요건).
- `MotionScanPage.jsx`: `finishScan()`/`runSimulation()` 양쪽에서 stiffnessComponent 계산·전달 제거. `JOINTRUNShell.jsx`: `lastScanScores`에서 필드 제거, 두 `computeRecoveryScore()` 호출부를 새 시그니처로 변경.
- UI에서 Morning Stiffness 독립 지표 제거: `mockProfiles.js` BIOMARKER_METRICS에서 "Morning Stiffness™" 카드 삭제, 소견서 모달의 "아침 강직" 항목도 삭제. 체크인 단순 항목으로의 격하는 지시서상 "필요하면"이라는 조건부 옵션이라 새 UI를 추가하진 않았다(새 기능 추가 금지 원칙과도 부합).

## 작업5 — 개인정보 안내 정확성

카메라 화면의 "어떠한 민감 정보도 외부로 전송되지 않습니다" 문구를 고치기 전에 실제로 원본 영상이 저장/전송되는지 코드로 확인했다.

**확인한 사실**:
- `CameraView.jsx`: canvas에는 랜드마크(스켈레톤)만 그리고 카메라 영상 자체를 canvas로 다시 그리지 않는다(파일 자체 주석에 명시). `toDataURL`/`getImageData`/`toBlob` 등 프레임 캡처 호출이 어디에도 없음.
- `MotionScanPage.jsx`의 `rawFramesRef` — 포즈별로 저장하는 값은 `{ worldLandmarks, ts }`뿐. MediaPipe가 브라우저 로컬에서 추출한 3D 랜드마크 좌표(숫자 배열)이지 이미지/영상 프레임이 아니다.
- `firestore.js`의 `saveScanRecord()`: 메인 문서엔 `metrics`/`scores`/`recommendation`만, `rawFrames`(랜드마크 좌표)는 별도 `raw` 서브컬렉션에 저장 — 이미지 바이너리나 video 데이터를 담는 경로가 어디에도 없음.
- `handTracker.js`: MediaPipe HandLandmarker가 `video` 엘리먼트를 브라우저 로컬에서 직접 처리(`detectForVideo`)하고 랜드마크만 반환 — 외부 추론 API로 영상을 전송하는 경로 없음(모델 파일 자체만 최초 1회 CDN에서 내려받을 뿐).

→ **"원본 카메라 영상은 저장되지 않는다"는 확신할 수 있는 사실**이라 판단해, 지시받은 두 문구 중 확신 가능한 쪽을 채택했다. `MotionScanPage.jsx`의 카메라 대기 화면 안내를 "원본 카메라 영상은 저장하지 않으며, 측정 결과만 사용자 계정에 저장됩니다."로 교체.

## 작업6 — 미출시·과장 기능 노출 제거

코드/데이터는 지우지 않고 조건부 숨김으로 처리(P2에서 다시 켤 수 있도록).

- `mockProfiles.js`: `HIDDEN_BIOMARKER_NAMES` Set을 추가해 `BIOMARKER_METRICS()`가 "Finger Age™"/"Risk Forecast™"를 반환 직전에 필터링. 항목 정의 자체는 그대로 두고 `ReportModule`에 렌더링되지 않게만 함. Pain Trend™ 설명에서 "AI 스마트 보조기의 미세 압력 변화" 문구도 제거(실제 연동 안 된 표현이라 관찰형으로 교체).
- `JOINTRUNShell.jsx`: `SHOW_ARO_DEVICE_CARD = false` 플래그로 HOME의 "스마트 보조기 정렬" 카드 전체를 숨김. 유일한 진입점이 사라져 `PremiumModule.jsx`("스마트 보조기 정밀 조율")와 Calibrator 모달도 자연히 도달 불가능해짐(둘 다 삭제하지 않고 그대로 둠). 소견서 모달 내러티브의 "JOINTRUN 스마트 보조기와" 문구도 제거.
- **Finger Reserve**: `BIOMARKER_METRICS`에 애초에 포함된 적이 없어(데이터 필드로만 존재, 어떤 UI에도 렌더링된 적 없음) 별도 조치 불필요 — 확인만 하고 여기 기록해둠.
- **가상 프로필/예시 데이터가 실제처럼 보이는 문제** — 조사 결과 두 가지를 발견:
  1. `PATIENT_PROFILES_DEFAULT`(김영희/박정자/이민우 목업) fallback은 `App.jsx`의 `AuthGate`가 `currentUser` 없이는 `JOINTRUNShell`을 아예 마운트하지 않기 때문에 **실제로는 도달 불가능한 코드**임을 확인. 이 경로는 실질적 위험이 아니었다.
  2. 대신 더 실질적인 위험을 발견했다 — `AuthContext.jsx`에 `DEMO_USER`(Firebase 미설정 시 자동 로그인되는 가짜 유저, `isDemo` 플래그로 노출됨)가 이미 존재하는데, 이 `isDemo` 플래그가 그동안 **UI 어디에도 쓰이지 않고** 있었다. 만약 실배포(Vercel) 환경변수 설정이 누락되면 실제 방문자가 로그인 없이 "데모 사용자"로 자동 진입해, 저장되지 않는 가짜 데이터를 진짜 계정처럼 보게 될 수 있는 구조였다. `JOINTRUNShell.jsx` 헤더에 `isDemo`일 때만 보이는 배너("데모 모드입니다 — 예시 데이터이며 기록이 저장되지 않습니다")를 추가 — 기존에 이미 존재하던 상태값을 노출하는 조건부 렌더링이라 "새 기능 추가"가 아니라 "조건 분기"로 판단해 진행했다.
  - **실기기/실배포 확인 필요**: Vercel 프로젝트 환경변수에 `VITE_FIREBASE_*`가 정상 설정되어 있는지 대시보드에서 직접 확인 권장 — 이 저장소엔 `.env`가 없어 로컬에서는 항상 데모 모드로 뜨고, 실배포가 실제로 `FIREBASE_ENABLED=true`로 동작하는지는 이 환경에서 검증할 수 없었다.

**주의(중요)**: 작업6의 "숨김"은 런타임 필터링 방식이라 "Finger Age™"/"Risk Forecast™"/"스마트 보조기" 등 문자열 자체는 여전히 JS 번들 소스에 존재한다(작업2의 `import.meta.env.DEV` 분기처럼 빌드 시점에 완전히 제거되는 것과는 다르다). devtools로 번들 소스를 열어보면 문자열을 찾을 수 있지만, 실제 화면(DOM)에는 절대 렌더링되지 않는다. "코드 삭제보다 숨김 우선"이라는 지시를 문자 그대로 따른 결과이며, 완전한 바이트 단위 제거가 필요하면 별도 논의가 필요하다.

## 다음 검토 대상 (이번 P0 범위 밖, 의도적으로 손대지 않음)

- **"대학병원 제출용 소견 PDF" 카드**(ReportModule.jsx)와 소견서 발급 모달 전체(JOINTRUNShell.jsx) — "소견서"/"환자"/"Clinical Diagnostic Referral Sheet" 등 진단서 느낌의 문구가 남아있지만, 이번 작업 지시서의 6개 항목에 명시적으로 포함되지 않아 손대지 않음. Finger Score/아침 강직/스마트 보조기 관련 필드는 이번 세션에서 부분적으로 방어·정리했지만(작업3·4·6), 카드/모달 자체의 존재 여부는 다음 세션에서 별도 검토 필요.
- **`src/services/anthropicCoach.js`의 AI 코치 가드레일 설계** — 이번엔 시스템 프롬프트 문구만 정리(작업1)했고, 대화형 AI의 안전장치 자체를 더 깊게 설계하는 건 별도 세션 검토 대상(이전 세션에서도 같은 이유로 보류함).
- **`BLUEPRINT_SECTIONS`(mockProfiles.js)** — 어디에도 렌더링되지 않는 dead 데이터지만 "예방"/"5년"/"Finger Age" 등 금칙어가 남아있음. 완전히 안 쓰는 코드라 이번엔 정리하지 않았고, 언젠가 파일 자체를 삭제하는 게 더 깔끔할 수 있음.

## 검증 결과

- `npm run build` / `npm run lint`(0 errors) / `npm test`(8 files, 28 tests) 전부 통과.
- 금칙어 grep 재검증(예방/변형/위험 예측/5년/윤활/Finger Age/Finger Reserve/Risk Forecast/스마트 보조기/stiffnessComponent) — 남은 매치는 전부 (a) 코드 주석/false positive, (b) `BLUEPRINT_SECTIONS` dead 데이터(위 "다음 검토 대상" 참고), (c) 작업6에서 필터링으로 숨긴 항목의 소스 정의(런타임에 렌더링 안 됨) 뿐 — **사용자에게 실제로 보이는 화면 기준으로는 0건**.
- 브라우저로 직접 확인: 신규 계정(데모 유저, 스캔 0회) 상태에서 Report 탭에 Finger Age™/Risk Forecast™/Morning Stiffness™ 미노출, Finger Score™는 "측정 전"으로 표시(50점/경고 아님), Pain Trend™ 설명 문구 교체 확인, 데모 모드 배너 정상 표시, 콘솔 에러 없음.
- **실기기 확인 필요(이 환경에서 검증 불가)**:
  - 카메라가 필요한 실제 스캔 플로우 전체(정상 스캔 완료 → 결과 화면 → Report/Timeline 반영) — 이 샌드박스에 카메라 접근이 없어 코드 리뷰로만 검증.
  - 운영 빌드(production)에서 모델 초기화 실패 시나리오의 실제 동작 — DEV/prod 분기 로직과 프로덕션 번들에 "시뮬레이션" 문자열이 없다는 것까지는 확인했지만, 실제 배포 환경에서 MediaPipe 로드 실패를 인위로 재현해 안내 문구가 뜨는 것까지는 확인 못함.
  - Vercel 실배포의 Firebase 환경변수 설정 여부(위 작업6 "실기기/실배포 확인 필요" 참고) — 데모 배너가 실제로 뜨지 않는(=정상 설정된) 상태인지 프로덕션 URL에서 직접 확인 필요.
