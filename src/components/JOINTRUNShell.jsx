import { useState, useEffect, useCallback } from "react";
import {
  Activity, Camera, Compass, LogOut, MessageSquare, Printer,
  Settings, Sparkles, TrendingUp, Users, Volume2, Zap
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import MotionScanPage from "./MotionScanPage";
import { saveScanRecord, saveCheckIn, saveProfileSnapshot, getProfileSnapshot } from "../lib/firestore";
import { PATIENT_PROFILES_DEFAULT, DEFAULT_STEPS } from "../data/mockProfiles";
import HomeModule from "./tabs/HomeModule";
import CoachModule from "./tabs/CoachModule";
import TimelineModule from "./tabs/TimelineModule";
import ReportModule from "./tabs/ReportModule";
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
  fingerHealthScore: 70, // TODO(7단계): 스캔 전 기본값을 중립 하위점수 가중합(50)으로 교체
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

  const triggerFeedback = useCallback((msg) => {
    setFeedbackMsg(msg);
    if ("vibrate" in navigator) { try { navigator.vibrate(40); } catch {} }
    setTimeout(() => setFeedbackMsg(null), 2500);
  }, []);

  const handleScanCompleted = (metrics) => {
    const updated = { ...currentProfile, fingerHealthScore: Math.min(100, currentProfile.fingerHealthScore+1), painIndex: metrics.painIndex, morningStiffnessMin: metrics.stiffnessMin };
   setUserProfile(updated);
    setRecoverySteps(s => s.map(step => step.id === 2 ? { ...step, isCompleted: true } : step));
    if (currentUser) {
      // TODO(7단계 Home 이식): scores/rawFrames 연결은 MotionScanPage/HomeModule 이식 시 채운다.
      saveScanRecord(currentUser.uid, { metrics, scores: null, rawFrames: null }).catch(err => console.error("스캔 결과 저장 실패:", err));
      saveProfileSnapshot(currentUser.uid, {
        fingerHealthScore: updated.fingerHealthScore,
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
    { id: "premium", icon: Users, label: "커뮤니티", externalUrl: NAVER_BAND_URL },
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
          <img src="/icons/icon-96.png" alt="JOINTRUN" style={{width:30,height:30,borderRadius:8}} />
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
                  <HomeModule currentProfile={currentProfile} recoverySteps={recoverySteps} setRecoverySteps={setRecoverySteps} setActiveTab={setActiveTab} triggerFeedback={triggerFeedback} onUpdateProfile={p => setUserProfile(p)} onCheckIn={handleCheckIn} />
                </div>
              )}
              {activeTab === "scan" && <MotionScanPage currentProfile={currentProfile} onScanCompleted={handleScanCompleted} triggerFeedback={triggerFeedback} setActiveTab={setActiveTab} />}
              {activeTab === "coach" && <CoachModule currentProfile={currentProfile} triggerFeedback={triggerFeedback} />}
              {activeTab === "progress" && <TimelineModule currentProfile={currentProfile} currentUser={currentUser} triggerDoctorReportPrint={triggerDoctorReportPrint} triggerFeedback={triggerFeedback} />}
              {activeTab === "health" && <ReportModule currentProfile={currentProfile} triggerDoctorReportPrint={triggerDoctorReportPrint} triggerFeedback={triggerFeedback} />}


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
              {[{l:"Finger Score™",v:`${currentProfile.fingerHealthScore}점`},{l:"아침 강직",v:`${currentProfile.morningStiffnessMin}분`},{l:"관절 기능 나이",v:`${currentProfile.fingerAge}세`},{l:"통증 VAS",v:`${currentProfile.painIndex}/10`}].map(item=>(
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

export default JOINTRUNUnified;
