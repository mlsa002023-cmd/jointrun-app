/**
 * JOINTRUN UNIFIED APP
 * jointrun-11 (Movement Intelligence Platform) + HandScanEngine (MediaPipe) + Anthropic AI Coach
 *
 * 통합 내역:
 * 1. jointrun-11: 완성된 6탭 모바일 앱 에뮬레이터 + 투자자 스펙덱
 * 2. HandScanEngine: 실제 MediaPipe HandLandmarker 웹캠 스캔 (기존 시뮬레이션 대체)
 * 3. AI Coach: /api → Anthropic claude-sonnet-4-6 직접 연결
 *
 * 의존성: lucide-react, recharts (CDN available in artifact env)
 * MediaPipe: CDN (jsdelivr + Google Storage) 런타임 자동 로드
 */

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Activity, Sparkles, Compass, Layers, MessageSquare, FileText,
  User, Zap, Printer, Volume2, Users, TrendingUp, Award,
  ShieldCheck, Camera, BookOpen, CheckCircle2, Settings,
  Send, RefreshCw, HelpCircle, ChevronRight, Heart, AlertCircle,
  ArrowRight, Flame, Check, Smile, LogOut, Loader2
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip as ChartTooltip, BarChart, Bar, Cell
} from "recharts";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import AuthScreen from "./components/AuthScreen";
import { saveScanResult, getScanHistory, saveCheckIn, saveProfileSnapshot, getProfileSnapshot } from "./lib/firestore";

// ─────────────────────────────────────────────
// CONSTANTS & DATA
// ─────────────────────────────────────────────

// MediaPipe — npm 패키지로 설치 (CDN dynamic import 제거)
const MODEL_URL = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

const HAND_CONNECTIONS = [
  [0,1],[1,2],[2,3],[3,4],
  [0,5],[5,6],[6,7],[7,8],
  [5,9],[9,10],[10,11],[11,12],
  [9,13],[13,14],[14,15],[15,16],
  [13,17],[17,18],[18,19],[19,20],
  [0,17],
];

// 20초 스캔 동안 순환하는 유도 동작. 각 동작이 펴짐/굽힘/미세조절 각도를
// 뚜렷하게 드러내도록 설계 — ROM 측정 신뢰도와 사용자 몰입도를 동시에 높임.
const POSE_GUIDE = [
  { id: "spread", label: "손가락 펴기", instruction: "손가락을 최대한 쫙 펴주세요", sub: "최대 신전각(펴짐) 측정", duration: 7 },
  { id: "ok",     label: "OK 사인",     instruction: "엄지와 검지를 붙여 OK 모양을 만들어 주세요", sub: "정밀 조절력 측정", duration: 7 },
  { id: "fist",   label: "가볍게 쥐기", instruction: "주먹을 편안하게 살짝 쥐어 주세요", sub: "최대 굴곡각(굽힘) 측정", duration: 6 },
];

// 포즈별 미니 라인아트 아이콘. 실사 이미지 없이도 어떤 손 모양을 취해야 하는지
// 한눈에 전달되도록 각 동작의 손가락 배치를 단순화해 표현.
function PoseIcon({ poseId, className = "" }) {
  const stroke = "currentColor";
  if (poseId === "ok") {
    return (
      <svg viewBox="0 0 64 64" className={className} fill="none">
        <circle cx="24" cy="34" r="10" stroke={stroke} strokeWidth="3" />
        <path d="M38 20 L38 40" stroke={stroke} strokeWidth="3" strokeLinecap="round" />
        <path d="M46 22 L46 42" stroke={stroke} strokeWidth="3" strokeLinecap="round" />
        <path d="M53 26 L53 44" stroke={stroke} strokeWidth="3" strokeLinecap="round" />
        <path d="M18 48 Q32 56 50 50" stroke={stroke} strokeWidth="3" strokeLinecap="round" />
      </svg>
    );
  }
  if (poseId === "fist") {
    return (
      <svg viewBox="0 0 64 64" className={className} fill="none">
        <rect x="16" y="26" width="32" height="24" rx="10" stroke={stroke} strokeWidth="3" />
        <path d="M24 26 V18" stroke={stroke} strokeWidth="3" strokeLinecap="round" />
        <path d="M32 26 V16" stroke={stroke} strokeWidth="3" strokeLinecap="round" />
        <path d="M40 26 V18" stroke={stroke} strokeWidth="3" strokeLinecap="round" />
        <path d="M14 36 Q10 38 12 44" stroke={stroke} strokeWidth="3" strokeLinecap="round" />
      </svg>
    );
  }
  // spread (default)
  return (
    <svg viewBox="0 0 64 64" className={className} fill="none">
      <path d="M32 58 Q18 58 16 44 L14 30" stroke={stroke} strokeWidth="3" strokeLinecap="round" />
      <path d="M20 30 L18 12" stroke={stroke} strokeWidth="3" strokeLinecap="round" />
      <path d="M28 28 L27 8" stroke={stroke} strokeWidth="3" strokeLinecap="round" />
      <path d="M36 28 L38 8" stroke={stroke} strokeWidth="3" strokeLinecap="round" />
      <path d="M44 30 L48 12" stroke={stroke} strokeWidth="3" strokeLinecap="round" />
      <path d="M50 34 L56 22" stroke={stroke} strokeWidth="3" strokeLinecap="round" />
      <path d="M32 58 Q46 58 48 44 L50 34" stroke={stroke} strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

const PATIENT_PROFILES_DEFAULT = [
  {
    id: "hairdresser", name: "김영희", age: 58, gender: "여성",
    job: "미용사 (가위질 하루 8시간 이상)",
    symptoms: "양측 엄지·검지 관절염 및 저녁 통증 극심",
    handCondition: "관절 마찰음 발생, 가위 쥘 때 방아쇠수지(딸깍거림) 초기 현상",
    fingerScore: 68, fingerAge: 65, fingerReserve: 62, recoveryScore: 71,
    morningStiffness: "주의 (약 35분 지속)", morningStiffnessMin: 35,
    painTrend: "오후 가위질 집중 시간대 통증 최고조", painIndex: 7,
    riskForecast: 42, weeklyROMChange: "+4.2% (엄지 굴곡 가동각 개선 중)", streakDays: 8,
  },
  {
    id: "housewife", name: "박정자", age: 65, gender: "여성",
    job: "전업 주부 (김장, 손수건 짜기 등 손노동 빈번)",
    symptoms: "아침 기상 시 양손 뻣뻣함(강직) 40분 지속 및 붓기",
    handCondition: "중지 마디의 방아쇠수지 증상, 물건을 쥘 때 움켜쥐는 힘 부족",
    fingerScore: 59, fingerAge: 72, fingerReserve: 51, recoveryScore: 64,
    morningStiffness: "경고 (약 45분 지속)", morningStiffnessMin: 45,
    painTrend: "아침 기상 후 1시간 이내 극심, 온수 요법 후 완화", painIndex: 8,
    riskForecast: 68, weeklyROMChange: "+1.8% (강직 완화 시간 단축세)", streakDays: 4,
  },
  {
    id: "office_worker", name: "이민우", age: 42, gender: "남성",
    job: "IT 기업 개발자 (키보드·마우스 사용 하루 10시간)",
    symptoms: "우측 수근관 증후군(손목터널) 및 엄지 손가락 끝 저림",
    handCondition: "손등을 맞대고 꺾었을 때(팔렌 검사) 20초 만에 저림 발생",
    fingerScore: 78, fingerAge: 48, fingerReserve: 79, recoveryScore: 82,
    morningStiffness: "정상 (약 10분 지속)", morningStiffnessMin: 10,
    painTrend: "스마트 기기 장시간 사용 시 축적되는 손목 피로", painIndex: 5,
    riskForecast: 24, weeklyROMChange: "+6.5% (손목 가동 범위 양호 수준 유지)", streakDays: 14,
  }
];

const BIOMARKER_METRICS = (profile) => [
  { name: "Finger Score™", value: profile.fingerScore, unit: "점", tradeName: "Finger Score™",
    description: "관절 운동각(ROM), 조절 능력, 근력을 종합한 JOINTRUN 고유의 손가락 건강 상태 지표입니다.",
    status: profile.fingerScore > 75 ? "good" : profile.fingerScore > 60 ? "stable" : "warning" },
  { name: "Finger Age™", value: profile.fingerAge, unit: "세", tradeName: "Finger Age™",
    description: "생체 가동성 데이터를 바탕으로 분석된 회원 님의 손가락 기능 나이입니다.",
    status: profile.fingerAge <= profile.age ? "good" : profile.fingerAge - profile.age < 10 ? "stable" : "danger" },
  { name: "Morning Stiffness™", value: profile.morningStiffnessMin, unit: "분 지속", tradeName: "Morning Stiffness™",
    description: "아침 기상 시 손가락이 뻣뻣하고 구부리기 힘든 증상이 해소되는 데 걸리는 시간입니다.",
    status: profile.morningStiffnessMin < 15 ? "good" : profile.morningStiffnessMin < 35 ? "stable" : "warning" },
  { name: "Pain Trend™", value: profile.painIndex, unit: "VAS", tradeName: "Pain Trend™",
    description: "AI 스마트 보조기의 미세 압력 변화와 유저 설문을 통해 기록된 통증 척도입니다.",
    status: profile.painIndex < 4 ? "good" : profile.painIndex < 7 ? "stable" : "warning" },
  { name: "Risk Forecast™", value: profile.riskForecast, unit: "%", tradeName: "Risk Forecast™",
    description: "현재 날씨(습도/기압)와 연속 가혹 동작 감지를 통해 예보하는 24시간 내 통증 위험도입니다.",
    status: profile.riskForecast < 30 ? "good" : profile.riskForecast < 50 ? "stable" : "danger" },
];

const DEFAULT_STEPS = [
  { id: 1, label: "Score 확인", description: "오늘 내 Finger Score 및 아침 강직도 상태 확인", isCompleted: false },
  { id: 2, label: "정밀 스캔", description: "20초 AI 카메라 손동작 스캔 가동 범위 측정", isCompleted: false },
  { id: 3, label: "AI 소견 분석", description: "어제 대비 개선 정도 및 AI 한 줄 맞춤 진단", isCompleted: false },
  { id: 4, label: "3분 온수 운동", description: "관절 윤활 및 유연 회복을 위한 잼잼 요법", isCompleted: false },
  { id: 5, label: "회복 일기 공유", description: "소중한 일상과 응원을 커뮤니티에 나누기", isCompleted: false },
  { id: 6, label: "기록 최종 완료", description: "오늘 회복 스트릭 채우고 관절 회복력 축적", isCompleted: false },
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

// ─────────────────────────────────────────────
// HAND BIOMECHANICS (순수 함수)
// ─────────────────────────────────────────────

function sub(a, b) { return { x: a.x-b.x, y: a.y-b.y, z: a.z-b.z }; }
function dot(a, b) { return a.x*b.x + a.y*b.y + a.z*b.z; }
function cross(a, b) { return { x: a.y*b.z-a.z*b.y, y: a.z*b.x-a.x*b.z, z: a.x*b.y-a.y*b.x }; }
function norm(v) { const m = Math.sqrt(dot(v,v)); return m<1e-9?{x:0,y:0,z:1}:{x:v.x/m,y:v.y/m,z:v.z/m}; }
function angleDeg(a, b) { return Math.acos(Math.max(-1, Math.min(1, dot(norm(a), norm(b)))))*(180/Math.PI); }

function analyzePIPJoint(wl, mcp, pip, dip) {
  const proximal = sub(wl[pip], wl[mcp]);
  const distal   = sub(wl[dip], wl[pip]);
  const palmNorm = norm(cross(sub(wl[5],wl[0]), sub(wl[17],wl[0])));
  const e1 = norm(proximal);
  const e2 = norm(sub(palmNorm, {x:dot(palmNorm,e1)*e1.x,y:dot(palmNorm,e1)*e1.y,z:dot(palmNorm,e1)*e1.z}));
  const e3 = cross(e1, e2);
  const fx = dot(distal, e1);
  const fy = dot(distal, e2);
  const fz = dot(distal, e3);
  const flexion = Math.atan2(fy, fx)*(180/Math.PI);
  const deviation = Math.atan2(fz, fx)*(180/Math.PI);
  const direction = fz > 0 ? "radial" : "ulnar";
  return { flexion: Math.max(0, flexion), deviation: Math.abs(deviation), deviationDir: direction };
}

const FINGER_CHAINS = {
  index:  { mcp:5,  pip:6,  dip:7,  name:"검지" },
  middle: { mcp:9,  pip:10, dip:11, name:"중지" },
  ring:   { mcp:13, pip:14, dip:15, name:"약지" },
  pinky:  { mcp:17, pip:18, dip:19, name:"소지" },
};

function analyzeAllFingers(wl) {
  return Object.entries(FINGER_CHAINS).map(([key, c]) => {
    const r = analyzePIPJoint(wl, c.mcp, c.pip, c.dip);
    const score = Math.round(Math.min(100, Math.max(0, (r.flexion/80)*60 + (1-Math.min(r.deviation,10)/10)*40)));
    return { key, name: c.name, ...r, score };
  });
}

// ─────────────────────────────────────────────
// ANTHROPIC AI COACH
// ─────────────────────────────────────────────

async function callAnthropicCoach(messages, profile) {
  const systemPrompt = `당신은 JOINTRUN의 전문 관절 건강 AI 코치입니다. 손가락·손목 관절 건강을 전문으로 합니다.

현재 환자 정보:
- 이름: ${profile.name} (${profile.age}세, ${profile.gender})
- 직업: ${profile.job}
- 주요 증상: ${profile.symptoms}
- Finger Score™: ${profile.fingerScore}/100점
- 아침 강직: ${profile.morningStiffness}
- 통증 VAS: ${profile.painIndex}/10

응답 규칙:
1. 친근하고 따뜻한 주치의 말투로 답하세요.
2. 환자의 직업과 증상에 맞게 구체적인 조언을 제공하세요.
3. 3분 온수 잼잼 요법, 스마트 보조기 활용, 생활 습관 개선을 권장하세요.
4. 의학적 진단을 내리지 말고, 전문의 상담을 권장하는 방향으로 안내하세요.
5. 200자 이내로 간결하게 답변하세요.`;

  const apiMessages = messages
    .filter(m => m.sender !== "system")
    .map(m => ({ role: m.sender === "user" ? "user" : "assistant", content: m.text }));

  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY || "";
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
      ...(apiKey ? { "x-api-key": apiKey } : {}),
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      system: systemPrompt,
      messages: apiMessages,
    }),
  });
  if (!response.ok) throw new Error("API error " + response.status);
  const data = await response.json();
  return data.content?.[0]?.text || "";
}

