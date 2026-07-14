import { useEffect, useState } from "react";
import { useRecordRepository } from "./useRecordRepository";
import { mergeScansAndEvents } from "../lib/mergeTimeline";

// TIMELINE 화면 — scans/events를 각각 보관(그래프·Decision Log 비교에 개별 필요)하면서
// 병합 리스트(timelineItems)도 함께 반환한다. repository.getTimeline()을 쓰지 않고 scans/events를
// 따로 받는 이유: EventDetailModal의 전후 비교 그래프가 원본 scans 배열을 그대로 필요로 한다.
export function useTimelineData() {
  const repository = useRecordRepository();
  const [scans, setScans] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([repository.getRecentScans(30), repository.getEvents(30)]).then(([scanRows, eventRows]) => {
      if (!cancelled) { setScans(scanRows); setEvents(eventRows); setLoading(false); }
    });
    return () => { cancelled = true; };
  }, [repository]);

  const timelineItems = mergeScansAndEvents(scans, events);

  return { scans, events, timelineItems, loading };
}
