"use client";

import { Home } from "lucide-react";
import { ChildMagnet } from "@/types";
import { ChildCard } from "./ChildCard";
import { cn } from "@/lib/utils";

interface FamilyPickupColumnProps {
  children: ChildMagnet[];
  onChildClick: (magnet: ChildMagnet, columnId: string) => void;
}

/**
 * 「家族迎え」専用列コンポーネント（送りタブのみ表示）
 * status === "dropoff_only" の児童がデフォルトで配置される。
 * ここへの移動・ここからの移動は「移動先モーダル」経由で行う。
 */
export function FamilyPickupColumn({ children, onChildClick }: FamilyPickupColumnProps) {
  return (
    <div
      data-testid="family-pickup-column"
      className="flex flex-col w-56 shrink-0 rounded-xl border-2 border-dashed border-emerald-300 bg-emerald-50 overflow-hidden"
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-emerald-200 bg-emerald-100">
        <div className="flex items-center gap-2">
          <Home className="w-4 h-4 text-emerald-700" />
          <p className="font-bold text-emerald-800 text-sm">🏠 家族迎え</p>
        </div>
        <p className="text-xs text-emerald-600 mt-0.5">
          {children.length}名 — 保護者・自家用車
        </p>
      </div>

      {/* Children */}
      <div
        data-testid="family-pickup-pool"
        className="flex-1 p-3 min-h-[120px] max-h-[500px] overflow-y-auto overflow-x-hidden space-y-2 transition-colors"
      >
        {children.map((magnet) => (
          <ChildCard
            key={magnet.id}
            magnet={magnet}
            mode="outbound"
            onClick={(m) => onChildClick(m, "family-pickup")}
          />
        ))}
        {children.length === 0 && (
          <div className="flex items-center justify-center h-16 text-emerald-400 text-xs text-center leading-relaxed">
            保護者迎えの児童を<br />ここへ移動できます
          </div>
        )}
      </div>
    </div>
  );
}

