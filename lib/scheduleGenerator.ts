import { isHoliday } from "./holidays";

export const TARGET_ROLES = ["ぽっけリーダー", "ぽっけⅡリーダー", "日中リーダー"] as const;
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

    // 月曜基準の週番号/キーを算出
    // 月曜日の日付を週のキーとする
    const mondayDiff = dayOfWeek - 1;
    const monday = new Date(year, month - 1, d - mondayDiff);
    const weekKey = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, "0")}-${String(monday.getDate()).padStart(2, "0")}`;

    const dayData = existingData[dateStr] || {};
    // 休み、遅刻、早退、中抜け、研修以外の「通常」スタッフ
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
 * リーダー自動割り当てロジック
 * 1. 週1回の均等配置: 各週内で各スタッフは原則各リーダー（ぽっけ、ぽっけⅡ、日中）を各1回まで担当
 * 2. 曜日の分散（ローテーション）: 直近担当した曜日と異なる曜日に割り当てられるようペナルティ制御
 * 3. 休み・遅刻・早退・中抜け・研修のある日は除外し、通常スタッフからアサイン
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

  // 過去の役職担当履歴（曜日分散用）: staff -> role -> Set of dayOfWeek
  const assignedDayOfWeeks: Record<string, Record<string, number[]>> = {};
  const monthRoleCounts: Record<string, Record<string, number>> = {};

  staffList.forEach((s) => {
    assignedDayOfWeeks[s] = {
      "ぽっけリーダー": [],
      "ぽっけⅡリーダー": [],
      "日中リーダー": [],
    };
    monthRoleCounts[s] = {
      "ぽっけリーダー": 0,
      "ぽっけⅡリーダー": 0,
      "日中リーダー": 0,
    };
  });

  let lastDayRoleMap: Record<string, string> = {}; // 直前稼働日の担当

  for (const week of weekGroups) {
    // 週ごとの各役職担当回数: staff -> role -> count
    const weekRoleCount: Record<string, Record<string, number>> = {};
    staffList.forEach((s) => {
      weekRoleCount[s] = {
        "ぽっけリーダー": 0,
        "ぽっけⅡリーダー": 0,
        "日中リーダー": 0,
      };
    });

    for (const day of week.days) {
      const { dateStr, dayOfWeek, availableStaff } = day;
      const dayData = newData[dateStr] || {};
      const assignedToday: Record<string, string> = {};

      // 割り当てる3役職
      const rolesToAssign = [...TARGET_ROLES];

      // 各役職に対して、最もスコア（適合度）が高いスタッフを選出
      for (const role of rolesToAssign) {
        // まだ今日役職が決まっていない通常出勤スタッフ
        const candidates = availableStaff.filter((s) => !assignedToday[s]);

        if (candidates.length === 0) continue;

        // スコアリング（ペナルティが最小のスタッフを選択）
        candidates.sort((a, b) => {
          const scoreA = calculatePenalty(
            a,
            role,
            dayOfWeek,
            weekRoleCount,
            assignedDayOfWeeks,
            monthRoleCounts,
            lastDayRoleMap
          );
          const scoreB = calculatePenalty(
            b,
            role,
            dayOfWeek,
            weekRoleCount,
            assignedDayOfWeeks,
            monthRoleCounts,
            lastDayRoleMap
          );
          return scoreA - scoreB;
        });

        const chosen = candidates[0];
        assignedToday[chosen] = role;
        weekRoleCount[chosen][role] = (weekRoleCount[chosen][role] || 0) + 1;
        monthRoleCounts[chosen][role] = (monthRoleCounts[chosen][role] || 0) + 1;
        assignedDayOfWeeks[chosen][role].push(dayOfWeek);
      }

      // 役職がつかなかったスタッフは「フリー」
      staffList.forEach((s) => {
        if (!assignedToday[s]) {
          assignedToday[s] = "フリー";
        }
      });

      lastDayRoleMap = { ...assignedToday };

      // 出欠情報は維持しつつ役職をパックして保存
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
    }
  }

  return newData;
}

/**
 * 割り当てペナルティの計算（値が小さいほど好ましい）
 */
function calculatePenalty(
  staff: string,
  role: TargetRole,
  dayOfWeek: number,
  weekRoleCount: Record<string, Record<string, number>>,
  assignedDayOfWeeks: Record<string, Record<string, number[]>>,
  monthRoleCounts: Record<string, Record<string, number>>,
  lastDayRoleMap: Record<string, string>
): number {
  let penalty = 0;

  // 1. 同週内での同一役割の重複は重いペナルティ（原則週1回）
  const weekCount = weekRoleCount[staff]?.[role] || 0;
  if (weekCount >= 1) {
    penalty += 1000 * weekCount;
  }

  // 同週内で既に担当した全リーダー役職の合計回数（全体で週3回を均等に）
  const totalWeekLeaders = Object.values(weekRoleCount[staff] || {}).reduce((sum, c) => sum + c, 0);
  penalty += totalWeekLeaders * 50;

  // 2. 前日と同じ役割の連続はペナルティ
  if (lastDayRoleMap[staff] === role) {
    penalty += 300;
  }

  // 3. 曜日の分散（直近に同じ役割を担当した曜日と同じ曜日ならペナルティ）
  const pastDays = assignedDayOfWeeks[staff]?.[role] || [];
  if (pastDays.length > 0) {
    const lastDay = pastDays[pastDays.length - 1];
    if (lastDay === dayOfWeek) {
      penalty += 150; // 直前週と同じ曜日
    }
    // 過去に担当した回数に応じてペナルティ
    const countThisDay = pastDays.filter((d) => d === dayOfWeek).length;
    penalty += countThisDay * 80;
  }

  // 4. 月全体の担当回数平準化
  const monthCount = monthRoleCounts[staff]?.[role] || 0;
  penalty += monthCount * 20;

  // わずかなランダムノイズを付与してタイブレーキング
  penalty += Math.random() * 5;

  return penalty;
}
