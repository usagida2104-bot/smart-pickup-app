import { describe, it, expect } from "vitest";
import {
  getCellData,
  packCellData,
  formatAttendanceBadge,
  getAttendanceDisplayParts,
  attendanceToStatus,
} from "../app/schedule/page";

describe("schedule attendance & time parsing tests", () => {
  it("getCellData correctly parses hours and minutes without dropping minutes (:00 bug fix)", () => {
    // 従来のバグ: 早退:13:30 を split(":", 2) すると ["早退", "13"] になり分が消えていた
    const rawEarlyLeave = "フリー|早退:13:30";
    const data1 = getCellData(rawEarlyLeave);
    expect(data1.role).toBe("フリー");
    expect(data1.attendance).toBe("早退");
    expect(data1.time).toBe("13:30");
    expect(data1.endTime).toBe("");

    const rawLate = "ぽっけリーダー|遅刻:10:15";
    const data2 = getCellData(rawLate);
    expect(data2.role).toBe("ぽっけリーダー");
    expect(data2.attendance).toBe("遅刻");
    expect(data2.time).toBe("10:15");

    const rawNormal = "集団担当|通常";
    const data3 = getCellData(rawNormal);
    expect(data3.role).toBe("集団担当");
    expect(data3.attendance).toBe("通常");
    expect(data3.time).toBe("");
  });

  it("getCellData and packCellData support new 中抜け (break) status with start and end times", () => {
    // 中抜け: 開始〜終了
    const packed = packCellData("ぽっけリーダー", "中抜け", "11:00", "12:30");
    expect(packed).toBe("ぽっけリーダー|中抜け:11:00-12:30");

    const parsed = getCellData(packed);
    expect(parsed.role).toBe("ぽっけリーダー");
    expect(parsed.attendance).toBe("中抜け");
    expect(parsed.time).toBe("11:00");
    expect(parsed.endTime).toBe("12:30");
  });

  it("formatAttendanceBadge formats status badges accurately", () => {
    expect(formatAttendanceBadge("早退", "13:30")).toBe("早退 (〜13:30)");
    expect(formatAttendanceBadge("遅刻", "10:15")).toBe("遅刻 (10:15〜)");
    expect(formatAttendanceBadge("中抜け", "11:00", "12:00")).toBe("中抜け (11:00〜12:00)");
    expect(formatAttendanceBadge("通常")).toBe("通常");
    expect(formatAttendanceBadge("休み")).toBe("休み");
  });

  it("getAttendanceDisplayParts formats 2-row badge accurately", () => {
    expect(getAttendanceDisplayParts("早退", "13:30")).toEqual({ main: "早退", sub: "〜13:30" });
    expect(getAttendanceDisplayParts("遅刻", "10:30")).toEqual({ main: "遅刻", sub: "10:30〜" });
    expect(getAttendanceDisplayParts("中抜け", "11:00", "12:00")).toEqual({ main: "中抜け", sub: "11:00〜12:00" });
    expect(getAttendanceDisplayParts("中抜け", "11:00")).toEqual({ main: "中抜け", sub: "11:00〜" });
    expect(getAttendanceDisplayParts("通常")).toEqual({ main: "通常", sub: "" });
    expect(getAttendanceDisplayParts("休み")).toEqual({ main: "休み", sub: "" });
  });

  it("attendanceToStatus maps Japanese attendance to system status correctly", () => {
    expect(attendanceToStatus("通常")).toBe("present");
    expect(attendanceToStatus("遅刻")).toBe("late");
    expect(attendanceToStatus("早退")).toBe("early_leave");
    expect(attendanceToStatus("中抜け")).toBe("middle_leave");
    expect(attendanceToStatus("休み")).toBe("absent");
    expect(attendanceToStatus("研修")).toBe("training");
  });
});
