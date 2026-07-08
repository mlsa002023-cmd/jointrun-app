import { Loader2 } from "lucide-react";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import AuthScreen from "./components/AuthScreen";
import JOINTRUNUnified from "./components/JOINTRUNShell";

function AuthGate() {
  const { currentUser, authLoading } = useAuth();

  if (authLoading) {
    return (
      <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#f8fafc"}}>
        <Loader2 style={{width:28,height:28,color:"#2563eb"}} className="animate-spin" />
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
