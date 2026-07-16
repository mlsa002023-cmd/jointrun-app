import { useState, useEffect, useRef } from "react";
import { Send } from "lucide-react";
import { callAnthropicCoach } from "../../services/anthropicCoach";

function CoachModule({ currentProfile, triggerFeedback }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    setMessages([{
      id: "welcome", sender: "coach",
      text: `안녕하세요, ${currentProfile.name} 님! JOINTRUN 기록 도우미입니다. 오늘 손가락·손목 상태를 편히 기록해보세요.`,
      ts: "방금 전"
    }]);
  }, [currentProfile.id]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, typing]);

  const QUICK_CHIPS = ["오늘 손이 많이 아파요", "아침 강직이 심해요", "오늘 상태를 기록하고 싶어요", "최근 기록을 요약해줘"];

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
      triggerFeedback("기록 도우미 답변이 도착했습니다.");
    } catch {
      setTyping(false);
      const fallback = "지금은 답변을 가져오지 못했어요. 잠시 후 다시 시도해 주세요.";
      setMessages(prev => [...prev, { id: `cf-${Date.now()}`, sender: "coach", text: fallback, ts: "방금 전" }]);
    }
  };

  return (
    <div className="flex flex-col h-full space-y-3">
      <div className="text-center bg-white border border-slate-200 p-3 rounded-2xl shadow-sm">
        <p className="text-[9px] text-slate-400 uppercase tracking-widest font-mono">Record Assistant</p>
        <h2 className="text-sm font-bold text-slate-900">기록 도우미</h2>
      </div>
      <div className="flex-1 overflow-y-auto space-y-2.5 max-h-80 px-1">
        {messages.map(m => (
          <div key={m.id} className={`flex ${m.sender === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] px-3 py-2 rounded-2xl text-[10px] leading-relaxed ${
              m.sender === "user" ? "bg-blue-600 text-white" : "bg-white border border-slate-200 text-slate-800"
            }`}>
              {m.text}
              <div className="text-[7px] mt-0.5 opacity-60">{m.ts}</div>
            </div>
          </div>
        ))}
        {typing && (
          <div className="flex justify-start">
            <div className="bg-white border border-slate-200 px-3 py-2 rounded-2xl flex gap-1 items-center">
              {[0,1,2].map(i => <span key={i} className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{animationDelay:`${i*0.15}s`}} />)}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <div className="flex gap-1 flex-wrap">
        {QUICK_CHIPS.map(chip => (
          <button key={chip} onClick={() => send(chip)} className="bg-slate-100 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 text-slate-600 hover:text-blue-700 px-2.5 py-1 rounded-full text-[9px] font-semibold transition-all">
            {chip}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && send()}
          placeholder="증상을 입력하세요..." className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
        <button onClick={() => send()} className="bg-blue-600 hover:bg-blue-500 text-white p-2 rounded-xl transition-all">
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export default CoachModule;
