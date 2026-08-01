"use client";

import { useEffect, useState } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { Sparkles, RotateCcw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { VehicleColumn } from "@/components/board/VehicleColumn";
import { ChildCard, ChildCardOverlay } from "@/components/board/ChildCard";
import { useBoardStore } from "@/lib/store/boardStore";
import { autoAssignVehicles } from "@/lib/autoAssignVehicles";
import { MOCK_DAILY_ATTENDANCE, MOCK_DAILY_SHIFTS } from "@/lib/mockData";
import { ChildMagnet, VehicleColumn as VehicleColumnType } from "@/types";

function UnassignedPool({ children }: { children: ChildMagnet[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: "unassigned" });

  return (
    <div
      data-testid="unassigned-column"
      className="flex flex-col w-64 shrink-0 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 overflow-hidden"
    >
      <div className="px-4 py-3 border-b border-gray-200 bg-gray-100">
        <p className="font-bold text-gray-600 text-sm">📋 未割り当て</p>
        <p className="text-xs text-gray-400 mt-0.5">{children.length}名</p>
      </div>
      <div
        ref={setNodeRef}
        data-testid="unassigned-pool"
        className={`flex-1 p-3 min-h-[160px] space-y-2 transition-colors ${
          isOver ? "bg-gray-100" : ""
        }`}
      >
        <SortableContext
          items={children.map((c) => c.id)}
          strategy={verticalListSortingStrategy}
        >
          {children.map((magnet) => (
            <ChildCard key={magnet.id} magnet={magnet} />
          ))}
        </SortableContext>
        {children.length === 0 && (
          <div className="flex items-center justify-center h-24 text-gray-400 text-sm">
            全員が配車済みです 🎉
          </div>
        )}
      </div>
    </div>
  );
}

export default function BoardPage() {
  const { board, setBoard, moveChild } = useBoardStore();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeMagnet, setActiveMagnet] = useState<ChildMagnet | null>(null);
  const [isAutoAssigned, setIsAutoAssigned] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

  // Find which column contains a child
  const findColumnId = (childId: string): string => {
    if (board.unassigned.children.some((c) => c.id === childId)) {
      return "unassigned";
    }
    const col = board.columns.find((c) => c.children.some((ch) => ch.id === childId));
    return col?.id ?? "unassigned";
  };

  const findMagnet = (id: string): ChildMagnet | undefined => {
    const fromUnassigned = board.unassigned.children.find((c) => c.id === id);
    if (fromUnassigned) return fromUnassigned;
    for (const col of board.columns) {
      const found = col.children.find((c) => c.id === id);
      if (found) return found;
    }
    return undefined;
  };

  const handleAutoAssign = () => {
    const result = autoAssignVehicles({
      attendances: MOCK_DAILY_ATTENDANCE,
      shifts: MOCK_DAILY_SHIFTS,
    });
    setBoard({
      columns: result.columns,
      unassigned: { id: "unassigned", children: result.unassigned },
    });
    setIsAutoAssigned(true);
  };

  const handleReset = () => {
    setBoard({
      columns: MOCK_DAILY_SHIFTS.map((shift) => ({
        id: shift.id,
        shiftId: shift.id,
        vehicleId: shift.vehicle_id,
        vehicleName: shift.vehicle?.name ?? "不明",
        driverName: shift.driver?.name ?? "不明",
        capacity: shift.vehicle?.capacity ?? 0,
        children: [],
      })),
      unassigned: { id: "unassigned", children: [] },
    });
    setIsAutoAssigned(false);
  };

  // 車両カラムの初期値: MOCK_DAILY_SHIFTSから即時構築（カラムは常に表示）
  const initialColumns = MOCK_DAILY_SHIFTS.map((shift) => ({
    id: shift.id,
    shiftId: shift.id,
    vehicleId: shift.vehicle_id,
    vehicleName: shift.vehicle?.name ?? "不明",
    driverName: shift.driver?.name ?? "不明",
    capacity: shift.vehicle?.capacity ?? 0,
    children: [] as ChildMagnet[],
  }));

  // ボード表示用カラム: Zustandが空ならMOCK初期値を使用
  const displayColumns = board.columns.length > 0 ? board.columns : initialColumns;

  // Initialize board on mount — 自動配車を実行
  useEffect(() => {
    if (board.columns.length === 0) {
      handleAutoAssign();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    setActiveId(active.id as string);
    setActiveMagnet(findMagnet(active.id as string) ?? null);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const fromColumnId = findColumnId(activeId);
    let toColumnId = overId;

    // If dropping over a child card, find its column
    const overMagnet = findMagnet(overId);
    if (overMagnet) {
      toColumnId = findColumnId(overId);
    }

    if (fromColumnId === toColumnId) return;

    moveChild(activeId, fromColumnId, toColumnId);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setActiveMagnet(null);

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const fromColumnId = findColumnId(activeId);

    // Check if dropped on a child in the same column for reordering
    const overMagnet = findMagnet(overId);
    if (overMagnet) {
      const toColumnId = findColumnId(overId);
      if (fromColumnId === toColumnId) {
        // Reorder within same column
        const newBoard = { ...board };
        if (fromColumnId === "unassigned") {
          const items = [...board.unassigned.children];
          const fromIdx = items.findIndex((c) => c.id === activeId);
          const toIdx = items.findIndex((c) => c.id === overId);
          newBoard.unassigned = {
            ...board.unassigned,
            children: arrayMove(items, fromIdx, toIdx),
          };
        } else {
          newBoard.columns = board.columns.map((col) => {
            if (col.id !== fromColumnId) return col;
            const items = [...col.children];
            const fromIdx = items.findIndex((c) => c.id === activeId);
            const toIdx = items.findIndex((c) => c.id === overId);
            return { ...col, children: arrayMove(items, fromIdx, toIdx) };
          });
        }
        setBoard(newBoard);
      }
    }
  };

  const today = new Date().toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });

  const totalPresent = displayColumns.reduce(
    (sum, col) => sum + col.children.length,
    0
  ) + board.unassigned.children.length;

  const overCapacityCols = displayColumns.filter(
    (col) => col.children.length > col.capacity
  );

  return (
    <div className="p-6 h-[calc(100vh-4rem)] flex flex-col">
      {/* Page header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">送迎ボード</h1>
          <p className="text-sm text-gray-500">{today} — 出席 {totalPresent}名</p>
        </div>
        <div className="flex items-center gap-3">
          {overCapacityCols.length > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-sm font-medium">
              ⚠️ {overCapacityCols.length}台が定員超過
            </div>
          )}
          <Button variant="outline" size="sm" onClick={handleReset} className="gap-2">
            <RotateCcw className="w-4 h-4" />
            リセット
          </Button>
          <Button size="sm" onClick={handleAutoAssign} className="gap-2 bg-indigo-600 hover:bg-indigo-700">
            <Sparkles className="w-4 h-4" />
            自動配車
          </Button>
          <Button size="sm" variant="outline" className="gap-2">
            <Save className="w-4 h-4" />
            保存
          </Button>
        </div>
      </div>

      {/* Auto-assign banner */}
      {isAutoAssigned && (
        <div className="mb-4 px-4 py-2.5 bg-indigo-50 border border-indigo-200 rounded-lg text-sm text-indigo-700">
          ✨ 自動配車が完了しました。マグネットをドラッグして手動調整できます。
        </div>
      )}

      {/* Board */}
      <div className="flex-1 overflow-x-auto">
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 h-full pb-4">
            {/* Unassigned pool */}
            <UnassignedPool children={board.unassigned.children} />

            {/* Vehicle columns */}
            {displayColumns.map((col) => (
              <VehicleColumn key={col.id} column={col} />
            ))}
          </div>

          {/* Drag overlay */}
          <DragOverlay>
            {activeMagnet ? <ChildCardOverlay magnet={activeMagnet} /> : null}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Legend */}
      <div className="mt-3 flex items-center gap-6 text-xs text-gray-500 border-t border-gray-200 pt-3">
        <span className="font-medium">凡例:</span>
        <span className="flex items-center gap-1.5">
          <div className="w-3 h-3 bg-blue-500 rounded-full" /> 通常
        </span>
        <span className="flex items-center gap-1.5">
          <div className="w-3 h-3 bg-amber-500 rounded-full" /> 満員
        </span>
        <span className="flex items-center gap-1.5">
          <div className="w-3 h-3 bg-red-500 rounded-full" /> 定員超過
        </span>
        <span className="flex items-center gap-1.5">
          ❤️ 配慮事項あり
        </span>
      </div>
    </div>
  );
}
