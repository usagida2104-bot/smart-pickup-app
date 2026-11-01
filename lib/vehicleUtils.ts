/**
 * 車両および運行便に関するユーティリティ
 */

/**
 * 日別設定の送迎区分から、迎え（来所）の送迎が必要かを判定
 * - both (両方) -> true
 * - pickup_only (迎えのみ) -> true
 * - dropoff_only (送りのみ) -> false
 * - no_transport (送迎不要) -> false
 * - absent (欠席) -> false
 */
export function isPickupRequired(status?: string | null): boolean {
  if (!status) return true;
  return status === "both" || status === "pickup_only";
}

/**
 * 日別設定の送迎区分から、送り（帰宅）の送迎が必要かを判定
 * - both (両方) -> true
 * - dropoff_only (送りのみ) -> true
 * - pickup_only (迎えのみ) -> false
 * - no_transport (送迎不要) -> false
 * - absent (欠席) -> false
 */
export function isDropoffRequired(status?: string | null): boolean {
  if (!status) return true;
  return status === "both" || status === "dropoff_only";
}

/**
 * モード（inbound / outbound）に応じた送迎要否判定
 */
export function isTransportRequired(mode: "inbound" | "outbound", status?: string | null): boolean {
  return mode === "inbound" ? isPickupRequired(status) : isDropoffRequired(status);
}

export interface VehicleColorTheme {
  badgeBg: string;        // 画面用バッジ背景
  badgeText: string;      // 画面用バッジ文字色
  badgeBorder: string;    // 画面用バッジ枠線
  printBg: string;        // 印刷用背景
  printText: string;      // 印刷用文字色
  printBorder: string;    // 印刷用枠線
  label: string;          // 表示名
}

/**
 * 車種名から固有の識別カラーテーマを取得
 * - ボクシー / ヴォクシー: 青系 (blue)
 * - ステップワゴン: 緑系 (emerald / green)
 * - シエンタ: オレンジ系 (orange / amber)
 * - アイシス: シアン / スカイブルー系 (cyan / sky)
 * - ブーン / ムーブ / 軽 / タント: 紫 / ピンク系 (purple / fuchsia)
 */
export function getVehicleColorTheme(vehicleName?: string | null): VehicleColorTheme {
  const name = (vehicleName || "").toLowerCase();

  if (name.includes("ボクシー") || name.includes("ヴォクシー") || name.includes("voxy")) {
    return {
      badgeBg: "bg-blue-100",
      badgeText: "text-blue-800",
      badgeBorder: "border-blue-300",
      printBg: "print:bg-blue-100",
      printText: "print:text-blue-900",
      printBorder: "print:border-blue-400",
      label: "ボクシー",
    };
  }

  if (name.includes("ステップワゴン") || name.includes("stepwgn") || name.includes("step")) {
    return {
      badgeBg: "bg-emerald-100",
      badgeText: "text-emerald-800",
      badgeBorder: "border-emerald-300",
      printBg: "print:bg-emerald-100",
      printText: "print:text-emerald-900",
      printBorder: "print:border-emerald-400",
      label: "ステップワゴン",
    };
  }

  if (name.includes("シエンタ") || name.includes("sienta")) {
    return {
      badgeBg: "bg-orange-100",
      badgeText: "text-orange-800",
      badgeBorder: "border-orange-300",
      printBg: "print:bg-orange-100",
      printText: "print:text-orange-900",
      printBorder: "print:border-orange-400",
      label: "シエンタ",
    };
  }

  if (name.includes("アイシス") || name.includes("isis")) {
    return {
      badgeBg: "bg-cyan-100",
      badgeText: "text-cyan-800",
      badgeBorder: "border-cyan-300",
      printBg: "print:bg-cyan-100",
      printText: "print:text-cyan-900",
      printBorder: "print:border-cyan-400",
      label: "アイシス",
    };
  }

  if (
    name.includes("ブーン") ||
    name.includes("boon") ||
    name.includes("ムーブ") ||
    name.includes("ムーヴ") ||
    name.includes("move") ||
    name.includes("軽") ||
    name.includes("タント") ||
    name.includes("tanto")
  ) {
    return {
      badgeBg: "bg-purple-100",
      badgeText: "text-purple-800",
      badgeBorder: "border-purple-300",
      printBg: "print:bg-purple-100",
      printText: "print:text-purple-900",
      printBorder: "print:border-purple-400",
      label: "軽・小型",
    };
  }

  // デフォルト（グレー・スレート系）
  return {
    badgeBg: "bg-slate-100",
    badgeText: "text-slate-800",
    badgeBorder: "border-slate-300",
    printBg: "print:bg-slate-100",
    printText: "print:text-slate-900",
    printBorder: "print:border-slate-400",
    label: "車両",
  };
}

/**
 * 時刻文字列 "HH:MM" を分（0:00からの分数）に変換
 */
export function timeToMinutes(t: string | null | undefined): number | null {
  if (!t || typeof t !== "string" || t === "-" || t.trim() === "") return null;
  const parts = t.trim().split(":");
  if (parts.length < 2) return null;
  const [h, m] = parts.map(Number);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}

