import { useEffect, useState } from "react";
import { useRecordRepository } from "./useRecordRepository";

// HOME 화면이 필요로 하는 데이터만 반환한다 — scans의 원본 개수(scanCount)로 Empty/First
// Scan/Normal 상태를 가르고, mobilityTrendUp으로 TodayActionCard의 "루틴 유지" 규칙을 판정한다.
// scanCount는 null(로딩 중)과 0(빈 상태)을 구분해야 하므로 scans와 별개 필드로 유지한다.
//
// scanCount는 SCAN 탭(HOME이 마운트되어 있지 않을 수 있는 시점)에서 발생하는 KPI 판정
// (return_scan/timeline_created)에도 쓰이므로, 이 훅은 JOINTRUNShell 최상위에서 호출해
// 탭 전환과 무관하게 유지되어야 한다 — HOME 화면 내부(leaf 컴포넌트)에서 호출하지 않는다.
//
// addOptimisticScan: 로컬 Firebase 프로젝트가 없는 데모 환경에서는 saveScanRecord가 실제로
// 아무것도 쓰지 않기 때문에, 새 스캔 직후 재조회로는 반영이 안 된다. 기존 동작(스캔 완료 시
// 로컬 상태에 즉시 반영)을 그대로 보존하기 위한 낙관적 업데이트 훅.
export function useHomeData() {
  const repository = useRecordRepository();
  const [scans, setScans] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    repository.getRecentScans(30).then((rows) => {
      if (!cancelled) { setScans(rows); setLoading(false); }
    });
    return () => { cancelled = true; };
  }, [repository]);

  const addOptimisticScan = (scores) => {
    setScans((prev) => [{ scores }, ...(prev ?? [])].slice(0, 30));
  };

  const scanCount = scans === null ? null : scans.length;
  const mobilityTrendUp = !!(scans && scans.length >= 2 &&
    (scans[0].scores?.mobility?.value ?? 0) > (scans[1].scores?.mobility?.value ?? 0));

  return { scans, scanCount, mobilityTrendUp, loading, addOptimisticScan };
}
