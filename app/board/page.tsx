"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowUp, ArrowDown, ChevronLeft, ChevronRight, CalendarIcon, Sparkles, RotateCcw, Save, Printer, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DateSelector } from "@/components/ui/date-selector";
import { VehicleColumn } from "@/components/board/VehicleColumn";
import { ChildCard } from "@/components/board/ChildCard";
import { useBoardStore } from "@/lib/store/boardStore";
import { autoAssignVehicles } from "@/lib/autoAssignVehicles";
import { MOCK_WHITEBOARD_STATE, toMagnet, MOCK_STAFF, OFFICE_ADDRESS } from "@/lib/mockData";
import { useMasterStore } from "@/lib/store/masterStore";
import { ChildMagnet, VehicleColumn as VehicleColumnType, DailyAttendance, DailyStaff, DailyVehicle } from "@/types";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase/client";
import { fetchDailyData, saveBoardState } from "@/lib/supabase/service";

function formatDate(date: Date) {
  return date.toISOString().split("T")[0];
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function UnassignedPool({ children, mode, onChildClick }: { children: ChildMagnet[], mode: "inbound" | "outbound", onChildClick: (magnet: ChildMagnet, columnId: string) => void }) {
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
        data-testid="unassigned-pool"
        className="flex-1 p-3 min-h-[160px] max-h-[450px] overflow-y-auto overflow-x-hidden space-y-2 transition-colors"
      >
        {children.map((magnet) => (
          <ChildCard key={magnet.id} magnet={magnet} mode={mode} onClick={(m) => onChildClick(m, "unassigned")} />
        ))}
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
  const { inboundBoard, outboundBoard, setBoard, moveChild, reorderChild } = useBoardStore();
  const { staff, vehicles, children, attendances } = useMasterStore();
  const [activeTab, setActiveTab] = useState<"inbound" | "outbound">("inbound");
  const [selectedChild, setSelectedChild] = useState<{ magnet: ChildMagnet, columnId: string } | null>(null);
  const [isAutoAssigned, setIsAutoAssigned] = useState(false);
  const [isAutoAssigning, setIsAutoAssigning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [dailyStaff, setDailyStaff] = useState<any[]>([]);
  const [dailyVehicles, setDailyVehicles] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const board = activeTab === "inbound" ? inboundBoard : outboundBoard;

  // 本日の稼働シフトを日別設定から動的に構築
  const dynamicShifts = dailyStaff
    .filter((ds) => ds.staff?.is_driver && ds.staff?.assignedVehicleId && ds.status !== "absent")
    .map((ds) => {
      const v = dailyVehicles.find((dv) => dv.vehicle_id === ds.staff?.assignedVehicleId);
      return {
        id: `shift-${ds.staff_id}`,
        target_date: formatDate(selectedDate),
        vehicle_id: ds.staff!.assignedVehicleId!,
        driver_id: ds.staff_id,
        vehicle: v?.vehicle,
        driver: ds.staff,
        is_active: v?.is_active ?? true,
      };
    })
    .filter((shift) => shift.vehicle && shift.is_active);

  const handleChildClick = (magnet: ChildMagnet, columnId: string) => {
    setSelectedChild({ magnet, columnId });
  };

  const handleAssignTo = (targetColumnId: string) => {
    if (!selectedChild) return;
    if (selectedChild.columnId !== targetColumnId) {
      moveChild(activeTab, selectedChild.magnet.id, selectedChild.columnId, targetColumnId);
    }
    setSelectedChild(null);
  };

  const handleReorder = (direction: -1 | 1) => {
    if (!selectedChild) return;
    if (selectedChild.columnId === "unassigned") return;
    reorderChild(activeTab, selectedChild.columnId, selectedChild.magnet.id, direction);
  };

  const handleAutoAssign = async () => {
    setIsAutoAssigning(true);
    try {
      // 各車両の出発地・到着地を計算
      const shiftsWithLocation = dynamicShifts.map(shift => {
        const col = board.columns.find(c => c.shiftId === shift.id);
        const driver = staff.find(s => s.id === shift.driver_id);
        
        let startAddress = OFFICE_ADDRESS;
        if (col?.startLocation === "home" && driver?.homeAddress) {
          startAddress = driver.homeAddress;
        }

        let endAddress = OFFICE_ADDRESS;
        if (col?.endLocation === "home" && driver?.homeAddress) {
          endAddress = driver.homeAddress;
        }

        return { ...shift, startAddress, endAddress };
      });

      // 現在ボード上（カラム＋未割り当て）にいる児童を対象とする
      const allChildrenOnBoard = [
        ...board.unassigned.children,
        ...board.columns.flatMap(c => c.children)
      ];

      const currentAttendances = allChildrenOnBoard.map(c => ({
        child_id: c.id,
        status: c.transportMode,
        pickup_time: c.pickup_time,
        child: children.find(masterC => masterC.id === c.id)
      }));

      if (currentAttendances.length === 0) {
        setIsAutoAssigning(false);
        return;
      }

      const res = await fetch("/api/auto-assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: activeTab,
          attendances: currentAttendances,
          shifts: shiftsWithLocation,
        }),
      });

      let data: any;
      try {
        data = await res.json();
      } catch (e) {
        // ignore
      }

      if (!res.ok) {
        throw new Error(data?.error || "自動配車に失敗しました");
      }

      
      const allExpectedIds = new Set(allChildrenOnBoard.map(c => c.id));
      
      const newColumns = initialColumns.map(col => {
        // APIレスポンスと画面上のカラム（シフト）を正確にマッピングする
        const assignment = data.assignments?.find((a: any) => 
          a.shiftId === col.shiftId || (a.vehicleId === col.vehicleId && !a.shiftId)
        );
        let colChildren: ChildMagnet[] = [];
        
        if (assignment && Array.isArray(assignment.childrenIds)) {
          // ボード上に実在する児童IDだけを安全に抽出
          const validIds = assignment.childrenIds.filter((id: string) => allExpectedIds.has(id));
          colChildren = validIds.map((id: string) => toMagnet(id, children, attendances));
          
          // 割り当て済みのIDを未割り当て候補から削除
          validIds.forEach((id: string) => allExpectedIds.delete(id));
        }

        return {
          ...col,
          routeInfo: assignment?.routeInfo,
          estimatedTime: assignment?.estimatedTime,
          children: colChildren
        };
      });

      // AIが割り当てを忘れた児童、または `data.unassigned` に返された児童はすべて未割り当てに戻す
      const newUnassignedIds = Array.from(allExpectedIds);
      const newUnassigned = newUnassignedIds.map(id => toMagnet(id, children, attendances));

      setBoard(activeTab, {
        columns: newColumns,
        unassigned: { id: "unassigned", children: newUnassigned },
      });
      setIsAutoAssigned(true);

      // 自動配車後、即座に Supabase に永続化
      setTimeout(async () => {
        const targetDateStr = formatDate(selectedDate);
        const state = useBoardStore.getState();
        await saveBoardState(targetDateStr, state.inboundBoard, state.outboundBoard);
      }, 0);
    } catch (err: any) {
      console.error(err);
      alert(`エラー: ${err.message}`);
    } finally {
      setIsAutoAssigning(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setToastMessage(null);
    try {
      const targetDateStr = formatDate(selectedDate);
      const state = useBoardStore.getState();
      
      await saveBoardState(targetDateStr, state.inboundBoard, state.outboundBoard);

      setToastMessage({ type: "success", text: "✅ 送迎表を保存しました" });
    } catch (error) {
      setToastMessage({ type: "error", text: "❌ 保存に失敗しました" });
    } finally {
      setIsSaving(false);
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  const handleReset = (overrideAtts?: DailyAttendance[]) => {
    const state = useBoardStore.getState();
    const attsToUse = overrideAtts || attendances;
    
    const inboundChildren = attsToUse
      .filter(a => ["both", "pickup_only"].includes(a.status))
      .filter(a => {
        const child = children.find(c => c.id === a.child_id);
        const isAbsent = (a.attendance_status || child?.status) === "absent" || a.status === "absent";
        return child && !isAbsent;
      })
      .map(a => toMagnet(a.child_id, children, attsToUse));
      
    const outboundChildren = attsToUse
      .filter(a => ["both", "dropoff_only"].includes(a.status))
      .filter(a => {
        const child = children.find(c => c.id === a.child_id);
        const isAbsent = (a.attendance_status || child?.status) === "absent" || a.status === "absent";
        return child && !isAbsent;
      })
      .map(a => toMagnet(a.child_id, children, attsToUse));

    if (activeTab === "inbound") {
      setBoard("inbound", {
        columns: dynamicShifts.map((shift) => ({
          id: shift.id,
          shiftId: shift.id,
          vehicleId: shift.vehicle_id,
          vehicleName: shift.vehicle?.name ?? "不明",
          driverId: shift.driver_id,
          driverName: shift.driver?.name ?? "不明",
          driverStatus: shift.driver?.status,
          driverStatusTime: shift.driver?.status_time,
          capacity: shift.vehicle?.capacity ?? 0,
          children: [],
        })),
        unassigned: { id: "unassigned", children: inboundChildren },
      });
    } else {
      setBoard("outbound", {
        columns: dynamicShifts.map((shift) => ({
          id: shift.id,
          shiftId: shift.id,
          vehicleId: shift.vehicle_id,
          vehicleName: shift.vehicle?.name ?? "不明",
          driverId: shift.driver_id,
          driverName: shift.driver?.name ?? "不明",
          driverStatus: shift.driver?.status,
          driverStatusTime: shift.driver?.status_time,
          capacity: shift.vehicle?.capacity ?? 0,
          children: [],
        })),
        unassigned: { id: "unassigned", children: outboundChildren },
      });
    }
    setIsAutoAssigned(false);

    // リセット後、最新状態をSupabaseに上書き保存
    setTimeout(async () => {
      const todayStr = new Date().toISOString().split("T")[0];
      const state = useBoardStore.getState();
      await saveBoardState(todayStr, state.inboundBoard, state.outboundBoard);
    }, 0);

    setToastMessage({ type: "success", text: "✅ 最新の状態でリセットしました" });
    setTimeout(() => setToastMessage(null), 3000);
  };

  // 車両カラムの初期値: dynamicShiftsから即時構築（カラムは常に表示）
  const initialColumns = dynamicShifts.map((shift) => ({
    id: shift.id,
    shiftId: shift.id,
    vehicleId: shift.vehicle_id,
    vehicleName: shift.vehicle?.name ?? "不明",
    driverId: shift.driver_id,
    driverName: shift.driver?.name ?? "不明",
    driverStatus: shift.driver?.status,
    driverStatusTime: shift.driver?.status_time,
    capacity: shift.vehicle?.capacity ?? 0,
    children: [] as ChildMagnet[],
  }));

  // ボード表示用カラム: Zustandが空ならMOCK初期値を使用
  const displayColumns = board.columns.length > 0 ? board.columns : initialColumns;

  // Initialize board on mount and date change
  useEffect(() => {
    if (children.length === 0) return;

    const targetDateStr = formatDate(selectedDate);
    let isMounted = true;

    const loadData = async () => {
      try {
        const { attendances: fetchedAtts, boardState, dailyStaff: fetchedStaff, dailyVehicles: fetchedVehicles } = await fetchDailyData(targetDateStr);
        if (!isMounted) return;

        // Merge dailyStaff
        const mergedStaff = staff.map((s) => {
          const existing = fetchedStaff?.find((ds: any) => ds.staff_id === s.id);
          return existing ? { ...existing, staff: s } : { staff_id: s.id, status: "present", role: s.role, staff: s };
        });
        setDailyStaff(mergedStaff);

        // Merge dailyVehicles
        const mergedVehicles = vehicles.map((v) => {
          const existing = fetchedVehicles?.find((dv: any) => dv.vehicle_id === v.id);
          return existing ? { ...existing, vehicle: v } : { vehicle_id: v.id, is_active: v.is_active ?? true, vehicle: v };
        });
        setDailyVehicles(mergedVehicles);

        // attendance の反映 (日別設定に登録されている児童のみ抽出する)
        const mergedAtts = fetchedAtts.map((a: any) => {
          const child = children.find((c) => c.id === a.child_id);
          return { ...a, child };
        }).filter((a: any) => a.child);
        useMasterStore.getState().setAttendances(mergedAtts);

        // board の反映
        if (boardState && boardState.inbound_board && boardState.outbound_board) {
          useBoardStore.getState().setBoard("inbound", boardState.inbound_board);
          useBoardStore.getState().setBoard("outbound", boardState.outbound_board);
        } else {
          // 何もない場合はリセット（新規作成）
          handleReset(mergedAtts);
        }
      } catch (err) {
        console.error("Board load error", err);
      }
    };

    loadData();

    // リアルタイム購読の設定
    const channel = supabase
      .channel(`board-${targetDateStr}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "board_states", filter: `target_date=eq.${targetDateStr}` },
        () => {
          loadData();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "daily_attendances", filter: `target_date=eq.${targetDateStr}` },
        () => {
          loadData();
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [children, selectedDate]);

  // 同期用useEffect (児童およびスタッフマスターの変更をボードに反映)
  useEffect(() => {
    const state = useBoardStore.getState();
    if (state.inboundBoard.columns.length === 0 && state.outboundBoard.columns.length === 0) return;

    const syncBoard = (boardState: typeof inboundBoard, mode: "inbound" | "outbound") => {
      const newCols = boardState.columns
        .filter(col => {
          // スタッフが休みの場合は車両カラムごと削除
          const driver = dailyStaff.find(ds => ds.staff_id === col.driverId);
          return !driver || driver.status !== "absent";
        })
        .map(col => {
          const driver = dailyStaff.find(ds => ds.staff_id === col.driverId);
          return {
            ...col,
            driverStatus: driver?.status,
            driverStatusTime: driver?.status_time,
            driverRole: driver?.role || driver?.staff?.role,
            children: col.children
              .filter(m => {
                const child = children.find(c => c.id === m.id);
                const att = attendances.find(a => a.child_id === m.id);
                const isValidForMode = mode === "inbound" 
                  ? ["both", "pickup_only"].includes(att?.status || "")
                  : ["both", "dropoff_only"].includes(att?.status || "");
                const isAbsent = (att?.attendance_status || child?.status) === "absent" || att?.status === "absent";
                return child && !isAbsent && isValidForMode;
              })
              .map(m => {
                const child = children.find(c => c.id === m.id);
                const att = attendances.find(a => a.child_id === m.id);
                return { 
                  ...m, 
                  status: child?.status, 
                  status_time: child?.status_time, 
                  has_caution: child?.has_caution ?? false,
                  pickup_time: (att?.pickup_time && att.pickup_time.trim() !== "")
                    ? att.pickup_time
                    : (child?.default_dismissal_time && child.default_dismissal_time.trim() !== "")
                      ? child.default_dismissal_time
                      : (child?.school?.default_dismissal_time && child.school.default_dismissal_time.trim() !== "")
                        ? child.school.default_dismissal_time
                        : null
                };
              })
          };
        });
      
      const newUnassignedChildren = boardState.unassigned.children
        .filter(m => {
          const child = children.find(c => c.id === m.id);
          const att = attendances.find(a => a.child_id === m.id);
          const isValidForMode = mode === "inbound" 
            ? ["both", "pickup_only"].includes(att?.status || "")
            : ["both", "dropoff_only"].includes(att?.status || "");
          const isAbsent = (att?.attendance_status || child?.status) === "absent" || att?.status === "absent";
          return child && !isAbsent && isValidForMode;
        })
        .map(m => {
          const child = children.find(c => c.id === m.id);
          const att = attendances.find(a => a.child_id === m.id);
          return { 
            ...m, 
            status: child?.status, 
            status_time: child?.status_time, 
            has_caution: child?.has_caution ?? false,
            pickup_time: (att?.pickup_time && att.pickup_time.trim() !== "")
              ? att.pickup_time
              : (child?.default_dismissal_time && child.default_dismissal_time.trim() !== "")
                ? child.default_dismissal_time
                : (child?.school?.default_dismissal_time && child.school.default_dismissal_time.trim() !== "")
                  ? child.school.default_dismissal_time
                  : null
          };
        });

      // 休みから復帰した児童（かつ、まだボード上に存在しない児童）を抽出して未割り当てに追加
      const currentIds = new Set([
        ...newCols.flatMap(col => col.children.map(c => c.id)),
        ...newUnassignedChildren.map(c => c.id)
      ]);

      const missingChildren = attendances
        .filter(a => mode === "inbound" ? ["both", "pickup_only"].includes(a.status) : ["both", "dropoff_only"].includes(a.status))
        .filter(a => children.some(c => c.id === a.child_id && (a.attendance_status || c.status) !== "absent"))
        .filter(a => !currentIds.has(a.child_id))
        .map(a => toMagnet(a.child_id, children, attendances));

      const newUnassigned = {
        ...boardState.unassigned,
        children: [...newUnassignedChildren, ...missingChildren]
      };

      state.setBoard(mode, { columns: newCols, unassigned: newUnassigned });
    };

    syncBoard(state.inboundBoard, "inbound");
    syncBoard(state.outboundBoard, "outbound");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [children, dailyStaff, attendances]);




  const displayDate = selectedDate.toLocaleDateString("ja-JP", {
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

  const handlePrint = () => {
    window.print();
  };

  const handleDirectReorder = async (columnId: string, childId: string, direction: -1 | 1) => {
    try {
      reorderChild(activeTab, columnId, childId, direction);
      const state = useBoardStore.getState();
      const targetDateStr = formatDate(selectedDate);
      await saveBoardState(targetDateStr, state.inboundBoard, state.outboundBoard);
    } catch (err) {
      console.error("Failed to reorder directly", err);
    }
  };

  return (
    <>
      <div className="p-4 md:p-6 h-[calc(100vh-4rem)] flex flex-col print:hidden">
      {/* Page header */}
      <div className="flex flex-col gap-4 mb-4 print:mb-6">
        
        {/* Top Row: Title & Actions */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="shrink-0">
            <h1 className="text-xl md:text-2xl font-bold text-gray-800 print:text-3xl">送迎ボード</h1>
            <p className="text-xs md:text-sm text-gray-500 print:text-base">{displayDate} — 出席 {totalPresent}名</p>
          </div>
          
          <div className="flex flex-wrap items-center justify-start md:justify-end gap-2 xl:gap-3 shrink-0 print:hidden">
            {overCapacityCols.length > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-xs font-bold">
                ⚠️ {overCapacityCols.length}台超過
              </div>
            )}
            <div className="flex bg-gray-100 p-1 rounded-lg shrink-0">
              <button
                onClick={() => setActiveTab("inbound")}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${
                  activeTab === "inbound" ? "bg-white shadow-sm text-blue-700" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                迎え
              </button>
              <button
                onClick={() => setActiveTab("outbound")}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${
                  activeTab === "outbound" ? "bg-white shadow-sm text-indigo-700" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                送り
              </button>
            </div>
            <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1.5 h-8 px-3 text-xs shrink-0">
              <Printer className="w-3.5 h-3.5" />
              A4印刷
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleReset()} className="gap-1.5 h-8 px-3 text-xs shrink-0">
              <RotateCcw className="w-3.5 h-3.5" />
              リセット
            </Button>
            <Button 
              size="sm" 
              onClick={handleAutoAssign} 
              disabled={isAutoAssigning}
              className="gap-1.5 h-8 px-3 text-xs bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-70 transition-all shrink-0"
            >
              <Sparkles className={`w-3.5 h-3.5 ${isAutoAssigning ? "animate-pulse" : ""}`} />
              {isAutoAssigning ? "AI配車中..." : "自動配車"}
            </Button>
            <Button 
              size="sm" 
              onClick={handleSave}
              disabled={isSaving}
              className="gap-1.5 h-8 px-4 text-xs font-bold bg-gray-900 hover:bg-gray-800 text-white shrink-0"
            >
              {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              {isSaving ? "保存中..." : "保存"}
            </Button>
          </div>
        </div>

        {/* Bottom Row: Date Selector */}
        <DateSelector selectedDate={selectedDate} onChange={setSelectedDate} />
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div 
          className={cn(
            "fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-bold flex items-center gap-2 animate-in fade-in slide-in-from-top-4 print:hidden",
            toastMessage.type === "success" 
              ? "bg-green-100 text-green-800 border border-green-200" 
              : "bg-red-100 text-red-800 border border-red-200"
          )}
        >
          {toastMessage.text}
        </div>
      )}

      {/* Auto-assign banner */}
      {isAutoAssigned && (
        <div className="mb-4 px-4 py-2.5 bg-indigo-50 border border-indigo-200 rounded-lg text-sm text-indigo-700 print:hidden">
          ✨ 自動配車が完了しました。マグネットをドラッグして手動調整できます。
        </div>
      )}

      {/* Board */}
      <div className="flex-1 overflow-x-auto print:overflow-visible">
        <div className="flex gap-4 h-full pb-4 print:flex-wrap print:gap-6 print:pb-0">
          {/* Unassigned pool */}
          <div className="print:hidden">
            <UnassignedPool children={board.unassigned.children} mode={activeTab} onChildClick={handleChildClick} />
          </div>

          {/* Vehicle columns */}
          {displayColumns.map((col) => (
            <VehicleColumn key={col.id} column={col} mode={activeTab} onChildClick={handleChildClick} onReorderChild={handleDirectReorder} />
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-gray-500 border-t border-gray-200 pt-3">
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
          <div className="w-3 h-3 bg-amber-100 border border-amber-300 rounded-sm" /> 配慮事項あり
        </span>
      </div>
    </div>
      
    {/* 印刷用専用レイアウト */}
    <div className="hidden print:block p-0 bg-white text-black">
        <div className="mb-6 border-b-2 border-black pb-2">
          <h1 className="text-3xl font-bold mb-2">放デイ 送迎運行表 ({activeTab === "inbound" ? "迎え" : "送り"})</h1>
          <div className="flex justify-between items-end">
            <p className="text-xl font-bold">{displayDate}</p>
            <p className="text-sm">出力日時: {new Date().toLocaleString("ja-JP")}</p>
          </div>
        </div>

        <div className="space-y-6">
          {displayColumns
            .filter(col => col.children.length > 0)
            .map(col => {
              // 児童を時間順にソート (nullや空は最後)
              const sortedChildren = [...col.children].sort((a, b) => {
                const timeA = a.pickup_time || "99:99";
                const timeB = b.pickup_time || "99:99";
                return timeA.localeCompare(timeB);
              });

              return (
                <div key={col.id} className="print-vehicle-table mb-6 break-inside-avoid">
                  <div className="flex items-center gap-4 mb-2 border-b-2 border-black pb-1">
                    <h2 className="text-2xl font-bold flex-1">{col.vehicleName}</h2>
                    <div className="text-base flex gap-6">
                      <p><strong>運転手:</strong> {col.driverName}</p>
                    </div>
                  </div>
                  <div className="mb-2 text-base font-bold flex gap-4 items-center">
                    <span className="px-2 py-1 bg-gray-200 border border-black rounded text-sm">
                      {activeTab === "inbound" ? "各所 ➔ 施設" : "施設 ➔ 各所"}
                    </span>
                  </div>
                  <table className="w-full text-left border-collapse border-2 border-black text-sm">
                    <thead>
                      <tr className="bg-gray-100 border-b-2 border-black">
                        <th className="border border-black p-1.5 w-10 text-center font-bold">順</th>
                        <th className="border border-black p-1.5 font-bold">児童名</th>
                        <th className="border border-black p-1.5 font-bold w-48">学校名</th>
                        <th className="border border-black p-1.5 w-20 text-center font-bold">時間</th>
                        <th className="border border-black p-1.5 w-24 text-center font-bold">遅刻/早退</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedChildren.map((child, idx) => (
                        <tr key={child.id} className="border-b border-gray-400">
                          <td className="border border-black p-1.5 text-center text-base">{idx + 1}</td>
                          <td className="border border-black p-1.5 text-lg font-bold">{child.name}</td>
                          <td className="border border-black p-1.5 text-sm">{child.school_name}</td>
                          <td className="border border-black p-1.5 font-mono text-center text-base">{child.pickup_time || "-"}</td>
                          <td className="border border-black p-1.5 text-sm font-bold text-center leading-tight">
                            {child.status === "late" && <span>遅刻 {child.status_time}</span>}
                            {child.status === "early_leave" && <span>早退 {child.status_time}</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}
        </div>
      </div>
      {/* Assignment Modal */}
      <Dialog open={!!selectedChild} onOpenChange={(open) => !open && setSelectedChild(null)}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto print:hidden">
          <DialogHeader>
            <DialogTitle>{selectedChild?.magnet.name} の配車・順番変更</DialogTitle>
          </DialogHeader>

          {selectedChild && (
            <div className="space-y-6 pt-4">
              {/* 並び順変更セクション（既に車両にいる場合のみ表示） */}
              {selectedChild.columnId !== "unassigned" && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-gray-500">同じ車両内での順番移動</h3>
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1 gap-2" onClick={() => handleReorder(-1)}>
                      <ArrowUp className="w-4 h-4" /> 前へ
                    </Button>
                    <Button variant="outline" className="flex-1 gap-2" onClick={() => handleReorder(1)}>
                      <ArrowDown className="w-4 h-4" /> 後ろへ
                    </Button>
                  </div>
                </div>
              )}

              {/* 配車先変更セクション */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-500">別の車両へ移動 (最後尾に追加)</h3>
                <div className="flex flex-col gap-2">
                  {displayColumns.map((col) => {
                    const isCurrent = col.id === selectedChild.columnId;
                    const isFull = col.children.length >= col.capacity;
                    return (
                      <Button
                        key={col.id}
                        variant="outline"
                        className={cn(
                          "justify-start text-left h-auto py-3",
                          isCurrent && "border-blue-500 bg-blue-50 cursor-default hover:bg-blue-50",
                          !isCurrent && isFull && "opacity-75"
                        )}
                        onClick={() => !isCurrent && handleAssignTo(col.id)}
                      >
                        <div className="flex flex-col items-start gap-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold">{col.vehicleName}</span>
                            {isCurrent && <span className="text-xs text-blue-600 font-bold bg-blue-100 px-2 py-0.5 rounded">現在</span>}
                            {!isCurrent && isFull && <span className="text-xs text-amber-600 font-bold bg-amber-100 px-2 py-0.5 rounded">満員</span>}
                          </div>
                          <span className="text-xs text-gray-500">{col.driverName}</span>
                        </div>
                      </Button>
                    );
                  })}
                  <Button
                    variant="outline"
                    className={cn(
                      "justify-start text-left h-auto py-3 mt-2",
                      selectedChild.columnId === "unassigned" && "border-blue-500 bg-blue-50 cursor-default hover:bg-blue-50"
                    )}
                    onClick={() => selectedChild.columnId !== "unassigned" && handleAssignTo("unassigned")}
                  >
                    <div className="font-bold">📋 未割り当てに戻す</div>
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
