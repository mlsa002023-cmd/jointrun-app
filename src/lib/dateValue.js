// ─────────────────────────────────────────────
// dateValue — 여러 형태의 날짜 값을 안전하게 Date로 변환하는 순수 함수 (P0-14 UAT FIX-1 §4)
//
// 화면 어디에서도 "Invalid Date"를 노출하지 않는다. 변환 불가면 null이고, 표시 계층에서
// "날짜 미확인"으로 적는다. 컴포넌트마다 new Date(value)를 직접 부르지 말고 이 함수를 쓴다.
//
// 지원 입력: JS Date / Firestore Timestamp(.toDate()) / { seconds, nanoseconds } /
//            ISO 문자열 / epoch number.
// ─────────────────────────────────────────────

/**
 * 다양한 날짜 표현을 유효한 Date로 변환한다.
 * @returns {Date|null} 유효 Date, 변환 불가 시 null(절대 Invalid Date를 반환하지 않는다).
 */
export function toValidDate(value) {
  if (value == null) return null;

  // 이미 Date 인스턴스
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

  // Firestore Timestamp — toDate() 제공
  if (typeof value?.toDate === "function") {
    try {
      const d = value.toDate();
      return d instanceof Date && !Number.isNaN(d.getTime()) ? d : null;
    } catch {
      return null;
    }
  }

  // { seconds, nanoseconds } 형태(직렬화된 Timestamp)
  if (typeof value === "object" && typeof value.seconds === "number") {
    const ms = value.seconds * 1000 + (typeof value.nanoseconds === "number" ? value.nanoseconds / 1e6 : 0);
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  // epoch number(밀리초)
  if (typeof value === "number" && Number.isFinite(value)) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  // ISO 문자열 등
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const d = new Date(trimmed);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  return null;
}

export const DATE_UNKNOWN_LABEL = "날짜 미확인";

/**
 * 표시용 날짜 문자열. 유효하지 않으면 "날짜 미확인"(절대 Invalid Date 아님).
 * @param {*} value 원본 날짜 값
 * @param {Intl.DateTimeFormatOptions} [options] toLocaleDateString 옵션
 */
export function formatDateValue(value, options = { month: "long", day: "numeric" }) {
  const d = toValidDate(value);
  return d ? d.toLocaleDateString("ko-KR", options) : DATE_UNKNOWN_LABEL;
}

/**
 * 날짜 내림차순 정렬 비교자. 날짜 미확인(null)은 항상 뒤로 보낸다.
 * 사용: items.sort((a, b) => compareByDateDesc(a.date, b.date))
 */
export function compareByDateDesc(a, b) {
  const da = toValidDate(a);
  const db = toValidDate(b);
  if (da && db) return db.getTime() - da.getTime();
  if (da && !db) return -1; // 유효한 쪽이 앞
  if (!da && db) return 1;
  return 0;
}
