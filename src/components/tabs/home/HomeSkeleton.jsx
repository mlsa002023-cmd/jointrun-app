// HOME 진입 시 Firestore 조회가 끝나기 전(scanCount === null) 보여주는 스켈레톤 — 빈 화면 노출 방지.
function Block({ height }) {
  return <div className="bg-slate-100 rounded-2xl animate-pulse" style={{ height }} />;
}

function HomeSkeleton() {
  return (
    <div className="space-y-4">
      <Block height={64} />
      <Block height={90} />
      <Block height={70} />
      <Block height={110} />
      <Block height={140} />
    </div>
  );
}

export default HomeSkeleton;
