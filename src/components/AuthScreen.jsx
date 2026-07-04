// src/components/AuthScreen.jsx
// 로그인되지 않은 상태에서 폰 에뮬레이터 안쪽에 표시되는 인증 화면.
// 기존 JOINTRUN_UNIFIED.jsx 의 인라인 스타일 디자인 언어(네이비/민트)를 그대로 따릅니다.

import { useState } from "react";
import { Activity, Mail, Lock, User as UserIcon, Loader2 } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

export default function AuthScreen() {
  const { signup, login, loginWithGoogle, resetPassword, authError, setAuthError } = useAuth();
  const [mode, setMode] = useState("login"); // login | signup
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [infoMsg, setInfoMsg] = useState(null);

  const handleGoogle = async () => {
    setInfoMsg(null);
    setGoogleSubmitting(true);
    try {
      await loginWithGoogle();
    } catch {
      // authError already set (팝업 취소는 무시)
    } finally {
      setGoogleSubmitting(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setInfoMsg(null);
    setSubmitting(true);
    try {
      if (mode === "signup") {
        await signup(email, password, name);
      } else {
        await login(email, password);
      }
    } catch {
      // authError는 AuthContext에서 이미 세팅됨
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = async () => {
    if (!email) { setAuthError("비밀번호를 재설정할 이메일을 입력해 주세요."); return; }
    setSubmitting(true);
    try {
      await resetPassword(email);
      setInfoMsg("비밀번호 재설정 메일을 보냈습니다. 받은편지함을 확인해 주세요.");
    } catch {
      // authError already set
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "32px 24px", background: "#f8fafc" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 28 }}>
        <div style={{ background: "#0f172a", color: "white", width: 56, height: 56, borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12, boxShadow: "0 8px 20px rgba(15,23,42,0.25)" }}>
          <Activity style={{ width: 28, height: 28, color: "#2dd4bf" }} />
        </div>
        <div style={{ fontSize: 18, fontWeight: 900, color: "#0f172a" }}>JOINTRUN</div>
        <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
          {mode === "login" ? "다시 만나서 반갑습니다" : "5년을 막는 일, 지금 시작하세요"}
        </div>
      </div>

      <button onClick={handleGoogle} disabled={googleSubmitting}
        style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", background: "white", border: "1px solid #e2e8f0", borderRadius: 12, padding: "11px 0", fontSize: 13, fontWeight: 700, color: "#0f172a", cursor: googleSubmitting ? "default" : "pointer", opacity: googleSubmitting ? 0.7 : 1, marginBottom: 14 }}>
        {googleSubmitting ? (
          <Loader2 style={{ width: 15, height: 15 }} className="animate-spin" />
        ) : (
          <GoogleIcon />
        )}
        Google로 계속하기
      </button>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <div style={{ flex: 1, height: 1, background: "#e2e8f0" }} />
        <span style={{ fontSize: 10, color: "#94a3b8", fontWeight: 600 }}>또는</span>
        <div style={{ flex: 1, height: 1, background: "#e2e8f0" }} />
      </div>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {mode === "signup" && (
          <FieldInput icon={UserIcon} type="text" placeholder="이름" value={name} onChange={setName} />
        )}
        <FieldInput icon={Mail} type="email" placeholder="이메일" value={email} onChange={setEmail} required />
        <FieldInput icon={Lock} type="password" placeholder="비밀번호 (6자 이상)" value={password} onChange={setPassword} required />

        {authError && (
          <div style={{ fontSize: 11, color: "#dc2626", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "6px 10px", fontWeight: 600 }}>
            {authError}
          </div>
        )}
        {infoMsg && (
          <div style={{ fontSize: 11, color: "#0f766e", background: "#f0fdfa", border: "1px solid #99f6e4", borderRadius: 8, padding: "6px 10px", fontWeight: 600 }}>
            {infoMsg}
          </div>
        )}

        <button type="submit" disabled={submitting}
          style={{ marginTop: 4, background: "#0d9488", color: "white", border: "none", borderRadius: 12, padding: "12px 0", fontSize: 13, fontWeight: 800, cursor: submitting ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, opacity: submitting ? 0.75 : 1, boxShadow: "0 4px 12px rgba(13,148,136,0.3)" }}>
          {submitting && <Loader2 style={{ width: 14, height: 14 }} className="animate-spin" />}
          {mode === "login" ? "로그인" : "회원가입"}
        </button>
      </form>

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14, fontSize: 11 }}>
        <button onClick={() => { setMode(mode === "login" ? "signup" : "login"); setAuthError(null); setInfoMsg(null); }}
          style={{ background: "none", border: "none", color: "#0d9488", fontWeight: 700, cursor: "pointer", padding: 0 }}>
          {mode === "login" ? "계정이 없으신가요? 회원가입" : "이미 계정이 있으신가요? 로그인"}
        </button>
        {mode === "login" && (
          <button onClick={handleReset} style={{ background: "none", border: "none", color: "#94a3b8", fontWeight: 600, cursor: "pointer", padding: 0 }}>
            비밀번호 찾기
          </button>
        )}
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z"/>
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 16.3 4 9.6 8.3 6.3 14.7z"/>
      <path fill="#4CAF50" d="M24 44c5.5 0 10.4-1.9 14.3-5.1l-6.6-5.6C29.6 35 26.9 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.6 5.1C9.5 39.6 16.2 44 24 44z"/>
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4.1 5.6l6.6 5.6C40.9 36.6 44 30.9 44 24c0-1.3-.1-2.7-.4-3.5z"/>
    </svg>
  );
}

function FieldInput({ icon: Icon, type, placeholder, value, onChange, required }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, background: "white", border: "1px solid #e2e8f0", borderRadius: 12, padding: "10px 12px" }}>
      <Icon style={{ width: 15, height: 15, color: "#94a3b8", flexShrink: 0 }} />
      <input
        type={type} required={required} placeholder={placeholder} value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ border: "none", outline: "none", fontSize: 13, flex: 1, background: "transparent", color: "#0f172a" }}
      />
    </div>
  );
}
