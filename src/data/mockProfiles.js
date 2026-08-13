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

// Finger Age™/Risk Forecast™는 main(step2-cleanup)에서 이미 완전히 삭제됐고(미출시·과장 표현),
// Morning Stiffness™는 이 브랜치(P0 작업4)에서 독립 지표로 노출하지 않기로 확정 — 셋 다 항목
// 자체를 남기지 않는다. 별도 필터 메커니즘 없이 처음부터 포함하지 않는 쪽으로 병합.
const BIOMARKER_METRICS = (profile) => [
  { name: "Finger Score™", value: profile.fingerHealthScore, unit: "점", tradeName: "Finger Score™",
    description: "Mobility·Stability·Inflammation·Recovery 4개 하위 점수를 종합한 Finger Health Score입니다.",
    status: profile.fingerHealthScore == null ? null : profile.fingerHealthScore > 75 ? "good" : profile.fingerHealthScore > 60 ? "stable" : "warning" },
  { name: "Pain Trend™", value: profile.painIndex, unit: "VAS", tradeName: "Pain Trend™",
    description: "사용자가 기록한 통증 정도를 기준으로 한 척도입니다.",
    status: profile.painIndex < 4 ? "good" : profile.painIndex < 7 ? "stable" : "warning" },
];

const DEFAULT_STEPS = [
  { id: 1, label: "Score 확인", description: "오늘 내 Finger Score 및 아침 강직도 상태 확인", isCompleted: false },
  { id: 2, label: "정밀 스캔", description: "20초 AI 카메라 손동작 스캔 가동 범위 측정", isCompleted: false },
  { id: 3, label: "기록 도우미 확인", description: "어제 대비 변화를 기록 도우미와 함께 확인", isCompleted: false },
  { id: 4, label: "3분 손 움직임", description: "가볍게 손을 움직여보는 시간", isCompleted: false },
  { id: 5, label: "회복 일기 공유", description: "소중한 일상과 응원을 커뮤니티에 나누기", isCompleted: false },
  { id: 6, label: "기록 최종 완료", description: "오늘 상태를 기록으로 남기기", isCompleted: false },
];

export { PATIENT_PROFILES_DEFAULT, BIOMARKER_METRICS, DEFAULT_STEPS };
