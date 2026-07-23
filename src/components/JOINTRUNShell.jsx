import { useState, useEffect, useCallback, useRef } from "react";
import {
  Activity, Camera, Compass,
  TrendingUp, User, Volume2, Zap
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import MotionScanPage from "./MotionScanPage";
import OnboardingScreen from "./OnboardingScreen";
import {
  saveScanRecord, saveCheckIn, saveProfileSnapshot, getProfileSnapshot,
  getEventHistory, getLatestConditionCheckIn, recordHabitActivity, getHabitActivity,
  flushPendingEvents,
} from "../lib/firestore";
import { trackKpiEvent } from "../lib/analytics";
import { useHomeData } from "../hooks/useHomeData";
import { useV9Agenda } from "../hooks/useV9Agenda";
import { useV9Repository } from "../hooks/useV9Repository";
import { MOCK_CAPTURE_ENABLED } from "../config/featureFlags";
import DecisionLoopFlow from "./v9/DecisionLoopFlow";
import EventMarkerModal from "./EventMarkerModal";
import {
  computeInflammationScore, computeFatigueComponent, computeRecoveryScore, computeFingerHealthScore,
  DEFAULT_FINGER_HEALTH_SCORE,
} from "../lib/fingerHealthScore";
import { computeHabitScore, todayKey } from "../lib/habitScore";
import { PATIENT_PROFILES_DEFAULT, DEFAULT_STEPS } from "../data/mockProfiles";
import EmptyHomeState from "./tabs/home/EmptyHomeState";
import FirstScanHomeState from "./tabs/home/FirstScanHomeState";
import HomeSkeleton from "./tabs/home/HomeSkeleton";
import RecentTimelinePreview from "./tabs/home/RecentTimelinePreview";
import HomeModule from "./tabs/HomeModule";
import CoachModule from "./tabs/CoachModule";
import TimelineModule from "./tabs/TimelineModule";
import ReportModule from "./tabs/ReportModule";
import ProfileModule from "./tabs/ProfileModule";

const NAVER_BAND_URL = "https://band.us/@jointrun";

function JOINTRUNUnified() {
 const { currentUser, logout, isDemo } = useAuth();

// 실제 로그인 사용자 기반 프로필 생성
const buildUserProfile = (user, overrides = {}) => ({
  id: user.uid,
  name: user.displayName || user.email?.split("@")[0] || "회원",
  age: 0,
  gender: "",
  job: "직업 미등록",
  symptoms: "증상 미등록",
  handCondition: "",
  fingerHealthScore: DEFAULT_FINGER_HEALTH_SCORE, // null — 스캔 전에는 "측정 전"으로 표시(P0 안전 요건, 50점 중립값 금지)
  fingerAge: 40,
  fingerReserve: 65,
  recoveryScore: 72,
  morningStiffness: "정상",
  morningStiffnessMin: 15,
  painTrend: "",
  painIndex: 3,
  riskForecast: 20,
  weeklyROMChange: "측정 대기 중",
  concernArea: null,
  ...overrides,
});

const [userProfile, setUserProfile] = useState(
  currentUser ? buildUserProfile(currentUser) : PATIENT_PROFILES_DEFAULT[0]
);

const currentProfile = userProfile;

// 가장 최근 스캔의 객관적 하위 점수(Mobility/Stability) — 다음 컨디션 체크인 때 그대로 재사용된다.
// 스캔 전에는 50점 중립값이 아니라 null(측정 전)로 둔다(P0 안전 요건).
// stiffnessComponent는 v2.0부터 Recovery 계산에 쓰이지 않아 더 이상 들고 있지 않는다(작업4).
const UNMEASURED_SUBSCORE = { value: null, reason: "스캔 전" };
const [lastScanScores, setLastScanScores] = useState({
  mobility: UNMEASURED_SUBSCORE, stability: UNMEASURED_SUBSCORE,
});
// 가장 최근 컨디션 체크인(붓기/피로도) — 아직 체크인하지 않았으면 null(중립 처리).
const [condition, setCondition] = useState({ swellingLevel: null, fatigueLevel: null });
// 홈 화면 상태(Empty/First Scan/Normal) 분기 + "최근 변화" 상대 비교(§5, RelativeChangeCard) 계산용.
// scanCount는 SCAN 탭(홈이 마운트되어 있지 않을 수 있는 시점)의 KPI 판정에도 쓰이므로,
// 이 훅을 최상위(JOINTRUNShell)에서 호출해 탭 전환과 무관하게 유지한다.
const { scans: recentScans, scanCount, mobilityTrendUp, addOptimisticScan } = useHomeData();
// V9 Decision Loop(트리거→기준선→재확인→비교) 진행 상태 — 04_APP_PRD_V9.md S07 홈 상단 카드.
const { activeEvent, agenda, refresh: refreshAgenda } = useV9Agenda();
const v9Repository = useV9Repository();
const [decisionLoop, setDecisionLoop] = useState(null); // { mode: "baseline"|"recheck", recheck? } | null
// Habit Score(Consistency/Streak) 산출용 활동일(YYYY-MM-DD) 목록 — Finger Health Score와 별개 체계.
const [activeDayKeys, setActiveDayKeys] = useState([]);
const habitScore = computeHabitScore(activeDayKeys);
// 독립 온보딩 페이지 표시 여부. true: edit 모드(마이페이지에서 재방문) → 완료 시 "뒤로" 취소 가능.
const [showOnboardingPage, setShowOnboardingPage] = useState(false);
const [onboardingEditMode, setOnboardingEditMode] = useState(false);
// timeline_created KPI(§8) 판정용 — events 보유 여부. null = 아직 확인 전.
const [hasAnyEvent, setHasAnyEvent] = useState(null);

// 스캔/체크인이 있을 때마다 호출 — Habit Score 활동일 기록을 로컬(즉시 반영)과 Firestore에 함께 남긴다.
const recordActivity = (uid) => {
  const key = todayKey();
  setActiveDayKeys(prev => (prev.includes(key) ? prev : [...prev, key].slice(-30)));
  if (uid) recordHabitActivity(uid, key).catch(err => console.error("습관 활동 기록 실패:", err));
};

// 로그인 시 Firestore 스냅샷 + 최근 컨디션 체크인 + 습관 활동 이력을 불러와 반영.
// 스캔 목록 자체는 useHomeData()가 담당한다(위) — 여기서는 중복 조회하지 않는다.
useEffect(() => {
  if (!currentUser) return;
  setUserProfile(buildUserProfile(currentUser));
  (async () => {
    const snapshot = await getProfileSnapshot(currentUser.uid);
    if (snapshot) {
      setUserProfile(prev => ({ ...prev, ...snapshot }));
    }
    // concernArea가 없다는 것은 아직 첫 만남 진단을 마치지 않았다는 뜻 — 최초 로그인 시 1회만 자동 진입.
    if (!snapshot?.concernArea) {
      setOnboardingEditMode(false);
      setShowOnboardingPage(true);
    }

    const lastCondition = await getLatestConditionCheckIn(currentUser.uid);
    if (lastCondition) {
      setCondition({
        swellingLevel: lastCondition.swellingLevel ?? null,
        fatigueLevel: lastCondition.fatigueLevel ?? null,
      });
    }

    const activeDays = await getHabitActivity(currentUser.uid);
    setActiveDayKeys(activeDays);

    const existingEvents = await getEventHistory(currentUser.uid, 1);
    setHasAnyEvent(existingEvents.length > 0);
  })();
}, [currentUser?.uid]);

// useHomeData()가 최근 스캔을 불러오면 그중 최신 1건의 하위 점수로 lastScanScores를 1회만 시딩한다.
// ref로 가드하는 이유: addOptimisticScan으로 recentScans가 이후에도 계속 바뀌는데, 그때마다
// 재시딩하면 handleScanCompleted가 이미 직접 setLastScanScores한 값을 덮어쓸 위험이 있다.
const lastScanSeededRef = useRef(false);
useEffect(() => {
  if (lastScanSeededRef.current || !recentScans || recentScans.length === 0) return;
  const sc = recentScans[0]?.scores;
  if (!sc) return;
  lastScanSeededRef.current = true;
  setLastScanScores({
    mobility: sc.mobility ?? UNMEASURED_SUBSCORE,
    stability: sc.stability ?? UNMEASURED_SUBSCORE,
  });
}, [recentScans]);

// timeline_created(§8 North Star) — scans 1건 + events 1건을 모두 보유하게 된 최초 시점에 정확히 1회만 발생시킨다.
// Cloud Function 없이 클라이언트에서 판정하므로, Firestore profile의 timelineCreated 플래그로 중복 발생을 막는다.
useEffect(() => {
  if (!currentUser || scanCount == null || hasAnyEvent == null) return;
  if (scanCount >= 1 && hasAnyEvent && !userProfile.timelineCreated) {
    trackKpiEvent("timeline_created", currentUser.uid);
    saveProfileSnapshot(currentUser.uid, { timelineCreated: true }).catch(err => console.error("timeline_created 플래그 저장 실패:", err));
    setUserProfile(prev => ({ ...prev, timelineCreated: true }));
  }
}, [currentUser, scanCount, hasAnyEvent, userProfile.timelineCreated]);

  // 오프라인 상태에서 입력된 기록(events)을 재연결 시 동기화 — 앱 진입 시 1회 + 온라인 복귀 시마다 재시도.
  useEffect(() => {
    if (!currentUser) return;
    flushPendingEvents();
    window.addEventListener("online", flushPendingEvents);
    return () => window.removeEventListener("online", flushPendingEvents);
  }, [currentUser?.uid]);

  // session_start(§8) — 로그인된 사용자가 앱을 실행(또는 재로그인)할 때마다 1회 발생.
  useEffect(() => {
    if (!currentUser) return;
    trackKpiEvent("session_start", currentUser.uid);
  }, [currentUser?.uid]);

  const [activeTab, setActiveTab] = useState("home");
  const [showEventMarker, setShowEventMarker] = useState(false);
  const [recoverySteps, setRecoverySteps] = useState(DEFAULT_STEPS);
  const [feedbackMsg, setFeedbackMsg] = useState(null);
  const [activeSpecSection, setActiveSpecSection] = useState(1);
  const [specSearch, setSpecSearch] = useState("");
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileForm, setProfileForm] = useState({});
  const [profileMode, setProfileMode] = useState("edit");

  const triggerFeedback = useCallback((msg) => {
    setFeedbackMsg(msg);
    if ("vibrate" in navigator) { try { navigator.vibrate(40); } catch { /* 진동 미지원 기기 무시 */ } }
    setTimeout(() => setFeedbackMsg(null), 2500);
  }, []);

  const handleScanCompleted = (payload) => {
    const { metrics, scanScores, raw, recommendation, isSimulated } = payload;
    // Mobility/Stability는 이번 스캔의 실측값, Inflammation/Recovery는 가장 최근 컨디션 체크인 값과 결합한다.
    setLastScanScores(scanScores);
    const inflammation = computeInflammationScore(condition.swellingLevel);
    const fatigueComponent = computeFatigueComponent(condition.fatigueLevel);
    const recovery = computeRecoveryScore(fatigueComponent);
    const healthScore = computeFingerHealthScore({
      mobility: scanScores.mobility, stability: scanScores.stability, inflammation, recovery,
    });

    const updated = { ...currentProfile, fingerHealthScore: healthScore.total, painIndex: metrics.painIndex, morningStiffnessMin: metrics.stiffnessMin };
    setUserProfile(updated);
    // return_scan(§8) — 이전 스캔이 이미 있던 상태에서(재방문) 새 스캔을 완료한 경우에만 발생.
    // 시뮬레이션(dev 전용) 결과는 실제 방문 지표에 섞이면 안 되므로 집계하지 않는다.
    if (currentUser && scanCount >= 1 && !isSimulated) {
      trackKpiEvent("return_scan", currentUser.uid);
    }
    // 홈 화면 상태(Empty/First Scan/Normal) 판정이 리페치 없이 즉시 갱신되도록 낙관적으로 반영.
    // (로컬 상태 미리보기이므로 시뮬레이션이어도 그대로 반영 — dev에서 UI 흐름 확인용.)
    addOptimisticScan(healthScore);
    setRecoverySteps(s => s.map(step => step.id === 2 ? { ...step, isCompleted: true } : step));
    // 시뮬레이션 결과는 어떤 경우에도 Firebase에 저장하지 않는다(P0 안전 요건 — 실제 기록과 섞임 방지).
    if (currentUser && !isSimulated) {
      saveScanRecord(currentUser.uid, { metrics, scores: healthScore, rawFrames: raw, recommendation }).catch(err => console.error("스캔 기록 저장 실패:", err));
      saveProfileSnapshot(currentUser.uid, {
        fingerHealthScore: updated.fingerHealthScore,
        painIndex: updated.painIndex,
        morningStiffnessMin: updated.morningStiffnessMin,
      }).catch(err => console.error("프로필 스냅샷 저장 실패:", err));
    }
    if (!isSimulated) recordActivity(currentUser?.uid);
  };

  const handleCheckIn = (checkinData) => {
    if (!currentUser) return;
    saveCheckIn(currentUser.uid, checkinData).catch(err => console.error("체크인 저장 실패:", err));
    recordActivity(currentUser.uid);
  };

  // 붓기/피로도 컨디션 체크인 — 가장 최근 스캔의 객관적 하위 점수와 결합해 Finger Health Score를 재계산한다.
  const handleConditionCheckIn = (swellingLevel, fatigueLevel) => {
    setCondition({ swellingLevel, fatigueLevel });
    const inflammation = computeInflammationScore(swellingLevel);
    const fatigueComponent = computeFatigueComponent(fatigueLevel);
    const recovery = computeRecoveryScore(fatigueComponent);
    const healthScore = computeFingerHealthScore({
      mobility: lastScanScores.mobility, stability: lastScanScores.stability, inflammation, recovery,
    });

    setUserProfile(prev => ({ ...prev, fingerHealthScore: healthScore.total }));
    triggerFeedback(healthScore.total != null
      ? "컨디션 체크인이 Finger Health Score에 반영되었습니다!"
      : "컨디션 체크인이 저장되었습니다. 스캔을 완료하면 Finger Health Score를 볼 수 있어요.");
    if (currentUser) {
      saveCheckIn(currentUser.uid, { swellingLevel, fatigueLevel, fingerHealthScore: healthScore.total }).catch(err => console.error("컨디션 체크인 저장 실패:", err));
      saveProfileSnapshot(currentUser.uid, { fingerHealthScore: healthScore.total }).catch(err => console.error("프로필 스냅샷 저장 실패:", err));
    }
    recordActivity(currentUser?.uid);
  };

  // 온보딩(최초 1회 자동 진입 + 마이페이지에서 재방문) 완료 시 concernArea를 저장하고 홈으로 이동.
  const handleOnboardingComplete = (concernArea) => {
    setUserProfile(prev => ({ ...prev, concernArea }));
    setShowOnboardingPage(false);
    setOnboardingEditMode(false);
    setActiveTab("home");
    triggerFeedback("걱정 부위가 저장되었습니다!");
    if (currentUser) {
      saveProfileSnapshot(currentUser.uid, { concernArea }).catch(err => console.error("걱정 부위 저장 실패:", err));
    }
  };

  // 작업지시서 항목 3(정보구조 개편): HOME/SCAN/TIMELINE/REPORT/PROFILE 5탭 고정.
  // 기존 AI코치·커뮤니티 탭은 없애지 않고 PROFILE 화면 안의 진입점으로 재배치했다(기능 자체는 유지).
  const TAB_CONFIG = [
    { id: "home", icon: Compass, label: "홈" },
    { id: "scan", icon: Camera, label: "모션스캔", fab: true },
    { id: "timeline", icon: TrendingUp, label: "타임라인" },
    { id: "report", icon: Activity, label: "리포트" },
    { id: "profile", icon: User, label: "프로필" },
  ];

  if (showOnboardingPage) {
    return (
      <OnboardingScreen
        currentProfile={currentProfile}
        initialValue={currentProfile.concernArea}
        onComplete={handleOnboardingComplete}
        onCancel={onboardingEditMode ? () => setShowOnboardingPage(false) : undefined}
      />
    );
  }

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

      {/* ── 앱 상단 헤더 (앱 이름) — 로그아웃은 PROFILE 탭으로 이동 ── */}
      <div style={{
        background:"white",
        borderBottom:"0.5px solid #e2e8f0",
        padding:"10px 16px",
        display:"flex",
        alignItems:"center",
        position:"sticky",
        top:0,
        zIndex:50,
      }}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <img src="/icons/icon-96.png" alt="JOINTRUN" style={{width:30,height:30,borderRadius:8}} />
          <span style={{fontSize:15,fontWeight:900,letterSpacing:"-0.5px",color:"#0f172a"}}>JOINTRUN</span>
        </div>
      </div>

      {/* 데모 모드 안내 — Firebase 연결이 안 된 상태(env 미설정 등)에서 예시 데이터가 실제
          계정처럼 보이는 것을 막기 위한 배너(P0 작업6, isDemo는 기존에 있었지만 어디서도
          쓰이지 않던 값). */}
      {isDemo && (
        <div style={{background:"#fffbeb",borderBottom:"1px solid #fde68a",color:"#92400e",padding:"6px 16px",fontSize:10,fontWeight:700,textAlign:"center"}}>
          데모 모드입니다 — 예시 데이터이며 기록이 저장되지 않습니다.
        </div>
      )}

      {/* ── 앱 스크롤 콘텐츠 ── */}
      <main style={{flex:1,overflowY:"auto",padding:"12px 14px 80px"}}>

            {/* App content */}
              {activeTab === "home" && (
                <>
                {agenda && (
                  <div style={{background:"white",border:"1px solid #B9C7E1",borderRadius:14,padding:"14px 16px",marginBottom:12}}>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10}}>
                      <div>
                        <div style={{fontSize:10,color:"#122A5C",fontWeight:700,marginBottom:2}}>지금 필요한 기록</div>
                        <div style={{fontSize:13,fontWeight:800,color:"#0f172a"}}>{agenda.label}</div>
                      </div>
                      {agenda.key === "no_baseline" && (
                        <button onClick={() => setDecisionLoop({ mode: "baseline" })}
                          style={{minHeight:40,padding:"0 16px",background:"#122A5C",color:"white",border:"none",borderRadius:10,fontSize:12,fontWeight:800,whiteSpace:"nowrap"}}>
                          첫 기준선 만들기
                        </button>
                      )}
                      {agenda.key === "recheck_ready" && (
                        <button onClick={() => setDecisionLoop({ mode: "recheck", recheck: agenda.recheck })}
                          style={{minHeight:40,padding:"0 16px",background:"#122A5C",color:"white",border:"none",borderRadius:10,fontSize:12,fontWeight:800,whiteSpace:"nowrap"}}>
                          지금 재확인하기
                        </button>
                      )}
                      {agenda.key === "awaiting_decision" && (
                        <button onClick={() => setDecisionLoop({ mode: "decision" })}
                          style={{minHeight:40,padding:"0 16px",background:"#122A5C",color:"white",border:"none",borderRadius:10,fontSize:12,fontWeight:800,whiteSpace:"nowrap"}}>
                          결과 기록하기
                        </button>
                      )}
                    </div>
                    {agenda.qualityWarning && (
                      <div style={{marginTop:10,padding:"8px 10px",background:"#fffbeb",border:"1px solid #fde68a",borderRadius:10,fontSize:11,color:"#92400e",fontWeight:600,lineHeight:1.5}}>
                        {agenda.qualityWarning}
                      </div>
                    )}
                    {/* MOCK_CAPTURE_ENABLED가 꺼져 있으면(production 항상 꺼짐) 렌더링되지 않는다.
                        2주/4주를 실제로 기다리지 않고 재확인 화면까지 E2E로 검증하기 위한 개발용 버튼. */}
                    {MOCK_CAPTURE_ENABLED && (agenda.key === "week2_waiting" || agenda.key === "week4_waiting") && agenda.recheck && (
                      <button
                        onClick={async () => {
                          await v9Repository.debugForceRecheckDue(activeEvent.id, agenda.recheck.dueType);
                          refreshAgenda();
                        }}
                        style={{marginTop:10,width:"100%",minHeight:36,background:"rgba(250,204,21,0.12)",border:"1px solid rgba(202,138,4,0.4)",color:"#854d0e",borderRadius:8,fontSize:11,fontWeight:700}}>
                        MOCK: 재확인 날짜를 오늘로 당기기 (개발용)
                      </button>
                    )}
                  </div>
                )}
                {scanCount === null ? (
                  <HomeSkeleton />
                ) : scanCount === 0 ? (
                  <EmptyHomeState currentProfile={currentProfile} setActiveTab={setActiveTab} />
                ) : (
                <div>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
                    <div>
                      <div style={{fontSize:11,color:"#94a3b8"}}>환영합니다!</div>
                      <div style={{fontSize:16,fontWeight:900,color:"#0f172a"}}>{currentProfile.name} 님</div>
                    </div>
                    <div style={{background:"#fff7ed",border:"1px solid #fed7aa",color:"#ea580c",padding:"4px 10px",borderRadius:20,display:"flex",alignItems:"center",gap:4,fontSize:11,fontWeight:800}}>
                      <Zap style={{width:12,height:12,fill:"#ea580c"}} />{habitScore.streak.days}일 연속
                    </div>
                  </div>
                  {scanCount === 1 ? (
                    <>
                      {/* 측정 진입점 — 하단 탭 FAB과 별개로, 홈 상단에도 축소된 형태로 유지(첫 스캔 이후 재측정 유도) */}
                      <button onClick={() => setActiveTab("scan")}
                        style={{width:"100%",background:"#2563eb",color:"white",border:"none",borderRadius:12,padding:"10px 14px",marginBottom:12,fontSize:12,fontWeight:800,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6,minHeight:44}}>
                        <Camera style={{width:14,height:14}} />30초 스캔 시작하기
                      </button>
                      <FirstScanHomeState currentProfile={currentProfile} scans={recentScans} recoverySteps={recoverySteps} setRecoverySteps={setRecoverySteps} setActiveTab={setActiveTab} triggerFeedback={triggerFeedback} onCheckIn={handleCheckIn} onConditionCheckIn={handleConditionCheckIn} swellingLevel={condition.swellingLevel} consistencyScore={habitScore.consistency.value} mobilityTrendUp={mobilityTrendUp} onOpenEventMarker={() => setShowEventMarker(true)} />
                      <div style={{marginTop:12}}>
                        <RecentTimelinePreview setActiveTab={setActiveTab} />
                      </div>
                    </>
                  ) : (
                    <HomeModule currentProfile={currentProfile} scans={recentScans} recoverySteps={recoverySteps} setRecoverySteps={setRecoverySteps} setActiveTab={setActiveTab} triggerFeedback={triggerFeedback} onCheckIn={handleCheckIn} onConditionCheckIn={handleConditionCheckIn} swellingLevel={condition.swellingLevel} consistencyScore={habitScore.consistency.value} mobilityTrendUp={mobilityTrendUp} onOpenEventMarker={() => setShowEventMarker(true)} />
                  )}
                </div>
                )}
                </>
              )}
              {activeTab === "scan" && <MotionScanPage currentProfile={currentProfile} onScanCompleted={handleScanCompleted} triggerFeedback={triggerFeedback} setActiveTab={setActiveTab} />}
              {activeTab === "coach" && <CoachModule currentProfile={currentProfile} triggerFeedback={triggerFeedback} />}
              {activeTab === "timeline" && <TimelineModule currentProfile={currentProfile} currentUser={currentUser} triggerFeedback={triggerFeedback} onOpenEventMarker={() => setShowEventMarker(true)} />}
              {activeTab === "report" && <ReportModule currentProfile={currentProfile} />}
              {activeTab === "profile" && (
                <ProfileModule
                  currentProfile={currentProfile}
                  onEditConcernArea={() => { setOnboardingEditMode(true); setShowOnboardingPage(true); }}
                  onOpenCoach={() => setActiveTab("coach")}
                  communityUrl={NAVER_BAND_URL}
                  logout={logout}
                />
              )}


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
          <button key={tab.id} onClick={() => {
              if (tab.externalUrl) {
                window.open(tab.externalUrl, "_blank", "noopener,noreferrer");
                return;
              }
              setActiveTab(tab.id);
            }}
            style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"4px 0",minHeight:44,background:"none",border:"none",cursor:"pointer",color:activeTab===tab.id?"#2563eb":"#94a3b8",fontWeight:activeTab===tab.id?800:500,transition:"color 0.2s"}}>
            {tab.fab ? (
              <div style={{width:38,height:38,background:"#EEF1F8",border:"1.5px solid #B9C7E1",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",marginTop:-16,boxShadow:"0 4px 12px rgba(37,99,235,0.25)"}}>
                <tab.icon style={{width:20,height:20,color:"#2563eb"}} />
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
        <div style={{position:"fixed",top:72,left:"50%",transform:"translateX(-50%)",background:"#2563eb",color:"#172554",padding:"8px 16px",borderRadius:40,fontWeight:800,fontSize:11,boxShadow:"0 8px 24px rgba(37,99,235,0.3)",zIndex:100,display:"flex",alignItems:"center",gap:6,whiteSpace:"nowrap"}}>
          <Volume2 style={{width:14,height:14}} />{feedbackMsg}
        </div>
      )}

      {/* EVENT MARKER MODAL */}
      {showEventMarker && currentUser && (
        <EventMarkerModal
          onClose={() => setShowEventMarker(false)}
          onSaved={() => { recordActivity(currentUser.uid); setHasAnyEvent(true); }}
          triggerFeedback={triggerFeedback}
        />
      )}

      {/* V9 DECISION LOOP (트리거→기준선 또는 재확인→비교) */}
      {decisionLoop && currentUser && (
        <DecisionLoopFlow
          mode={decisionLoop.mode}
          event={activeEvent}
          recheck={decisionLoop.recheck}
          onClose={() => setDecisionLoop(null)}
          onCompleted={() => { refreshAgenda(); triggerFeedback("기록이 저장되었습니다."); }}
        />
      )}

    </div>
  );
}

export default JOINTRUNUnified;
