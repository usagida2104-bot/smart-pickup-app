"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AlertCircle, Clock, GripVertical } from "lucide-react";
import { ChildMagnet } from "@/types";
import { cn } from "@/lib/utils";

interface ChildCardProps {
  magnet: ChildMagnet;
  isDragging?: boolean;
}

export function ChildCard({ magnet, isDragging }: ChildCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: magnet.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSortableDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-testid={`child-card-${magnet.childId}`}
      data-child-name={magnet.name}
      className={cn(
        "group flex items-center gap-2 p-2.5 rounded-lg border-2 shadow-sm cursor-grab active:cursor-grabbing select-none",
        "hover:shadow-md transition-all duration-150",
        isDragging && "shadow-xl scale-105 rotate-1 z-50",
        magnet.has_caution ? "bg-green-50 border-green-200" : "bg-white"
      )}
    >
      {/* Color accent bar */}
      <div
        className="w-1 self-stretch rounded-full shrink-0"
        style={{ backgroundColor: magnet.color }}
      />

      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className="text-gray-300 hover:text-gray-500 shrink-0"
      >
        <GripVertical className="w-3.5 h-3.5" />
      </div>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-sm font-semibold text-gray-800 truncate">
            {magnet.name}
          </span>
          {magnet.status === "late" && (
            <span className="text-[10px] font-bold bg-yellow-100 text-yellow-700 px-1 py-0.5 rounded border border-yellow-200 whitespace-nowrap">
              遅刻 {magnet.status_time}
            </span>
          )}
          {magnet.status === "early_leave" && (
            <span className="text-[10px] font-bold bg-purple-50 text-purple-700 px-1 py-0.5 rounded border border-purple-200 whitespace-nowrap">
              早退 {magnet.status_time}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 mt-0.5">
          <div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: magnet.color }}
          />
          <span className="text-xs text-gray-500 truncate">{magnet.school_name}</span>
        </div>
      </div>

      {/* Pickup time badge */}
      {magnet.pickup_time && (
        <div className="flex items-center gap-0.5 shrink-0">
          <Clock className="w-3 h-3 text-gray-400" />
          <span className="text-xs font-mono text-gray-600">{magnet.pickup_time}</span>
        </div>
      )}
    </div>
  );
}

/** ドラッグ中のオーバーレイ表示用 */
export function ChildCardOverlay({ magnet }: { magnet: ChildMagnet }) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 p-2.5 rounded-lg border-2 shadow-2xl rotate-2 scale-105",
        magnet.has_caution ? "bg-green-50 border-green-300" : "bg-white"
      )}
      style={{ borderColor: magnet.has_caution ? undefined : magnet.color }}
    >
      <div
        className="w-1 self-stretch rounded-full shrink-0"
        style={{ backgroundColor: magnet.color }}
      />
      <div className="flex-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-sm font-semibold text-gray-800">{magnet.name}</span>
          {magnet.status === "late" && (
            <span className="text-[10px] font-bold bg-yellow-100 text-yellow-700 px-1 py-0.5 rounded border border-yellow-200 whitespace-nowrap">
              遅刻 {magnet.status_time}
            </span>
          )}
          {magnet.status === "early_leave" && (
            <span className="text-[10px] font-bold bg-purple-50 text-purple-700 px-1 py-0.5 rounded border border-purple-200 whitespace-nowrap">
              早退 {magnet.status_time}
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500">{magnet.school_name}</p>
      </div>
      {magnet.pickup_time && (
        <div className="flex items-center gap-0.5 shrink-0">
          <Clock className="w-3 h-3 text-gray-400" />
          <span className="text-xs font-mono text-gray-600">{magnet.pickup_time}</span>
        </div>
      )}
    </div>
  );
}
