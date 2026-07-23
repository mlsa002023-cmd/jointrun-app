# 대표 검수용 UAT Preview 환경 설정 런북

이 문서는 대표 검수(UAT)를 위한 Vercel Preview + Staging Firebase 환경을 만들 때
**Vercel/Firebase 대시보드에서 직접 해야 하는 작업**을 정리한 것이다.

이 저장소를 다루는 코딩 에이전트(Claude)는 GitHub Personal Access Token, Vercel
Token, Firebase 비밀키를 대화창에서 요청하거나 다룰 수 없다(보안 정책). 그래서
아래 단계는 대표님 또는 담당 엔지니어가 각 서비스의 대시보드에 직접 로그인해서
진행해야 한다 — 코드 쪽 준비(QA 모드, 환경변수 읽기 구조, Rules 등)는 이미 이번
커밋들에 전부 반영되어 있다.

## 0. 사전 준비 — GitHub 연동 확인

Vercel 프로젝트가 아직 이 GitHub 저장소(`jointrun-app`, `jointrun-homepage`)에
연결되어 있지 않다면, Vercel 대시보드 → "Add New… → Project" → 두 저장소를 각각
import한다. 이미 연결되어 있다면 이 단계는 건너뛴다.

## 1. Staging Firebase 프로젝트 만들기

1. https://console.firebase.google.com → "프로젝트 추가" → 이름 예: `jointrun-staging`
   (운영 프로젝트와 완전히 분리된 별도 프로젝트여야 한다 — 운영 데이터와 절대 섞이지 않음)
2. 프로젝트 안에서 "웹 앱 추가"(</> 아이콘) → 앱 닉네임 아무거나 → 나오는
   `firebaseConfig` 객체의 6개 값(`apiKey`, `authDomain`, `projectId`,
   `storageBucket`, `messagingSenderId`, `appId`)을 복사해둔다. (2-C에서 사용)
3. "Firestore Database" → 만들기 → 프로덕션 모드 → 리전은 기존 운영 프로젝트와
   동일하게 선택.
4. "Authentication" → 시작하기 → "이메일/비밀번호" 제공업체 사용 설정. (Google
   로그인도 쓰고 싶다면 함께 사용 설정)
5. 로컬에서 이 Staging 프로젝트에 Firestore Rules를 배포한다(이미 검증된
   `firestore.rules` 그대로 사용 — 운영과 동일한 보안 규칙):
   ```
   firebase login
   firebase use --add        # jointrun-staging을 별칭(예: staging)으로 등록
   firebase deploy --only firestore:rules --project jointrun-staging
   ```

## 2. Vercel 프로젝트 환경변수 설정 (앱 저장소만 해당 — 홈페이지는 Firebase 불필요)

Vercel 프로젝트 → Settings → Environment Variables. Vercel은 변수마다 어느
환경(Production / Preview / Development)에 적용할지 체크박스로 지정할 수 있다 —
**아래 값들은 반드시 "Preview" 체크박스만 켜고 "Production"은 꺼둔다.**

| 변수명 | 값 | 적용 환경 |
|---|---|---|
| `VITE_FIREBASE_API_KEY` | 1-2에서 복사한 값 | Preview만 |
| `VITE_FIREBASE_AUTH_DOMAIN` | 〃 | Preview만 |
| `VITE_FIREBASE_PROJECT_ID` | 〃 | Preview만 |
| `VITE_FIREBASE_STORAGE_BUCKET` | 〃 | Preview만 |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | 〃 | Preview만 |
| `VITE_FIREBASE_APP_ID` | 〃 | Preview만 |
| `VITE_QA_MODE_ENABLED` | `true` | Preview만 |
| `VITE_QA_ALLOWED_EMAILS` | 대표님이 가입할 이메일 주소(콤마로 여러 개 가능) | Preview만 |

`VITE_QA_MODE_ENABLED`와 Staging Firebase 값을 **Production 환경변수에는 절대
추가하지 않는다** — 이것이 운영 배포에서 QA 도구와 Staging 연결이 노출되지 않게
하는 유일한 장치다(코드는 이미 이 값이 없으면 항상 꺼진 상태로 동작하도록
작성되어 있고, 실제 build로 직접 검증했다).

설정 후 해당 브랜치에 새로 push하거나 "Redeploy"를 눌러야 반영된다.

## 3. 고정된 Preview URL

GitHub 브랜치를 Vercel에 연결해두면, 같은 브랜치(`feat/v9-design-integration`)에
push할 때마다 Vercel이 **항상 같은 URL**로 재배포한다(형태:
`<프로젝트명>-git-feat-v9-design-integration-<팀명>.vercel.app`). 더 보기 좋은
URL을 원하면 Vercel Settings → Domains에서 이 Preview 배포에 별도 별칭(alias)을
지정할 수 있다.

정확한 URL은 Vercel 프로젝트 대시보드의 Deployments 탭에서 확인 가능하다 — 이
환경에는 Vercel 로그인 권한이 없어 실제 URL을 확인하지 못했다.

## 4. Deployment Protection (허가된 검수자만 접근)

Vercel 프로젝트 → Settings → Deployment Protection → "Preview Deployments"에 대해
다음 중 하나를 선택:
- **Vercel Authentication**(추천): Vercel 계정으로 로그인한 사람 중 이 프로젝트에
  초대된 사람만 접근 가능
- **Password Protection**: 검수자에게 공유할 별도 비밀번호 설정
- **특정 이메일/도메인만 허용**도 가능(Vercel Pro 이상 플랜)

## 5. Firebase Auth — Authorized Domains

Firebase 콘솔 → Authentication → Settings → "승인된 도메인" → 3에서 확인한
고정 Preview 도메인을 정확히 추가한다(`https://` 없이 호스트명만, 예:
`jointrun-app-git-feat-v9-design-integration-yourteam.vercel.app`). 이 설정이
없으면 Preview에서 로그인/회원가입 시 `auth/unauthorized-domain` 오류가 난다.

## 6. 검수용 테스트 계정 만들기 (비밀번호를 아무 데도 넣지 않는 방법)

1. Preview URL을 열면 로그인 화면이 뜬다(Staging Firebase가 연결되어 있으므로
   데모 모드가 아니라 실제 회원가입/로그인 화면).
2. 대표님이 직접 "회원가입"에서 원하는 이메일 + 비밀번호로 계정을 만든다 —
   이 비밀번호는 Firebase Authentication에만 저장되고, 코드/Git/문서 어디에도
   들어가지 않는다.
3. 그 이메일을 2번 표의 `VITE_QA_ALLOWED_EMAILS`에 넣어야 QA 패널이 보인다 —
   순서상 먼저 이메일을 정해서 환경변수에 넣고, 그 다음 그 이메일로 가입하는
   순서를 권장한다.

## 확인 체크리스트 (설정 후 대표님이 직접 확인)

- [ ] Preview URL 접속 시 Deployment Protection 화면이 먼저 뜨는가
- [ ] 통과 후 JOINTRUN 로그인/회원가입 화면이 뜨는가(데모 모드 배너가 아니라)
- [ ] 지정한 이메일로 로그인하면 홈 화면에 "QA 모드 — 검수 전용 도구" 패널이 보이는가
- [ ] 다른(허용되지 않은) 이메일로 가입하면 QA 패널이 보이지 않는가
- [ ] QA 패널의 "촬영 방식"을 "실제 카메라"로 바꾸면 휴대폰에서 정상적으로 카메라
      권한을 요청하는가
