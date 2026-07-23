// ─────────────────────────────────────────────
// v9Repository — Decision Loop(트리거→기준선→재확인→비교) Repository 계층.
// recordRepository.js와 같은 패턴: Firestore 세부사항(collection/query)은 src/lib/firestoreV9.js에만
// 두고, 이 파일은 화면이 필요로 하는 동작 단위(트리거 선택, 촬영 저장, 재확인 완료 등)만 노출한다.
// ─────────────────────────────────────────────
import {
  createV9Event, updateV9EventStatus, saveCapture, markBaselineCreated,
  completeRecheck, skipRecheck, saveComparison, getCapture,
  getActiveV9Event, getV9EventHistory,
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

    async confirmBaseline(eventId, captureId, baselineCapturedAt) {
      if (!uid) return null;
      return markBaselineCreated(uid, eventId, captureId, baselineCapturedAt);
    },

    async completeRecheck(eventId, recheckId, captureId) {
      if (!uid) return;
      return completeRecheck(uid, eventId, recheckId, captureId);
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
  };
}
