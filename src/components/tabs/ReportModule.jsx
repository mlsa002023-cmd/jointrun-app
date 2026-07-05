import { Printer } from "lucide-react";
import { BIOMARKER_METRICS } from "../../data/mockProfiles";

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

export default ReportModule;
