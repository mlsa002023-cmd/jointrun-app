import { useTimelineData } from "./useTimelineData";
import { PatternDetector } from "../domain/PatternDetector";
import { computeMonthlyTrend } from "../lib/monthlyTrend";
import { summarizeMonthlyEvents } from "../lib/monthlyEventSummary";
import { findMostNotableEvent } from "../lib/eventComparison";

// REPORT "이번 달" 섹션 — useTimelineData()가 이미 하는 fetch(scans+events)와 병합(mergeScansAndEvents)을
// 그대로 재사용하고, 여기서는 그 결과를 이번 달 기준으로 요약(문장)·집계(그래프)·그룹핑(이벤트)·
// 선택(대표 변화)만 한다. 새로운 fetch/병합 로직은 없다.
export function useMonthlyReportData() {
  const { scans, timelineItems, loading } = useTimelineData();

  const summary = PatternDetector.detectMonthly(scans);
  const trend = computeMonthlyTrend(scans);
  const eventGroups = summarizeMonthlyEvents(timelineItems);
  const highlight = findMostNotableEvent(timelineItems, scans);

  return { loading, summary, trend, eventGroups, highlight };
}
