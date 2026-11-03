"use client";

import { useState, useMemo, useEffect } from "react";
import { AlertTriangle, User, Users, Plus, Trash2, Car, Clock } from "lucide-react";
import { VehicleColumn as VehicleColumnType, ChildMagnet, Trip } from "@/types";
import { ChildCard } from "./ChildCard";
import { cn } from "@/lib/utils";
import { useBoardStore } from "@/lib/store/boardStore";
import {
  getVehicleColorTheme,
  getTripTimeSummary,
  getConflictingVehicleIds,
  generateTimeOptions,
  getOutboundConflictingVehicles,
  sortTripsByTime,
} from "@/lib/vehicleUtils";

interface VehicleColumnProps {
  column: VehicleColumnType;
  mode: "inbound" | "outbound";
  availableVehicles?: { id: string; name: string; capacity: number }[];
  allColumns?: VehicleColumnType[];
  onChildClick?: (magnet: ChildMagnet, columnId: string) => void;
  onReorderChild?: (columnId: string, childId: string, direction: -1 | 1) => void;
  onChangeLocation?: (mode: "inbound" | "outbound", columnId: string, type: "start" | "end", val: "office" | "home") => void;
  onDeleteTrip?: () => void;
  onUpdateTripVehicle?: () => void;
  onUpdateTripTime?: () => void;
  onShowToast?: (type: "success" | "error", text: string) => void;
  readOnly?: boolean;
  className?: string;
}

