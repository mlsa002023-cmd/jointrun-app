import { useEffect, useState } from "react";
import { useRecordRepository } from "./useRecordRepository";

// HOME 화면이 필요로 하는 데이터만 반환한다 — scans의 원본 개수(scanCount)로 Empty/First
// Scan/Normal 상태를 가르고, mobilityTrendUp으로 TodayActionCard의 "루틴 유지" 규칙을 판정한다.
// scanCount는 null(로딩 중)과 0(빈 상태)을 구분해야 하므로 scans와 별개 필드로 유지한다.
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

  const scanCount = scans === null ? null : scans.length;
  const mobilityTrendUp = !!(scans && scans.length >= 2 &&
    (scans[0].scores?.mobility?.value ?? 0) > (scans[1].scores?.mobility?.value ?? 0));

  return { scans, scanCount, mobilityTrendUp, loading };
}
