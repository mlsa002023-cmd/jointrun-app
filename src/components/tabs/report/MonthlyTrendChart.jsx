import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip, Cell } from "recharts";
import JTCard from "../../ui/JTCard";

// "이번 달" 섹션 ② 월간 평균 추이 그래프 — 색상은 design/tokens/color.js를 새로 도입하지 않고,
// TimelineModule의 Finger Score™ 추이 차트와 동일한 방식(hex 직접 지정)으로 맞춘다.
function MonthlyTrendChart({ trend }) {
  if (!trend.hasData) {
    return (
      <JTCard tone="warning" className="text-center">
        <p className="text-xs font-bold text-amber-700">아직 데이터가 충분하지 않습니다</p>
        <p className="text-[10px] text-amber-600 mt-1 leading-relaxed">
          이번 달 스캔을 2회 이상 진행하면 월간 평균 추이가 여기에 표시됩니다.
        </p>
      </JTCard>
    );
  }

  return (
    <JTCard>
      <p className="text-[10px] font-bold text-blue-700 mb-2">월간 평균 추이 — Finger Score™</p>
      <div className="h-36 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={trend.weeks}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="week" tick={{ fontSize: 8 }} />
            <YAxis tick={{ fontSize: 8 }} domain={[0, 100]} />
            <ChartTooltip contentStyle={{ fontSize: "10px" }} />
            <Bar dataKey="avg" name="Finger Score 평균" radius={[4, 4, 0, 0]}>
              {trend.weeks.map((_, i) => (
                <Cell key={i} fill={i === trend.weeks.length - 1 ? "#3b82f6" : "#bfdbfe"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </JTCard>
  );
}

export default MonthlyTrendChart;
