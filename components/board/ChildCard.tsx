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
  actionSlot?: React.ReactNode;
  className?: string;
}

export function ChildCard({ magnet, mode, onClick, onMoveUp, onMoveDown, showMoveUp, showMoveDown, actionSlot, className }: ChildCardProps) {
  return (
    <div
      data-testid={`child-card-${magnet.childId}`}
      data-child-name={magnet.name}
      className={cn(
        "w-full text-left group flex items-center justify-between gap-1 py-1.5 px-2 rounded-md sm:rounded-lg border shadow-sm shrink-0 overflow-hidden",
        "hover:shadow-md hover:border-blue-300 transition-all duration-150 relative",
        magnet.has_caution ? "bg-green-50 border-green-200 hover:border-green-400" : "bg-white",
        onClick ? "cursor-pointer" : "",
        className
      )}
    >
      {/* 領域全体をクリック可能にする（actionSlot を避けるため position を調整） */}
      {onClick && (
        <div 
          className="absolute inset-0 z-0" 
          onClick={() => onClick(magnet)} 
          role="button"
          tabIndex={0}
        />
      )}
      {/* Color accent bar */}
      <div
        className="w-1 self-stretch rounded-full shrink-0 mr-0.5"
        style={{ backgroundColor: magnet.color }}
      />

      {/* 左側: 児童名と学校名 (余白に応じて柔軟に伸縮) */}
      <div className="min-w-0 flex-1 mr-1 py-0">
        <div className="flex items-center gap-1 min-w-0">
          <span className="text-xs sm:text-[13px] font-bold text-gray-900 truncate leading-snug">
            {magnet.name}
          </span>
          {magnet.transportMode === "no_transport" && (
            <span className="text-[9px] font-bold bg-gray-100 text-gray-600 px-1 py-0.2 rounded border border-gray-300 whitespace-nowrap shrink-0">
              送迎なし
            </span>
          )}
          {magnet.status === "late" && (
            <span className="text-[9px] font-bold bg-yellow-100 text-yellow-700 px-1 py-0.2 rounded border border-yellow-200 whitespace-nowrap shrink-0">
              遅刻 {magnet.status_time}
            </span>
          )}
          {magnet.status === "early_leave" && (
            <span className="text-[9px] font-bold bg-purple-50 text-purple-700 px-1 py-0.2 rounded border border-purple-200 whitespace-nowrap shrink-0">
              早退 {magnet.status_time}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 text-[10px] sm:text-[10.5px] text-gray-500 truncate leading-none">
          <div
            className="w-1.5 h-1.5 rounded-full shrink-0"
            style={{ backgroundColor: magnet.color }}
          />
          <span className="truncate">{magnet.school_name}</span>
        </div>
      </div>

      {/* 右側: 時間バッジ ＋ 並び順ボタン ＋ actionSlot (幅を固定して折り返し・見切れ防止) */}
      <div className="flex items-center gap-1 shrink-0">
        <span className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded bg-gray-100 text-[11px] font-mono font-medium text-gray-700 whitespace-nowrap shrink-0 border border-gray-200">
          <Clock className="w-2.5 h-2.5 text-gray-400 shrink-0" />
          {magnet.pickup_time && typeof magnet.pickup_time === "string" && magnet.pickup_time.trim() !== ""
            ? magnet.pickup_time.slice(0, 5)
            : "-"}
        </span>

        {/* Action buttons (Move up/down - compact) */}
        {(showMoveUp || showMoveDown) && (
          <div className="flex flex-col gap-0.5 shrink-0 border-l pl-0.5">
            <button 
              type="button"
              className={cn("w-4 h-3 flex items-center justify-center p-0 rounded hover:bg-gray-200 transition-colors bg-gray-100", !showMoveUp && "invisible")}
              onClick={onMoveUp}
            >
              <ChevronUp className="w-3 h-3 text-gray-600" />
            </button>
            <button 
              type="button"
              className={cn("w-4 h-3 flex items-center justify-center p-0 rounded hover:bg-gray-200 transition-colors bg-gray-100", !showMoveDown && "invisible")}
              onClick={onMoveDown}
            >
              <ChevronDown className="w-3 h-3 text-gray-600" />
            </button>
          </div>
        )}

        {/* actionSlot */}
        {actionSlot && (
          <div className="z-10 ml-0.5 shrink-0">
            {actionSlot}
          </div>
        )}
      </div>
    </div>
  );
}
