# CLAUDE.md

`docs/sprint-plan.md`(마스터플랜 v3)의 "전역 개발 원칙" 섹션. 모든 세션에서 이 원칙을 따른다.

## 전역 개발 원칙

**Architecture**
- Clean Architecture 유지
- UI / ViewModel / Repository 계층 분리
- UI에는 비즈니스 로직 작성 금지
- ViewModel에는 UI 코드 작성 금지
- Repository만 Firestore 접근 가능
- State 기반 UI 렌더링
- 기존 코드 우선 재사용

**UI**
- Design System 기반, 화면별 스타일 중복 금지
- 공용 컴포넌트 사용

**Domain**
- Pattern Detection은 Domain Service (`PatternDetector`)
- Firestore 모델과 UI 모델 분리
- Repository는 Interface 우선 설계, 구현체가 이를 따름

**Copy (사용자 노출 문구)**
- 패턴 기반 문구는 관찰형만 사용
- 진단·처방·지시 표현 금지 ("병원 가세요", "염증입니다" 등)

**Quality**
- Build 성공
- Lint 오류 0
- 기존 SCAN 회귀 테스트 통과
- 완료 기준 미충족 시 "완료" 선언 금지

## JOINTRUN OS — Automation First

반복 수작업은 자동화가 기본이다.
대표에게 작업을 요청하기 전에
CLI → API → 연결 도구 → 안전한 대체 자동화 순서로 먼저 해결한다.

### 자동화 기본 범위
- 환경변수 일괄 등록 및 적용 범위 감사
- Firebase/Vercel Staging 연결과 Preview 재배포
- 브랜치·커밋·태그·PR 준비 및 상태 확인
- 테스트·빌드·Firestore Rules 검증·배포
- 문서·보고서·체크리스트·Gap Matrix 작성
- 데이터 Dry-run과 영향 분석
- 반복적인 복사·붙여넣기와 결과 취합

### 대표 직접 수행이 필요한 경우
1. 로그인·OAuth·2단계 인증·비밀번호·복구 코드 입력
2. 결제·구독·환불·비용 승인
3. 계약·약관·법적 동의·개인정보 범위 변경·영구 삭제 승인
4. 가격·고객·제품 방향·main 병합·운영 배포·외부 제출의 최종 결정
5. 실제 휴대폰 사용자 경험과 카메라 UAT

### 대표에게 작업을 요청하는 방식
- 요청 전에 반드시 다음 형식을 표시한다.
  `대표 직접 수행 필요 — 사유: 인증/결제/법적 책임/최종 승인`
- 한 번에 한 단계만 안내한다.
- 누를 버튼·입력값·완료 기준·금지 행동을 함께 제시한다.
- 대표 작업 완료 후 자동화 경로로 즉시 이어서 처리한다.
- 같은 값을 반복 입력하도록 요구하지 않는다.

### 보안·배포 중지점
- 비밀값을 채팅·로그·Git·보고서에 출력하지 않는다.
- Production 환경변수, 운영 Firebase, main 병합, 운영 배포는
  대표의 명시적 승인 전 변경하지 않는다.
- 데이터 삭제·마이그레이션은 Dry-run 보고 후 대표 승인 뒤 실행한다.
- 자동화가 막혀도 즉시 수작업으로 전환하지 말고,
  원인·대체 자동화·대표 최소 행동을 먼저 제시한다.

## 이 저장소에서의 적용 (JS/React, TypeScript·Kotlin 아님)

- Repository/Interface는 JS 팩토리 함수로 구현한다(`src/data/recordRepository.js`).
- "ViewModel" 계층은 React 관용에 맞춰 커스텀 훅으로 구현한다(`src/hooks/use*Data.js`) — Firestore ↔ Repository ↔ Hook ↔ UI 순서로 의존한다.
- 공용 컴포넌트는 `src/components/ui/JT*.jsx`, 디자인 토큰은 `src/design/tokens/*.js`에 둔다.
