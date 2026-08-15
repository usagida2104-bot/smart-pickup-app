"use client";

import { Clock, ChevronUp, ChevronDown } from "lucide-react";
import { ChildMagnet } from "@/types";
import { cn } from "@/lib/utils";

interface ChildCardProps {
  magnet: ChildMagnet;
  mode: "inbound" | "outbound";
  onClick?: (magnet: ChildMagnet) => void;
  onMoveUp?: (e: React.MouseEvent) => void;
  onMoveDown?: (e: React.MouseEvent) => void;
  showMoveUp?: boolean;
  showMoveDown?: boolean;
}

export function ChildCard({ magnet, mode, onClick, onMoveUp, onMoveDown, showMoveUp, showMoveDown }: ChildCardProps) {
  return (
    <button
      type="button"
      onClick={() => onClick && onClick(magnet)}
      data-testid={`child-card-${magnet.childId}`}
      data-child-name={magnet.name}
      className={cn(
        "w-full text-left group flex items-center gap-2 p-2.5 rounded-lg border-2 shadow-sm cursor-pointer select-none shrink-0",
        "hover:shadow-md hover:border-blue-300 transition-all duration-150",
        magnet.has_caution ? "bg-green-50 border-green-200 hover:border-green-400" : "bg-white"
      )}
    >
      {/* Color accent bar */}
      <div
        className="w-1 self-stretch rounded-full shrink-0"
        style={{ backgroundColor: magnet.color }}
      />

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
      {mode === "inbound" && (
        <div className="flex items-center gap-1 shrink-0 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-200">
          <Clock className="w-3 h-3 text-gray-400" />
          <span className="text-xs font-bold font-mono text-gray-600">{magnet.pickup_time || "-"}</span>
        </div>
      )}

      {/* Action buttons (Move up/down) */}
      {(showMoveUp || showMoveDown) && (
        <div className="flex flex-col gap-0.5 shrink-0 ml-1 border-l pl-1">
          <button 
            type="button"
            className={cn("p-1 rounded hover:bg-gray-200 transition-colors bg-gray-100", !showMoveUp && "invisible")}
            onClick={onMoveUp}
          >
            <ChevronUp className="w-4 h-4 text-gray-600" />
          </button>
          <button 
            type="button"
            className={cn("p-1 rounded hover:bg-gray-200 transition-colors bg-gray-100", !showMoveDown && "invisible")}
            onClick={onMoveDown}
          >
            <ChevronDown className="w-4 h-4 text-gray-600" />
          </button>
        </div>
      )}
    </button>
  );
}
