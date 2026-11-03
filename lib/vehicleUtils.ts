import { toMagnet } from "./mockData";

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

// フォールバック用のカラーパレット一覧（登録外車両でも重複しにくい配色）
const FALLBACK_COLOR_PALETTES: Omit<VehicleColorTheme, "label">[] = [
  {
    badgeBg: "bg-sky-100",
    badgeText: "text-sky-800",
    badgeBorder: "border-sky-300",
    printBg: "print:bg-sky-100",
    printText: "print:text-sky-900",
    printBorder: "print:border-sky-400",
  },
  {
    badgeBg: "bg-amber-100",
    badgeText: "text-amber-800",
    badgeBorder: "border-amber-300",
    printBg: "print:bg-amber-100",
    printText: "print:text-amber-900",
    printBorder: "print:border-amber-400",
  },
  {
    badgeBg: "bg-purple-100",
    badgeText: "text-purple-800",
    badgeBorder: "border-purple-300",
    printBg: "print:bg-purple-100",
    printText: "print:text-purple-900",
    printBorder: "print:border-purple-400",
  },
  {
    badgeBg: "bg-pink-100",
    badgeText: "text-pink-800",
    badgeBorder: "border-pink-300",
    printBg: "print:bg-pink-100",
    printText: "print:text-pink-900",
    printBorder: "print:border-pink-400",
  },
  {
    badgeBg: "bg-indigo-100",
    badgeText: "text-indigo-800",
    badgeBorder: "border-indigo-300",
    printBg: "print:bg-indigo-100",
    printText: "print:text-indigo-900",
    printBorder: "print:border-indigo-400",
  },
  {
    badgeBg: "bg-emerald-100",
    badgeText: "text-emerald-800",
    badgeBorder: "border-emerald-300",
    printBg: "print:bg-emerald-100",
    printText: "print:text-emerald-900",
    printBorder: "print:border-emerald-400",
  },
  {
    badgeBg: "bg-yellow-100",
    badgeText: "text-yellow-800",
    badgeBorder: "border-yellow-300",
    printBg: "print:bg-yellow-100",
    printText: "print:text-yellow-900",
    printBorder: "print:border-yellow-400",
  },
  {
    badgeBg: "bg-teal-100",
    badgeText: "text-teal-800",
    badgeBorder: "border-teal-300",
    printBg: "print:bg-teal-100",
    printText: "print:text-teal-900",
    printBorder: "print:border-teal-400",
  },
  {
    badgeBg: "bg-rose-100",
    badgeText: "text-rose-800",
    badgeBorder: "border-rose-300",
    printBg: "print:bg-rose-100",
    printText: "print:text-rose-900",
    printBorder: "print:border-rose-400",
  },
  {
    badgeBg: "bg-cyan-100",
    badgeText: "text-cyan-800",
    badgeBorder: "border-cyan-300",
    printBg: "print:bg-cyan-100",
    printText: "print:text-cyan-900",
    printBorder: "print:border-cyan-400",
  },
];

/**
 * 車両・車種名から固有の識別カラーパレットを取得
 * - アイシス: スカイブルー系 (bg-sky-100 text-sky-800 border-sky-300)
 * - シエンタ: アンバー/オレンジ系 (bg-amber-100 text-amber-800 border-amber-300)
 * - ノート: パープル系 (bg-purple-100 text-purple-800 border-purple-300)
 * - ムーブ: ピンク/ローズ系 (bg-pink-100 text-pink-800 border-pink-300)
 * - ボクシー / ヴォクシー: インディゴ/ブルー系 (bg-indigo-100 text-indigo-800 border-indigo-300)
 * - ステップワゴン: エメラルド/グリーン系 (bg-emerald-100 text-emerald-800 border-emerald-300)
 * - エブリィ: イエロー系 (bg-yellow-100 text-yellow-800 border-yellow-300)
 * - スペーシア: ティール系 (bg-teal-100 text-teal-800 border-teal-300)
 * - その他登録外車両: 文字列ハッシュにより一貫してパレットから自動選択
 */
