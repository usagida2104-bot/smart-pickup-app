import { describe, it, expect } from "vitest";
import { isHoliday, getHolidayName, getHolidaysForYear } from "../lib/holidays";

describe("Japanese Holiday calculation tests", () => {
  it("correctly identifies 2026 holidays including substitute and citizen holidays", () => {
    // 2026年の祝日
    expect(getHolidayName("2026-01-01")).toBe("元日");
    expect(getHolidayName("2026-01-12")).toBe("成人の日");
    expect(getHolidayName("2026-02-11")).toBe("建国記念の日");
    expect(getHolidayName("2026-02-23")).toBe("天皇誕生日");
    expect(getHolidayName("2026-03-20")).toBe("春分の日");
    expect(getHolidayName("2026-04-29")).toBe("昭和の日");
    expect(getHolidayName("2026-05-03")).toBe("憲法記念日");
    expect(getHolidayName("2026-05-04")).toBe("みどりの日");
    expect(getHolidayName("2026-05-05")).toBe("こどもの日");
    // 5/3(日)憲法記念日の振替休日が5/6(水)になる
    expect(getHolidayName("2026-05-06")).toBe("振替休日");

    expect(getHolidayName("2026-07-20")).toBe("海の日");
    expect(getHolidayName("2026-08-11")).toBe("山の日");
    expect(getHolidayName("2026-09-21")).toBe("敬老の日");
    // 9/21(月)敬老の日と9/23(水)秋分の日に挟まれた9/22(火)が国民の休日
    expect(getHolidayName("2026-09-22")).toBe("国民の休日");
    expect(getHolidayName("2026-09-23")).toBe("秋分の日");
    expect(getHolidayName("2026-10-12")).toBe("スポーツの日");
    expect(getHolidayName("2026-11-03")).toBe("文化の日");
    expect(getHolidayName("2026-11-23")).toBe("勤労感謝の日");

    // 平日の判定
    expect(isHoliday("2026-01-02")).toBe(false);
    expect(isHoliday("2026-05-07")).toBe(false);
    expect(isHoliday("2026-09-24")).toBe(false);
    expect(isHoliday("2026-11-04")).toBe(false);
  });
});
