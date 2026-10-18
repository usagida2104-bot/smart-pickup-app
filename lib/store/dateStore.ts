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
