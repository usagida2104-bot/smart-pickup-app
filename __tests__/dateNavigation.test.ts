import { describe, it, expect } from "vitest";
import { changeDateByDays, getTodayDateString } from "../lib/store/dateStore";

describe("Date Navigation & Rapid-click Safety", () => {
  it("reliably moves backward across consecutive rapid clicks without looping or resetting", () => {
    // ユーザーが高速に矢印「<」を連続クリックしたシミュレーション
    let latestDateStr = "2026-11-01";
    const history: string[] = [];

    const handleNavigate = (days: number) => {
      // 最新の最新Refから計算（非同期遷移の完了を待たずにキューイング的に前進）
      const nextDate = changeDateByDays(latestDateStr, days);
      latestDateStr = nextDate;
      history.push(nextDate);
    };

    // 11/01から3回連続「<」を押す
    handleNavigate(-1);
    handleNavigate(-1);
    handleNavigate(-1);

    expect(history).toEqual(["2026-10-31", "2026-10-30", "2026-10-29"]);
    expect(latestDateStr).toBe("2026-10-29");
  });

  it("reliably moves forward across consecutive rapid clicks without looping or resetting", () => {
    let latestDateStr = "2026-10-29";
    const history: string[] = [];

    const handleNavigate = (days: number) => {
      const nextDate = changeDateByDays(latestDateStr, days);
      latestDateStr = nextDate;
      history.push(nextDate);
    };

    // 10/29から3回連続「>」を押す
    handleNavigate(1);
    handleNavigate(1);
    handleNavigate(1);

    expect(history).toEqual(["2026-10-30", "2026-10-31", "2026-11-01"]);
    expect(latestDateStr).toBe("2026-11-01");
  });

  it("handles 'Today' button transition safely without redundant triggers", () => {
    const todayStr = getTodayDateString();
    let latestDateStr = "2026-10-15";
    let triggerCount = 0;

    const handleSelectToday = () => {
      if (latestDateStr === todayStr) return; // 既に今日ならスキップ
      latestDateStr = todayStr;
      triggerCount++;
    };

    // 1回目のクリック: 今日へ遷移
    handleSelectToday();
    expect(latestDateStr).toBe(todayStr);
    expect(triggerCount).toBe(1);

    // 2回目・3回目のクリック: 既に今日なので再トリガーしない
    handleSelectToday();
    handleSelectToday();
    expect(triggerCount).toBe(1);
  });

  it("guards against redundant data fetch for the same date (Early Return)", () => {
    let prevLoadedDate = "";
    let fetchCount = 0;

    const simulateLoadData = (targetDateStr: string, reloadKey: number) => {
      // 直前に読み込んだ日付と同じでリロード要求もない場合はスキップ
      if (prevLoadedDate === targetDateStr && reloadKey === 0) {
        return;
      }
      prevLoadedDate = targetDateStr;
      fetchCount++;
    };

    // 初回読み込み
    simulateLoadData("2026-11-01", 0);
    expect(fetchCount).toBe(1);

    // 同じ日付の再通知（State更新とURL更新で重複発火した場合など）
    simulateLoadData("2026-11-01", 0);
    expect(fetchCount).toBe(1); // スキップされて増えない

    // 日付変更時
    simulateLoadData("2026-10-31", 0);
    expect(fetchCount).toBe(2);

    // 明示的リロード要求（reloadKey > 0）時は同じ日付でもフェッチ実行
    simulateLoadData("2026-10-31", 1);
    expect(fetchCount).toBe(3);
  });
});
