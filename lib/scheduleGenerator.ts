import { isHoliday } from "./holidays";

export const TARGET_ROLES = ["ぽっけリーダー", "日中リーダー", "集団担当"] as const;
export type TargetRole = typeof TARGET_ROLES[number];

export interface DayAssignment {
  dateStr: string;
  dayOfWeek: number; // 0=日, 1=月, ..., 6=土
  availableStaff: string[]; // その日「通常」出勤できるスタッフ
}

export interface WeekGroup {
  weekKey: string;
  days: DayAssignment[];
}

/**
 * 月の日付一覧から、祝日・土日を除いた週ごとのグループを作成
 */
export function groupWorkingDaysByWeek(
  year: number,
  month: number,
  staffList: string[],
  existingData: Record<string, Record<string, string>>,
  getCellDataFn: (raw: string) => { role: string; attendance: string }
): WeekGroup[] {
  const daysInMonth = new Date(year, month, 0).getDate();
  const weekMap = new Map<string, DayAssignment[]>();

  for (let d = 1; d <= daysInMonth; d++) {
    const dateObj = new Date(year, month - 1, d);
    const dayOfWeek = dateObj.getDay();
    // 土日を除外
    if (dayOfWeek === 0 || dayOfWeek === 6) continue;

    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    // 祝日を除外
    if (isHoliday(dateStr)) continue;

    // 月曜基準の週キーを算出
    const mondayDiff = dayOfWeek - 1;
    const monday = new Date(year, month - 1, d - mondayDiff);
    const weekKey = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, "0")}-${String(monday.getDate()).padStart(2, "0")}`;

    const dayData = existingData[dateStr] || {};
    // 休み、遅刻、早退、中抜け、研修以外の「通常」スタッフのみ
    const availableStaff = staffList.filter((s) => {
      const cell = getCellDataFn(dayData[s]);
      return cell.attendance === "通常";
    });

    const dayAssignment: DayAssignment = {
      dateStr,
      dayOfWeek,
      availableStaff,
    };

    if (!weekMap.has(weekKey)) {
      weekMap.set(weekKey, []);
    }
    weekMap.get(weekKey)!.push(dayAssignment);
  }

  return Array.from(weekMap.entries()).map(([weekKey, days]) => ({
    weekKey,
    days,
  }));
}

/**
 * リーダーおよび集団担当の自動割り当てロジック
 * 1. 対象の3役職: 「ぽっけリーダー」「日中リーダー」「集団担当」
 * 2. 1日の配置枠: 平日稼働日は毎日上記3役職を各1名配置、残りは「フリー」
 * 3. 週1回均等担当: 1週間の中で各スタッフが各役職を原則1回ずつ担当（合計週3回）
 * 4. 曜日ばらけ（ローテーション）: 過去の割り当て履歴に基づき担当曜日が固定化しないよう循環配置
 * 5. 変則勤務除外ガード: 休み、遅刻、早退、中抜け、研修のスタッフは除外
 * 6. 祝日除外: 祝日は全スタッフ業務割り当てを行わない
 */
export function generateOptimizedSchedule(
  year: number,
  month: number,
  staffList: string[],
  existingData: Record<string, Record<string, string>>,
  getCellDataFn: (raw: string) => { role: string; attendance: string; time?: string; endTime?: string },
  packCellDataFn: (role: string, attendance: string, time?: string, endTime?: string) => string
): Record<string, Record<string, string>> {
  const newData: Record<string, Record<string, string>> = { ...existingData };
  const weekGroups = groupWorkingDaysByWeek(year, month, staffList, existingData, getCellDataFn);

  // 過去の役職担当曜日履歴（スタッフ -> 役職 -> 担当曜日配列）
  const assignedDayOfWeeks: Record<string, Record<string, number[]>> = {};
  const monthRoleCounts: Record<string, Record<string, number>> = {};

  staffList.forEach((s) => {
    assignedDayOfWeeks[s] = {};
    monthRoleCounts[s] = {};
    for (const r of TARGET_ROLES) {
      assignedDayOfWeeks[s][r] = [];
      monthRoleCounts[s][r] = 0;
    }
  });

  let lastDayRoleMap: Record<string, string> = {}; // 直前稼働日の担当役職

  for (const week of weekGroups) {
    const days = week.days;
    if (days.length === 0) continue;

    const totalSlots = days.length * TARGET_ROLES.length;
    let bestAssignments: string[][] | null = null;
    let bestCost = Infinity;

    const currentAssignments: string[][] = Array.from({ length: days.length }, () =>
      Array(TARGET_ROLES.length).fill("")
    );

    const weekRoleCount: Record<string, Record<string, number>> = {};
    staffList.forEach((s) => {
      weekRoleCount[s] = {};
      for (const r of TARGET_ROLES) {
        weekRoleCount[s][r] = 0;
      }
    });

    let steps = 0;
    const maxSteps = 30000;

    function search(slotIdx: number, currentCost: number) {
      if (++steps > maxSteps) return;

      if (slotIdx === totalSlots) {
        if (currentCost < bestCost) {
          bestCost = currentCost;
          bestAssignments = currentAssignments.map((row) => [...row]);
        }
        return;
      }

      const dayIdx = Math.floor(slotIdx / TARGET_ROLES.length);
      const roleIdx = slotIdx % TARGET_ROLES.length;
      const role = TARGET_ROLES[roleIdx];
      const day = days[dayIdx];

      // 本日既に使われたスタッフ
      const usedToday = new Set<string>();
      for (let r = 0; r < roleIdx; r++) {
        if (currentAssignments[dayIdx][r]) {
          usedToday.add(currentAssignments[dayIdx][r]);
        }
      }

      // 今日通常出勤可能な候補者
      const candidates = day.availableStaff.filter((s) => !usedToday.has(s));
      if (candidates.length === 0) return;

      // 候補者ごとのペナルティ計算
      const scoredCandidates = candidates.map((staff) => {
        let p = 0;

        // 1. 同週内での重複ペナルティ（原則週1回）
        const wCount = weekRoleCount[staff][role];
        if (wCount >= 1) {
          p += 1000 * wCount;
        }

        // 週内での全役職担当合計（週3回に平準化）
        const totalWeek = Object.values(weekRoleCount[staff]).reduce((sum, c) => sum + c, 0);
        p += totalWeek * 40;

        // 2. 曜日分散・ローテーション
        const pastDays = assignedDayOfWeeks[staff]?.[role] || [];
        if (pastDays.length > 0) {
          // 直近に担当した曜日と同じなら重いペナルティ
          if (pastDays[pastDays.length - 1] === day.dayOfWeek) {
            p += 300;
          }
          // 過去に同じ曜日を担当した回数に応じたペナルティ
          const countThisDay = pastDays.filter((d) => d === day.dayOfWeek).length;
          p += countThisDay * 100;
        }

        // 3. 前日と同じ役職の連続ペナルティ
        if (dayIdx === 0) {
          if (lastDayRoleMap[staff] === role) {
            p += 150;
          }
        } else {
          const prevDayRoleIdx = currentAssignments[dayIdx - 1].indexOf(staff);
          if (prevDayRoleIdx !== -1 && TARGET_ROLES[prevDayRoleIdx] === role) {
            p += 150;
          }
        }

        // 4. 月全体の担当回数平準化
        const mCount = monthRoleCounts[staff]?.[role] || 0;
        p += mCount * 25;

        return { staff, penalty: p };
      });

      scoredCandidates.sort((a, b) => a.penalty - b.penalty);

      for (const cand of scoredCandidates) {
        const nextCost = currentCost + cand.penalty;
        if (nextCost >= bestCost) continue;

        currentAssignments[dayIdx][roleIdx] = cand.staff;
        weekRoleCount[cand.staff][role]++;

        search(slotIdx + 1, nextCost);

        currentAssignments[dayIdx][roleIdx] = "";
        weekRoleCount[cand.staff][role]--;
      }
    }

    search(0, 0);

    // 見つかった最適割り当てを反映
    if (bestAssignments) {
      days.forEach((day, dayIdx) => {
        const { dateStr, dayOfWeek } = day;
        const dayData = newData[dateStr] || {};
        const assignedToday: Record<string, string> = {};

        TARGET_ROLES.forEach((role, roleIdx) => {
          const staff = bestAssignments![dayIdx][roleIdx];
          if (staff) {
            assignedToday[staff] = role;
            monthRoleCounts[staff][role] = (monthRoleCounts[staff][role] || 0) + 1;
            assignedDayOfWeeks[staff][role].push(dayOfWeek);
          }
        });

        staffList.forEach((s) => {
          if (!assignedToday[s]) {
            assignedToday[s] = "フリー";
          }
        });

        lastDayRoleMap = { ...assignedToday };

        const packedDayData: Record<string, string> = { ...dayData };
        for (const s of staffList) {
          const existingCell = getCellDataFn(dayData[s]);
          if (existingCell.attendance !== "通常") {
            packedDayData[s] = packCellDataFn("フリー", existingCell.attendance, existingCell.time, existingCell.endTime);
          } else {
            packedDayData[s] = packCellDataFn(assignedToday[s] || "フリー", existingCell.attendance, existingCell.time, existingCell.endTime);
          }
        }

        newData[dateStr] = packedDayData;
      });
    }
  }

  return newData;
}
