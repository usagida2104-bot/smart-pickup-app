"use client";

import { AlertTriangle, Car, Users, Plus, Trash2 } from "lucide-react";
import { VehicleColumn as VehicleColumnType, ChildMagnet, Trip } from "@/types";
import { ChildCard } from "./ChildCard";
import { cn } from "@/lib/utils";
import { useBoardStore } from "@/lib/store/boardStore";

interface VehicleColumnProps {
  column: VehicleColumnType;
  mode: "inbound" | "outbound";
  onChildClick?: (magnet: ChildMagnet, columnId: string) => void;
  onReorderChild?: (columnId: string, childId: string, direction: -1 | 1) => void;
  onChangeLocation?: (mode: "inbound" | "outbound", columnId: string, type: "start" | "end", val: "office" | "home") => void;
  onDeleteTrip?: () => void;
  readOnly?: boolean;
  className?: string;
}

export function VehicleColumn({ column, mode, onChildClick, onReorderChild, onChangeLocation, onDeleteTrip, readOnly = false, className }: VehicleColumnProps) {
  const updateTripLocation = useBoardStore((state) => state.updateTripLocation);
  const addTrip = useBoardStore((state) => state.addTrip);
  const removeTrip = useBoardStore((state) => state.removeTrip);
  
  const handleAddTrip = () => {
    if (readOnly) return;
    addTrip(mode, column.id);
    onChangeLocation && onChangeLocation(mode, column.id, "start", "office");
  };

  const handleDeleteTrip = (trip: Trip) => {
    if (readOnly) return;
    const childCount = (trip?.children || []).length;
    if (childCount > 0) {
      const ok = window.confirm(
        `この便に乗っている児童（${childCount}名）を未割り当てに戻して、${trip.tripIndex}便目を削除しますか？`
      );
      if (!ok) return;
    }
    removeTrip(mode, column.id, trip.id);
    onDeleteTrip && onDeleteTrip();
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

  return (
    <div
      data-testid={`vehicle-column-${column.vehicleId}`}
      data-vehicle-name={column.vehicleName}
      data-capacity={column.capacity}
      data-count={totalChildrenCount}
      className={cn(
        "vehicle-column flex flex-col rounded-xl border-2 overflow-hidden transition-all duration-200 print:w-auto print:flex-1 print:border-gray-300 print:shadow-none print:break-inside-avoid border-gray-200 bg-white shadow-sm min-w-0",
        className || "w-64 shrink-0"
      )}
    >
      {/* Column Header (Global for Vehicle) */}
      <div className="px-3 py-2 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-1.5">
            <Car className="w-3.5 h-3.5 text-gray-600" />
            <span className="font-bold text-gray-800 text-sm">{column.vehicleName}</span>
          </div>
          <div className="flex items-center gap-1">
            <p className="text-[11px] text-gray-500 font-medium">🚗 {column.driverName}</p>
            {column.driverStatus === "late" && (
              <span className="text-[9px] font-bold bg-yellow-100 text-yellow-700 px-1 py-0.2 rounded">
                遅刻 {column.driverStatusTime}
              </span>
            )}
            {column.driverStatus === "early_leave" && (
              <span className="text-[9px] font-bold bg-purple-50 text-purple-700 px-1 py-0.2 rounded border border-purple-200">
                早退 {column.driverStatusTime}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Trips Container */}
      <div className="flex flex-col flex-1 bg-gray-50 divide-y divide-gray-200 min-h-min overflow-y-auto">
        {(column?.trips || [])
          .filter(trip => trip?.tripIndex === 1 || (trip?.children || []).length > 0 || trip?.isNew)
          .map((trip) => {
          const capacity = column?.capacity || 99;
          const isOverCapacity = (trip?.children || []).length > capacity;
          const isFull = (trip?.children || []).length >= capacity;
          const fillPct = Math.min(((trip?.children || []).length / capacity) * 100, 100);
          
          return (
            <div key={trip?.id || Math.random().toString()} className={cn("flex flex-col", isOverCapacity ? "bg-red-50" : "bg-white")}>
              {/* Trip Header */}
              <div className="w-full px-2 py-1 border-b border-gray-100 flex items-center justify-between gap-1 overflow-hidden">
                <div className="flex items-center gap-1 shrink-0">
                  <span className="font-bold text-[11px] text-gray-600 bg-gray-200 px-1.5 py-0.2 rounded-full shrink-0">
                    {trip?.tripIndex || 1}便目
                  </span>
                  {/* 1便目は削除不可、2便目以降（かつ全体の便数が2便以上）のみ削除ボタンを表示 */}
                  {(trip?.tripIndex > 1 || (column?.trips || []).length > 1) && trip?.tripIndex !== 1 && (
                    <button
                      type="button"
                      onClick={() => handleDeleteTrip(trip)}
                      disabled={readOnly}
                      className="text-gray-400 hover:text-red-600 hover:bg-red-50 p-0.5 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                      title={`${trip?.tripIndex || 1}便目を削除`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                
                {isOverCapacity && (
                  <div className="flex items-center gap-1 px-1.5 py-0.5 bg-red-500 rounded text-[10px] text-white font-bold shrink-0">
                    <AlertTriangle className="w-3 h-3" />
                    超過
                  </div>
                )}
                
                <div className="flex items-center gap-1.5 shrink-0">
                  <div className="w-12 sm:w-14 h-1.5 bg-gray-200 rounded-full overflow-hidden shrink-0">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-300",
                        isOverCapacity ? "bg-red-500" : isFull ? "bg-amber-500" : "bg-blue-500"
                      )}
                      style={{ width: `${fillPct}%` }}
                    />
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <Users className="w-3 h-3 text-gray-400 shrink-0" />
                    <span
                      className={cn(
                        "text-[10px] font-bold font-mono shrink-0",
                        isOverCapacity ? "text-red-600" : "text-gray-600"
                      )}
                    >
                      {(trip.children || []).length}/{column.capacity}
                    </span>
                  </div>
                </div>
              </div>

              {/* Trip settings */}
              <div className="px-2 pt-1 pb-0.5">
                <div className="flex gap-1.5 mb-1">
                  <div className="flex-1">
                    <label className="text-[9px] text-gray-500 block mb-0.5">出発地</label>
                    <select 
                      value={trip.startLocation || "office"} 
                      onChange={(e) => {
                        const val = e.target.value as "office" | "home";
                        updateTripLocation(mode, trip.id, "start", val);
                        onChangeLocation && onChangeLocation(mode, column.id, "start", val);
                      }}
                      className="w-full text-xs h-7 py-0.5 px-1 border-gray-200 rounded bg-gray-50 disabled:opacity-60"
                      disabled={readOnly}
                    >
                      <option value="office">事業所</option>
                      <option value="home">自宅</option>
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="text-[9px] text-gray-500 block mb-0.5">到着地</label>
                    <select 
                      value={trip.endLocation || "office"} 
                      onChange={(e) => {
                        const val = e.target.value as "office" | "home";
                        updateTripLocation(mode, trip.id, "end", val);
                        onChangeLocation && onChangeLocation(mode, column.id, "end", val);
                      }}
                      className="w-full text-xs h-7 py-0.5 px-1 border-gray-200 rounded bg-gray-50 disabled:opacity-60"
                      disabled={readOnly}
                    >
                      <option value="office">事業所</option>
                      <option value="home">自宅</option>
                    </select>
                  </div>
                </div>

                {(trip.routeInfo || trip.estimatedTime) && (
                  <div className="mb-1 px-2 py-1 bg-indigo-50 border border-indigo-100 rounded text-[9.5px] text-indigo-700 leading-tight">
                    <div className="font-semibold mb-0.5">📍 ルート:</div>
                    <div className="mb-0.5">{renderRouteInfo(trip)}</div>
                    {trip.estimatedTime && (
                      <div className="flex items-center gap-1 font-semibold">
                        <span>⏱️ 見込み:約 {trip.estimatedTime} 分</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Trip Drop zone */}
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
        {(column.trips || []).length < 4 && (
          <div className="p-1.5 bg-gray-50">
            <button
              onClick={handleAddTrip}
              disabled={readOnly}
              className="w-full py-1 flex items-center justify-center gap-1 text-[11px] font-bold text-gray-500 hover:text-gray-700 hover:bg-gray-100 border border-dashed border-gray-300 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
            >
              <Plus className="w-3 h-3" />
              便を追加
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
