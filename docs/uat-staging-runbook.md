# JOINTRUN Staging UAT 런북

## 공식 UAT 주소 (확정)

```
https://jointrun-staging.firebaseapp.com
```

실기기 Safari에서 Google 로그인이 정상 동작하는 것을 확인해 확정했다(RC1.2.2 P0-6).
**보조 주소**: `https://jointrun-staging.web.app` — 같은 Firebase Hosting 사이트라 화면은
동일하지만, 공식 안내·QR·CTA에는 쓰지 않는다.

### 왜 firebaseapp.com인가

Firebase Auth의 인증 도우미는 `authDomain` 아래의 `/__/auth/*` 경로에서 동작한다. Staging의
`authDomain`이 `jointrun-staging.firebaseapp.com`이므로, 앱을 같은 호스트에서 열면 앱과 인증
도우미가 **같은 출처**가 된다. Safari/WebKit은 교차 출처 저장소 접근을 제한하기 때문에, 이
조건이 아니면 Google 계정을 선택해도 로그인 결과가 앱으로 돌아오지 못하는 경우가 있다.

`web.app`을 앱 주소로 쓰면서 `authDomain`만 그쪽으로 바꾸는 방법은 쓸 수 없다 — Google OAuth
클라이언트에 해당 redirect URI가 등록돼 있지 않아 `redirect_uri_mismatch`(400)가 발생하는 것을
실제 흐름에서 확인했다. 등록하려면 Google Cloud Console 작업이 필요하다.

## 환경 구성

| 항목 | 값 |
|---|---|
| Firebase 프로젝트 | `jointrun-staging` (운영 `jointrun`과 완전 분리) |
| Web App | `jointrun-staging-web` |
| `VITE_FIREBASE_AUTH_DOMAIN` | `jointrun-staging.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | `jointrun-staging` |
| `VITE_QA_MODE_ENABLED` | `true` |
| `VITE_QA_ALLOWED_EMAILS` | 검수 계정 이메일(콤마 구분) |
| `VITE_SERVICE_WORKER_ENABLED` | `false` (UAT 중 PWA 캐시를 변수에서 제외) |

Firebase SDK 값은 `firebase apps:sdkconfig WEB <APP_ID> --project jointrun-staging` 한 세트에서만
가져온다. 어떤 값도 Git·`.env`·보고서에 남기지 않는다.

## 배포 절차

```bash
# 1) 반드시 커밋된 상태에서 빌드한다(미커밋 코드로 배포 금지)
git status --porcelain --untracked-files=no   # 출력이 비어 있어야 한다

# 2) Staging 환경변수를 주입해 빌드
npm run build

# 3) staging 타깃으로만 배포 — 운영 jointrun 프로젝트에는 배포되지 않는다
firebase deploy --only hosting:staging --project jointrun-staging
```

`firebase.json`이 `"target": "staging"`을 쓰고 그 타깃은 `.firebaserc`에서 `jointrun-staging`에만
매핑돼 있다. 운영 프로젝트로 잘못 배포하는 것을 구조적으로 막는 장치이므로 풀지 않는다.

### 배포된 커밋 확인

로그인 화면 하단에 `build <SHA>`가 표시된다. 미커밋 작업 트리로 빌드하면 `-dirty`가 붙으므로
배포 코드와 커밋이 어긋나면 화면에서 바로 드러난다.

## 검증

```bash
npm test              # 유닛
npm run test:rules    # Firestore Rules (Java 필요)
npm run lint
npm run test:staging  # 실배포 E2E — WebKit/Chromium
```

`test:staging`은 기본으로 `https://jointrun-staging.firebaseapp.com`을 검사한다.
`EXPECTED_SHA=<sha>`를 주면 배포된 번들이 그 커밋인지까지 확인한다.
playwright는 Vercel 빌드를 무겁게 하지 않으려고 devDependencies에 넣지 않았다:

```bash
npm i --no-save playwright && npx playwright install webkit chromium
```

## Firebase Auth 승인 도메인

`jointrun-staging.firebaseapp.com`과 `jointrun-staging.web.app`은 기본으로 등록돼 있어 별도
작업이 필요 없다. 다른 호스트에서 열 때만 Firebase 콘솔 → Authentication → Settings →
승인된 도메인에 추가한다.

## 검수 계정과 QA 패널

1. 위 UAT 주소를 연다(Deployment Protection 없음 — 바로 로그인 화면).
2. "Google로 계속하기"로 검수 계정 로그인. 모바일·Safari는 redirect 방식으로 동작하며,
   계정 선택 후 앱으로 돌아온다.
3. `VITE_QA_ALLOWED_EMAILS`에 있는 계정에만 홈 화면의 "QA 모드 — 검수 전용 도구" 패널이 보인다.
   목록에 없는 계정으로 로그인하면 보이지 않아야 한다.

## 체크리스트

- [ ] 로그인 화면이 뜨고 하단 `build <SHA>`가 기대한 커밋과 같은가(`-dirty` 없음)
- [ ] Google 계정 선택 후 앱 홈으로 진입하는가
- [ ] 새로고침해도 로그인이 유지되는가
- [ ] 허용 계정에만 QA 패널이 보이는가
- [ ] 카메라 3포즈가 실제 기기에서 동작하는가
- [ ] baseline 전체 흐름이 끝까지 진행되는가
- [ ] 새로고침 후 `symptom_pending`이 복원되는가
- [ ] 2주·4주 Recheck가 중복 없이 각 1건인가
- [ ] 다른 기기에서 같은 계정으로 기록이 복원되는가

## 참고 — Vercel Preview

RC1.2.2 초기에는 Vercel Preview를 UAT에 썼다. Deployment Protection(SSO) 때문에 접근 절차가
번거롭고 배포마다 주소가 바뀌는 문제가 있어 Firebase Hosting Staging으로 옮겼다. Vercel Preview
설정 이력은 [uat-preview-setup-runbook.md](uat-preview-setup-runbook.md)에 남겨 두었으며,
현재 UAT 경로는 아니다.
