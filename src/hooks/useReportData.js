import { useEffect, useState } from "react";
import { useRecordRepository } from "./useRecordRepository";

// REPORT 화면 — 바이오마커는 profile(currentProfile)에서 오고, scans는 PatternInsightCard의
// 판정 근거로만 쓰인다.
export function useReportData() {
  const repository = useRecordRepository();
  const [scans, setScans] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    repository.getRecentScans(30).then((rows) => {
      if (!cancelled) { setScans(rows); setLoading(false); }
    });
    return () => { cancelled = true; };
  }, [repository]);

  return { scans, loading };
}
