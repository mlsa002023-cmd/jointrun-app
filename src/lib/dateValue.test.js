import { describe, it, expect } from "vitest";
import { toValidDate, formatDateValue, compareByDateDesc, DATE_UNKNOWN_LABEL } from "./dateValue";

describe("dateValue (FIX-1 §4)", () => {
  it("JS Date를 그대로 통과시킨다", () => {
    const d = new Date("2026-07-01T00:00:00Z");
    expect(toValidDate(d)).toBe(d);
  });

  it("Firestore Timestamp(.toDate())를 변환한다", () => {
    const ts = { toDate: () => new Date("2026-07-02T00:00:00Z") };
    expect(toValidDate(ts)?.toISOString()).toBe("2026-07-02T00:00:00.000Z");
  });

  it("{ seconds, nanoseconds } 직렬화 Timestamp를 변환한다", () => {
    const v = { seconds: 1751414400, nanoseconds: 0 }; // 2025-07-02
    const d = toValidDate(v);
    expect(d).toBeInstanceOf(Date);
    expect(Number.isNaN(d.getTime())).toBe(false);
  });

  it("ISO 문자열과 epoch number를 변환한다", () => {
    expect(toValidDate("2026-07-03").getUTCFullYear()).toBe(2026);
    expect(toValidDate(1751414400000)).toBeInstanceOf(Date);
  });

  it("변환 불가 값은 null (Invalid Date를 만들지 않는다)", () => {
    expect(toValidDate(null)).toBeNull();
    expect(toValidDate(undefined)).toBeNull();
    expect(toValidDate("")).toBeNull();
    expect(toValidDate("not a date")).toBeNull();
    expect(toValidDate({})).toBeNull();
    expect(toValidDate(NaN)).toBeNull();
    expect(toValidDate(new Date("garbage"))).toBeNull();
  });

  it("formatDateValue는 잘못된 날짜에 '날짜 미확인'을 반환한다(Invalid Date 노출 금지)", () => {
    expect(formatDateValue("not a date")).toBe(DATE_UNKNOWN_LABEL);
    expect(formatDateValue(null)).toBe(DATE_UNKNOWN_LABEL);
    expect(formatDateValue("2026-07-01")).not.toContain("Invalid");
  });

  it("compareByDateDesc는 최신이 먼저, 날짜 미확인은 마지막", () => {
    const items = [
      { id: "a", date: "2026-07-01" },
      { id: "bad", date: "garbage" },
      { id: "b", date: "2026-07-10" },
      { id: "null", date: null },
    ];
    const sorted = [...items].sort((x, y) => compareByDateDesc(x.date, y.date));
    expect(sorted[0].id).toBe("b");
    expect(sorted[1].id).toBe("a");
    // 날짜 미확인 두 개는 뒤쪽
    expect(sorted.slice(2).map((i) => i.id).sort()).toEqual(["bad", "null"]);
  });
});