export function VehicleColumn({
  column,
  mode,
  availableVehicles = [],
  allColumns = [],
  onChildClick,
  onReorderChild,
  onChangeLocation,
  onDeleteTrip,
  onUpdateTripVehicle,
  onUpdateTripTime,
  onShowToast,
  readOnly = false,
  className
}: VehicleColumnProps) {
  const updateTripLocation = useBoardStore((state) => state.updateTripLocation);
  const updateTripVehicle = useBoardStore((state) => state.updateTripVehicle);
  const updateTripTime = useBoardStore((state) => state.updateTripTime);
  const addTrip = useBoardStore((state) => state.addTrip);
  const removeTrip = useBoardStore((state) => state.removeTrip);

  const timeOptions = useMemo(() => generateTimeOptions("15:00", "19:00", 5), []);

  // 既存の便に含まれていない時刻をサジェスト
  const existingTimes = useMemo(() => {
    return new Set((column.trips || []).map((t) => t.departure_time || t.time || "17:00"));
  }, [column.trips]);

  const defaultNewTime = useMemo(() => {
    const candidates = ["17:00", "17:30", "16:30", "18:00", "16:00", "18:30", "15:30", "19:00"];
    return candidates.find((c) => !existingTimes.has(c)) || "17:30";
  }, [existingTimes]);

  const [selectedNewTripTime, setSelectedNewTripTime] = useState<string>(defaultNewTime);

  useEffect(() => {
    setSelectedNewTripTime(defaultNewTime);
  }, [defaultNewTime]);
  
  const handleAddTrip = (customTime?: string) => {
    if (readOnly) return;
    const timeToAdd = mode === "outbound" ? (customTime || selectedNewTripTime) : undefined;
    addTrip(mode, column.id, timeToAdd);
    onChangeLocation && onChangeLocation(mode, column.id, "start", "office");
  };

  const handleDeleteTrip = (trip: Trip) => {
    if (readOnly) return;
    const childCount = (trip?.children || []).length;
    const tripLabel = mode === "outbound" ? (trip.departure_time || trip.time || "17:00") : `${trip.tripIndex}便目`;
    if (childCount > 0) {
      const ok = window.confirm(
        `この便に乗っている児童（${childCount}名）を未割り当てに戻して、${tripLabel}を削除しますか？`
      );
      if (!ok) return;
    }
    removeTrip(mode, column.id, trip.id);
    onDeleteTrip && onDeleteTrip();
  };

  const handleVehicleChange = (tripId: string, vehicleId: string) => {
    if (readOnly) return;
    if (!vehicleId) {
      updateTripVehicle(mode, column.id, tripId, "", "", 0);
      onUpdateTripVehicle && onUpdateTripVehicle();
      return;
    }
    const selected = availableVehicles.find(v => String(v.id) === String(vehicleId));
    if (!selected) return;
    updateTripVehicle(mode, column.id, tripId, selected.id, selected.name, selected.capacity);
    onUpdateTripVehicle && onUpdateTripVehicle();
  };

  const handleTimeChange = (tripId: string, newTime: string) => {
    if (readOnly) return;
    const currentTrip = (column.trips || []).find((t) => t.id === tripId);
    if (!currentTrip) return;

    // 変更先の時刻ですでに他スタッフが同じ車両を使用していた場合の安全ガード
    if (currentTrip.vehicleId) {
      const conflicts = getOutboundConflictingVehicles(allColumns, column.id, tripId, newTime);
      const isConflicting = conflicts.some((c) => String(c.vehicleId) === String(currentTrip.vehicleId));
      if (isConflicting) {
        updateTripVehicle(mode, column.id, tripId, "", "", 6);
        if (onShowToast) {
          onShowToast(
            "error",
            `⚠️ ${newTime} の便では別スタッフが同じ車両を使用中のため、車両選択を解除しました`
          );
        }
      }
    }

    updateTripTime(mode, column.id, tripId, newTime);
    onUpdateTripTime && onUpdateTripTime();
  };

  const renderRouteInfo = (trip: Trip) => {
    let route = trip.routeInfo || "未設定";
    if (trip.endLocation === "home" && mode === "outbound") {
      if (!route.includes("🏁")) {
        route += " → 🏁 ドライバー自宅（直帰）";
      }
    }
    return route;
  };

  const totalChildrenCount = (column.trips || []).reduce((sum, t) => sum + (t.children || []).length, 0);
  const staffDisplayName = column.staffName || column.driverName || "担当スタッフ";

  // 便を時系列昇順にソート（送りモード時は departure_time 昇順、迎えモード時は tripIndex 昇順）
  const displayTrips = sortTripsByTime(
    (column?.trips || []).filter(trip => trip?.tripIndex === 1 || (trip?.children || []).length > 0 || trip?.isNew),
    mode
  );

  return (
    <div
      data-testid={`staff-column-${column.id}`}
      data-staff-name={staffDisplayName}
      data-count={totalChildrenCount}
      className={cn(
        "vehicle-column flex flex-col rounded-xl border-2 overflow-hidden transition-all duration-200 print:w-auto print:flex-1 print:border-gray-300 print:shadow-none print:break-inside-avoid border-gray-200 bg-white shadow-sm min-w-0",
        className || "w-72 shrink-0"
      )}
    >
      {/* Column Header (スタッフ人ベース見出し) */}
      <div className="px-3 py-2 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
        <div className="flex flex-col gap-0.5 min-w-0 flex-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-base shrink-0">👤</span>
            <span className="font-bold text-gray-900 text-sm truncate">{staffDisplayName}</span>
            {column.staffRole && column.staffRole !== "一般スタッフ" && (
              <span className="text-[10px] font-semibold text-gray-500 bg-gray-200 px-1.5 py-0.2 rounded shrink-0">
                {column.staffRole}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 flex-wrap">
            {column.driverStatus === "late" && (
              <span className="text-[9px] font-bold bg-yellow-100 text-yellow-700 px-1 py-0.2 rounded border border-yellow-200">
                遅刻 {column.driverStatusTime}
              </span>
            )}
            {column.driverStatus === "early_leave" && (
              <span className="text-[9px] font-bold bg-rose-50 text-rose-700 px-1 py-0.2 rounded border border-rose-200">
                早退 {column.driverStatusTime}
              </span>
            )}
            {column.driverStatus === "middle_leave" && (
              <span className="text-[9px] font-bold bg-purple-100 text-purple-800 px-1 py-0.2 rounded border border-purple-200">
                中抜け {column.driverStatusTime}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Trips Container */}
      <div className="flex flex-col flex-1 bg-gray-50 divide-y divide-gray-200 min-h-min overflow-y-auto">
        {displayTrips.map((trip) => {
          const hasVehicle = Boolean(trip?.vehicleId);
          const capacity = trip?.capacity || column?.capacity;
          const childCount = (trip?.children || []).length;
          const isOverCapacity = hasVehicle && capacity ? childCount > capacity : false;
          const isFull = hasVehicle && capacity ? childCount >= capacity : false;
          const fillPct = hasVehicle && capacity ? Math.min((childCount / capacity) * 100, 100) : 0;
          const vehicleTheme = getVehicleColorTheme(trip?.vehicleName);
          const timeSummary = getTripTimeSummary(trip?.children);
          
          const tripTime = trip.departure_time || trip.time || "17:00";
          const conflictingList = mode === "outbound"
            ? getOutboundConflictingVehicles(allColumns, column.id, trip?.id, tripTime)
            : getConflictingVehicleIds(allColumns, column.id, trip?.id, trip?.children || []);
          
          return (
            <div key={trip?.id || Math.random().toString()} className={cn("flex flex-col", isOverCapacity ? "bg-red-50" : "bg-white")}>
              {/* Trip Header (便・車種選択・定員バー) */}
              <div className="w-full px-2 py-1.5 border-b border-gray-100 flex flex-col gap-1 bg-gray-50/70">
                <div className="flex items-center justify-between gap-1 overflow-hidden">
                  {/* 便名（迎えは連番便名、送りは時刻バッジ＆変更ドロップダウン）＆ 車種選択ドロップダウン */}
                  <div className="flex items-center gap-1 min-w-0 flex-1">
                    {mode === "inbound" ? (
                      <span className="font-bold text-[11px] text-gray-700 bg-gray-200 px-1.5 py-0.5 rounded shrink-0 whitespace-nowrap">
                        【{trip?.tripIndex || 1}便】
                      </span>
                    ) : (
                      <div className="flex items-center shrink-0">
                        <select
                          value={trip.departure_time || trip.time || "17:00"}
                          disabled={readOnly}
                          onChange={(e) => handleTimeChange(trip.id, e.target.value)}
                          className={cn(
                            "text-[11px] font-bold border rounded px-1 py-0.5 h-6 text-blue-900 bg-blue-50 border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer transition-colors",
                            readOnly && "opacity-90 cursor-default bg-gray-100 border-gray-300 text-gray-700"
                          )}
                          title="出発時刻を変更"
                        >
                          {timeOptions.map((t) => (
                            <option key={t} value={t}>
                              【{t}】
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* 車種カラータグ（薄いカラーバッジ）: 車両未選択時は非表示 */}
                    {hasVehicle && trip?.vehicleName && trip.vehicleName !== "車両未選択" && trip.vehicleName !== "車未定" && (
                      <span className={cn(
                        "text-[10px] font-bold px-1.5 py-0.2 rounded border shrink-0 hidden sm:inline-flex items-center gap-0.5 transition-all duration-300 animate-in fade-in",
                        vehicleTheme.badgeBg,
                        vehicleTheme.badgeText,
                        vehicleTheme.badgeBorder
                      )}>
                        🚙 {vehicleTheme.label}
                      </span>
                    )}
                    
                    {/* 便ごとの車種選択UI（送迎ボードから直接変更可能＆重複使用防止） */}
                    <select
                      value={String(trip.vehicleId || "")}
                      disabled={readOnly}
                      onChange={(e) => handleVehicleChange(trip.id, e.target.value)}
                      className={cn(
                        "text-[10.5px] font-bold border rounded px-1.5 py-0.5 h-6 text-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-400 cursor-pointer min-w-[100px] max-w-[140px] truncate transition-colors",
                        !trip.vehicleId ? "bg-amber-50 border-amber-300 text-amber-800" : "bg-white border-gray-300 hover:border-gray-400",
                        readOnly && "opacity-80 cursor-default bg-gray-100"
                      )}
                      title={trip.vehicleName || "使用車両を選択"}
                    >
                      <option value="">車両を選択...</option>
                      {availableVehicles.map((v) => {
                        const conflict = conflictingList.find((c: any) => String(c.vehicleId) === String(v.id));
                        return (
                          <option key={v.id} value={String(v.id)} disabled={Boolean(conflict)}>
                            {v.name} (定員{v.capacity}人)
                            {conflict
                              ? ` ⚠️ ${conflict.conflictStaffName}が${
                                  mode === "outbound"
                                    ? (conflict as any).conflictTime
                                    : `${(conflict as any).conflictTripIndex}便`
                                }で使用中`
                              : ""}
                          </option>
                        );
                      })}
                    </select>

                    {/* 2便目以降の削除ボタン */}
                    {(displayTrips.length > 1) && (
                      <button
                        type="button"
                        onClick={() => handleDeleteTrip(trip)}
                        disabled={readOnly}
                        className="text-gray-400 hover:text-red-600 hover:bg-red-50 p-0.5 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                        title={mode === "outbound" ? `【${tripTime}】の便を削除` : `${trip?.tripIndex || 1}便目を削除`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  
                  {/* 超過バッジ */}
                  {isOverCapacity && (
                    <div className="flex items-center gap-0.5 px-1 py-0.5 bg-red-500 rounded text-[9.5px] text-white font-bold shrink-0">
                      <AlertTriangle className="w-3 h-3" />
                      超過
                    </div>
                  )}
                  
                  {/* 定員プログレスバー / 残席カウント */}
                  <div className="flex items-center gap-1 shrink-0">
                    <div className="w-8 sm:w-10 h-1.5 bg-gray-200 rounded-full overflow-hidden shrink-0">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-300",
                          !hasVehicle ? "bg-gray-300" : isOverCapacity ? "bg-red-500" : isFull ? "bg-amber-500" : "bg-blue-500"
                        )}
                        style={{ width: `${fillPct}%` }}
                      />
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0">
                      <Users className="w-2.5 h-2.5 text-gray-400 shrink-0" />
                      <span
                        className={cn(
                          "text-[10px] font-bold font-mono shrink-0",
                          isOverCapacity ? "text-red-600" : !hasVehicle ? "text-gray-400" : "text-gray-600"
                        )}
                      >
                        {hasVehicle && capacity ? `${childCount}/${capacity}` : `${childCount}/-`}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 運行時間サマリー表示（迎え運行のみ表示、送り運行では非表示） */}
                {mode === "inbound" && timeSummary && (
                  <div className="flex items-center gap-1 px-1 text-[10px] text-gray-600">
                    <Clock className="w-3 h-3 text-gray-400 shrink-0" />
                    <span className="font-mono font-semibold">運行時間: {timeSummary}</span>
                  </div>
                )}
              </div>

              {/* Trip settings (出発地・到着地) */}
              <div className="px-2.5 pt-1 pb-1 border-b border-gray-100">
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="text-[9px] text-gray-400 block mb-0.5">出発地</label>
                    <select 
                      value={trip.startLocation || "office"} 
                      onChange={(e) => {
                        const val = e.target.value as "office" | "home";
                        updateTripLocation(mode, trip.id, "start", val);
                        onChangeLocation && onChangeLocation(mode, column.id, "start", val);
                      }}
                      className="w-full text-[11px] h-6 py-0 px-1 border border-gray-200 rounded bg-gray-50 focus:bg-white text-gray-700 disabled:opacity-60"
                      disabled={readOnly}
                    >
                      <option value="office">事業所</option>
                      <option value="home">自宅</option>
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="text-[9px] text-gray-400 block mb-0.5">到着地</label>
                    <select 
                      value={trip.endLocation || "office"} 
                      onChange={(e) => {
                        const val = e.target.value as "office" | "home";
                        updateTripLocation(mode, trip.id, "end", val);
                        onChangeLocation && onChangeLocation(mode, column.id, "end", val);
                      }}
                      className="w-full text-[11px] h-6 py-0 px-1 border border-gray-200 rounded bg-gray-50 focus:bg-white text-gray-700 disabled:opacity-60"
                      disabled={readOnly}
                    >
                      <option value="office">事業所</option>
                      <option value="home">自宅</option>
                    </select>
                  </div>
                </div>

                {(trip.routeInfo || trip.estimatedTime) && (
                  <div className="mt-1 px-1.5 py-0.5 bg-indigo-50 border border-indigo-100 rounded text-[9.5px] text-indigo-700 leading-tight">
                    <div className="font-semibold mb-0.5">📍 ルート: {renderRouteInfo(trip)}</div>
                    {trip.estimatedTime && (
                      <div className="font-semibold">⏱️ 見込み: 約{trip.estimatedTime}分</div>
                    )}
                  </div>
                )}
              </div>

              {/* Trip Drop zone (児童カード一覧) */}
              <div
                className={cn(
                  "p-1.5 min-h-[60px] max-h-[300px] overflow-y-auto overflow-x-hidden space-y-1 transition-colors duration-150 print:max-h-none print:overflow-visible"
                )}
              >
                {(trip?.children || []).map((magnet, idx) => (
                  <ChildCard 
                    key={magnet?.id || Math.random().toString()} 
                    magnet={magnet} 
                    mode={mode} 
                    className="py-1 px-2"
                    onClick={(m) => onChildClick && onChildClick(m, trip?.id || '')} 
                    showMoveUp={idx > 0}
                    showMoveDown={idx < (trip?.children || []).length - 1}
                    onMoveUp={(e) => {
                      e.stopPropagation();
                      onReorderChild && onReorderChild(trip?.id || '', magnet?.id || '', -1);
                    }}
                    onMoveDown={(e) => {
                      e.stopPropagation();
                      onReorderChild && onReorderChild(trip?.id || '', magnet?.id || '', 1);
                    }}
                  />
                ))}

                {(trip?.children || []).length === 0 && (
                  <div className="flex items-center justify-center h-12 border-2 border-dashed border-gray-200 rounded-lg text-gray-400 text-xs">
                    （未割り当て）
                  </div>
                )}
              </div>
            </div>
          );
        })}
        
        {/* Add Trip Button */}
        {(column.trips || []).length < 5 && (
          <div className="p-1.5 bg-gray-50 border-t border-gray-100">
            {mode === "outbound" ? (
              <div className="flex items-center gap-1.5">
                <select
                  value={selectedNewTripTime}
                  onChange={(e) => setSelectedNewTripTime(e.target.value)}
                  disabled={readOnly}
                  className="text-[11px] font-bold border border-gray-300 rounded px-1.5 py-0.5 bg-white text-gray-700 h-6.5 focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                  title="追加する便の時刻を選択"
                >
                  {timeOptions.map((t) => (
                    <option key={t} value={t}>
                      {t} 便
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => handleAddTrip(selectedNewTripTime)}
                  disabled={readOnly}
                  className="flex-1 py-1 flex items-center justify-center gap-1 text-[11px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-300 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-blue-50"
                >
                  <Plus className="w-3.5 h-3.5" />
                  便を追加
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => handleAddTrip()}
                disabled={readOnly}
                className="w-full py-1 flex items-center justify-center gap-1 text-[11px] font-bold text-gray-500 hover:text-gray-700 hover:bg-gray-100 border border-dashed border-gray-300 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
              >
                <Plus className="w-3 h-3" />
                便を追加
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
