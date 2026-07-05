# Contributing to JOINTRUN

JOINTRUN은 개인 프로젝트가 아니라 **스타트업 제품**처럼 관리합니다.
혼자 개발하더라도 아래 규칙을 따르면 이력 추적, 팀원 합류, 투자자 기술 실사에
유리합니다.

---

## 브랜치 전략

```
main       항상 배포 가능한 코드 (Vercel Production 배포 대상)
develop    개발 통합 브랜치
feature/*  기능 단위 브랜치
release/*  배포 준비 (버그 수정만)
hotfix/*   운영 중 긴급 수정
```

### 규칙

- `main`에는 절대 테스트 코드나 미완성 기능을 올리지 않습니다.
- 모든 기능은 `develop`으로 먼저 병합됩니다.
- 기능 하나당 브랜치 하나를 사용합니다.

예:
```
feature/finger-score-v2
feature/rom-engine
feature/risk-forecast
feature/dashboard
feature/firebase-history
feature/login
```

- 배포 준비 시 `release/vX.Y.Z` 브랜치를 만들고 버그 수정만 진행합니다.
- 운영 중 긴급 이슈는 `hotfix/*` 브랜치로 분리해 바로 `main`에 반영 후 `develop`에도 병합합니다.

예: `hotfix/camera-crash`

---

## 버전 관리 (SemVer)

```
v0.1.0 → v0.2.0 → v0.3.0 → v0.5.0 → v1.0.0
```

릴리스마다 태그를 생성합니다.

```bash
git tag v0.2.0
git push origin v0.2.0
```

---

## 커밋 메시지 규칙

| 접두사 | 용도 | 예시 |
|---|---|---|
| `feat:` | 기능 추가 | `feat: add ROM calculation` |
| `fix:` | 버그 수정 | `fix: resolve camera permission issue` |
| `refactor:` | 코드 정리 | `refactor: split motion analyzer` |
| `perf:` | 성능 개선 | `perf: optimize MediaPipe inference` |
| `style:` | 스타일/포맷 | `style: improve dashboard spacing` |
| `docs:` | 문서 | `docs: update README` |
| `test:` | 테스트 | `test: add ROM unit tests` |
| `release:` | 배포 | `release: v0.2.0` |

---

## Pull Request

혼자 개발하더라도 PR을 남깁니다.

```
feature 브랜치 작업 → Pull Request 생성 → develop으로 Merge
```

나중에 언제 어떤 변경을 했는지 추적하기 쉽고, 팀원/투자자가 합류했을 때
개발 이력을 신뢰할 수 있는 근거가 됩니다.

---

## Issues & Projects

- GitHub Issues로 작업 항목을 관리합니다. (예: `#31 Improve Finger Score Accuracy`)
- GitHub Projects에서 Kanban 보드로 진행 상황을 추적합니다.

```
Todo → Doing → Review → Done
```

- Milestone으로 릴리스 단위를 묶습니다. (예: `v0.2 MVP` → `v0.5 Beta` → `v1.0 Release`)

---

## 폴더 구조 (목표)

```
src/
├── components/
├── pages/
├── hooks/
├── contexts/
├── services/
├── firebase/
├── lib/
├── utils/
├── types/
├── styles/
├── assets/
└── constants/
```

AI 관련 로직은 `ai/` 하위에 역할별로 분리합니다.

```
ai/
├── MotionAnalyzer
├── FingerScore
├── ROM
├── RiskForecast
├── PoseEngine
├── FeatureExtractor
└── PredictionEngine
```

> 현재 코드베이스는 위 구조로 완전히 정리되어 있지 않습니다. 폴더 재구성은
> 별도 작업(`refactor:` 커밋)으로 단계적으로 진행하는 것을 권장합니다.
