import { describe, it, expect, beforeEach } from "vitest";
import {
  formatLocalDate,
  getTodayDateString,
  isValidDateString,
  parseDateString,
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
});
