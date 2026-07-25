import { Loader2 } from "lucide-react";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import AuthScreen from "./components/AuthScreen";
import JOINTRUNUnified from "./components/JOINTRUNShell";

// RC1.2.2 P0-2 — onAuthStateChanged가 12초 안에 응답하지 않거나 오류를 반환하면
// 로그인 화면 대신 이 화면을 보여준다("무한 authLoading 금지").
function AuthConnectionError({ code, onRetry }) {
  const message = code === "connection_timeout"
    ? "서버 연결이 지연되고 있습니다"
    : "서버에 연결하지 못했습니다";
  return (
    <div style={{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:"#f8fafc",padding:24,textAlign:"center"}}>
      <p style={{fontSize:16,fontWeight:600,color:"#0f172a",marginBottom:8}}>{message}</p>
      <p style={{fontSize:13,color:"#94a3b8",marginBottom:20}}>진단 코드: {code}</p>
      <button
        type="button"
        onClick={onRetry}
        style={{padding:"10px 24px",borderRadius:8,background:"#2563eb",color:"white",border:"none",fontSize:14,fontWeight:600,cursor:"pointer"}}
      >
        재시도
      </button>
    </div>
  );
}

function AuthGate() {
  const { currentUser, authLoading, authError, retryAuthInit } = useAuth();

  if (authLoading) {
    return (
      <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#f8fafc"}}>
        <Loader2 style={{width:28,height:28,color:"#2563eb"}} className="animate-spin" />
      </div>
    );
  }

  if (authError && !currentUser) {
    return <AuthConnectionError code={authError} onRetry={retryAuthInit} />;
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