export function getVehicleColorTheme(vehicleName?: string | null): VehicleColorTheme {
  const name = (vehicleName || "").trim().toLowerCase();

  // 1. アイシス (スカイブルー系)
  if (name.includes("アイシス") || name.includes("isis")) {
    return {
      badgeBg: "bg-sky-100",
      badgeText: "text-sky-800",
      badgeBorder: "border-sky-300",
      printBg: "print:bg-sky-100",
      printText: "print:text-sky-900",
      printBorder: "print:border-sky-400",
      label: "アイシス",
    };
  }

  // 2. シエンタ (アンバー/オレンジ系)
  if (name.includes("シエンタ") || name.includes("sienta")) {
    return {
      badgeBg: "bg-amber-100",
      badgeText: "text-amber-800",
      badgeBorder: "border-amber-300",
      printBg: "print:bg-amber-100",
      printText: "print:text-amber-900",
      printBorder: "print:border-amber-400",
      label: "シエンタ",
    };
  }

  // 3. ノート (パープル系)
  if (name.includes("ノート") || name.includes("note")) {
    return {
      badgeBg: "bg-purple-100",
      badgeText: "text-purple-800",
      badgeBorder: "border-purple-300",
      printBg: "print:bg-purple-100",
      printText: "print:text-purple-900",
      printBorder: "print:border-purple-400",
      label: "ノート",
    };
  }

  // 4. ムーブ / ムーヴ (ピンク/ローズ系)
  if (name.includes("ムーブ") || name.includes("ムーヴ") || name.includes("move")) {
    return {
      badgeBg: "bg-pink-100",
      badgeText: "text-pink-800",
      badgeBorder: "border-pink-300",
      printBg: "print:bg-pink-100",
      printText: "print:text-pink-900",
      printBorder: "print:border-pink-400",
      label: "ムーブ",
    };
  }

  // 5. ボクシー / ヴォクシー (インディゴ/ブルー系)
  if (name.includes("ボクシー") || name.includes("ヴォクシー") || name.includes("voxy")) {
    return {
      badgeBg: "bg-indigo-100",
      badgeText: "text-indigo-800",
      badgeBorder: "border-indigo-300",
      printBg: "print:bg-indigo-100",
      printText: "print:text-indigo-900",
      printBorder: "print:border-indigo-400",
      label: "ボクシー",
    };
  }

  // 6. ステップワゴン (エメラルド/グリーン系)
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

  // 7. エブリィ / エブリー (イエロー系)
  if (name.includes("エブリィ") || name.includes("エブリー") || name.includes("every")) {
    return {
      badgeBg: "bg-yellow-100",
      badgeText: "text-yellow-800",
      badgeBorder: "border-yellow-300",
      printBg: "print:bg-yellow-100",
      printText: "print:text-yellow-900",
      printBorder: "print:border-yellow-400",
      label: "エブリィ",
    };
  }

  // 8. スペーシア (ティール系)
  if (name.includes("スペーシア") || name.includes("spacia")) {
    return {
      badgeBg: "bg-teal-100",
      badgeText: "text-teal-800",
      badgeBorder: "border-teal-300",
      printBg: "print:bg-teal-100",
      printText: "print:text-teal-900",
      printBorder: "print:border-teal-400",
      label: "スペーシア",
    };
  }

  // ブーン / タント / 軽自動車フォールバック
  if (name.includes("ブーン") || name.includes("boon") || name.includes("タント") || name.includes("tanto") || name.includes("軽")) {
    return {
      badgeBg: "bg-pink-100",
      badgeText: "text-pink-800",
      badgeBorder: "border-pink-300",
      printBg: "print:bg-pink-100",
      printText: "print:text-pink-900",
      printBorder: "print:border-pink-400",
      label: "軽自動車",
    };
  }

  // 車両未定または未指定
  if (!name || name === "車未定" || name === "車両未定" || name === "車両未選択") {
    return {
      badgeBg: "bg-slate-100",
      badgeText: "text-slate-700",
      badgeBorder: "border-slate-300",
      printBg: "print:bg-slate-100",
      printText: "print:text-slate-800",
      printBorder: "print:border-slate-400",
      label: "車未定",
    };
  }

  // その他登録外車両：文字列ハッシュでパレットから一貫して自動選択
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % FALLBACK_COLOR_PALETTES.length;
  const palette = FALLBACK_COLOR_PALETTES[index];

  return {
    ...palette,
    label: vehicleName || "車両",
  };
}

