// 환자 프로필 목업 데이터 및 Biomarker 지표 정의
// (JOINTRUN_UNIFIED.jsx에서 분리됨)

const PATIENT_PROFILES_DEFAULT = [
  {
    id: "hairdresser", name: "김영희", age: 58, gender: "여성",
    job: "미용사 (가위질 하루 8시간 이상)",
    symptoms: "양측 엄지·검지 관절염 및 저녁 통증 극심",
    handCondition: "관절 마찰음 발생, 가위 쥘 때 방아쇠수지(딸깍거림) 초기 현상",
    fingerHealthScore: 68, fingerAge: 65, fingerReserve: 62, recoveryScore: 71,
    morningStiffness: "주의 (약 35분 지속)", morningStiffnessMin: 35,
    painTrend: "오후 가위질 집중 시간대 통증 최고조", painIndex: 7,
    riskForecast: 42, weeklyROMChange: "+4.2% (엄지 굴곡 가동각 개선 중)", streakDays: 8,
  },
  {
    id: "housewife", name: "박정자", age: 65, gender: "여성",
    job: "전업 주부 (김장, 손수건 짜기 등 손노동 빈번)",
    symptoms: "아침 기상 시 양손 뻣뻣함(강직) 40분 지속 및 붓기",
    handCondition: "중지 마디의 방아쇠수지 증상, 물건을 쥘 때 움켜쥐는 힘 부족",
    fingerHealthScore: 59, fingerAge: 72, fingerReserve: 51, recoveryScore: 64,
    morningStiffness: "경고 (약 45분 지속)", morningStiffnessMin: 45,
    painTrend: "아침 기상 후 1시간 이내 극심, 온수 요법 후 완화", painIndex: 8,
    riskForecast: 68, weeklyROMChange: "+1.8% (강직 완화 시간 단축세)", streakDays: 4,
  },
  {
    id: "office_worker", name: "이민우", age: 42, gender: "남성",
    job: "IT 기업 개발자 (키보드·마우스 사용 하루 10시간)",
    symptoms: "우측 수근관 증후군(손목터널) 및 엄지 손가락 끝 저림",
    handCondition: "손등을 맞대고 꺾었을 때(팔렌 검사) 20초 만에 저림 발생",
    fingerHealthScore: 78, fingerAge: 48, fingerReserve: 79, recoveryScore: 82,
    morningStiffness: "정상 (약 10분 지속)", morningStiffnessMin: 10,
    painTrend: "스마트 기기 장시간 사용 시 축적되는 손목 피로", painIndex: 5,
    riskForecast: 24, weeklyROMChange: "+6.5% (손목 가동 범위 양호 수준 유지)", streakDays: 14,
  }
];

// P0 B2C 안전 요건 — 아직 정식 출시되지 않았거나 실제 제품과 연동되지 않은 지표는
// 코드/데이터를 지우지 않고 이 목록으로만 걸러 숨긴다(P2에서 이름만 빼면 다시 노출 가능).
const HIDDEN_BIOMARKER_NAMES = new Set(["Finger Age™", "Risk Forecast™"]);

const BIOMARKER_METRICS = (profile) => [
  { name: "Finger Score™", value: profile.fingerHealthScore, unit: "점", tradeName: "Finger Score™",
    description: "Mobility·Stability·Inflammation·Recovery 4개 하위 점수를 종합한 Finger Health Score입니다.",
    status: profile.fingerHealthScore == null ? null : profile.fingerHealthScore > 75 ? "good" : profile.fingerHealthScore > 60 ? "stable" : "warning" },
  { name: "Finger Age™", value: profile.fingerAge, unit: "세", tradeName: "Finger Age™",
    description: "생체 가동성 데이터를 바탕으로 분석된 회원 님의 손가락 기능 나이입니다.",
    status: profile.fingerAge <= profile.age ? "good" : profile.fingerAge - profile.age < 10 ? "stable" : "danger" },
  { name: "Pain Trend™", value: profile.painIndex, unit: "VAS", tradeName: "Pain Trend™",
    description: "사용자가 기록한 통증 정도를 기준으로 한 척도입니다.",
    status: profile.painIndex < 4 ? "good" : profile.painIndex < 7 ? "stable" : "warning" },
  { name: "Risk Forecast™", value: profile.riskForecast, unit: "%", tradeName: "Risk Forecast™",
    description: "현재 날씨(습도/기압)와 연속 가혹 동작 감지를 통해 예보하는 24시간 내 통증 위험도입니다.",
    status: profile.riskForecast < 30 ? "good" : profile.riskForecast < 50 ? "stable" : "danger" },
].filter((b) => !HIDDEN_BIOMARKER_NAMES.has(b.name));

