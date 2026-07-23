// ─────────────────────────────────────────────
// v9Repository — Decision Loop(트리거→기준선→재확인→비교) Repository 계층.
// recordRepository.js와 같은 패턴: Firestore 세부사항(collection/query)은 src/lib/firestoreV9.js에만
// 두고, 이 파일은 화면이 필요로 하는 동작 단위(트리거 선택, 촬영 저장, 재확인 완료 등)만 노출한다.
// ─────────────────────────────────────────────
import {
  createV9Event, updateV9EventStatus, saveCapture, markBaselineCreated,
  completeRecheck, skipRecheck, saveComparison, getCapture,
  getActiveV9Event, getV9EventHistory, getV9EventHistoryDetailed, getEventDetail,
  saveDecision, saveOutcome, __debugForceRecheckDue,
} from "../lib/firestoreV9";

export function createV9Repository(uid) {
  return {
    async startEvent({ primaryTrigger, secondaryTriggers, contextNote }) {
      if (!uid) return null;
      return createV9Event(uid, { primaryTrigger, secondaryTriggers, contextNote });
    },

    async setEventStatus(eventId, status) {
      if (!uid) return;
      return updateV9EventStatus(uid, eventId, status);
    },

    async saveCapture(eventId, captureData) {
      if (!uid) return null;
      return saveCapture(uid, eventId, captureData);
    },

    async confirmBaseline(eventId, captureId, baselineCapturedAt, baselineQualityStatus) {
      if (!uid) return null;
      return markBaselineCreated(uid, eventId, captureId, baselineCapturedAt, baselineQualityStatus);
    },

    async completeRecheck(eventId, recheckId, captureId, qualityStatus) {
      if (!uid) return;
      return completeRecheck(uid, eventId, recheckId, captureId, qualityStatus);
    },

    async skipRecheck(eventId, recheckId) {
      if (!uid) return;
      return skipRecheck(uid, eventId, recheckId);
    },

    async saveComparison(eventId, comparisonData) {
      if (!uid) return null;
      return saveComparison(uid, eventId, comparisonData);
    },

    async getCapture(eventId, captureId) {
      if (!uid) return null;
      return getCapture(uid, eventId, captureId);
    },

    async getActiveEvent() {
      if (!uid) return null;
      return getActiveV9Event(uid);
    },

    async getHistory(count = 20) {
      if (!uid) return [];
      return getV9EventHistory(uid, count);
    },

    async getHistoryDetailed(count = 5) {
      if (!uid) return [];
      return getV9EventHistoryDetailed(uid, count);
    },

    async getEventDetail(eventId) {
      if (!uid) return null;
      return getEventDetail(uid, eventId);
    },

    async saveDecision(eventId, decisionData) {
      if (!uid) return null;
      return saveDecision(uid, eventId, decisionData);
    },

    async saveOutcome(eventId, outcomeData) {
      if (!uid) return null;
      return saveOutcome(uid, eventId, outcomeData);
    },

    // 개발/Mock Capture E2E 검증 전용 — RC0 검증 스프린트 참고.
    async debugForceRecheckDue(eventId, dueType) {
      if (!uid) return;
      return __debugForceRecheckDue(uid, eventId, dueType);
    },
  };
}