/**
 * 車両バッジカラーヘルパー（エイリアス）
 */
export const getVehicleBadgeColor = getVehicleColorTheme;

export interface BoardStateData {
  columns: any[];
  unassigned: { id: string; children: any[] };
  familyPickup: { id: string; children: any[] };
}

/**
 * 日別設定の最新出欠・送迎フラグ（Single Source of Truth）に基づき、
 * 送迎ボードの配車ステート（スタッフ便、未割り当て枠、家族枠）の整合性を修復（リコンシリエーション）する純粋関数。
 *
 * 【動作仕様】
 * - 送迎フラグがONに変更された児童:
 *   「家族枠」に存在していた場合、即座に「家族枠」から除外して「未割り当て（unassigned）」枠へ移動（ドラッグロック解除）
 * - 送迎フラグがOFFに変更された児童:
 *   スタッフ便や未割り当て枠に存在していた場合、即座に除外して「家族枠」へ移動（ドラッグロック）
 * - 欠席児童:
 *   全枠から除外
 */
export function reconcileBoardWithAttendances(
  currentBoard: BoardStateData,
  attendances: any[],
  children: any[],
  mode: "inbound" | "outbound"
): BoardStateData {
  const requiredChildIds = new Set<string>();
  const noTransportChildIds = new Set<string>();
  const absentChildIds = new Set<string>();

  (attendances || []).forEach((a: any) => {
    const childId = String(a.child_id);
    const transportStatus = a.status || "both";
    const attendanceStatus = a.attendance_status || "present";
    const isAbsent = attendanceStatus === "absent" || transportStatus === "absent";

    if (isAbsent) {
      absentChildIds.add(childId);
    } else if (isTransportRequired(mode, transportStatus)) {
      requiredChildIds.add(childId);
    } else {
      noTransportChildIds.add(childId);
    }
  });

  // 1. スタッフ便（columns）の修復
  const newColumns = (currentBoard.columns || []).map((col: any) => ({
    ...col,
    trips: (col.trips || []).map((trip: any) => ({
      ...trip,
      children: (trip.children || [])
        .filter((child: any) => {
          const id = String(child.id);
          return !absentChildIds.has(id) && !noTransportChildIds.has(id) && requiredChildIds.has(id);
        })
        .map((child: any) => {
          const att = attendances.find((a: any) => String(a.child_id) === String(child.id));
          return {
            ...child,
            pickup_time: att ? att.pickup_time : child.pickup_time,
            transportMode: att ? att.status : child.transportMode,
          };
        }),
    })),
  }));

  const assignedStaffChildIds = new Set<string>(
    newColumns.flatMap((col: any) =>
      (col.trips || []).flatMap((trip: any) =>
        (trip.children || []).map((child: any) => String(child.id))
      )
    )
  );

  // 2. 家族枠（familyPickup）の修復
  // 送迎フラグがONの児童は家族枠から絶対に除外！
  const familyChildrenMap = new Map<string, any>();

  (currentBoard.familyPickup?.children || []).forEach((child: any) => {
    const id = String(child.id);
    if (!absentChildIds.has(id) && noTransportChildIds.has(id)) {
      const att = attendances.find((a: any) => String(a.child_id) === id);
      familyChildrenMap.set(id, {
        ...child,
        pickup_time: att ? att.pickup_time : child.pickup_time,
        transportMode: att ? att.status : child.transportMode,
      });
    }
  });

  // 送迎不要の全児童を家族枠に補完
  noTransportChildIds.forEach((childId) => {
    if (!familyChildrenMap.has(childId)) {
      const magnet = toMagnet(childId, children, attendances);
      if (magnet) {
        familyChildrenMap.set(childId, magnet);
      }
    }
  });

  const newFamilyChildren = Array.from(familyChildrenMap.values());

  // 3. 未割り当て枠（unassigned）の修復
  const unassignedMap = new Map<string, any>();

  (currentBoard.unassigned?.children || []).forEach((child: any) => {
    const id = String(child.id);
    if (
      !absentChildIds.has(id) &&
      !noTransportChildIds.has(id) &&
      requiredChildIds.has(id) &&
      !assignedStaffChildIds.has(id)
    ) {
      const att = attendances.find((a: any) => String(a.child_id) === id);
      unassignedMap.set(id, {
        ...child,
        pickup_time: att ? att.pickup_time : child.pickup_time,
        transportMode: att ? att.status : child.transportMode,
      });
    }
  });

  // 送迎が必要だがスタッフ便に乗っていない児童（＝家族枠から解放された児童を含む）を未割り当てに追加
  requiredChildIds.forEach((childId) => {
    if (!assignedStaffChildIds.has(childId) && !unassignedMap.has(childId)) {
      const magnet = toMagnet(childId, children, attendances);
      if (magnet) {
        unassignedMap.set(childId, magnet);
      }
    }
  });

  const newUnassignedChildren = Array.from(unassignedMap.values());

  return {
    columns: newColumns,
    unassigned: {
      id: currentBoard.unassigned?.id || "unassigned",
      children: newUnassignedChildren,
    },
    familyPickup: {
      id: currentBoard.familyPickup?.id || "family-pickup",
      children: newFamilyChildren,
    },
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

/**
 * 放課後等デイサービスの送迎時間帯（15:00〜19:00等）の5分刻み時刻配列を生成
 */
export function generateTimeOptions(start = "15:00", end = "19:00", stepMinutes = 5): string[] {
  const startMin = timeToMinutes(start) ?? 15 * 60;
  const endMin = timeToMinutes(end) ?? 19 * 60;
  const options: string[] = [];
  for (let m = startMin; m <= endMin; m += stepMinutes) {
    options.push(minutesToTimeString(m));
  }
  return options;
}

/**
 * 送り運行時の便の出発時刻を取得（未設定時はデフォルト "17:00"）
 */
export function getTripDepartureTime(trip: any, mode: "inbound" | "outbound" = "outbound"): string {
  if (mode === "inbound") {
    return `${trip?.tripIndex || 1}便`;
  }
  return trip?.departure_time || trip?.time || "17:00";
}

/**
 * 便リストを時系列昇順にソートする純粋関数
 * - 送り（outbound）: departure_time（または "17:00"）の昇順（早い時刻が上）
 * - 迎え（inbound）: tripIndex の昇順
 */
export function sortTripsByTime<T extends { tripIndex?: number; departure_time?: string; time?: string }>(
  trips: T[],
  mode: "inbound" | "outbound"
): T[] {
  if (!trips || trips.length <= 1) return trips || [];

  return [...trips].sort((a, b) => {
    if (mode === "outbound") {
      const timeA = a.departure_time || a.time || "17:00";
      const timeB = b.departure_time || b.time || "17:00";
      const minA = timeToMinutes(timeA) ?? 17 * 60;
      const minB = timeToMinutes(timeB) ?? 17 * 60;
      if (minA !== minB) return minA - minB;
    }
    return (a.tripIndex || 1) - (b.tripIndex || 1);
  });
}

/**
 * 送りモードにおいて、同一時刻に他スタッフ（または同一スタッフの他便）で使用されている車両を検知
 */
export function getOutboundConflictingVehicles(
  columns: any[],
  targetColId: string,
  targetTripId: string,
  targetTime: string
): { vehicleId: string; conflictStaffName: string; conflictTime: string }[] {
  if (!targetTime) return [];

  const conflicts: { vehicleId: string; conflictStaffName: string; conflictTime: string }[] = [];

  for (const col of columns || []) {
    const staffName = col.staffName || col.driverName || "他スタッフ";
    for (const trip of col.trips || []) {
      // 自便自身は除外
      if (String(col.id) === String(targetColId) && String(trip.id) === String(targetTripId)) {
        continue;
      }
      if (!trip.vehicleId) continue;

      const tripTime = trip.departure_time || trip.time || "17:00";
      // 同一時刻の場合のみ衝突
      if (tripTime === targetTime) {
        conflicts.push({
          vehicleId: String(trip.vehicleId),
          conflictStaffName: staffName,
          conflictTime: tripTime,
        });
      }
    }
  }

  return conflicts;
}
