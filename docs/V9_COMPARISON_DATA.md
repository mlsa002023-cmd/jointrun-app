# V9 비교 데이터 구조 — RC0 검증 스프린트 보고

기준: `src/lib/firestoreV9.js`, `src/lib/captureQuality.js`, `src/components/v9/ComparisonScreen.jsx`
(코드가 실제로 하는 일만 기술한다 — 스펙 문서가 아니라 구현 기준.)

## 1. 기준선(Baseline)에서 실제로 저장되는 데이터

**Event 문서** (`users/{uid}/v9Events/{eventId}`) — `markBaselineCreated()` 호출 시 갱신되는 필드:

| 필드 | 값 |
|---|---|
| `status` | `"baseline_created"` |
| `baselineCaptureId` | 아래 Capture 문서의 id |
| `baselineQualityStatus` | `"pass"` 또는 `"unreliable"`(강제 저장) |
| `nextRecheckDueAt` | 2주 뒤 날짜 |

**Capture 문서** (`.../v9Events/{eventId}/captures/{captureId}`) — `saveCapture()`가 저장하는 필드:

```
{
  schemaVersion, type: "baseline", handSide: "left"|"right",
  qualityStatus: "pass"|"unreliable", qualityFlags: string[],
  landmarksRef: null,                 // §5 참고 — 저장 안 함
  symptomSnapshot: {
    painSelfReport, stiffnessSelfReport,      // 0~10
    swellingSelfReport, warmthSelfReport,      // 없음/조금/많음/모르겠음 등
    functionDifficulty, note, recordedAt,
  },
  captureProtocolVersion, algorithmVersion, appVersion,
  capturedAt,
}
```

이미지·영상·픽셀 데이터는 어디에도 없다. 저장되는 것은 **품질 판정 결과값(통과/불안정 여부)**과 **사용자가 직접 입력한 증상 체감값**뿐이다.

## 2. 재확인(Recheck)에서 실제로 저장되는 데이터

**Recheck 문서** (`.../v9Events/{eventId}/rechecks/{recheckId}`) — `completeRecheck()`가 갱신:

| 필드 | 값 |
|---|---|
| `status` | `"completed"` |
| `captureId` | 이번 재확인의 Capture 문서 id |
| `qualityStatus` | `"pass"` 또는 `"unreliable"` |
| `completedAt` | 완료 시각 |

재확인의 Capture 문서 자체는 기준선과 완전히 같은 스키마(§1)를 그대로 쓴다 — `type: "recheck"`만 다르다.

## 3. 비교 알고리즘이 실제로 사용하는 데이터

`evaluateComparability(baselineCapture, currentCapture)` (`src/lib/captureQuality.js`)가 보는 값은 정확히 이 4개뿐이다:

- `baselineCapture.handSide` vs `currentCapture.handSide` — 다르면 `hand_side_mismatch`
- `baselineCapture.qualityStatus` — `"pass"`가 아니면 `baseline_quality_unreliable`
- `currentCapture.qualityStatus` — `"pass"`가 아니면 `current_quality_unreliable`
- (캡처 자체가 없으면 `missing_capture`)

**증상 체감값(symptomSnapshot)은 비교 가능 여부 판정에 전혀 쓰이지 않는다** — 오직 "같은 조건으로 찍혔는가"만 기계적으로 판단하고, 증상이 좋아졌는지 나빠졌는지는 알고리즘이 절대 판단하지 않는다(사용자가 직접 §4에서 선택).

## 4. 비교 화면에 실제로 표시되는 데이터

`ComparisonScreen.jsx`가 그리는 것:

1. `evaluateComparability()` 결과 — comparable=false면 경고 배너 + 사유 목록(§3)
2. 기준선 Capture의 `symptomSnapshot` 5개 필드 vs 현재 Capture의 `symptomSnapshot` 5개 필드 — **숫자/라벨을 표 형태로 나란히**(통증 5→3, 뻣뻣함 6→4 처럼)
3. 사용자가 직접 고르는 4지선다: 덜함/비슷함/더함/판단 어려움 (`PERCEIVED_CHANGE`) — 저장 시 `comparisons` 문서의 `userPerceivedChange`로 들어감

