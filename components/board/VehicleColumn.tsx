"use client";


import { AlertTriangle, Car, Users } from "lucide-react";
import { VehicleColumn as VehicleColumnType, ChildMagnet } from "@/types";
import { ChildCard } from "./ChildCard";
import { cn } from "@/lib/utils";
import { useBoardStore } from "@/lib/store/boardStore";

interface VehicleColumnProps {
  column: VehicleColumnType;
  mode: "inbound" | "outbound";
  onChildClick?: (magnet: ChildMagnet, columnId: string) => void;
  onReorderChild?: (columnId: string, childId: string, direction: -1 | 1) => void;
}

export function VehicleColumn({ column, mode, onChildClick, onReorderChild }: VehicleColumnProps) {
  const isOverCapacity = column.children.length > column.capacity;
  const isFull = column.children.length >= column.capacity;
  const fillPct = Math.min((column.children.length / column.capacity) * 100, 100);
  const updateColumnLocation = useBoardStore((state) => state.updateColumnLocation);

  const renderRouteInfo = () => {
    let route = column.routeInfo || "未設定";
    if (column.endLocation === "home" && mode === "outbound") {
      if (!route.includes("🏁")) {
        route += " → 🏁 ドライバー自宅（直帰）";
      }
    }
    return route;
  };

  return (
    <div
      data-testid={`vehicle-column-${column.vehicleId}`}
      data-vehicle-name={column.vehicleName}
      data-capacity={column.capacity}
      data-count={column.children.length}
      className={cn(
        "vehicle-column flex flex-col w-64 shrink-0 rounded-xl border-2 overflow-hidden transition-all duration-200 print:w-auto print:flex-1 print:border-gray-300 print:shadow-none print:break-inside-avoid",
        isOverCapacity
          ? "border-red-400 bg-red-50 shadow-lg shadow-red-200"
          : "border-gray-200 bg-white shadow-sm"
      )}
    >
      {/* Column header */}
      <div
        className={cn(
          "px-4 py-3 border-b",
          isOverCapacity ? "border-red-200 bg-red-100" : "border-gray-100 bg-gray-50"
        )}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Car className="w-4 h-4 text-gray-600" />
            <span className="font-bold text-gray-800 text-sm">{column.vehicleName}</span>
          </div>
          {isOverCapacity && (
            <div className="flex items-center gap-1 px-2 py-0.5 bg-red-500 rounded-full">
              <AlertTriangle className="w-3 h-3 text-white" />
              <span className="text-xs text-white font-bold">定員超過</span>
            </div>
          )}
        </div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1">
            <p className="text-xs text-gray-500 font-medium">🚗 {column.driverName}</p>
            {column.driverStatus === "late" && (
              <span className="text-[10px] font-bold bg-yellow-100 text-yellow-700 px-1 py-0.5 rounded">
                遅刻 {column.driverStatusTime}
              </span>
            )}
            {column.driverStatus === "early_leave" && (
              <span className="text-[10px] font-bold bg-purple-50 text-purple-700 px-1 py-0.5 rounded border border-purple-200">
                早退 {column.driverStatusTime}
              </span>
            )}
          </div>
        </div>

        <div className="flex gap-2 mb-3">
          <div className="flex-1">
            <label className="text-[10px] text-gray-500 block mb-0.5">出発地</label>
            <select 
              value={column.startLocation || "office"} 
              onChange={(e) => updateColumnLocation(mode, column.id, "start", e.target.value as "office" | "home")}
              className="w-full text-xs border-gray-200 rounded px-1 py-0.5 bg-white"
            >
              <option value="office">事業所</option>
              <option value="home">自宅</option>
            </select>
          </div>
          <div className="flex-1">
            <label className="text-[10px] text-gray-500 block mb-0.5">到着地</label>
            <select 
              value={column.endLocation || "office"} 
              onChange={(e) => updateColumnLocation(mode, column.id, "end", e.target.value as "office" | "home")}
              className="w-full text-xs border-gray-200 rounded px-1 py-0.5 bg-white"
            >
              <option value="office">事業所</option>
              <option value="home">自宅</option>
            </select>
          </div>
        </div>
        
        {(column.routeInfo || column.estimatedTime) && (
          <div className="mb-3 px-2 py-1.5 bg-indigo-50 border border-indigo-100 rounded text-[11px] text-indigo-700 leading-tight">
            <div className="font-semibold mb-0.5">📍 想定ルート:</div>
            <div className="mb-1">{renderRouteInfo()}</div>
            {column.estimatedTime && (
              <div className="flex items-center gap-1 font-semibold">
                <span>⏱️ 見込み:</span>
                <span>約 {column.estimatedTime} 分</span>
              </div>
            )}
          </div>
        )}

        {/* Capacity bar */}
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-300",
                isOverCapacity ? "bg-red-500" : isFull ? "bg-amber-500" : "bg-blue-500"
              )}
              style={{ width: `${fillPct}%` }}
            />
          </div>
          <div className="flex items-center gap-0.5 shrink-0">
            <Users className="w-3 h-3 text-gray-400" />
            <span
              className={cn(
                "text-xs font-semibold",
                isOverCapacity ? "text-red-600" : "text-gray-600"
              )}
            >
              {column.children.length}/{column.capacity}
            </span>
          </div>
        </div>
      </div>

      {/* Drop zone / List */}
      <div
        className={cn(
          "flex-1 p-3 min-h-[160px] max-h-[450px] overflow-y-auto overflow-x-hidden space-y-2 transition-colors duration-150 print:max-h-none print:overflow-visible"
        )}
      >
        {column.children.map((magnet, idx) => (
          <ChildCard 
            key={magnet.id} 
            magnet={magnet} 
            mode={mode} 
            onClick={(m) => onChildClick && onChildClick(m, column.id)} 
            showMoveUp={idx > 0}
            showMoveDown={idx < column.children.length - 1}
            onMoveUp={(e) => {
              e.stopPropagation();
              onReorderChild && onReorderChild(column.id, magnet.id, -1);
            }}
            onMoveDown={(e) => {
              e.stopPropagation();
              onReorderChild && onReorderChild(column.id, magnet.id, 1);
            }}
          />
        ))}

        {column.children.length === 0 && (
          <div className="flex items-center justify-center h-24 border-2 border-dashed border-gray-200 rounded-lg text-gray-400 text-sm">
            （未割り当て）
          </div>
        )}
      </div>
    </div>
  );
}
