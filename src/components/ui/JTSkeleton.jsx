// HomeSkeleton/TimelineModule 로딩 상태에서 반복되던 펄스 블록 패턴의 단일 출처.
function JTSkeleton({ height = 40, count = 1, className = "" }) {
  return (
    <div className="space-y-1.5">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={`bg-slate-100 rounded-2xl animate-pulse ${className}`} style={{ height }} />
      ))}
    </div>
  );
}

export default JTSkeleton;