const DEFAULT_STEPS = [
  { id: 1, label: "Score 확인", description: "오늘 내 Finger Score 및 아침 강직도 상태 확인", isCompleted: false },
  { id: 2, label: "정밀 스캔", description: "20초 AI 카메라 손동작 스캔 가동 범위 측정", isCompleted: false },
  { id: 3, label: "기록 도우미 확인", description: "어제 대비 변화를 기록 도우미와 함께 확인", isCompleted: false },
  { id: 4, label: "3분 손 움직임", description: "가볍게 손을 움직여보는 시간", isCompleted: false },
  { id: 5, label: "회복 일기 공유", description: "소중한 일상과 응원을 커뮤니티에 나누기", isCompleted: false },
  { id: 6, label: "기록 최종 완료", description: "오늘 상태를 기록으로 남기기", isCompleted: false },
];

const BLUEPRINT_SECTIONS = [
  { id: 1, title: "전체 UX 철학", subtitle: "UX Philosophy", content: `JOINTRUN의 핵심 가치는 단순 '정량적 측정'에 머물러 좌절감을 주는 의료 앱이 아닙니다. 행동 경제학과 넛지이론(BJ Fogg)을 바탕으로 '안심'과 '행동 변화'를 선사하는 동반자입니다.\n\n4대 코어 철학:\n• 측정보다 행동: "지금 온수 요법을 5분간 하시면 오늘 업무 통증이 40% 줄어듭니다" 같은 쉬운 첫걸음 유도\n• 점수보다 변화: 어제보다 아침 뻣뻣함이 '5분 줄어들었다'는 상대적 변화치를 강조\n• 기록보다 회복: 20초 AI 카메라 스캔으로 일상 속에서 자동 데이터 누적\n• AI보다 신뢰: 친근하고 든든한 주치의 선생님 같은 '휴먼 터치 대화체' 인터페이스` },
  { id: 2, title: "정보구조(IA) 설계", subtitle: "Information Architecture", content: `JOINTRUN은 회원 님(40-70세)이 복잡한 메뉴 계층에서 길을 잃지 않도록, 평평하고 직관적인 5탭 샌드위치 구조를 채택했습니다.\n\n• 1단계: Bottom Navigation (홈 / 스캔 / AI 코치 / 회복추이 / 나의건강 / 커뮤니티)\n• 2단계 (Home): 최상단 AI 한 줄 안심 처방 → 중앙 마이크로 행동 카드 → 하단 스트릭\n• 3단계 (Scan): 진입 → 20초 ROM 측정 → 즉각적 안심 결과 및 오늘의 행동 연결\n• 4단계 (AI Coach): 1:1 채팅 + 바로가기 행동 키워드 칩` },
  { id: 3, title: "사용자 플로우", subtitle: "User Flow", content: `회원 님이 '통증 자각' 시점부터 '안심과 행동 치료'를 완료하기까지의 순환형 룹 설계입니다.\n\n1. 인식(Trigger): 푸시 알림 ("오늘 아침 기압이 낮아 손이 더 뻣뻣하실 수 있어요")\n2. 진입(Action): 앱 실행 시 홈 화면에서 바로 오늘 손 상태 안심 처방 확인\n3. 간편 스캔(Scan): 20초간 카메라 앞에 손을 펴고 주먹을 쥐어 ROM 측정\n4. AI 코칭(Coach): "오늘 검지 손가락 움직임이 10% 유연해지셨어요!"\n5. 습관 고착(Reward): 행동 완료 후 스트릭 게이지 채우기 → 시각적 피드백` },
  { id: 4, title: "앱 구조도 및 인터페이스", subtitle: "Application Architecture", content: `• Core Engine: MediaPipe HandLandmarker (GPU 가속) + IMU Sensor Wearable Core\n• UX/UI Layer:\n  - Home: 당일 최적 처방 뷰포트\n  - Scan: 20초 무부담 MediaPipe 카메라 스캐너 (PIP 굴곡각 + 측면편위)\n  - AI Coach: Anthropic claude-sonnet-4-6 기반 행동 코칭 대화창\n  - Progress: 가시적 통증 감소선 및 주간 안심 리포트\n  - My Health: 특허 Biomarker 지표 (Finger Score™, Morning Stiffness™ 등)` },
  { id: 5, title: "HandScanEngine 통합", subtitle: "Real MediaPipe Integration", content: `이번 버전의 핵심 업그레이드: 기존 시뮬레이션 스캔을 실제 MediaPipe HandLandmarker로 대체했습니다.\n\n측정 원리:\n• PIP 관절 기준 굴곡각 + 측면편위(요측/척측) 분리 계산\n• 로컬 좌표계 (e1=근위지골 방향, e2=손바닥 법선, e3=좌우 방향)로 분리\n• IndexedDB 기반 시계열 저장 (14회 스캔 트렌드 추적)\n• 검지·중지·약지·소지 4지 동시 분석\n\n알려진 한계: 단안 카메라 기반 3D 추정 오차, 임상 미검증 초기 휴리스틱 점수 공식` },
  { id: 6, title: "AI Coach 아키텍처", subtitle: "Anthropic API Integration", content: `AI Coach는 Anthropic claude-sonnet-4-6 모델로 직접 연결됩니다.\n\n• 시스템 프롬프트: 환자 프로필(나이, 증상, 직업, Finger Score)을 실시간 컨텍스트로 주입\n• 개인화된 관절 건강 조언, 운동 처방, 병원 방문 결정 지원\n• 폴백 로직: API 실패 시 로컬 규칙 기반 응답으로 자동 전환\n• 대화 히스토리 유지: 같은 프로필 내에서 이전 대화 맥락 보존` },
  { id: 7, title: "디지털 바이오마커 지표", subtitle: "Digital Biomarkers™", content: `JOINTRUN 고유의 5대 특허 지표:\n\n• Finger Score™: ROM + 조절 능력 + 근력 종합 점수 (0-100점)\n• Finger Age™: 생체 가동성 데이터 기반 손가락 기능 나이\n• Finger Reserve™: 염증·피로를 이겨낼 수 있는 여유 한계치 (%)\n• Morning Stiffness™: 아침 강직 해소까지 소요 시간 (분)\n• Risk Forecast™: 날씨(기압/습도) + 동작 패턴 기반 24시간 내 통증 예측 (%)` },
  { id: 8, title: "수익 모델 (Revenue Model)", subtitle: "3-Layer Monetization", content: `3계층 수익 구조:\n\n• Layer 1 - B2C 구독: 프리미엄 AI 코치 월 9,900원 / ARO 스마트 보조기 세트 199,000원\n• Layer 2 - B2B 병원: 재활의학과·정형외과 SaaS 라이선스 (원격 모니터링 대시보드)\n• Layer 3 - B2B2C 보험: 생명보험사와 예방적 관절 관리 협약 (보험료 할인 연동)\n\n목표 시장: 국내 류마티스·관절염 환자 350만 명 + 직업성 관절 질환 고위험군 120만 명` },
  { id: 9, title: "경쟁 우위 분석", subtitle: "Competitive Moat", content: `현재 시장 현황:\n• 국내 손가락 관절 특화 디지털 헬스 앱: 0개 (BlueOcean)\n• 보조기 + 소프트웨어 통합 솔루션: 글로벌 부재\n\nJOINTRUN 차별화:\n• 하드웨어(ARO 보조기) + 소프트웨어(AI) 수직 통합\n• MediaPipe 기반 임상급 관절 가동성 측정 (비접촉, 20초)\n• Finger Score™ 등 독자 Biomarker 체계 (특허 출원 예정)\n• 창업자 본인이 환자 = 진정성 있는 제품 개발` },
  { id: 10, title: "임상 타당성 로드맵", subtitle: "Clinical Validation", content: `Phase 1 (현재): 알고리즘 개발 및 소규모 사용자 테스트\nPhase 2 (6개월): IRB 승인 하 재활의학과 파일럿 (n=50)\nPhase 3 (12개월): 다기관 임상 연구 (n=200), SCI 논문 투고\nPhase 4 (18개월): MFDS 의료기기 허가 신청 (소프트웨어 의료기기 SaMD)\n\n주요 KPI: Morning Stiffness 감소 20%, Finger Score 개선 15%, 환자 순응도 85% 이상` },
];

export { PATIENT_PROFILES_DEFAULT, BIOMARKER_METRICS, DEFAULT_STEPS, BLUEPRINT_SECTIONS };
