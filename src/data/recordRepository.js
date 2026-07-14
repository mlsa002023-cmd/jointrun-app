// ─────────────────────────────────────────────
// recordRepository — Firestore → Repository → Hook → UI 계층 구조 중 Repository 단계.
// DataSource(원본 Firestore 읽기/쓰기)는 src/lib/firestore.js가 맡는다. 이 파일은
// 그 위에서 화면이 실제로 필요로 하는 도메인 형태(scans+events 병합 등)만 얹는다 —
// Firestore 관련 지식(collection/query 등)은 여기서 절대 직접 다루지 않는다.
// ─────────────────────────────────────────────
import { getScanHistory, getEventHistory, saveEvent } from "../lib/firestore";
import { mergeScansAndEvents } from "../lib/mergeTimeline";

/**
 * @param {string|undefined} uid
 * @returns {{
 *   getRecentScans: (count?: number) => Promise<object[]>,
 *   getEvents: (count?: number) => Promise<object[]>,
 *   getTimeline: (opts?: { scanCount?: number, eventCount?: number }) => Promise<object[]>,
 *   addEvent: (record: object) => Promise<string|null>,
 * }}
 */
export function createRecordRepository(uid) {
  return {
    async getRecentScans(count = 30) {
      if (!uid) return [];
      return getScanHistory(uid, count);
    },

    async getEvents(count = 30) {
      if (!uid) return [];
      return getEventHistory(uid, count);
    },

    async getTimeline({ scanCount = 30, eventCount = 30 } = {}) {
      if (!uid) return [];
      const [scans, events] = await Promise.all([
        getScanHistory(uid, scanCount),
        getEventHistory(uid, eventCount),
      ]);
      return mergeScansAndEvents(scans, events);
    },

    async addEvent(record) {
      if (!uid) return null;
      return saveEvent(uid, record);
    },
  };
}