/**
 * 分数から "HH:MM" 形式の時刻文字列を生成
 */
export function minutesToTimeString(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * 便内の乗車児童リストから運行時間帯サマリー文字列を算出
 * 例: "14:10〜14:10", "15:05〜15:25"
 */
export function getTripTimeSummary(children?: any[]): string | null {
  if (!children || children.length === 0) return null;
  const validTimes = children
    .map((c) => c.pickup_time || c.departure_time || c.time)
    .filter((t): t is string => Boolean(t && typeof t === "string" && t.trim() !== "" && t.trim() !== "-"));

  if (validTimes.length === 0) return null;

  validTimes.sort();
  const minTime = validTimes[0];
  const maxTime = validTimes[validTimes.length - 1];

  return `${minTime}〜${maxTime}`;
}

/**
 * 便の運行時間範囲 [開始分, 終了分] を算出
 * - 開始: 最初の児童の下校時刻
 * - 終了: 最後の児童の下校時刻 + 送迎所要時間（デフォルト25分）
 */
export function getTripTimeRange(children?: any[], estimatedDurationMinutes = 25): [number, number] | null {
  if (!children || children.length === 0) return null;
  const minutesList = children
    .map((c) => timeToMinutes(c.pickup_time || c.departure_time || c.time))
    .filter((m): m is number => m !== null);

  if (minutesList.length === 0) return null;

  const minMinutes = Math.min(...minutesList);
  const maxMinutes = Math.max(...minutesList);
  return [minMinutes, maxMinutes + estimatedDurationMinutes];
}

/**
 * 2つの時間帯 [start1, end1] と [start2, end2] が重複（衝突）しているか判定
 */
export function isTimeRangeOverlapping(range1: [number, number], range2: [number, number]): boolean {
  // 一方の終了時刻がもう一方の開始時刻以下なら重複なし
  return range1[0] < range2[1] && range2[0] < range1[1];
}

/**
 * ある便（targetColId, targetTripId）に対して、同一時間帯に他スタッフの便で使用中の車両ID一覧を取得
 */
export function getConflictingVehicleIds(
  columns: any[],
  targetColId: string,
  targetTripId: string,
  targetChildren: any[]
): { vehicleId: string; conflictStaffName: string; conflictTripIndex: number }[] {
  const targetRange = getTripTimeRange(targetChildren);
  if (!targetRange) return [];

  const conflicts: { vehicleId: string; conflictStaffName: string; conflictTripIndex: number }[] = [];

  for (const col of columns) {
    const staffName = col.staffName || col.driverName || "他スタッフ";
    for (const trip of col.trips || []) {
      // 自便自身は除外
      if (String(col.id) === String(targetColId) && String(trip.id) === String(targetTripId)) {
        continue;
      }
      if (!trip.vehicleId) continue;
      // 児童がいる便のみ時間範囲を比較（児童0人の空便は衝突とみなさない）
      if (!trip.children || trip.children.length === 0) continue;

      const otherRange = getTripTimeRange(trip.children);
      if (otherRange && isTimeRangeOverlapping(targetRange, otherRange)) {
        conflicts.push({
          vehicleId: String(trip.vehicleId),
          conflictStaffName: staffName,
          conflictTripIndex: trip.tripIndex || 1,
        });
      }
    }
  }

  return conflicts;
}

/**
 * 自動配車後のカラム各便に対して、時間重複（ダブルブッキング）を完全排除して車両を最適割り当てする
 * - 1便目同士はすべて異なる車両を割り当て（完全重複禁止）
 * - 2便目は1便目が終了した後の車両または待機車両を割り当て
 * - 児童数に応じた定員適合（大人数には大型車を優先）
 */
export function assignVehiclesWithoutOverlap(
  columns: any[],
  availableVehicles: { id: string; name: string; capacity: number }[]
): any[] {
  if (!availableVehicles || availableVehicles.length === 0) return columns;

  // 定員が大きい順に使用可能車両をソート
  const sortedVehicles = [...availableVehicles].sort((a, b) => b.capacity - a.capacity);

  // 便ごとの割当結果マップ: key: `${colId}-${tripIndex}` -> vehicle
  const assignmentMap = new Map<string, { id: string; name: string; capacity: number }>();

  // 運行スケジュール履歴: { vehicleId, range, colId, tripIndex }
  const vehicleSchedule: { vehicleId: string; range: [number, number]; colId: string; tripIndex: number }[] = [];

  // フェーズ1: 1便目（tripIndex === 1）で児童がいる便への割り当て
  // 1便目同士は同時刻運行のため、それぞれ完全にユニークな別々の車両を割り当てる
  const firstTripsWithChildren = columns.map((col) => {
    const t1 = (col.trips || []).find((t: any) => t.tripIndex === 1);
    return {
      colId: col.id,
      trip: t1,
      childCount: (t1?.children || []).length,
      range: getTripTimeRange(t1?.children || []),
    };
  }).filter((item) => item.trip && item.childCount > 0);

  // 乗車児童数が多い順にソート（人数の多い便に大型車を優先）
  firstTripsWithChildren.sort((a, b) => b.childCount - a.childCount);

  const usedVehiclesInFirstTrips = new Set<string>();

  for (const item of firstTripsWithChildren) {
    // 定員を満たし、まだ1便目で使われていない車両
    let selectedV = sortedVehicles.find((v) => !usedVehiclesInFirstTrips.has(v.id) && v.capacity >= item.childCount);
    // なければまだ使われていない車両の中で最も定員の大きいもの
    if (!selectedV) {
      selectedV = sortedVehicles.find((v) => !usedVehiclesInFirstTrips.has(v.id));
    }
    // それでもなければ残りの車両
    if (!selectedV) {
      selectedV = sortedVehicles[0];
    }

    usedVehiclesInFirstTrips.add(selectedV.id);
    assignmentMap.set(`${item.colId}-1`, selectedV);
    if (item.range) {
      vehicleSchedule.push({
        vehicleId: selectedV.id,
        range: item.range,
        colId: item.colId,
        tripIndex: 1,
      });
    }
  }

  // 1便目で児童がいないスタッフにも、まだ1便目で使われていない車両を優先セット
  columns.forEach((col, idx) => {
    if (!assignmentMap.has(`${col.id}-1`)) {
      const unusedV = sortedVehicles.find((v) => !usedVehiclesInFirstTrips.has(v.id)) ||
        sortedVehicles[idx % sortedVehicles.length];
      usedVehiclesInFirstTrips.add(unusedV.id);
      assignmentMap.set(`${col.id}-1`, unusedV);
    }
  });

  // フェーズ2: 2便目以降（tripIndex >= 2）で児童がいる便への割り当て
  const secondTripsWithChildren: { colId: string; tripIndex: number; childCount: number; range: [number, number] | null }[] = [];
  columns.forEach((col) => {
    (col.trips || []).forEach((t: any) => {
      if (t.tripIndex >= 2 && (t.children || []).length > 0) {
        secondTripsWithChildren.push({
          colId: col.id,
          tripIndex: t.tripIndex,
          childCount: t.children.length,
          range: getTripTimeRange(t.children),
        });
      }
    });
  });

  // 開始時刻が早い順 → 児童数が多い順にソート
  secondTripsWithChildren.sort((a, b) => {
    const timeA = a.range ? a.range[0] : 9999;
    const timeB = b.range ? b.range[0] : 9999;
    if (timeA !== timeB) return timeA - timeB;
    return b.childCount - a.childCount;
  });

  for (const item of secondTripsWithChildren) {
    const tripRange = item.range;

    // 時間衝突しない車両かどうかの判定
    const isVehicleAvailable = (vId: string) => {
      if (!tripRange) return true;
      const conflicts = vehicleSchedule.filter((s) => s.vehicleId === vId && isTimeRangeOverlapping(s.range, tripRange));
      return conflicts.length === 0;
    };

    // 優先度1: 1便目と同じスタッフの車両が、時間が終わっていて空いているならその車（乗り換えの手間削減）
    const staffTrip1V = assignmentMap.get(`${item.colId}-1`);
    let selectedV: { id: string; name: string; capacity: number } | undefined;

    if (staffTrip1V && isVehicleAvailable(staffTrip1V.id) && staffTrip1V.capacity >= item.childCount) {
      selectedV = staffTrip1V;
    }

    // 優先度2: 定員を満たし、時間重複しない他の空き車両
    if (!selectedV) {
      selectedV = sortedVehicles.find((v) => isVehicleAvailable(v.id) && v.capacity >= item.childCount);
    }

    // 優先度3: 時間重複しない任意の空き車両
    if (!selectedV) {
      selectedV = sortedVehicles.find((v) => isVehicleAvailable(v.id));
    }

    // フォールバック（どうしても空きがない場合）
    if (!selectedV) {
      selectedV = staffTrip1V || sortedVehicles[0];
    }

    assignmentMap.set(`${item.colId}-${item.tripIndex}`, selectedV);
    if (tripRange) {
      vehicleSchedule.push({
        vehicleId: selectedV.id,
        range: tripRange,
        colId: item.colId,
        tripIndex: item.tripIndex,
      });
    }
  }

  // 2便目以降で児童0人の便には、1便目と同じ車両をセット
  columns.forEach((col) => {
    const trip1V = assignmentMap.get(`${col.id}-1`) || sortedVehicles[0];
    (col.trips || []).forEach((t: any) => {
      if (!assignmentMap.has(`${col.id}-${t.tripIndex}`)) {
        assignmentMap.set(`${col.id}-${t.tripIndex}`, trip1V);
      }
    });
  });

  // 最終的に columns の各便に反映
  return columns.map((col) => {
    const updatedTrips = (col.trips || []).map((t: any) => {
      const v = assignmentMap.get(`${col.id}-${t.tripIndex}`) || sortedVehicles[0];
      return {
        ...t,
        vehicleId: v.id,
        vehicleName: v.name,
        capacity: v.capacity,
      };
    });

    return {
      ...col,
      capacity: updatedTrips[0]?.capacity || col.capacity,
      vehicleName: updatedTrips[0]?.vehicleName || col.vehicleName,
      trips: updatedTrips,
    };
  });
}
