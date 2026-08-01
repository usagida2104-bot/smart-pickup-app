"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { AlertTriangle, Car, Users } from "lucide-react";
import { VehicleColumn as VehicleColumnType } from "@/types";
import { ChildCard } from "./ChildCard";
import { cn } from "@/lib/utils";

interface VehicleColumnProps {
  column: VehicleColumnType;
}

export function VehicleColumn({ column }: VehicleColumnProps) {
  const isOverCapacity = column.children.length > column.capacity;
  const isFull = column.children.length >= column.capacity;
  const fillPct = Math.min((column.children.length / column.capacity) * 100, 100);

  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  return (
    <div
      data-testid={`vehicle-column-${column.vehicleId}`}
      data-vehicle-name={column.vehicleName}
      data-capacity={column.capacity}
      data-count={column.children.length}
      className={cn(
        "flex flex-col w-64 shrink-0 rounded-xl border-2 overflow-hidden transition-all duration-200",
        isOverCapacity
          ? "border-red-400 bg-red-50 shadow-lg shadow-red-200"
          : isOver
          ? "border-blue-400 bg-blue-50 shadow-lg shadow-blue-200"
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
        <p className="text-xs text-gray-500 mb-2">🚗 {column.driverName}</p>

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

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        data-testid={`drop-zone-${column.vehicleId}`}
        className={cn(
          "flex-1 p-3 min-h-[160px] space-y-2 transition-colors duration-150",
          isOver && "bg-blue-50/60"
        )}
      >
        <SortableContext
          items={column.children.map((c) => c.id)}
          strategy={verticalListSortingStrategy}
        >
          {column.children.map((magnet) => (
            <ChildCard key={magnet.id} magnet={magnet} />
          ))}
        </SortableContext>

        {column.children.length === 0 && (
          <div className="flex items-center justify-center h-24 border-2 border-dashed border-gray-200 rounded-lg text-gray-400 text-sm">
            ここにドロップ
          </div>
        )}
      </div>
    </div>
  );
}
