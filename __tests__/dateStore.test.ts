import { describe, it, expect, beforeEach } from "vitest";
import {
  formatLocalDate,
  getTodayDateString,
  isValidDateString,
  parseDateString,
  changeDateByDays,
  useDateStore,
} from "../lib/store/dateStore";

describe("dateStore utilities & state", () => {
  beforeEach(() => {
    useDateStore.setState({
      selectedDateStr: getTodayDateString(),
      isEditing: false,
    });
  });

  it("formatLocalDate formats date to YYYY-MM-DD in local time", () => {
    const d = new Date(2026, 9, 21); // October 21, 2026
    expect(formatLocalDate(d)).toBe("2026-10-21");
  });

  it("isValidDateString correctly identifies valid and invalid dates", () => {
    expect(isValidDateString("2026-10-21")).toBe(true);
    expect(isValidDateString("2026-02-28")).toBe(true);
    expect(isValidDateString("2026-02-30")).toBe(false); // Invalid day for Feb
    expect(isValidDateString("2026-13-01")).toBe(false); // Invalid month
    expect(isValidDateString("invalid")).toBe(false);
    expect(isValidDateString("")).toBe(false);
    expect(isValidDateString(null as any)).toBe(false);
  });

  it("parseDateString parses YYYY-MM-DD into correct local Date", () => {
    const d = parseDateString("2026-10-21");
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(9); // 0-indexed October
    expect(d.getDate()).toBe(21);
  });

  it("useDateStore updates selectedDateStr and isEditing correctly", () => {
    const { setSelectedDateStr, setIsEditing } = useDateStore.getState();

    setSelectedDateStr("2026-10-25");
    expect(useDateStore.getState().selectedDateStr).toBe("2026-10-25");

    // Invalid date string should not overwrite
    setSelectedDateStr("invalid-date");
    expect(useDateStore.getState().selectedDateStr).toBe("2026-10-25");

    setIsEditing(true);
    expect(useDateStore.getState().isEditing).toBe(true);

    setIsEditing(false);
    expect(useDateStore.getState().isEditing).toBe(false);
  });

  describe("changeDateByDays across month and year boundaries", () => {
    it("safely decrements across month boundaries without resetting or jumping", () => {
      // 11月1日から前日へ遡ると確実に10月31日
      expect(changeDateByDays("2026-11-01", -1)).toBe("2026-10-31");
      // 10月31日から前日へ
      expect(changeDateByDays("2026-10-31", -1)).toBe("2026-10-30");
      // 3月1日から前日へ（2026年は平年なので2月28日）
      expect(changeDateByDays("2026-03-01", -1)).toBe("2026-02-28");
      // うるう年の2月29日テスト（2024年）
      expect(changeDateByDays("2024-03-01", -1)).toBe("2024-02-29");
    });

    it("safely decrements across year boundaries", () => {
      // 1月1日から前日へ遡ると確実に前年12月31日
      expect(changeDateByDays("2026-01-01", -1)).toBe("2025-12-31");
    });

    it("safely increments across month and year boundaries", () => {
      expect(changeDateByDays("2026-10-31", 1)).toBe("2026-11-01");
      expect(changeDateByDays("2025-12-31", 1)).toBe("2026-01-01");
    });

    it("handles multiple days increment and decrement", () => {
      expect(changeDateByDays("2026-11-01", -7)).toBe("2026-10-25");
      expect(changeDateByDays("2026-10-25", 7)).toBe("2026-11-01");
    });
  });
});
