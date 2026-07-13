import { useState, useEffect, useCallback } from "react";
import {
  Activity, Camera, Compass, Printer,
  Settings, TrendingUp, User, Volume2, Zap
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import MotionScanPage from "./MotionScanPage";
import OnboardingScreen from "./OnboardingScreen";
import {
  saveScanRecord, saveCheckIn, saveProfileSnapshot, getProfileSnapshot,
  getScanHistory, getLatestConditionCheckIn, recordHabitActivity, getHabitActivity,
  flushPendingEvents,
} from "../lib/firestore";
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
import PremiumModule from "./tabs/PremiumModule";

const NAVER_BAND_URL = "https://band.us/@jointrun";

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
  fingerHealthScore: DEFAULT_FINGER_HEALTH_SCORE, // 하위 점수 전부 중립값(50)일 때의 가중합 — 스캔 전 기본값
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

// 가장 최근 스캔의 객관적 하위 점수(Mobility/Stability/강직 성분) — 다음 컨디션 체크인 때 그대로 재사용된다.
const NEUTRAL_SUBSCORE = { value: 50, reason: "스캔 전 (중립값)" };
const [lastScanScores, setLastScanScores] = useState({
  mobility: NEUTRAL_SUBSCORE, stability: NEUTRAL_SUBSCORE, stiffnessComponent: null,
});
// 가장 최근 컨디션 체크인(붓기/피로도) — 아직 체크인하지 않았으면 null(중립 처리).
const [condition, setCondition] = useState({ swellingLevel: null, fatigueLevel: null });
// 홈 화면 상태(Empty/First Scan/Normal) 분기 + "최근 변화(직전 스캔 대비)" 계산용.
// null = 아직 로딩 전, []/[1개]/[2개]로 스캔 개수를 판정한다 (2개 이상은 더 가져올 필요 없음).
const [recentScans, setRecentScans] = useState(null);
const scanCount = recentScans === null ? null : recentScans.length;
const recentChange = recentScans && recentScans.length >= 2
  ? { delta: (recentScans[0].scores?.total ?? 0) - (recentScans[1].scores?.total ?? 0) }
  : null;
const mobilityTrendUp = !!(recentScans && recentScans.length >= 2 &&
  (recentScans[0].scores?.mobility?.value ?? 0) > (recentScans[1].scores?.mobility?.value ?? 0));
// Habit Score(Consistency/Streak) 산출용 활동일(YYYY-MM-DD) 목록 — Finger Health Score와 별개 체계.
const [activeDayKeys, setActiveDayKeys] = useState([]);
const habitScore = computeHabitScore(activeDayKeys);
// 독립 온보딩 페이지 표시 여부. true: edit 모드(마이페이지에서 재방문) → 완료 시 "뒤로" 취소 가능.
const [showOnboardingPage, setShowOnboardingPage] = useState(false);
const [onboardingEditMode, setOnboardingEditMode] = useState(false);

// 스캔/체크인이 있을 때마다 호출 — Habit Score 활동일 기록을 로컬(즉시 반영)과 Firestore에 함께 남긴다.
const recordActivity = (uid) => {
  const key = todayKey();
  setActiveDayKeys(prev => (prev.includes(key) ? prev : [...prev, key].slice(-30)));
  if (uid) recordHabitActivity(uid, key).catch(err => console.error("습관 활동 기록 실패:", err));
};

// 로그인 시 Firestore 스냅샷 + 최근 스캔 하위 점수 + 최근 컨디션 체크인 + 습관 활동 이력을 불러와 반영
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

    // 최근 2개만 가져온다 — 홈 화면 상태 판정(scanCount)과 "최근 변화(직전 스캔 대비)" 계산에 그 이상은 필요 없다.
    const rows = await getScanHistory(currentUser.uid, 2);
    setRecentScans(rows);
    if (rows[0]?.scores) {
      const sc = rows[0].scores;
      setLastScanScores({
        mobility: sc.mobility ?? NEUTRAL_SUBSCORE,
        stability: sc.stability ?? NEUTRAL_SUBSCORE,
        stiffnessComponent: sc.recovery?.stiffnessComponent ?? null,
      });
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
  })();
}, [currentUser?.uid]);

  // 오프라인 상태에서 입력된 기록(events)을 재연결 시 동기화 — 앱 진입 시 1회 + 온라인 복귀 시마다 재시도.
  useEffect(() => {
    if (!currentUser) return;
    flushPendingEvents();
    window.addEventListener("online", flushPendingEvents);
    return () => window.removeEventListener("online", flushPendingEvents);
  }, [currentUser?.uid]);

  const [activeTab, setActiveTab] = useState("home");
  const [showEventMarker, setShowEventMarker] = useState(false);
  const [recoverySteps, setRecoverySteps] = useState(DEFAULT_STEPS);
  const [feedbackMsg, setFeedbackMsg] = useState(null);
  const [activeSpecSection, setActiveSpecSection] = useState(1);
  const [specSearch, setSpecSearch] = useState("");
  const [showDoctorReport, setShowDoctorReport] = useState(false);
  const [showCalibrator, setShowCalibrator] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileForm, setProfileForm] = useState({});
  const [profileMode, setProfileMode] = useState("edit");

  const triggerFeedback = useCallback((msg) => {
    setFeedbackMsg(msg);
    if ("vibrate" in navigator) { try { navigator.vibrate(40); } catch {} }
    setTimeout(() => setFeedbackMsg(null), 2500);
  }, []);

  const handleScanCompleted = (payload) => {
    const { metrics, scanScores, raw, recommendation } = payload;
    // Mobility/Stability는 이번 스캔의 실측값, Inflammation/Recovery는 가장 최근 컨디션 체크인 값과 결합한다.
    setLastScanScores(scanScores);
    const inflammation = computeInflammationScore(condition.swellingLevel);
    const fatigueComponent = computeFatigueComponent(condition.fatigueLevel);
    const recovery = computeRecoveryScore(scanScores.stiffnessComponent, fatigueComponent);
    const healthScore = computeFingerHealthScore({
      mobility: scanScores.mobility, stability: scanScores.stability, inflammation, recovery,
    });

    const updated = { ...currentProfile, fingerHealthScore: healthScore.total, painIndex: metrics.painIndex, morningStiffnessMin: metrics.stiffnessMin };
    setUserProfile(updated);
    // 홈 화면 상태(Empty/First Scan/Normal) 판정 + "최근 변화"가 리페치 없이 즉시 갱신되도록 낙관적으로 반영.
    setRecentScans(prev => [{ scores: healthScore }, ...(prev ?? [])].slice(0, 2));
    setRecoverySteps(s => s.map(step => step.id === 2 ? { ...step, isCompleted: true } : step));
    if (currentUser) {
      saveScanRecord(currentUser.uid, { metrics, scores: healthScore, rawFrames: raw, recommendation }).catch(err => console.error("스캔 기록 저장 실패:", err));
      saveProfileSnapshot(currentUser.uid, {
        fingerHealthScore: updated.fingerHealthScore,
        painIndex: updated.painIndex,
        morningStiffnessMin: updated.morningStiffnessMin,
      }).catch(err => console.error("프로필 스냅샷 저장 실패:", err));
    }
    recordActivity(currentUser?.uid);
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
    const recovery = computeRecoveryScore(lastScanScores.stiffnessComponent, fatigueComponent);
    const healthScore = computeFingerHealthScore({
      mobility: lastScanScores.mobility, stability: lastScanScores.stability, inflammation, recovery,
    });

    setUserProfile(prev => ({ ...prev, fingerHealthScore: healthScore.total }));
    triggerFeedback("컨디션 체크인이 Finger Health Score에 반영되었습니다!");
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

  const triggerDoctorReportPrint = () => { triggerFeedback("대학병원 제출용 AI 안심 리포트 PDF가 생성되었습니다."); setShowDoctorReport(true); };

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

      {/* ── 앱 스크롤 콘텐츠 ── */}
      <main style={{flex:1,overflowY:"auto",padding:"12px 14px 80px"}}>

            {/* App content */}
              {activeTab === "home" && (
                scanCount === null ? (
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
                  <div style={{background:"white",border:"1px solid #e2e8f0",borderRadius:12,padding:"8px 12px",display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12,boxShadow:"0 1px 3px rgba(0,0,0,0.05)"}}>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <span style={{width:8,height:8,borderRadius:"50%",background:"#3b82f6",display:"inline-block",boxShadow:"0 0 0 3px rgba(59,130,246,0.2)"}} />
                      <div>
                        <div style={{fontSize:9,color:"#64748b",fontWeight:700}}>스마트 보조기 정렬</div>
                        <div style={{fontSize:9,color:"#2563eb",fontWeight:600,fontFamily:"monospace"}}>기기 정밀 조율 각도: 15°</div>
                      </div>
                    </div>
                    <button onClick={() => { setShowCalibrator(true); triggerFeedback("보조기 캘리브레이션 시작"); }}
                      style={{background:"#eff6ff",border:"1px solid #bfdbfe",color:"#2563eb",padding:"4px 8px",minHeight:44,borderRadius:8,fontSize:9,fontWeight:800,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:3}}>
                      <Settings style={{width:12,height:12}} />기기 조율
                    </button>
                  </div>
                  {/* 측정 진입점 — 하단 탭 FAB과 별개로, 홈 상단에도 축소된 형태로 유지 */}
                  <button onClick={() => setActiveTab("scan")}
                    style={{width:"100%",background:"#2563eb",color:"white",border:"none",borderRadius:12,padding:"10px 14px",marginBottom:12,fontSize:12,fontWeight:800,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6,minHeight:44}}>
                    <Camera style={{width:14,height:14}} />30초 스캔 시작하기
                  </button>
                  {scanCount === 1 ? (
                    <FirstScanHomeState currentProfile={currentProfile} recoverySteps={recoverySteps} setRecoverySteps={setRecoverySteps} setActiveTab={setActiveTab} triggerFeedback={triggerFeedback} onCheckIn={handleCheckIn} onConditionCheckIn={handleConditionCheckIn} swellingLevel={condition.swellingLevel} consistencyScore={habitScore.consistency.value} mobilityTrendUp={mobilityTrendUp} onOpenEventMarker={() => setShowEventMarker(true)} />
                  ) : (
                    <HomeModule currentProfile={currentProfile} recoverySteps={recoverySteps} setRecoverySteps={setRecoverySteps} setActiveTab={setActiveTab} triggerFeedback={triggerFeedback} onCheckIn={handleCheckIn} onConditionCheckIn={handleConditionCheckIn} recentChange={recentChange} swellingLevel={condition.swellingLevel} consistencyScore={habitScore.consistency.value} mobilityTrendUp={mobilityTrendUp} onOpenEventMarker={() => setShowEventMarker(true)} />
                  )}
                  <div style={{marginTop:12}}>
                    <RecentTimelinePreview currentUser={currentUser} setActiveTab={setActiveTab} />
                  </div>
                </div>
                )
              )}
              {activeTab === "scan" && <MotionScanPage currentProfile={currentProfile} onScanCompleted={handleScanCompleted} triggerFeedback={triggerFeedback} setActiveTab={setActiveTab} />}
              {activeTab === "coach" && <CoachModule currentProfile={currentProfile} triggerFeedback={triggerFeedback} />}
              {activeTab === "timeline" && <TimelineModule currentProfile={currentProfile} currentUser={currentUser} triggerDoctorReportPrint={triggerDoctorReportPrint} triggerFeedback={triggerFeedback} onOpenEventMarker={() => setShowEventMarker(true)} />}
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
              <div style={{width:38,height:38,background:"#eff6ff",border:"1.5px solid #bfdbfe",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",marginTop:-16,boxShadow:"0 4px 12px rgba(37,99,235,0.25)"}}>
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

      {/* DOCTOR REPORT MODAL */}
      {showDoctorReport && (
        <div style={{position:"fixed",inset:0,background:"rgba(15,23,42,0.7)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:16,backdropFilter:"blur(4px)"}}>
          <div style={{background:"white",borderRadius:20,maxWidth:560,width:"100%",padding:28,boxShadow:"0 25px 50px rgba(0,0,0,0.3)",border:"3px solid #3b82f6"}}>
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
              {[{l:"Finger Score™",v:`${currentProfile.fingerHealthScore}점`},{l:"아침 강직",v:`${currentProfile.morningStiffnessMin}분`},{l:"관절 기능 나이",v:`${currentProfile.fingerAge}세`},{l:"통증 VAS",v:`${currentProfile.painIndex}/10`}].map(item=>(
                <div key={item.l} style={{background:"#f8fafc",borderRadius:10,padding:"8px 4px",textAlign:"center"}}>
                  <div style={{fontSize:9,color:"#64748b"}}>{item.l}</div>
                  <div style={{fontSize:16,fontWeight:900,color:"#0f172a",marginTop:2}}>{item.v}</div>
                </div>
              ))}
            </div>
            <div style={{background:"#f8fafc",borderRadius:10,padding:10,fontSize:10,color:"#334155",lineHeight:1.7,marginBottom:14}}>
              해당 환자는 {currentProfile.job} 업무 시 지속적인 반복성 관절 가해를 겪고 있으며, 기상 시 약 {currentProfile.morningStiffnessMin}분간 아침 강직을 호소합니다. 최근 {habitScore.streak.days}일간 JOINTRUN 스마트 보조기와 온수 가동성 습관 실천 결과, 손가락 굽힘 가동 범위(ROM)가 {currentProfile.weeklyROMChange}의 개선 회복 국면을 확인했습니다.
            </div>
            <div style={{display:"flex",gap:8,justifyContent:"flex-end",paddingTop:10,borderTop:"1px solid #e2e8f0"}}>
              <button onClick={() => { triggerFeedback("소견서가 프린터로 발송되었습니다."); setShowDoctorReport(false); }}
                style={{background:"#2563eb",color:"white",fontWeight:800,fontSize:11,padding:"8px 16px",borderRadius:10,border:"none",cursor:"pointer",display:"flex",alignItems:"center",gap:4}}>
                <Printer style={{width:14,height:14}} />소견서 출력
              </button>
              <button onClick={() => setShowDoctorReport(false)} style={{background:"#f1f5f9",color:"#334155",fontWeight:700,fontSize:11,padding:"8px 14px",borderRadius:10,border:"none",cursor:"pointer"}}>닫기</button>
            </div>
          </div>
        </div>
      )}

      {/* EVENT MARKER MODAL */}
      {showEventMarker && currentUser && (
        <EventMarkerModal
          uid={currentUser.uid}
          onClose={() => setShowEventMarker(false)}
          onSaved={() => recordActivity(currentUser.uid)}
          triggerFeedback={triggerFeedback}
        />
      )}

      {/* CALIBRATOR MODAL */}
      {showCalibrator && (
        <div style={{position:"fixed",inset:0,background:"rgba(15,23,42,0.6)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:16,backdropFilter:"blur(4px)"}}>
          <div style={{background:"white",borderRadius:20,maxWidth:380,width:"100%",padding:20,boxShadow:"0 20px 40px rgba(0,0,0,0.25)",position:"relative"}}>
            <button onClick={() => setShowCalibrator(false)} style={{position:"absolute",top:12,right:12,background:"none",border:"none",cursor:"pointer",color:"#94a3b8",fontSize:16,fontWeight:700}}>×</button>
            <PremiumModule currentProfile={currentProfile} triggerFeedback={triggerFeedback} />
            <button onClick={() => { triggerFeedback("보조기 설정이 저장·동기화되었습니다."); setShowCalibrator(false); }}
              style={{marginTop:12,width:"100%",background:"#2563eb",color:"white",fontWeight:900,fontSize:11,padding:"10px",borderRadius:12,border:"none",cursor:"pointer"}}>
              조율 완료 & 기기 동기화
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

export default JOINTRUNUnified;
