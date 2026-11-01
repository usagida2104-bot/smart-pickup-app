// 日本の国民の祝日・振替休日・国民の休日 計算ユーティリティ

/**
 * 指定された年の日本の祝日マップを返す（キー: YYYY-MM-DD, 値: 祝日名）
 */
export function getHolidaysForYear(year: number): Map<string, string> {
  const holidays = new Map<string, string>();
  const addHoliday = (m: number, d: number, name: string) => {
    const key = `${year}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    holidays.set(key, name);
  };

  // 第N月曜日の日付を計算
  const getNthMonday = (m: number, nth: number): number => {
    const firstDay = new Date(year, m - 1, 1).getDay(); // 0(日)〜6(土)
    const firstMonday = 1 + ((1 - firstDay + 7) % 7);
    return firstMonday + (nth - 1) * 7;
  };

  // 1. 固定祝日 & ハッピーマンデー
  addHoliday(1, 1, "元日");
  addHoliday(1, getNthMonday(1, 2), "成人の日");
  addHoliday(2, 11, "建国記念の日");
  if (year >= 2020) {
    addHoliday(2, 23, "天皇誕生日");
  }

  // 春分の日 (1980〜2099対応の正確な天文学公式)
  const vernalEquinoxDay = Math.floor(20.8431 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
  addHoliday(3, vernalEquinoxDay, "春分の日");

  addHoliday(4, 29, "昭和の日");
  addHoliday(5, 3, "憲法記念日");
  addHoliday(5, 4, "みどりの日");
  addHoliday(5, 5, "こどもの日");

  // 海の日 (7月第3月曜日)
  addHoliday(7, getNthMonday(7, 3), "海の日");

  // 山の日 (8月11日、2016年〜)
  if (year >= 2016) {
    addHoliday(8, 11, "山の日");
  }

  // 敬老の日 (9月第3月曜日)
  const respectDay = getNthMonday(9, 3);
  addHoliday(9, respectDay, "敬老の日");

  // 秋分の日 (1980〜2099対応の正確な天文学公式)
  const autumnEquinoxDay = Math.floor(23.2488 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
  addHoliday(9, autumnEquinoxDay, "秋分の日");

  // 国民の休日（敬老の日と秋分の日に挟まれた平日）
  if (autumnEquinoxDay - respectDay === 2) {
    addHoliday(9, respectDay + 1, "国民の休日");
  }

  // スポーツの日 (10月第2月曜日)
  addHoliday(10, getNthMonday(10, 2), "スポーツの日");

  addHoliday(11, 3, "文化の日");
  addHoliday(11, 23, "勤労感謝の日");

  // 2. 振替休日の判定
  // 国民の祝日に関する法律第3条第2項:
  // 「国民の祝日」が日曜日に当たるときは、その日後においてその日に最も近い「国民の祝日」でない日を休日とする。
  const sortedDates = Array.from(holidays.keys()).sort();
  const substituteHolidays = new Map<string, string>();

  for (const dateStr of sortedDates) {
    const [y, m, d] = dateStr.split("-").map(Number);
    const dateObj = new Date(y, m - 1, d);
    if (dateObj.getDay() === 0) { // 日曜日
      let cur = new Date(y, m - 1, d + 1);
      while (true) {
        const curStr = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}-${String(cur.getDate()).padStart(2, "0")}`;
        if (!holidays.has(curStr) && !substituteHolidays.has(curStr)) {
          substituteHolidays.set(curStr, "振替休日");
          break;
        }
        cur.setDate(cur.getDate() + 1);
      }
    }
  }

  for (const [k, v] of substituteHolidays) {
    holidays.set(k, v);
  }

  return holidays;
}

/**
 * 日付が祝日（振替休日・国民の休日含む）かどうか判定
 */
export function isHoliday(dateOrDateStr: Date | string): boolean {
  let dateStr: string;
  let year: number;
  if (typeof dateOrDateStr === "string") {
    dateStr = dateOrDateStr;
    year = parseInt(dateStr.split("-")[0], 10);
  } else {
    year = dateOrDateStr.getFullYear();
    const m = String(dateOrDateStr.getMonth() + 1).padStart(2, "0");
    const d = String(dateOrDateStr.getDate()).padStart(2, "0");
    dateStr = `${year}-${m}-${d}`;
  }
  const holidays = getHolidaysForYear(year);
  return holidays.has(dateStr);
}

/**
 * 祝日名を取得（祝日でない場合は null）
 */
export function getHolidayName(dateOrDateStr: Date | string): string | null {
  let dateStr: string;
  let year: number;
  if (typeof dateOrDateStr === "string") {
    dateStr = dateOrDateStr;
    year = parseInt(dateStr.split("-")[0], 10);
  } else {
    year = dateOrDateStr.getFullYear();
    const m = String(dateOrDateStr.getMonth() + 1).padStart(2, "0");
    const d = String(dateOrDateStr.getDate()).padStart(2, "0");
    dateStr = `${year}-${m}-${d}`;
  }
  const holidays = getHolidaysForYear(year);
  return holidays.get(dateStr) || null;
}