화면 어디에도 점수·백분율·자동 판정 문구는 없다. "좋아졌다/나빠졌다"는 시스템이 아니라 사용자의 선택으로만 기록된다.

## 5. 랜드마크 좌표의 저장 위치와 형식

**저장하지 않는다.** `saveCapture()`의 `landmarksRef` 필드는 항상 `null`로 저장된다(`GuidedCaptureScreen`이 애초에 랜드마크 배열을 캡처 저장 함수에 넘기지 않는다). MediaPipe가 실시간으로 계산하는 손 랜드마크(`checkDistance`/`checkFraming`/`checkShake`가 쓰는 21개 좌표)는 **품질 판정에만 그 프레임 순간 사용되고 즉시 버려진다** — 브라우저 메모리 밖으로 나가지 않는다. Firestore에도, 다른 어떤 저장소에도 남지 않는다.

(기존 레거시 스캔 엔진 `MotionScanPage.jsx`는 별개로 `scans/{id}/raw` 서브컬렉션에 포즈별 랜드마크 프레임을 저장하지만, 이것은 V9 Decision Loop와 무관한 기존 기능이다.)

## 6. landmarksRef가 null이어도 비교가 가능한 이유

V9의 "비교"는 **사진을 픽셀 단위로 비교하거나 랜드마크 좌표를 재계산해서 각도 차이를 내는 것이 아니다.** 비교의 실체는:

- 촬영 조건이 같았는지(손, 품질 상태) — §3의 메타데이터만으로 판정 가능
- 사용자가 그 순간 느낀 증상 체감값의 변화 — §1/§2에서 사용자가 직접 입력한 숫자

즉 "비교 가능성 판정"과 "비교 대상 데이터"가 애초에 랜드마크 좌표를 필요로 하지 않도록 설계했다. 랜드마크는 촬영 **그 순간의 품질 게이트**(거리·흔들림·프레이밍)를 통과했는지 확인하는 용도로만 쓰이고, 일단 통과하면 그 값 자체는 비교에 관여하지 않는다. 이것이 "원본 이미지·좌표를 저장하지 않고도 비교 화면을 만들 수 있는" 이유다.

## 7. 다른 기기에서 로그인해도 기준선·재확인 데이터가 복원되는가

**Firebase 프로젝트가 실제로 연결된 환경(운영 배포 대상)에서는 가능하다.** 모든 Event/Capture/Recheck/Comparison 문서는 `users/{uid}/v9Events/...` 경로의 Firestore 문서이므로, 같은 계정으로 다른 기기에서 로그인하면 그대로 조회된다(`getActiveV9Event`가 uid 기준으로 조회).

**단, 이번 RC0 검증에 사용한 데모 모드(Firebase 미설정 상태)는 복원되지 않는다.** `firestoreV9.js`의 `USE_DEMO_STORE` 경로는 브라우저 탭의 JS 메모리(`Map`)에만 데이터를 들고 있어 새로고침·다른 기기·다른 탭에서는 완전히 사라진다. 이번 Mock Capture E2E 검증은 전부 이 데모 스토어로 진행했다 — **실제 Firebase 프로젝트가 연결된 프리뷰/운영 환경에서의 기기 간 복원은 별도로 검증되지 않았다** (남은 P0 위험 항목 참고).

## 8. 원본 이미지가 없을 때 사용자가 무엇을 시각적으로 비교하는가

사진이나 영상은 처음부터 존재하지 않으므로 "전후 사진 비교" 같은 화면은 없다. 사용자가 실제로 보는 것은:

- 기준선 때 자신이 직접 입력한 통증(0~10)/뻣뻣함(0~10)/붓기/열감/손 사용 불편 5개 값
- 지금 다시 입력한 같은 5개 값
- 이 둘을 나란히 놓은 표(§4)
- "촬영 조건이 같았는가"를 알려주는 배지(같으면 조용히 넘어가고, 다르면 경고 배너)

즉 **"사진 대 사진"이 아니라 "그때의 내 느낌 대 지금의 내 느낌"**을 비교하는 화면이다. 이는 임의 설계가 아니라 개인정보 최소수집 원칙(원본 이미지 미저장)과 04_APP_PRD_V9.md S09의 "관찰된 기록을 나란히 보여준다" 요구를 함께 만족시키기 위한 의도된 선택이다.
