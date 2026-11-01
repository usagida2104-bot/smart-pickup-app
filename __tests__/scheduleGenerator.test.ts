import { describe, it, expect } from "vitest";
import { generateOptimizedSchedule, TARGET_ROLES } from "../lib/scheduleGenerator";
import { getCellData, packCellData } from "../app/schedule/page";

const STAFF_LIST = ["増子", "内山", "熊田", "逵", "大平"];

describe("scheduleGenerator tests", () => {
  it("generates schedule assigning [ぽっけリーダー, 日中リーダー, 集団担当] once per week per staff without holiday assignment", () => {
    // 2026年11月（11/3文化の日、11/23勤労感謝の日あり）
    const year = 2026;
    const month = 11;
    const initialData: Record<string, Record<string, string>> = {};

    const result = generateOptimizedSchedule(
      year,
      month,
      STAFF_LIST,
      initialData,
      getCellData,
      packCellData
    );

    // 11/3 (文化の日・祝日) には何も割り当てられていないこと
    expect(result["2026-11-03"]).toBeUndefined();

    // 11/23 (勤労感謝の日・祝日) には何も割り当てられていないこと
    expect(result["2026-11-23"]).toBeUndefined();

    // 11/2 (月) の割り当てをチェック（3役職が異なるスタッフに割り当てられていること）
    const day1102 = result["2026-11-02"];
    expect(day1102).toBeDefined();
    const roles1102 = Object.values(day1102).map(raw => getCellData(raw).role);
    expect(roles1102).toContain("ぽっけリーダー");
    expect(roles1102).toContain("日中リーダー");
    expect(roles1102).toContain("集団担当");

    // フル稼働の週（第2週: 11/9月〜11/13金、5日間すべて平日祝日なし）での検証
    const week2Dates = ["2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13"];
    const week2RolesCount: Record<string, Record<string, number>> = {};
    STAFF_LIST.forEach(s => {
      week2RolesCount[s] = { "ぽっけリーダー": 0, "日中リーダー": 0, "集団担当": 0 };
    });

    for (const dStr of week2Dates) {
      const dayData = result[dStr];
      expect(dayData).toBeDefined();

      // 各日に3役職が重複なく1名ずつ割り当てられていること
      const todayRoles = STAFF_LIST.map(s => getCellData(dayData[s]).role).filter(r => r !== "フリー");
      expect(todayRoles.length).toBe(3);
      expect(new Set(todayRoles).size).toBe(3);
      expect(todayRoles).toContain("ぽっけリーダー");
      expect(todayRoles).toContain("日中リーダー");
      expect(todayRoles).toContain("集団担当");

      for (const s of STAFF_LIST) {
        const { role } = getCellData(dayData[s]);
        if (role !== "フリー") {
          week2RolesCount[s][role]++;
        }
      }
    }

    // 5人のスタッフがそれぞれ [ぽっけリーダー, 日中リーダー, 集団担当] を原則1回ずつ担当していること（週1回均等）
    for (const s of STAFF_LIST) {
      expect(week2RolesCount[s]["ぽっけリーダー"]).toBe(1);
      expect(week2RolesCount[s]["日中リーダー"]).toBe(1);
      expect(week2RolesCount[s]["集団担当"]).toBe(1);
    }
  });

  it("skips staff with non-normal attendance (休み、遅刻、早退、研修等) from target roles", () => {
    const year = 2026;
    const month = 11;
    // 11/09に「増子」が研修、「内山」が休み
    const initialData: Record<string, Record<string, string>> = {
      "2026-11-09": {
        "増子": packCellData("フリー", "研修", "13:00", "15:00"),
        "内山": packCellData("フリー", "休み"),
      }
    };

    const result = generateOptimizedSchedule(
      year,
      month,
      STAFF_LIST,
      initialData,
      getCellData,
      packCellData
    );

    const dayData = result["2026-11-09"];
    // 増子と内山には役職が割り当てられず、出勤状態が保たれていること
    const masukoCell = getCellData(dayData["増子"]);
    expect(masukoCell.attendance).toBe("研修");
    expect(masukoCell.role).toBe("フリー");

    const uchiyamaCell = getCellData(dayData["内山"]);
    expect(uchiyamaCell.attendance).toBe("休み");
    expect(uchiyamaCell.role).toBe("フリー");

    // 残りの3人（熊田、逵、大平）に3役職が割り当てられていること
    const assignedLeaders = [dayData["熊田"], dayData["逵"], dayData["大平"]].map(c => getCellData(c).role);
    expect(assignedLeaders).toContain("ぽっけリーダー");
    expect(assignedLeaders).toContain("日中リーダー");
    expect(assignedLeaders).toContain("集団担当");
  });
});
