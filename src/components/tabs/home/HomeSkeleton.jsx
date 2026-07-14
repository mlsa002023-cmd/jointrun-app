import JTSkeleton from "../../ui/JTSkeleton";

// HOME 진입 시 Firestore 조회가 끝나기 전(scanCount === null) 보여주는 스켈레톤 — 빈 화면 노출 방지.
const BLOCK_HEIGHTS = [64, 90, 70, 110, 140];

function HomeSkeleton() {
  return (
    <div className="space-y-4">
      {BLOCK_HEIGHTS.map((h, i) => <JTSkeleton key={i} height={h} />)}
    </div>
  );
}

export default HomeSkeleton;
