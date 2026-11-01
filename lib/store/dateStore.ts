import { create } from "zustand";

/**
 * ローカルタイムゾーンでの YYYY-MM-DD 形式の日付文字列を返す
 */
export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * 今日のローカル日付文字列 (YYYY-MM-DD)
 */
export function getTodayDateString(): string {
  return formatLocalDate(new Date());
}

/**
 * 安全な日付加減算（月またぎ・タイムゾーンずれ防止）
 * YYYY-MM-DD 文字列から正午基準で加減算し、結果の YYYY-MM-DD 文字列を返す
 */
export function changeDateByDays(currentDateStr: string, days: number): string {
  if (!currentDateStr || !isValidDateString(currentDateStr)) {
    currentDateStr = getTodayDateString();
  }
  const [year, month, day] = currentDateStr.split("-").map(Number);
  // 正午 (12:00:00) を指定してローカルタイムゾーン・夏時間の境界ズレを完全防止
  const date = new Date(year, month - 1, day, 12, 0, 0);
  date.setDate(date.getDate() + days);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * YYYY-MM-DD 形式の文字列が有効な日付かどうかを検証
 */
export function isValidDateString(dateStr: string | null | undefined): boolean {
  if (!dateStr || typeof dateStr !== "string") return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

/**
 * YYYY-MM-DD 形式の文字列をローカル日付の Date オブジェクトに安全に変換
 */
export function parseDateString(dateStr: string): Date {
  if (!isValidDateString(dateStr)) {
    return new Date();
  }
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

interface DateStore {
  selectedDateStr: string;
  setSelectedDateStr: (dateStr: string) => void;
  isEditing: boolean;
  setIsEditing: (editing: boolean) => void;
}

export const useDateStore = create<DateStore>((set) => ({
  selectedDateStr: getTodayDateString(),
  setSelectedDateStr: (dateStr) => {
    if (isValidDateString(dateStr)) {
      set({ selectedDateStr: dateStr });
    }
  },
  isEditing: false,
  setIsEditing: (editing) => set({ isEditing: editing }),
}));
