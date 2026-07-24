# 측정 완료 → 다음 단계 UX 보정 (P0)

**범위**: MotionScanPage 측정 완료 화면 + Home의 "다음 행동" 연결만. RC1.1 기능·Firestore
구조는 그대로 유지.

## 1. 완료 화면 변경 (변경 전 → 변경 후)

| 항목 | 변경 전 | 변경 후 |
|---|---|---|
| 우측 상단 '홈으로' | 작은 텍스트 버튼 | **제거** |
| 상단 | 스캔 분석 완료 + 다시 측정 + 홈으로 | **측정 기록 완료 + 다시 측정하기(보조)** 만 |
| 하단 | 없음 | **고정 Primary CTA "다음 단계로"**(전체너비·좌우16px·최소 56px·safe-area-bottom·sticky·focus ring·aria-label) |
| 결과 표시 | Finger Score·손가락별 점수·강직지수·VAS·자동추천 | (flag off 기본) **관찰된 손가락 각도·ROM·측정 날짜·촬영 품질 + 비진단 문구** |
| 레거시 점수 | 항상 노출 | `absoluteScoreUiEnabled` flag 뒤로 보존(내부 전용, production 미노출) |

비진단 문구(고정): "동일한 촬영 조건에서 기록된 관찰값입니다. 질환 진단이나 악화 여부를
의미하지 않습니다."

## 2. 저장 게이트 상태머신

`onScanCompleted`(부모 `handleScanCompleted`)를 async로 만들어 실제 Firestore 저장 성공을
await로 확인한다. `saveScanRecord`는 실제 실패 시 throw하도록 바꿔 성공/실패를 구분한다.

| 상태 | 버튼 | 동작 |
|---|---|---|
| saving | "저장 중…" (disabled, aria-busy) | 클릭 무시 — 홈 이동 불가 |
| saved | "다음 단계로" (활성) | 클릭 시 홈 이동 |
| error | "다시 저장" + 오류 배너(role=alert) | 홈 이동 안 함, 측정 결과·입력 보존, 재시도 |

- 중복 저장 차단: `savingRef`로 동시 실행 방지.
- 중복 클릭 차단: `nextClickedRef`로 "다음 단계로" 1회만.
- 데모 모드(Firebase 미설정)에서는 저장이 즉시 no-op 성공 → 게이트 자연 통과.

## 3. "다음 단계로" 동작 (다음 작업 하드코딩 없음)

클릭 시 `goToNextAction`(shell)이:
1. `activeTab` → `home`
2. `refreshAgenda()` — 현재 Event 상태 재계산
3. `agendaFocusSignal++` → HomeAgendaCard가 자기 자신을 `scrollIntoView` + `focus` + 1.6초 강조

다음에 무엇을 할지는 **전적으로 agenda state(recheckSchedule.js)**가 결정한다. 홈 이동 직후
모달을 자동 실행하지 않는다 — 사용자가 카드를 보고 직접 진행한다.

### 상태별 다음 행동 매핑 (agenda state → 카드 라벨/액션)

| Event/agenda 상태 | agenda.key | 카드 라벨 | 액션 버튼 |
|---|---|---|---|
| 아직 기준선 없음 | `no_baseline` | 첫 기준선 만들기 | "첫 기준선 만들기" → baseline 루프 |
| 2주 예정일 대기 중 | `week2_waiting` | 다음 재확인까지 D-N | (대기 안내 + 진행 슬라이더) |
| 2주/4주 재확인 가능일 | `recheck_ready` | 오늘 N주 기록을 다시 확인할 수 있어요 | "지금 재확인하기" → recheck 루프 |
| 4주 예정일 대기 중 | `week4_waiting` | 4주 비교까지 한 번 남았습니다 | (대기 안내 + 진행 슬라이더) |
| 4주 재확인 완료, 결과 미기록 | `awaiting_decision` | 선택한 관리의 결과를 기록해 주세요 | "결과 기록하기" → decision→outcome |
| 판단 루프 완료 | `loop_completed` | 이번 판단 루프를 완료했어요 | (타임라인/리포트로 확인) |

> 참고: MotionScanPage(레거시 ROM 측정)는 V9 기준선/재확인과 별개 흐름이라, 측정 직후
> agenda는 대개 `no_baseline`(첫 기준선 만들기)을 가리킨다. 요구사항의 "측정 완료 후 증상
> 미입력 → 증상·상황 기록하기"는 V9 GuidedCapture(S04~S07) 경로에서 자연히 이어지며, 이
> 화면은 그 흐름을 하드코딩하지 않고 agenda가 계산한 다음 행동으로 연결한다.

## 4. 분석 이벤트

| 이벤트 | 발생 시점 |
|---|---|
| `scan_result_viewed` | 완료 화면 진입(1회) |
| `scan_result_next_clicked` | "다음 단계로" 클릭 |
| `scan_result_save_failed` | 저장 실패(error 상태 진입) |
| `home_next_action_viewed` | 홈 이동 후 agenda 카드가 focus될 때 |
| `home_next_action_clicked` | agenda 카드의 액션 버튼 클릭 |

## 5. 테스트

- 신규 `MotionScanPage.test.jsx`(8) + `HomeAgendaCard.test.jsx`(3) 추가.
- 검증: 상단 '홈으로' 없음 / 하단 '다음 단계로' 있음 / 버튼 ≥56px / 저장 중 비활성 /
  저장 성공 전 홈 이동 불가 / 저장 실패 시 결과 유지·재시도 / 중복 저장 차단 /
  flag off 시 점수·강직지수·VAS·자동추천 0건 / flag on 시 레거시 점수 노출 /
  scan_result_viewed 기록 / agenda 카드 focus·scroll.
- 전체 **81 통과**(기존 70 + 신규 11), Rules **22 통과**, lint 0 error, build 성공.
- 브라우저(375×812): '다음 단계로' minHeight 56px, safe-area padding `calc(12px+env(safe-area-inset-bottom))`,
  가로 스크롤 없음, '홈으로'/'강직지수'/'VAS'/'Finger Score' 0건, "다음 단계로" → 홈 카드 focus 확인.

## 6. 디자인과 다르게 판단한 부분

- **'사용 손' 미표시**: 요구사항 §4는 완료 화면에 "사용 손"도 표시하라고 하지만, 레거시
  MotionScanPage(ROM 측정)는 어느 손인지 수집하지 않는다(V9 GuidedCapture만 `handSide` 저장).
  없는 데이터를 지어내지 않기 위해 이 화면에서는 '사용 손'을 생략했다. 필요하면 스캔 시작 시
  손 선택을 추가하는 별도 작업이 필요하다.
- **레거시 홈 대시보드의 "Finger Score 등 자세히 보기"**: 이 항목은 이번 P0 범위(측정 완료
  화면 + 홈 다음행동 카드) 밖의 기존 홈 요소다. flag off에서도 "Finger Score" 텍스트가 홈
  하단에 남아 있어 별도 후속 정리가 필요하다(범위 밖이라 이번엔 손대지 않음).
- **촬영 품질 표기**: 완료 화면은 3개 동작이 모두 확정돼야 도달하므로 품질을 "3개 동작 모두
  정상 인식 · 비교 가능"으로 고정 표기했다(별도 품질 등급 산출 없음).