// ─────────────────────────────────────────────
// HAND SCAN ENGINE (MediaPipe 실제 통합)
// ─────────────────────────────────────────────

function HandScanEngine({ currentProfile, onScanCompleted, triggerFeedback }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const landmarkerRef = useRef(null);
  const rafRef = useRef(null);
  const lastVideoTimeRef = useRef(-1);
  const latestResultRef = useRef(null);

  const [status, setStatus] = useState("idle"); // idle|loading|ready|error|completed
  const [errorMessage, setErrorMessage] = useState(null);
  const [handDetected, setHandDetected] = useState(false);
  const [liveMetrics, setLiveMetrics] = useState(null);
  const [history, setHistory] = useState([]);
  const [justSaved, setJustSaved] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [poseIndex, setPoseIndex] = useState(0);
  const [poseSecondsLeft, setPoseSecondsLeft] = useState(POSE_GUIDE[0].duration);
  const poseIndexRef = useRef(0);

  // 스캔이 시작되면(status === "ready") 유도 동작을 순서대로 자동 순환.
  useEffect(() => {
    if (status !== "ready") return;
    poseIndexRef.current = 0;
    setPoseIndex(0);
    setPoseSecondsLeft(POSE_GUIDE[0].duration);
    const timer = setInterval(() => {
      setPoseSecondsLeft(prev => {
        if (prev <= 1) {
          const nextIdx = (poseIndexRef.current + 1) % POSE_GUIDE.length;
          poseIndexRef.current = nextIdx;
          setPoseIndex(nextIdx);
          return POSE_GUIDE[nextIdx].duration;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [status]);

  const stopCamera = useCallback(() => {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  const drawSkeleton = useCallback((landmarks, canvas, videoW, videoH) => {
    const ctx = canvas.getContext("2d");
    canvas.width = videoW; canvas.height = videoH;
    ctx.clearRect(0, 0, videoW, videoH);
    const toCanvas = (lm) => ({ x: lm.x * videoW, y: lm.y * videoH });
    ctx.strokeStyle = "#00fff7"; ctx.lineWidth = 2;
    HAND_CONNECTIONS.forEach(([i, j]) => {
      const a = toCanvas(landmarks[i]), b = toCanvas(landmarks[j]);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    });
    landmarks.forEach((lm, idx) => {
      const p = toCanvas(lm);
      ctx.beginPath();
      ctx.arc(p.x, p.y, idx === 0 ? 5 : 3, 0, 2*Math.PI);
      ctx.fillStyle = idx === 0 ? "#ff6b6b" : "#c084fc";
      ctx.fill();
    });
  }, []);

  const detectLoop = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !landmarkerRef.current) return;
    if (video.currentTime !== lastVideoTimeRef.current) {
      lastVideoTimeRef.current = video.currentTime;
      const result = landmarkerRef.current.detectForVideo(video, performance.now());
      if (result.landmarks?.length > 0) {
        setHandDetected(true);
        const wl = result.worldLandmarks[0];
        const fingers = analyzeAllFingers(wl);
        latestResultRef.current = fingers;
        setLiveMetrics(fingers);
        drawSkeleton(result.landmarks[0], canvas, video.videoWidth || 640, video.videoHeight || 480);
      } else {
        setHandDetected(false);
        setLiveMetrics(null);
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
    rafRef.current = requestAnimationFrame(detectLoop);
  }, [drawSkeleton]);

  // HandLandmarker 생성: GPU 델리게이트 우선 시도, 실패 시 CPU로 자동 폴백.
  // (모바일 브라우저/구형 GPU/WebView에서 GPU 델리게이트가 조용히 실패하는 경우가 많음)
  const createLandmarker = async (vision) => {
    try {
      return await HandLandmarkerCtor.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
        runningMode: "VIDEO", numHands: 1,
      });
    } catch (gpuErr) {
      console.warn("[JOINTRUN] GPU delegate 실패, CPU로 재시도:", gpuErr);
      return await HandLandmarkerCtor.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: "CPU" },
        runningMode: "VIDEO", numHands: 1,
      });
    }
  };

  let HandLandmarkerCtor = null; // createLandmarker 클로저에서 참조

  const startScan = async () => {
    setStatus("loading");
    setErrorMessage(null);
    triggerFeedback("MediaPipe 모델을 불러오는 중...");

    // 1+2) MediaPipe npm 패키지로 직접 로드 (Vite CDN dynamic import 문제 완전 해결)
let landmarker;
try {
  const { FilesetResolver, HandLandmarker } = await import("@mediapipe/tasks-vision");
  HandLandmarkerCtor = HandLandmarker;
  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm"
  );
  landmarker = await createLandmarker(vision);
} catch (err) {
      console.error("[JOINTRUN] HandLandmarker 초기화 실패:", err);
      setErrorMessage(`AI 모델(WASM) 초기화에 실패했습니다. (${err?.message || "알 수 없는 오류"})`);
      setStatus("simulation");
      triggerFeedback("AI 모델 초기화 실패 — 시뮬레이션 모드로 전환합니다.");
      return;
    }
    landmarkerRef.current = landmarker;

// 3) 카메라 권한/스트림 (실패 원인: 권한 거부, 카메라 없음, HTTPS 아님)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        }
      });
      if (videoRef.current) {
        const v = videoRef.current;
        v.srcObject = stream;
        v.setAttribute("playsinline", "");
        v.setAttribute("webkit-playsinline", "");
        v.muted = true;
        v.autoplay = true;
        await new Promise((resolve, reject) => {
          v.onloadedmetadata = () => v.play().then(resolve).catch(reject);
          setTimeout(reject, 8000);
        });
      }
    } catch (err) {
      console.error("[JOINTRUN] 카메라 접근 실패:", err);
      setErrorMessage(`카메라에 접근할 수 없습니다. (${err?.message || "권한 거부"})`);
      setStatus("simulation");
      triggerFeedback("카메라 접근 불가 — 시뮬레이션 모드로 전환합니다.");
      return;
    }
    setStatus("ready");
    triggerFeedback("카메라 연결 완료! 손을 화면에 비춰주세요.");
    rafRef.current = requestAnimationFrame(detectLoop);
  };

  const saveSnapshot = () => {
    if (!latestResultRef.current) return;
    const fingers = latestResultRef.current;
    const avgScore = Math.round(fingers.reduce((s, f) => s + f.score, 0) / fingers.length);
    const avgFlexion = Math.round(fingers.reduce((s, f) => s + f.flexion, 0) / fingers.length);
    const entry = { ts: Date.now(), avgScore, avgFlexion, fingers };
    const next = [entry, ...history].slice(0, 14);
    setHistory(next);
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 1200);

    // Notify parent
    const stiffnessMin = Math.round((100 - avgScore) * 0.5);
    const painIndex = Math.round((100 - avgScore) / 15);
    setScanResult({ romDeg: avgFlexion, stiffnessMin, painIndex, fingers, avgScore });
    onScanCompleted({ romDeg: avgFlexion, stiffnessMin, painIndex, avgScore, fingers, recommendation: buildRecommendation(avgScore, avgFlexion) });
    triggerFeedback(`스캔 저장 완료! Finger Score: ${avgScore}점`);
  };

  const runSimulation = () => {
    const simResult = {
      romDeg: 122, stiffnessMin: 32, painIndex: 6,
      fingers: [
        { key:"index", name:"검지", flexion: 118, deviation: 4.2, deviationDir:"ulnar", score: 82 },
        { key:"middle", name:"중지", flexion: 125, deviation: 3.1, deviationDir:"radial", score: 88 },
        { key:"ring", name:"약지", flexion: 110, deviation: 6.8, deviationDir:"ulnar", score: 72 },
        { key:"pinky", name:"소지", flexion: 105, deviation: 5.5, deviationDir:"ulnar", score: 68 },
      ],
      avgScore: 78,
    };
    setScanResult(simResult);
    onScanCompleted({ romDeg: simResult.romDeg, stiffnessMin: simResult.stiffnessMin, painIndex: simResult.painIndex, avgScore: simResult.avgScore, fingers: simResult.fingers, recommendation: buildRecommendation(simResult.avgScore, simResult.romDeg) });
    triggerFeedback("시뮬레이션 스캔 완료!");
    setStatus("completed");
  };

  function buildRecommendation(score, rom) {
    if (score >= 80) return `손가락 가동 범위 ${rom}°로 양호합니다. 예방적 관리를 위해 보조기를 15° 각도로 설정하고 타이핑 작업 시 정기 스트레칭을 추천합니다.`;
    if (score >= 60) return `Finger Score ${score}점, 굴곡각 ${rom}°입니다. 3분 온수 잼잼 요법으로 관절 윤활액 분비를 촉진하고, 오늘 밤 보조기 착용을 권장합니다.`;
    return `Finger Score ${score}점으로 주의가 필요합니다. 무리한 손 사용을 줄이고, 즉시 따뜻한 물에 손을 5분간 담그신 후 전문의 상담을 권장합니다.`;
  }

  const statusColor = { good: "#14b8a6", stable: "#f59e0b", warning: "#ef4444", danger: "#dc2626" };

  if (status === "idle") return (
    <div className="space-y-4">
      <div className="text-center bg-white border border-slate-200 p-4 rounded-3xl shadow-sm">
        <p className="text-[9px] text-slate-400 uppercase tracking-widest font-mono">Real MediaPipe AI Scan</p>
        <h2 className="text-base font-bold text-slate-900">실제 손 관절 스캔</h2>
        <p className="text-[10px] text-slate-500 leading-normal mt-1">MediaPipe HandLandmarker로 PIP 굴곡각·측면편위를 실시간 측정합니다.</p>
      </div>
      <div className="bg-slate-900 rounded-2xl p-8 flex flex-col items-center gap-4 border border-teal-500/20">
        <div className="w-16 h-16 rounded-full bg-teal-500/10 border border-teal-500/30 flex items-center justify-center">
          <Camera className="w-8 h-8 text-teal-400" />
        </div>
        <p className="text-[10px] text-slate-400 text-center leading-relaxed">카메라 앞에 손을 가볍게 펼쳐 주세요.<br/>어떠한 민감 정보도 외부로 전송되지 않습니다.</p>
        <button onClick={startScan} className="bg-teal-500 hover:bg-teal-400 text-slate-950 font-black px-5 py-2 rounded-xl text-xs shadow-md transition-all">
          MediaPipe 스캔 시작
        </button>
      </div>
      <div className="bg-white border border-slate-200 p-3 rounded-2xl flex gap-3 text-[10px] text-slate-500 leading-relaxed">
        <HelpCircle className="w-5 h-5 text-teal-600 shrink-0 mt-0.5" />
        <span>실내 밝은 조명 아래, 손바닥이 카메라를 향하도록 하면 가장 정확합니다. 카메라 권한이 없으면 시뮬레이션 모드로 대체됩니다.</span>
      </div>
    </div>
  );

  if (status === "loading") return (
    <div className="flex flex-col items-center justify-center py-16 gap-4">
      <div className="w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
      <p className="text-xs text-slate-500">MediaPipe 모델 로딩 중...</p>
    </div>
  );

  if (status === "simulation") return (
    <div className="space-y-4">
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-center">
        <p className="text-xs font-bold text-amber-700">시뮬레이션 모드</p>
        <p className="text-[10px] text-amber-600 mt-1">
          {errorMessage || "카메라 접근이 불가하여 시뮬레이션 데이터로 시연합니다."}
        </p>
        <div className="flex gap-2 justify-center mt-3">
          <button onClick={() => { setStatus("idle"); setErrorMessage(null); }}
            className="bg-white border border-amber-300 text-amber-700 font-bold text-xs px-4 py-2 rounded-xl">
            다시 시도
          </button>
          <button onClick={runSimulation} className="bg-teal-500 text-white font-bold text-xs px-4 py-2 rounded-xl">
            시뮬레이션 스캔 실행
          </button>
        </div>
      </div>
    </div>
  );

  if (status === "completed" && scanResult) return (
    <div className="space-y-4">
      <div className="bg-white border border-teal-200 rounded-2xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5 text-teal-700 text-xs font-bold">
            <Sparkles className="w-4 h-4 text-orange-500" />
            스캔 분석 완료
          </div>
          <button onClick={() => { setStatus("idle"); setScanResult(null); stopCamera(); }}
            className="text-[10px] text-slate-500 hover:text-slate-800 flex items-center gap-1 font-bold">
            <RefreshCw className="w-3 h-3" /> 다시 측정
          </button>
        </div>
        <div className="grid grid-cols-4 gap-2 mb-3">
          {scanResult.fingers.map(f => (
            <div key={f.key} className="bg-slate-50 p-2 rounded-xl border border-slate-200 text-center">
              <div className="text-[8px] text-slate-400 font-bold">{f.name}</div>
              <div className="text-sm font-black text-teal-700 font-mono">{f.score}</div>
              <div className="text-[7px] text-slate-400">{Math.round(f.flexion)}°</div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="bg-slate-50 p-2 rounded-xl border border-slate-200 text-center">
            <div className="text-[8px] text-slate-400">ROM</div>
            <div className="text-xs font-black font-mono">{scanResult.romDeg}°</div>
          </div>
          <div className="bg-slate-50 p-2 rounded-xl border border-slate-200 text-center">
            <div className="text-[8px] text-slate-400">강직지수</div>
            <div className="text-xs font-black font-mono">{scanResult.stiffnessMin}분</div>
          </div>
          <div className="bg-slate-50 p-2 rounded-xl border border-slate-200 text-center">
            <div className="text-[8px] text-slate-400">VAS</div>
            <div className="text-xs font-black text-orange-600 font-mono">{scanResult.painIndex}단계</div>
          </div>
        </div>
        <div className="bg-teal-50 border border-teal-200 p-2.5 rounded-xl text-[10px] text-slate-700 leading-relaxed">
          <strong className="text-slate-900">처방:</strong> {buildRecommendation(scanResult.avgScore, scanResult.romDeg)}
        </div>
      </div>
      {history.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-3">
          <p className="text-[10px] font-bold text-slate-700 mb-2">최근 스캔 기록 (14회)</p>
          <div className="flex gap-1 overflow-x-auto">
            {history.slice(0,14).map((h, i) => (
              <div key={i} className="shrink-0 text-center">
                <div className="w-6 h-6 rounded bg-teal-100 flex items-center justify-center text-[8px] font-black text-teal-700">{h.avgScore}</div>
                <div className="text-[7px] text-slate-400">{new Date(h.ts).toLocaleDateString("ko-KR",{month:"numeric",day:"numeric"})}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const currentPose = POSE_GUIDE[poseIndex];
  const poseProgress = 1 - poseSecondsLeft / currentPose.duration;
  const ringR = 17;
  const ringCirc = 2 * Math.PI * ringR;

 // status === "ready" — live camera (풀화면)
return (
  <div style={{position:"fixed",inset:0,zIndex:200,background:"#000",display:"flex",flexDirection:"column"}}>
    <div style={{position:"relative",flex:1,overflow:"hidden"}}>
        <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover scale-x-[-1]" playsInline webkit-playsinline="true" muted autoPlay style={{opacity:1}} />
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none z-10 scale-x-[-1]" />
        <div className="absolute inset-4 border border-dashed border-teal-500/30 rounded-xl pointer-events-none" />

        {/* 스캐닝 레이저 스윕 - 스캔이 살아있다는 느낌을 주는 시각 효과 */}
        <div className="absolute inset-x-0 top-0 h-1/3 pointer-events-none z-10 bg-gradient-to-b from-transparent via-teal-400/25 to-transparent animate-scan-sweep" />

        <div className="absolute top-2 left-2 right-2 flex justify-between items-center z-20">
          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full transition-colors ${handDetected ? "bg-teal-500 text-slate-950" : "bg-slate-700 text-slate-400"}`}>
            {handDetected ? "손 감지됨" : "손을 화면에 보여주세요"}
          </span>
          <span className="text-[9px] text-teal-400 font-mono bg-slate-950/80 px-2 py-0.5 rounded-full flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" /> LIVE
          </span>
        </div>

        {/* 유도 동작 가이드 카드: 지금 어떤 손동작을 취해야 하는지 안내 */}
        <div className="absolute top-9 left-2 right-2 z-20 bg-slate-950/85 backdrop-blur-sm rounded-xl p-2.5 flex items-center gap-2.5 border border-teal-500/20">
          <div className="relative w-11 h-11 shrink-0">
            <svg viewBox="0 0 40 40" className="absolute inset-0 w-full h-full -rotate-90">
              <circle cx="20" cy="20" r={ringR} fill="none" stroke="#1e293b" strokeWidth="3" />
              <circle cx="20" cy="20" r={ringR} fill="none" stroke="#2dd4bf" strokeWidth="3"
                strokeDasharray={ringCirc}
                strokeDashoffset={ringCirc * (1 - poseProgress)}
                strokeLinecap="round" className="transition-all duration-1000 ease-linear" />
            </svg>
            <PoseIcon poseId={currentPose.id} className="absolute inset-0 w-full h-full p-1.5 text-teal-300" />
            <span className="absolute -bottom-1 -right-1 text-[8px] font-black text-teal-300 bg-slate-950 rounded-full w-4 h-4 flex items-center justify-center border border-teal-500/40">
              {poseSecondsLeft}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-bold text-white leading-tight">{currentPose.instruction}</p>
            <p className="text-[8px] text-teal-400/80 mt-0.5">{currentPose.sub}</p>
          </div>
          <div className="flex gap-1 shrink-0">
            {POSE_GUIDE.map((p, i) => (
              <span key={p.id} className={`w-1.5 h-1.5 rounded-full transition-colors ${i === poseIndex ? "bg-teal-400" : i < poseIndex ? "bg-teal-700" : "bg-slate-700"}`} />
            ))}
          </div>
        </div>

        {liveMetrics && (
          <div className="absolute bottom-2 left-2 right-2 z-20 bg-slate-950/80 rounded-xl p-2 grid grid-cols-4 gap-1">
            {liveMetrics.map(f => (
              <div key={f.key} className="text-center">
                <div className="text-[8px] text-slate-400">{f.name}</div>
                <div className="text-[10px] font-black text-teal-400 font-mono">{Math.round(f.flexion)}°</div>
                <div className="text-[7px] text-slate-500">{Math.round(f.deviation)}° {f.deviationDir === "radial" ? "요측" : "척측"}</div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="flex gap-2">
        <button onClick={saveSnapshot} disabled={!handDetected}
          className={`flex-1 py-2 rounded-xl text-xs font-black transition-all ${handDetected ? "bg-teal-500 hover:bg-teal-400 text-slate-950 shadow-md" : "bg-slate-200 text-slate-400 cursor-not-allowed"}`}>
          {justSaved ? "저장됨!" : "스냅샷 저장"}
        </button>
        <button onClick={() => { stopCamera(); setStatus("idle"); }}
          className="px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-600 transition-all">
          종료
        </button>
      </div>
      {history.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-2">
          <p className="text-[9px] text-slate-500 mb-1 font-bold">스캔 기록</p>
          <div className="flex gap-1 overflow-x-auto">
            {history.slice(0,14).map((h, i) => (
              <div key={i} className="shrink-0 w-6 h-6 rounded bg-teal-100 flex items-center justify-center text-[8px] font-black text-teal-700">{h.avgScore}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// AI COACH MODULE
// ─────────────────────────────────────────────

function CoachModule({ currentProfile, triggerFeedback }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    setMessages([{
      id: "welcome", sender: "coach",
      text: `안녕하세요, ${currentProfile.name} 님! JOINTRUN AI 코치입니다. 오늘 손가락·손목 상태는 어떠신가요? 아침 강직도나 통증 등 편히 말씀해 주세요.`,
      ts: "방금 전"
    }]);
  }, [currentProfile.id]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, typing]);

  const QUICK_CHIPS = ["오늘 손이 많이 아파요", "아침 강직이 심해요", "보조기 사용법 알려줘", "온수 요법 방법은?"];

  const send = async (text) => {
    const txt = text || input.trim();
    if (!txt) return;
    const userMsg = { id: `u-${Date.now()}`, sender: "user", text: txt, ts: new Date().toLocaleTimeString("ko-KR",{hour:"2-digit",minute:"2-digit"}) };
    const nextMsgs = [...messages, userMsg];
    setMessages(nextMsgs);
    setInput("");
    setTyping(true);
    try {
      const reply = await callAnthropicCoach(nextMsgs, currentProfile);
      setTyping(false);
      setMessages(prev => [...prev, { id: `c-${Date.now()}`, sender: "coach", text: reply, ts: "방금 전" }]);
      triggerFeedback("AI 코치 소견이 도착했습니다.");
    } catch {
      setTyping(false);
      const fallback = `${currentProfile.name} 님, ${currentProfile.job}으로 인해 손가락 건초 긴장이 누적되었을 수 있습니다. 억지로 꺾지 마시고 3분간 따뜻한 온수 잼잼 요법으로 관절 윤활액 분비를 촉진해 주세요.`;
      setMessages(prev => [...prev, { id: `cf-${Date.now()}`, sender: "coach", text: fallback, ts: "방금 전" }]);
    }
  };

  return (
    <div className="flex flex-col h-full space-y-3">
      <div className="text-center bg-white border border-slate-200 p-3 rounded-2xl shadow-sm">
        <p className="text-[9px] text-slate-400 uppercase tracking-widest font-mono">Anthropic AI Coach</p>
        <h2 className="text-sm font-bold text-slate-900">AI 관절 건강 코치</h2>
      </div>
      <div className="flex-1 overflow-y-auto space-y-2.5 max-h-80 px-1">
        {messages.map(m => (
          <div key={m.id} className={`flex ${m.sender === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] px-3 py-2 rounded-2xl text-[10px] leading-relaxed ${
              m.sender === "user" ? "bg-teal-600 text-white" : "bg-white border border-slate-200 text-slate-800"
            }`}>
              {m.text}
              <div className="text-[7px] mt-0.5 opacity-60">{m.ts}</div>
            </div>
          </div>
        ))}
        {typing && (
          <div className="flex justify-start">
            <div className="bg-white border border-slate-200 px-3 py-2 rounded-2xl flex gap-1 items-center">
              {[0,1,2].map(i => <span key={i} className="w-1.5 h-1.5 bg-teal-400 rounded-full animate-bounce" style={{animationDelay:`${i*0.15}s`}} />)}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <div className="flex gap-1 flex-wrap">
        {QUICK_CHIPS.map(chip => (
          <button key={chip} onClick={() => send(chip)} className="bg-slate-100 hover:bg-teal-50 border border-slate-200 hover:border-teal-300 text-slate-600 hover:text-teal-700 px-2.5 py-1 rounded-full text-[9px] font-semibold transition-all">
            {chip}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && send()}
          placeholder="증상을 입력하세요..." className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-teal-500" />
        <button onClick={() => send()} className="bg-teal-600 hover:bg-teal-500 text-white p-2 rounded-xl transition-all">
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// HOME MODULE
// ─────────────────────────────────────────────

function HomeModule({ currentProfile, recoverySteps, setRecoverySteps, setActiveTab, triggerFeedback, onUpdateProfile, onCheckIn }) {
  const [activeStepId, setActiveStepId] = useState(1);
  const [timer, setTimer] = useState(180);
  const [timerRunning, setTimerRunning] = useState(false);

  useEffect(() => {
    const next = recoverySteps.find(s => !s.isCompleted);
    if (next) setActiveStepId(next.id);
  }, [recoverySteps]);

  useEffect(() => {
    if (!timerRunning) return;
    if (timer <= 0) { setTimerRunning(false); triggerFeedback("온수 잼잼 요법 완료!"); return; }
    const t = setTimeout(() => setTimer(p => p - 1), 1000);
    return () => clearTimeout(t);
  }, [timerRunning, timer]);

  const completeStep = (id) => {
    const completedStep = recoverySteps.find(s => s.id === id);
    const next = recoverySteps.map(s => s.id === id ? { ...s, isCompleted: true } : s);
    setRecoverySteps(next);
    triggerFeedback(`${completedStep?.label} 완료!`);
    onCheckIn?.({
      stepId: id,
      stepLabel: completedStep?.label || "",
      painIndex: currentProfile.painIndex,
      morningStiffnessMin: currentProfile.morningStiffnessMin,
    });
    const nextStep = recoverySteps.find(s => s.id > id && !s.isCompleted);
    if (nextStep) setActiveStepId(nextStep.id);
  };

  const completedCount = recoverySteps.filter(s => s.isCompleted).length;
  const score = currentProfile.fingerScore;

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-br from-teal-50 to-slate-50 border border-teal-200 rounded-2xl p-3.5 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="text-[9px] text-slate-400 uppercase font-mono">Finger Score™</p>
            <div className="flex items-end gap-1">
              <span className="text-2xl font-black text-teal-700 font-mono">{score}</span>
              <span className="text-xs text-slate-500 mb-0.5">/100</span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[9px] text-slate-400">관절 기능 나이</p>
            <p className="text-lg font-black text-slate-800 font-mono">{currentProfile.fingerAge}<span className="text-xs font-normal">세</span></p>
          </div>
        </div>
        <div className="w-full bg-slate-200 rounded-full h-2">
          <div className="bg-teal-500 h-2 rounded-full transition-all" style={{ width: `${score}%` }} />
        </div>
        <div className="flex justify-between text-[8px] text-slate-400 mt-0.5">
          <span>주의</span><span>양호</span><span>최상</span>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-3 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1">
            <Flame className="w-4 h-4 text-orange-500" />오늘의 회복 미션
          </h4>
          <span className="text-[10px] text-teal-600 font-bold">{completedCount}/{recoverySteps.length}</span>
        </div>
        <div className="space-y-1.5">
          {recoverySteps.map(step => (
            <div key={step.id} className={`flex items-center gap-2 p-2 rounded-xl transition-all ${step.isCompleted ? "bg-teal-50 border border-teal-200" : activeStepId === step.id ? "bg-orange-50 border border-orange-200" : "bg-slate-50 border border-slate-100"}`}>
              <button onClick={() => !step.isCompleted && completeStep(step.id)} className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[8px] font-black border transition-all ${step.isCompleted ? "bg-teal-500 border-teal-500 text-white" : "border-slate-300 text-slate-400 hover:border-teal-400"}`}>
                {step.isCompleted ? <Check className="w-3 h-3" /> : step.id}
              </button>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-bold text-slate-800 truncate">{step.label}</div>
                <div className="text-[8px] text-slate-400 truncate">{step.description}</div>
              </div>
              {!step.isCompleted && activeStepId === step.id && (
                <button onClick={() => { if (step.id === 2) setActiveTab("scan"); else if (step.id === 3) setActiveTab("coach"); else completeStep(step.id); }} className="text-[8px] font-bold text-orange-600 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-lg shrink-0">
                  {step.id === 2 ? "스캔" : step.id === 3 ? "코치" : "시작"}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-3 shadow-sm">
        <h4 className="text-xs font-bold text-slate-900 mb-2">오늘의 AI 처방</h4>
        <div className="bg-teal-50 border border-teal-200 rounded-xl p-2.5 text-[10px] text-slate-700 leading-relaxed">
          {currentProfile.painIndex > 6 ? `${currentProfile.name} 님, 오늘 통증 수치가 높습니다. 무리한 손 사용을 줄이고 3분 온수 잼잼 요법을 즉시 시작해 주세요.` : `${currentProfile.name} 님, 오늘 관절 상태가 안정적입니다. 스마트 보조기를 착용한 채로 가볍게 20초 스캔을 진행해 회복 데이터를 누적해 보세요.`}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// TIMELINE MODULE
// ─────────────────────────────────────────────

function TimelineModule({ currentProfile, currentUser, triggerDoctorReportPrint, triggerFeedback }) {
  const [scans, setScans] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      if (!currentUser) { setLoading(false); return; }
      try {
        const rows = await getScanHistory(currentUser.uid, 30);
        if (!cancelled) setScans(rows);
      } catch (err) {
        console.error("[JOINTRUN] 스캔 기록 조회 실패:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [currentUser]);

  // Firestore는 최신순(desc)으로 오므로 그래프용으로 오래된 순으로 뒤집고,
  // createdAt(Firestore Timestamp)을 사람이 읽는 날짜 라벨로 변환.
  const chartData = [...scans].reverse().map(s => ({
    week: s.createdAt?.toDate ? s.createdAt.toDate().toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" }) : "-",
    pain: s.painIndex ?? 0,
    rom: s.avgScore ?? 0,
  }));

  const hasRealData = chartData.length >= 2;
  const latestScore = scans[0]?.avgScore;
  const earliestScore = scans[scans.length - 1]?.avgScore;
  const realWeeklyChange = (hasRealData && latestScore != null && earliestScore != null)
    ? `${latestScore >= earliestScore ? "+" : ""}${latestScore - earliestScore}점 (Finger Score 변화)`
    : null;

  return (
    <div className="space-y-4">
      <div className="text-center bg-white border border-slate-200 p-3 rounded-2xl shadow-sm">
        <p className="text-[9px] text-slate-400 uppercase font-mono">Recovery Progress</p>
        <h2 className="text-sm font-bold text-slate-900">관절 가동 범위(ROM) & 통증 감소 추이</h2>
      </div>

      {loading ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center">
          <p className="text-[10px] text-slate-400">스캔 기록을 불러오는 중...</p>
        </div>
      ) : !hasRealData ? (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-center">
          <p className="text-xs font-bold text-amber-700">아직 데이터가 충분하지 않습니다</p>
          <p className="text-[10px] text-amber-600 mt-1 leading-relaxed">
            모션스캔을 2회 이상 진행하면 실제 스캔 기록을 바탕으로 한 추이 그래프가 여기에 표시됩니다.
          </p>
        </div>
      ) : (
        <>
          <div className="bg-white border border-slate-200 rounded-2xl p-3 shadow-sm">
            <p className="text-[10px] font-bold text-teal-700 mb-2">실제 스캔 기록 — 통증 지수(VAS) 추이</p>
            <div className="h-40 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="week" tick={{fontSize:8}} />
                  <YAxis tick={{fontSize:8}} domain={[0,10]} />
                  <ChartTooltip contentStyle={{fontSize:"10px"}} />
                  <Area type="monotone" dataKey="pain" stroke="#ef4444" fill="#fee2e2" name="통증(VAS)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-3 shadow-sm">
            <p className="text-[10px] font-bold text-teal-700 mb-2">실제 스캔 기록 — Finger Score™ 추이</p>
            <div className="h-36 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="week" tick={{fontSize:8}} />
                  <YAxis tick={{fontSize:8}} domain={[0,100]} />
                  <ChartTooltip contentStyle={{fontSize:"10px"}} />
                  <Bar dataKey="rom" name="Finger Score" radius={[4,4,0,0]}>
                    {chartData.map((_, i) => <Cell key={i} fill={i === chartData.length - 1 ? "#14b8a6" : "#99f6e4"} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}

      <div className="bg-teal-50 border border-teal-200 rounded-2xl p-3 text-center">
        <p className="text-[10px] font-bold text-teal-800 mb-2">
          주간 회복 변화: <span className="text-teal-600">{realWeeklyChange || currentProfile.weeklyROMChange}</span>
        </p>
        <button onClick={triggerDoctorReportPrint} className="bg-teal-600 text-white text-[10px] font-bold px-3 py-1.5 rounded-xl flex items-center gap-1 mx-auto">
          <Printer className="w-3.5 h-3.5" /> 소견서 출력
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// REPORT MODULE
// ─────────────────────────────────────────────

function ReportModule({ currentProfile, triggerDoctorReportPrint, triggerFeedback }) {
  const biomarkers = BIOMARKER_METRICS(currentProfile);
  const statusColors = { good:"bg-teal-50 border-teal-200 text-teal-700", stable:"bg-amber-50 border-amber-200 text-amber-700", warning:"bg-orange-50 border-orange-200 text-orange-700", danger:"bg-red-50 border-red-200 text-red-700" };
  const statusLabels = { good:"양호", stable:"주의", warning:"경고", danger:"위험" };

  return (
    <div className="space-y-4">
      <div className="text-center bg-white border border-slate-200 p-3 rounded-2xl shadow-sm">
        <p className="text-[9px] text-slate-400 uppercase font-mono">Digital Biomarkers</p>
        <h2 className="text-sm font-bold text-slate-900">내 손의 디지털 바이오마커</h2>
      </div>
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 text-center space-y-2">
        <h4 className="text-xs font-bold text-slate-800">대학병원 제출용 소견 PDF</h4>
        <button onClick={triggerDoctorReportPrint} className="bg-teal-600 text-white px-4 py-2 rounded-xl text-[10px] font-extrabold w-full flex items-center justify-center gap-1">
          <Printer className="w-3.5 h-3.5" /> 공식 소견서 미리보기 / 인쇄
        </button>
      </div>
      <div className="space-y-2">
        {biomarkers.map(b => (
          <div key={b.name} className="bg-white border border-slate-200 rounded-2xl p-3 flex items-center justify-between gap-3 shadow-sm">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold text-slate-900">{b.tradeName}</p>
              <p className="text-[8px] text-slate-400 leading-relaxed line-clamp-2">{b.description}</p>
            </div>
            <div className="text-right shrink-0">
              <div className="text-base font-black text-slate-900 font-mono">{b.value}<span className="text-[9px] font-normal text-slate-400 ml-0.5">{b.unit}</span></div>
              <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full border ${statusColors[b.status]}`}>{statusLabels[b.status]}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// COMMUNITY MODULE
// ─────────────────────────────────────────────

function CommunityModule({ currentProfile, triggerFeedback }) {
  const [feed, setFeed] = useState([
    { id: "f1", author: "정정자", age: 58, job: "가사", score: 83, feeling: "가뿐함", content: "오늘 아침 강직이 15분 만에 풀렸어요! 온수 잼잼 요법 3일째인데 확실히 달라요.", likes: 24, supported: false, liked: false },
    { id: "f2", author: "홍길동", age: 52, job: "요리사", content: "칼질하다 손가락이 많이 부었는데 보조기 덕분에 퇴근 후엔 좀 낫네요.", likes: 18, supported: false, liked: false },
    { id: "f3", author: "김미순", age: 67, job: "농부", content: "농사일 후 손목이 시려워서 걱정했는데 AI 코치 추천대로 했더니 좋아졌어요.", likes: 31, supported: false, liked: false },
  ]);

  return (
    <div className="space-y-4">
      <div className="text-center bg-white border border-slate-200 p-3 rounded-2xl shadow-sm">
        <p className="text-[9px] text-slate-400 uppercase font-mono">Community</p>
        <h2 className="text-sm font-bold text-slate-900">손 건강 회복 커뮤니티</h2>
      </div>
      <div className="space-y-3">
        {feed.map(item => (
          <div key={item.id} className="bg-white border border-slate-200 rounded-2xl p-3 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-full bg-teal-100 flex items-center justify-center text-[10px] font-black text-teal-700">{item.author[0]}</div>
              <div>
                <p className="text-[10px] font-bold text-slate-900">{item.author} ({item.age}세)</p>
                <p className="text-[8px] text-slate-400">{item.job}</p>
              </div>
            </div>
            <p className="text-[10px] text-slate-700 leading-relaxed mb-2">{item.content}</p>
            <div className="flex gap-2">
              <button onClick={() => { setFeed(f => f.map(x => x.id === item.id ? {...x, liked: !x.liked, likes: x.liked ? x.likes-1 : x.likes+1} : x)); triggerFeedback("공감을 보냈습니다."); }} className={`flex items-center gap-1 text-[9px] px-2 py-1 rounded-full border transition-all ${item.liked ? "bg-red-50 border-red-200 text-red-600" : "bg-slate-50 border-slate-200 text-slate-500"}`}>
                <Heart className="w-3 h-3" /> {item.likes}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// PREMIUM MODULE (Calibrator)
// ─────────────────────────────────────────────

function PremiumModule({ currentProfile, triggerFeedback }) {
  const [angle, setAngle] = useState(15);
  const [preset, setPreset] = useState("생업");
  const presets = { "수면": 10, "생업": 15, "재활": 25 };

  return (
    <div className="space-y-3">
      <div className="text-center">
        <p className="text-[9px] text-slate-400 uppercase font-mono">Premium Control</p>
        <h2 className="text-sm font-bold text-slate-900">스마트 보조기 정밀 조율</h2>
      </div>
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-1.5">
          {Object.entries(presets).map(([label, val]) => (
            <button key={label} onClick={() => { setPreset(label); setAngle(val); triggerFeedback(`${label} 프리셋 적용: ${val}°`); }} className={`py-2 rounded-xl text-[10px] font-bold border transition-all ${preset === label ? "bg-teal-500 text-white border-teal-500" : "bg-slate-50 border-slate-200 text-slate-600"}`}>
              {label}
            </button>
          ))}
        </div>
        <div>
          <div className="flex justify-between mb-1">
            <span className="text-[10px] text-slate-500 font-bold">압박 고정각</span>
            <span className="text-xs font-black text-teal-600 font-mono">{angle}°</span>
          </div>
          <input type="range" min={5} max={35} value={angle} onChange={e => setAngle(Number(e.target.value))} className="w-full accent-teal-600" />
          <div className="flex justify-between text-[8px] text-slate-400 mt-0.5"><span>5° 최소</span><span>35° 최대</span></div>
        </div>
        <div className="bg-teal-50 border border-teal-200 rounded-xl p-2.5 text-[10px] text-teal-800 leading-relaxed">
          {angle <= 12 ? "수면 중 무의식 꺾임 방지를 위한 최소 지지 모드입니다." : angle <= 20 ? `${currentProfile.job} 업무 시 최적 압박 각도입니다. 관절 보호와 움직임을 균형 있게 유지합니다.` : "강도 높은 재활 지지 모드입니다. 통증이 있을 시 즉시 각도를 낮추세요."}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────────

function JOINTRUNUnified() {
 const { currentUser, logout } = useAuth();

// 실제 로그인 사용자 기반 프로필 생성
const buildUserProfile = (user, overrides = {}) => ({
  id: user.uid,
  name: user.displayName || user.email?.split("@")[0] || "회원",
  age: 0,
  gender: "",
  job: "직업 미등록",
  symptoms: "증상 미등록",
  handCondition: "",
  fingerScore: 70,
  fingerAge: 40,
  fingerReserve: 65,
  recoveryScore: 72,
  morningStiffness: "정상",
  morningStiffnessMin: 15,
  painTrend: "",
  painIndex: 3,
  riskForecast: 20,
  weeklyROMChange: "측정 대기 중",
  streakDays: 1,
  ...overrides,
});

const [userProfile, setUserProfile] = useState(
  currentUser ? buildUserProfile(currentUser) : PATIENT_PROFILES_DEFAULT[0]
);

const currentProfile = userProfile;

// 로그인 시 Firestore 스냅샷 불러와 프로필에 반영
useEffect(() => {
  if (!currentUser) return;
  setUserProfile(buildUserProfile(currentUser));
  (async () => {
    const snapshot = await getProfileSnapshot(currentUser.uid);
    if (snapshot) {
      setUserProfile(prev => ({ ...prev, ...snapshot }));
    }
  })();
}, [currentUser?.uid]);

  const [activeTab, setActiveTab] = useState("home");
  const [recoverySteps, setRecoverySteps] = useState(DEFAULT_STEPS);
  const [feedbackMsg, setFeedbackMsg] = useState(null);
  const [activeSpecSection, setActiveSpecSection] = useState(1);
  const [specSearch, setSpecSearch] = useState("");
  const [showOnboarding, setShowOnboarding] = useState(true);
  const [onboardingStep, setOnboardingStep] = useState(1);
  const [showDoctorReport, setShowDoctorReport] = useState(false);
  const [showCalibrator, setShowCalibrator] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileForm, setProfileForm] = useState({});
  const [profileMode, setProfileMode] = useState("edit");

  const triggerFeedback = (msg) => {
    setFeedbackMsg(msg);
    if ("vibrate" in navigator) { try { navigator.vibrate(40); } catch {} }
    setTimeout(() => setFeedbackMsg(null), 2500);
  };

  const handleScanCompleted = (metrics) => {
    const updated = { ...currentProfile, fingerScore: Math.min(100, currentProfile.fingerScore+1), painIndex: metrics.painIndex, morningStiffnessMin: metrics.stiffnessMin };
   setUserProfile(updated);
    setRecoverySteps(s => s.map(step => step.id === 2 ? { ...step, isCompleted: true } : step));
    if (currentUser) {
      saveScanResult(currentUser.uid, metrics).catch(err => console.error("스캔 결과 저장 실패:", err));
      saveProfileSnapshot(currentUser.uid, {
        fingerScore: updated.fingerScore,
        painIndex: updated.painIndex,
        morningStiffnessMin: updated.morningStiffnessMin,
      }).catch(err => console.error("프로필 스냅샷 저장 실패:", err));
    }
  };

  const handleCheckIn = (checkinData) => {
    if (!currentUser) return;
    saveCheckIn(currentUser.uid, checkinData).catch(err => console.error("체크인 저장 실패:", err));
  };

  const triggerDoctorReportPrint = () => { triggerFeedback("대학병원 제출용 AI 안심 리포트 PDF가 생성되었습니다."); setShowDoctorReport(true); };

  const TAB_CONFIG = [
    { id: "home", icon: Compass, label: "홈" },
    { id: "scan", icon: Camera, label: "모션스캔", fab: true },
    { id: "coach", icon: MessageSquare, label: "AI코치" },
    { id: "progress", icon: TrendingUp, label: "회복추이" },
    { id: "health", icon: Activity, label: "나의건강" },
    { id: "premium", icon: Users, label: "커뮤니티" },
  ];

  return (
    <div style={{
      minHeight:"100vh",
      maxWidth:480,
      margin:"0 auto",
      background:"#f8fafc",
      fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
      display:"flex",
      flexDirection:"column",
      position:"relative",
    }}>

      {/* ── 앱 상단 헤더 (앱 이름 + 로그아웃) ── */}
      <div style={{
        background:"white",
        borderBottom:"0.5px solid #e2e8f0",
        padding:"10px 16px",
        display:"flex",
        alignItems:"center",
        justifyContent:"space-between",
        position:"sticky",
        top:0,
        zIndex:50,
      }}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div style={{background:"#0d9488",color:"white",width:30,height:30,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center"}}>
            <Activity style={{width:16,height:16}} />
          </div>
          <span style={{fontSize:15,fontWeight:900,letterSpacing:"-0.5px",color:"#0f172a"}}>JOINTRUN</span>
        </div>
        <button onClick={logout}
          style={{display:"flex",alignItems:"center",gap:4,fontSize:11,fontWeight:600,color:"#94a3b8",background:"none",border:"none",cursor:"pointer",padding:"4px 8px"}}>
          <LogOut style={{width:13,height:13}} />로그아웃
        </button>
      </div>

      {/* ── 앱 스크롤 콘텐츠 ── */}
      <main style={{flex:1,overflowY:"auto",padding:"12px 14px 80px"}}>



            {/* Onboarding */}
            {showOnboarding && (
              <div style={{position:"fixed",top:60,left:"50%",transform:"translateX(-50%)",width:"calc(100% - 24px)",maxWidth:456,background:"#0f172a",borderRadius:16,padding:14,border:"1px solid rgba(20,184,166,0.3)",zIndex:20,boxShadow:"0 8px 24px rgba(0,0,0,0.3)"}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:8,alignItems:"center"}}>
                  <span style={{fontSize:10,color:"#5eead4",fontWeight:700,display:"flex",alignItems:"center",gap:4}}>
                    <Sparkles style={{width:13,height:13,color:"#fb923c"}} />첫 만남 진단 (JTBD)
                  </span>
                  <button onClick={() => setShowOnboarding(false)} style={{fontSize:11,color:"#94a3b8",background:"none",border:"none",cursor:"pointer",fontWeight:700}}>닫기 ×</button>
                </div>
                {onboardingStep <= 3 && (
                  <div>
                    <p style={{fontSize:10,color:"#cbd5e1",lineHeight:1.6,marginBottom:8}}>
                      {onboardingStep === 1 && `${currentProfile.name} 님, 가장 걱정되는 부위는?`}
                      {onboardingStep === 2 && "일상에서 가장 곤란한 행동은?"}
                      {onboardingStep === 3 && "JOINTRUN과 달성하고 싶은 목표는?"}
                    </p>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6}}>
                      {(onboardingStep===1?["엄지","끝마디","손전체"]:onboardingStep===2?["가사","생업","사무"]:["유연성","생업지속","통증감소"]).map(opt => (
                        <button key={opt} onClick={() => onboardingStep < 3 ? setOnboardingStep(s=>s+1) : setShowOnboarding(false)}
                          style={{padding:"7px 4px",borderRadius:10,fontSize:10,fontWeight:700,border:"1px solid #334155",background:"#1e293b",color:"#cbd5e1",cursor:"pointer",transition:"all 0.2s"}}>
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* App content */}
              {activeTab === "home" && (
                <div>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
                    <div>
                      <div style={{fontSize:11,color:"#94a3b8"}}>환영합니다!</div>
                      <div style={{fontSize:16,fontWeight:900,color:"#0f172a"}}>{currentProfile.name} 님</div>
                    </div>
                    <div style={{background:"#fff7ed",border:"1px solid #fed7aa",color:"#ea580c",padding:"4px 10px",borderRadius:20,display:"flex",alignItems:"center",gap:4,fontSize:11,fontWeight:800}}>
                      <Zap style={{width:12,height:12,fill:"#ea580c"}} />{currentProfile.streakDays}일 연속
                    </div>
                  </div>
                  <div style={{background:"white",border:"1px solid #e2e8f0",borderRadius:12,padding:"8px 12px",display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12,boxShadow:"0 1px 3px rgba(0,0,0,0.05)"}}>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <span style={{width:8,height:8,borderRadius:"50%",background:"#14b8a6",display:"inline-block",boxShadow:"0 0 0 3px rgba(20,184,166,0.2)"}} />
                      <div>
                        <div style={{fontSize:9,color:"#64748b",fontWeight:700}}>스마트 보조기 정렬</div>
                        <div style={{fontSize:9,color:"#0d9488",fontWeight:600,fontFamily:"monospace"}}>기기 정밀 조율 각도: 15°</div>
                      </div>
                    </div>
                    <button onClick={() => { setShowCalibrator(true); triggerFeedback("보조기 캘리브레이션 시작"); }}
                      style={{background:"#f0fdfa",border:"1px solid #99f6e4",color:"#0d9488",padding:"4px 8px",borderRadius:8,fontSize:9,fontWeight:800,cursor:"pointer",display:"flex",alignItems:"center",gap:3}}>
                      <Settings style={{width:12,height:12}} />기기 조율
                    </button>
                  </div>
                  <HomeModule currentProfile={currentProfile} recoverySteps={recoverySteps} setRecoverySteps={setRecoverySteps} setActiveTab={setActiveTab} triggerFeedback={triggerFeedback} onUpdateProfile={p => setProfiles(ps => ps.map(x => x.id === p.id ? p : x))} onCheckIn={handleCheckIn} />
                </div>
              )}
              {activeTab === "scan" && <HandScanEngine currentProfile={currentProfile} onScanCompleted={handleScanCompleted} triggerFeedback={triggerFeedback} />}
              {activeTab === "coach" && <CoachModule currentProfile={currentProfile} triggerFeedback={triggerFeedback} />}
              {activeTab === "progress" && <TimelineModule currentProfile={currentProfile} currentUser={currentUser} selectedProfileId={selectedId} triggerDoctorReportPrint={triggerDoctorReportPrint} triggerFeedback={triggerFeedback} />}
              {activeTab === "health" && <ReportModule currentProfile={currentProfile} triggerDoctorReportPrint={triggerDoctorReportPrint} triggerFeedback={triggerFeedback} />}
              {activeTab === "premium" && <CommunityModule currentProfile={currentProfile} triggerFeedback={triggerFeedback} />}


      </main>

      {/* ── Bottom Navigation (fixed) ── */}
      <nav style={{
        position:"fixed",
        bottom:0,
        left:"50%",
        transform:"translateX(-50%)",
        width:"100%",
        maxWidth:480,
        background:"white",
        borderTop:"0.5px solid #e2e8f0",
        display:"flex",
        justifyContent:"space-between",
        padding:"6px 8px 10px",
        zIndex:100,
        boxShadow:"0 -2px 12px rgba(0,0,0,0.08)",
      }}>
        {TAB_CONFIG.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",padding:"4px 0",background:"none",border:"none",cursor:"pointer",color:activeTab===tab.id?"#0d9488":"#94a3b8",fontWeight:activeTab===tab.id?800:500,transition:"color 0.2s"}}>
            {tab.fab ? (
              <div style={{width:38,height:38,background:"#f0fdfa",border:"1.5px solid #99f6e4",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",marginTop:-16,boxShadow:"0 4px 12px rgba(13,148,136,0.25)"}}>
                <tab.icon style={{width:20,height:20,color:"#0d9488"}} />
              </div>
            ) : (
              <tab.icon style={{width:20,height:20}} />
            )}
            <span style={{fontSize:9,marginTop:2,whiteSpace:"nowrap"}}>{tab.label}</span>
          </button>
        ))}
      </nav>

      {/* FEEDBACK TOAST */}
      {feedbackMsg && (
        <div style={{position:"fixed",top:72,left:"50%",transform:"translateX(-50%)",background:"#0d9488",color:"#042f2e",padding:"8px 16px",borderRadius:40,fontWeight:800,fontSize:11,boxShadow:"0 8px 24px rgba(13,148,136,0.3)",zIndex:100,display:"flex",alignItems:"center",gap:6,whiteSpace:"nowrap"}}>
          <Volume2 style={{width:14,height:14}} />{feedbackMsg}
        </div>
      )}

      {/* DOCTOR REPORT MODAL */}
      {showDoctorReport && (
        <div style={{position:"fixed",inset:0,background:"rgba(15,23,42,0.7)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:16,backdropFilter:"blur(4px)"}}>
          <div style={{background:"white",borderRadius:20,maxWidth:560,width:"100%",padding:28,boxShadow:"0 25px 50px rgba(0,0,0,0.3)",border:"3px solid #14b8a6"}}>
            <div style={{display:"flex",justifyContent:"space-between",borderBottom:"2px solid #0f172a",paddingBottom:12,marginBottom:16}}>
              <div>
                <div style={{fontSize:15,fontWeight:900,letterSpacing:"0.05em"}}>JOINTRUN DIGITAL BIOMARKER PORTFOLIO</div>
                <div style={{fontSize:10,color:"#64748b",textTransform:"uppercase",letterSpacing:"0.1em",fontFamily:"monospace"}}>Clinical Diagnostic Referral Sheet</div>
              </div>
              <div style={{background:"#0f172a",color:"white",padding:"4px 8px",borderRadius:6,fontSize:10,fontFamily:"monospace",fontWeight:900}}>JR-11-PR</div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,fontSize:11,marginBottom:14,paddingBottom:14,borderBottom:"1px solid #e2e8f0"}}>
              <div><strong>환자명:</strong> {currentProfile.name} ({currentProfile.gender})</div>
              <div><strong>증상:</strong> {currentProfile.symptoms}</div>
              <div><strong>나이:</strong> 만 {currentProfile.age}세</div>
              <div><strong>직업:</strong> {currentProfile.job}</div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:14}}>
              {[{l:"Finger Score™",v:`${currentProfile.fingerScore}점`},{l:"아침 강직",v:`${currentProfile.morningStiffnessMin}분`},{l:"관절 기능 나이",v:`${currentProfile.fingerAge}세`},{l:"통증 VAS",v:`${currentProfile.painIndex}/10`}].map(item=>(
                <div key={item.l} style={{background:"#f8fafc",borderRadius:10,padding:"8px 4px",textAlign:"center"}}>
                  <div style={{fontSize:9,color:"#64748b"}}>{item.l}</div>
                  <div style={{fontSize:16,fontWeight:900,color:"#0f172a",marginTop:2}}>{item.v}</div>
                </div>
              ))}
            </div>
            <div style={{background:"#f8fafc",borderRadius:10,padding:10,fontSize:10,color:"#334155",lineHeight:1.7,marginBottom:14}}>
              해당 환자는 {currentProfile.job} 업무 시 지속적인 반복성 관절 가해를 겪고 있으며, 기상 시 약 {currentProfile.morningStiffnessMin}분간 아침 강직을 호소합니다. 최근 {currentProfile.streakDays}일간 JOINTRUN 스마트 보조기와 온수 가동성 습관 실천 결과, 손가락 굽힘 가동 범위(ROM)가 {currentProfile.weeklyROMChange}의 개선 회복 국면을 확인했습니다.
            </div>
            <div style={{display:"flex",gap:8,justifyContent:"flex-end",paddingTop:10,borderTop:"1px solid #e2e8f0"}}>
              <button onClick={() => { triggerFeedback("소견서가 프린터로 발송되었습니다."); setShowDoctorReport(false); }}
                style={{background:"#0d9488",color:"white",fontWeight:800,fontSize:11,padding:"8px 16px",borderRadius:10,border:"none",cursor:"pointer",display:"flex",alignItems:"center",gap:4}}>
                <Printer style={{width:14,height:14}} />소견서 출력
              </button>
              <button onClick={() => setShowDoctorReport(false)} style={{background:"#f1f5f9",color:"#334155",fontWeight:700,fontSize:11,padding:"8px 14px",borderRadius:10,border:"none",cursor:"pointer"}}>닫기</button>
            </div>
          </div>
        </div>
      )}

      {/* CALIBRATOR MODAL */}
      {showCalibrator && (
        <div style={{position:"fixed",inset:0,background:"rgba(15,23,42,0.6)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:16,backdropFilter:"blur(4px)"}}>
          <div style={{background:"white",borderRadius:20,maxWidth:380,width:"100%",padding:20,boxShadow:"0 20px 40px rgba(0,0,0,0.25)",position:"relative"}}>
            <button onClick={() => setShowCalibrator(false)} style={{position:"absolute",top:12,right:12,background:"none",border:"none",cursor:"pointer",color:"#94a3b8",fontSize:16,fontWeight:700}}>×</button>
            <PremiumModule currentProfile={currentProfile} triggerFeedback={triggerFeedback} />
            <button onClick={() => { triggerFeedback("보조기 설정이 저장·동기화되었습니다."); setShowCalibrator(false); }}
              style={{marginTop:12,width:"100%",background:"#0d9488",color:"white",fontWeight:900,fontSize:11,padding:"10px",borderRadius:12,border:"none",cursor:"pointer"}}>
              조율 완료 & 기기 동기화
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

// ─────────────────────────────────────────────
// AUTH GATE + ROOT EXPORT
// ─────────────────────────────────────────────
function AuthGate() {
  const { currentUser, authLoading } = useAuth();

  if (authLoading) {
    return (
      <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#f8fafc"}}>
        <Loader2 style={{width:28,height:28,color:"#0d9488"}} className="animate-spin" />
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#f1f5f9",padding:0}}>
        <div style={{width:"100%",maxWidth:480,minHeight:"100vh",background:"white",display:"flex",flexDirection:"column"}}>
          <AuthScreen />
        </div>
      </div>
    );
  }

  return <JOINTRUNUnified />;
}

export default function JOINTRUNApp() {
  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  );
}
