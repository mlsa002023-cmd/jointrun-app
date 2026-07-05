import { useState } from "react";
import { Heart } from "lucide-react";

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

export default CommunityModule;
