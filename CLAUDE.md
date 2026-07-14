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

## 이 저장소에서의 적용 (JS/React, TypeScript·Kotlin 아님)

- Repository/Interface는 JS 팩토리 함수로 구현한다(`src/data/recordRepository.js`).
- "ViewModel" 계층은 React 관용에 맞춰 커스텀 훅으로 구현한다(`src/hooks/use*Data.js`) — Firestore ↔ Repository ↔ Hook ↔ UI 순서로 의존한다.
- 공용 컴포넌트는 `src/components/ui/JT*.jsx`, 디자인 토큰은 `src/design/tokens/*.js`에 둔다.
