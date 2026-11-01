"use client";

import { Home } from "lucide-react";
import { ChildMagnet } from "@/types";
import { ChildCard } from "./ChildCard";
import { cn } from "@/lib/utils";

interface FamilyPickupColumnProps {
  children: ChildMagnet[];
  mode?: "inbound" | "outbound";
  onChildClick?: (magnet: ChildMagnet, columnId: string) => void;
  className?: string;
}

/**
 * 「家族迎え／家族送迎」専用列コンポーネント
 * 送迎不要・家族送迎の児童が自動的に配置され、誤移動を防ぐためロックされる。
 */
export function FamilyPickupColumn({ children, mode = "outbound", onChildClick, className }: FamilyPickupColumnProps) {
  const isOutbound = mode === "outbound";
  const title = isOutbound ? "🏠 家族迎え" : "🏠 家族送迎（迎えなし）";
  const subtitle = isOutbound 
    ? `${children.length}名 — 保護者・自家用車` 
    : `${children.length}名 — 保護者来所・自力`;

  return (
    <div
      data-testid="family-pickup-column"
      className={cn(
        "flex flex-col rounded-xl border-2 border-dashed border-emerald-300 bg-emerald-50/70 overflow-hidden min-w-0 shadow-none",
        className || "w-56 shrink-0"
      )}
    >
      {/* Header */}
      <div className="px-3 py-2 border-b border-emerald-200 bg-emerald-100/80">
        <div className="flex items-center gap-1.5">
          <Home className="w-4 h-4 text-emerald-700 shrink-0" />
          <p className="font-bold text-emerald-900 text-sm truncate">{title}</p>
        </div>
        <p className="text-xs text-emerald-700 mt-0.5 truncate">
          {subtitle}
        </p>
      </div>

      {/* Children */}
      <div
        data-testid="family-pickup-pool"
        className="flex-1 p-2 md:p-3 min-h-[120px] overflow-y-auto overflow-x-hidden space-y-1.5 md:space-y-2 transition-colors"
      >
        {children.map((magnet) => (
          <ChildCard
            key={magnet.id}
            magnet={magnet}
            mode={mode}
            isLocked={true}
          />
        ))}
        {children.length === 0 && (
          <div className="flex items-center justify-center h-16 text-emerald-600/70 text-xs text-center leading-relaxed">
            {isOutbound ? "送迎不要（家族迎え）の児童が\nここに自動配置されます" : "送迎不要（保護者来所等）の児童が\nここに自動配置されます"}
          </div>
        )}
      </div>
    </div>
  );
}
