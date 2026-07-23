# JOINTRUN V9 통합 QA·수용 기준

## Gate A — 전략 일치
- [ ] Hero에 `선택의 순간을 잇는, 관절 건강의 내비게이션`
- [ ] 문제 정의가 `선택 전후를 판단할 개인 기준선 부재`
- [ ] 매일 사용이 아니라 판단이 필요한 순간의 트리거형 서비스
- [ ] 첫날의 가치와 4주 뒤의 가치가 구분됨
- [ ] 병원·치료·운동·보호대를 대체하지 않는다고 명시

## Gate B — 홈페이지
- [ ] Finger Health Score 노출 없음
- [ ] Inflammation 점수·카메라 염증 판정 표현 없음
- [ ] 자동 치료·운동·보조기 추천 없음
- [ ] 가이드 촬영·증상 기록·2주/4주 재확인 흐름 표시
- [ ] 개인 기준선·Decision Log·타임라인 설명
- [ ] 무료/4주 19,900원/Premium 9,900원 역할이 구분됨
- [ ] CTA가 첫 기준선과 4주 파일럿 중심
- [ ] Trust/FAQ와 개인정보 원칙 존재

## Gate C — 앱 핵심 경로
- [ ] 판단 트리거 선택
- [ ] 촬영 전 준비
- [ ] 품질 가이드와 재촬영
- [ ] 사용자 체감 증상 입력
- [ ] 첫 기준선 생성
- [ ] 2주·4주 재확인 상태
- [ ] 과거의 나와 비교
- [ ] Decision Log
- [ ] Outcome
- [ ] 타임라인
- [ ] 4주 리포트

## Gate D — 신뢰·의료 표현
- [ ] 질환 진단 표현 0건
- [ ] 악화 시점·변형 예측 표현 0건
- [ ] 치료효과 인과 확정 표현 0건
- [ ] 열감·붓기는 사용자 체감값으로 표시
- [ ] 비교 결과는 관찰된 변화로 표현
- [ ] 촬영 조건 불일치 시 비교 불가 상태 존재

## Gate E — 데이터·개인정보
- [ ] PersonalBaseline, Event, Recheck, Comparison, DecisionLog, Outcome, Timeline 존재
- [ ] captureProtocolVersion, algorithmVersion, appVersion 저장
- [ ] 데이터 최소수집
- [ ] 삭제·내보내기·동의 철회 경로
- [ ] Firestore Security Rules 테스트
- [ ] 분석 이벤트에 이미지·자유서술·민감정보 미포함

## Gate F — KPI
- [ ] capture_started / capture_completed
- [ ] recheck_started / recheck_completed
- [ ] comparison_viewed
- [ ] decision_logged
- [ ] outcome_logged
- [ ] decision_loop_completed
- [ ] offer_viewed / purchase_completed / subscription_started
- [ ] KPI 계산식과 대시보드 쿼리 존재

## Gate G — 디자인·접근성
- [ ] 본문 17px 이상
- [ ] 터치 영역 48px 이상
- [ ] AA 대비
- [ ] 색상만으로 상태 전달하지 않음
- [ ] 한 화면 한 행동
- [ ] 모바일 360/390/430 및 데스크톱 1440 확인
- [ ] 키보드·스크린리더 label 존재

## Gate H — 출시
- [ ] 기능 브랜치와 프리뷰 URL
- [ ] 변경 파일 목록
- [ ] 테스트 결과
- [ ] 마이그레이션 dry-run
- [ ] 롤백 절차
- [ ] 운영 배포 전 대표 결정사항 3개 이하

## 출시 판정
- P0 항목 하나라도 FAIL이면 운영 배포 보류
- P1 항목은 알려진 이슈로 기록하고 파일럿 영향 여부를 판단
- 사업계획서·홈페이지·앱의 숫자와 용어 불일치는 0건이어야 함
