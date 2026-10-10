"use client";

import { useEffect, useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowUp, ArrowDown, ChevronLeft, ChevronRight, CalendarIcon, Sparkles, RotateCcw, Save, Printer, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DateSelector } from "@/components/ui/date-selector";
import { VehicleColumn } from "@/components/board/VehicleColumn";
import { ChildCard } from "@/components/board/ChildCard";
import { FamilyPickupColumn } from "@/components/board/FamilyPickupColumn";
import { useBoardStore } from "@/lib/store/boardStore";
import { autoAssignVehicles } from "@/lib/autoAssignVehicles";
import { MOCK_WHITEBOARD_STATE, toMagnet, MOCK_STAFF, OFFICE_ADDRESS } from "@/lib/mockData";
import { useMasterStore } from "@/lib/store/masterStore";
import { ChildMagnet, VehicleColumn as VehicleColumnType, DailyAttendance, DailyStaff, DailyVehicle } from "@/types";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase/client";
import { fetchDailyData, saveBoardState } from "@/lib/supabase/service";

function formatDate(date: Date) {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function UnassignedPool({ children = [], mode, onChildClick, onAssignTo, readOnly = false, className }: { children?: ChildMagnet[], mode: "inbound" | "outbound", onChildClick: (magnet: ChildMagnet, columnId: string) => void, onAssignTo: (child: ChildMagnet, targetTripId: string) => void, readOnly?: boolean, className?: string }) {
  const { inboundBoard, outboundBoard } = useBoardStore();
  const board = mode === "inbound" ? inboundBoard : outboundBoard;
  const availableTrips = (board?.columns || []).flatMap((col: any) => 
    (col.trips || []).map((t: any) => ({
      id: t?.id,
      label: `${col?.vehicleName || '車両'} ${t?.tripIndex || 1}便`,
      isFull: (t?.children || []).length >= (col?.capacity || 99)
    }))
  ).filter((t: any) => t.id);

  return (
    <div
      data-testid="unassigned-column"
      className={cn(
        "flex flex-col rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 overflow-hidden",
        className || "w-64 shrink-0"
      )}
    >
      <div className="px-3 md:px-4 py-2.5 md:py-3 border-b border-gray-200 bg-gray-100 flex items-center justify-between">
        <p className="font-bold text-gray-600 text-sm">📋 未割り当て</p>
        <span className="text-xs font-semibold px-2 py-0.5 bg-gray-200 text-gray-700 rounded-full">
          {(children || []).length}名
        </span>
      </div>
      <div
        data-testid="unassigned-pool"
        className="flex-1 p-2 md:p-3 min-h-[150px] overflow-y-auto overflow-x-hidden space-y-1.5 md:space-y-2 transition-colors"
      >
        {(children || []).map((magnet) => (
          <ChildCard 
            key={magnet?.id || Math.random().toString()} 
            magnet={magnet} 
            mode={mode} 
            onClick={(m) => onChildClick(m, "unassigned")}
            actionSlot={
              <select
                disabled={readOnly}
                className="text-[10px] bg-white border border-gray-300 rounded px-1 py-1 w-[68px] text-gray-700 cursor-pointer hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                value=""
                onChange={(e) => {
                  if (e.target.value) {
                    onAssignTo(magnet, e.target.value);
                  }
                }}
              >
                <option value="" disabled>配車 ▼</option>
                {availableTrips.map(trip => (
                  <option key={trip.id} value={trip.id} disabled={trip.isFull}>
                    {trip.label} {trip.isFull ? "(満員)" : ""}
                  </option>
                ))}
              </select>
            }
          />
        ))}
        {(children || []).length === 0 && (
          <div className="flex items-center justify-center h-24 text-gray-400 text-sm">
            全員が配車済みです 🎉
          </div>
        )}
      </div>
    </div>
  );
}

export default function BoardPage() {
  const { children, attendances } = useMasterStore();
  const { staff: masterStaff, vehicles: masterVehicles } = useMasterStore();
  const { inboundBoard, outboundBoard, setBoard, moveChild, reorderChild } = useBoardStore();
  const [activeTab, setActiveTab] = useState<"inbound" | "outbound">("inbound");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  
  const [selectedChild, setSelectedChild] = useState<{ magnet: ChildMagnet; columnId: string } | null>(null);
  const [toastMessage, setToastMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isAutoAssigning, setIsAutoAssigning] = useState(false);
  const [isAutoAssigned, setIsAutoAssigned] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const isSavingRef = useRef(false);
  // 閲覧モード(false) / 編集モード(true)。ページ表示直後・日付変更直後は必ず閲覧モード
  const [isEditing, setIsEditing] = useState(false);
  const isEditingRef = useRef(false);
  const [reloadKey, setReloadKey] = useState(0);
  const setEditingMode = (v: boolean) => {
    isEditingRef.current = v;
    setIsEditing(v);
  };
  // ローカルステートとして管理（masterStoreには存在しないため）
  const [dailyStaff, setDailyStaff] = useState<any[]>([]);
  const [dailyVehicles, setDailyVehicles] = useState<any[]>([]);

  const board = activeTab === "inbound" ? inboundBoard : outboundBoard;

  // 本日の稼働シフトを日別設定から動的に構築
  const dynamicShifts = (dailyStaff || [])
    .filter((ds) => ds?.staff?.is_driver && ds?.assigned_vehicle_id && ds?.status !== "absent")
    .map((ds) => {
      const v = (dailyVehicles || []).find((dv) => dv?.vehicle_id === ds?.assigned_vehicle_id);
      return {
        id: `shift-${ds.staff_id}`,
        target_date: formatDate(selectedDate),
        vehicle_id: ds.assigned_vehicle_id!,
        driver_id: ds.staff_id,
        vehicle: v?.vehicle,
        driver: ds.staff,
        is_active: v?.is_active ?? true,
        daily_status: ds.status,
        daily_status_time: ds.status_time,
      };
    })
    .filter((shift) => shift.vehicle && shift.is_active);

  const handleChildClick = (magnet: ChildMagnet, columnId: string) => {
    if (!isEditingRef.current) return; // 閲覧モードでは配車モーダルを開かない
    setSelectedChild({ magnet, columnId });
  };

  const handleAssignTo = async (targetColumnId: string) => {
    if (!selectedChild) return;
    console.log("=== handleAssignTo ===", { selectedChild, targetColumnId });
    if (selectedChild.columnId !== targetColumnId) {
      moveChild(activeTab, selectedChild.magnet.id, selectedChild.columnId, targetColumnId);
      console.log("State after moveChild:", useBoardStore.getState().inboundBoard, useBoardStore.getState().outboundBoard);
      await performAutoSave();
    }
    setSelectedChild(null);
  };

  const handleReorder = async (direction: -1 | 1) => {
    if (!selectedChild) return;
    if (selectedChild.columnId === "unassigned" || selectedChild.columnId === "family-pickup") return;
    reorderChild(activeTab, selectedChild.columnId, selectedChild.magnet.id, direction);
    await performAutoSave();
  };

  const handleAutoAssign = async () => {
    if (!isEditingRef.current) return; // 閲覧モードでは実行不可
    setIsAutoAssigning(true);
    try {
      // 現在ボード上（カラム＋未割り当て）にいる児童を対象とする
      // ★家族迎えプールの児童は自動配車の対象外★
      const allChildrenOnBoard = [
        ...(board?.unassigned?.children || []),
        ...(board?.columns || []).flatMap((c: any) => (c.trips || []).flatMap((t: any) => t.children || []))
      ];

      const currentAttendances = allChildrenOnBoard.map((c: any) => ({
        id: c.id,
        child_id: c.id,
        status: c.transportMode,
        pickup_time: c.pickup_time,
        attendance_status: "present",
        child: children.find(masterC => masterC.id === c.id) || {
          id: c.id,
          name: c.name,
          has_caution: c.has_caution,
          notes: c.notes,
          school: { name: c.school_name, color_code: c.color, area: c.school_area },
        }
      }));

      if (currentAttendances.length === 0) {
        setIsAutoAssigning(false);
        return;
      }

      const inputShifts = displayColumns.map((col: any) => ({
        id: col.shiftId || col.id,
        target_date: formatDate(selectedDate),
        vehicle_id: col.vehicleId,
        driver_id: col.driverId,
        vehicle: { id: col.vehicleId, capacity: col.capacity, name: col.vehicleName },
        driver: { id: col.driverId, name: col.driverName },
        driverStatus: col.driverStatus,
        driverStatusTime: col.driverStatusTime
      })) as any[];

      // APIを通さず、直接ローカルでアルゴリズムを実行（最大4便・下校時間順）
      const result = autoAssignVehicles({ attendances: currentAttendances as any[], shifts: inputShifts });

      const newColumns = result.columns.map((col: any) => {
        const originalCol = displayColumns.find((c: any) => c.vehicleId === col.vehicleId) || col;
        return {
          ...originalCol,
          trips: col.trips,
        };
      });

      // === デバッグ用コンソールログ ===
      console.log("=== 自動配車デバッグログ ===");
      console.log(`対象児童総数: ${currentAttendances.length}人`);
      newColumns.forEach((col: any) => {
        const tripsLog = (col.trips || []).map((t: any) => `${t.tripIndex}便: ${(t.children || []).length}人`).join(", ");
        console.log(`${col.vehicleName} [${tripsLog}]`);
      });
      console.log(`未割り当て残数: ${result.unassigned.length}人`);
      console.log("============================");

      // 家族迎えプールは自動配車後も保持する
      const currentFamilyPickup = board.familyPickup ?? { id: "family-pickup" as const, children: [] };

      setBoard(activeTab, {
        columns: newColumns,
        unassigned: { id: "unassigned", children: result.unassigned },
        familyPickup: currentFamilyPickup,
      });
      setIsAutoAssigned(true);

      // 自動保存を確実に実行
      await performAutoSave();

    } catch (err: any) {
      console.error(err);
      alert(`エラー: ${err.message}`);
    } finally {
      setIsAutoAssigning(false);
    }
  };

  // 編集モード中は各操作ごとの自動保存を行わず（下書き状態）、
  // 「保存して完了」押下時にのみ Supabase へ保存する
  const performAutoSave = async () => {
    if (isEditingRef.current) return;
  };

  // 実際の Supabase 保存処理（board_states へ upsert）
  const saveBoardNow = async (): Promise<boolean> => {
    isSavingRef.current = true;
    try {
      const targetDateStr = formatDate(selectedDate);
      const state = useBoardStore.getState();
      await saveBoardState(targetDateStr, state.inboundBoard, state.outboundBoard);
      return true;
    } catch (error) {
      console.error("Save failed", error);
      return false;
    } finally {
      // 保存直後にリアルタイム通知で loadData が走り、状態が上書きされないよう 5 秒ブロック
      setTimeout(() => {
        isSavingRef.current = false;
      }, 5000);
    }
  };

  const showToast = (type: "success" | "error", text: string) => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleStartEdit = () => {
    setEditingMode(true);
  };

  const handleSaveEdit = async () => {
    setIsSaving(true);
    const ok = await saveBoardNow();
    setIsSaving(false);
    if (ok) {
      showToast("success", "✓ 変更を保存しました");
      setEditingMode(false);
      setIsAutoAssigned(false);
    } else {
      showToast("error", "❌ 保存に失敗しました（編集モードを継続します）");
    }
  };

  const handleCancelEdit = () => {
    if (!window.confirm("編集内容を破棄して元の状態に戻しますか？")) return;
    setEditingMode(false);
    setIsAutoAssigned(false);
    setSelectedChild(null);
    // DBから再読み込みしてロールバック
    setReloadKey((k) => k + 1);
  };

  // 日付変更（編集中は未保存警告）。変更後は必ず閲覧モードに戻す
  const handleDateChange = (date: Date) => {
    if (isEditingRef.current) {
      if (!window.confirm("未保存の変更があります。変更を破棄して移動しますか？")) return;
      setEditingMode(false);
      setIsAutoAssigned(false);
      setSelectedChild(null);
    }
    setSelectedDate(date);
  };

  // 編集中のタブ閉じ・リロード警告
  useEffect(() => {
    if (!isEditing) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.onbeforeunload = handler as any;
    return () => {
      window.onbeforeunload = null;
    };
  }, [isEditing]);

  const handleReset = (overrideAtts?: DailyAttendance[]) => {
    const state = useBoardStore.getState();
    const attsToUse = overrideAtts || attendances;
    
    // 出席かつ迎え利用の児童のみ
    const inboundChildren = attsToUse
      .filter(a => {
        const transportStatus = a.status || "both";
        const attendanceStatus = a.attendance_status || "present";
        const isAbsent = attendanceStatus === "absent";
        const wantsPickup = ["both", "pickup_only"].includes(transportStatus);
        return !isAbsent && wantsPickup;
      })
      .filter(a => children.some((c: any) => c.id === a.child_id))
      .map(a => toMagnet(a.child_id, children, attsToUse));

    // 送り: "both" → 未割り当てプール, "dropoff_only" → 家族迎えプール
    const outboundChildren = attsToUse
      .filter(a => {
        const transportStatus = a.status || "both";
        const attendanceStatus = a.attendance_status || "present";
        const isAbsent = attendanceStatus === "absent";
        return !isAbsent && transportStatus === "both";
      })
      .filter(a => children.some((c: any) => c.id === a.child_id))
      .map(a => toMagnet(a.child_id, children, attsToUse));

    const familyPickupChildren = attsToUse
      .filter(a => {
        const transportStatus = a.status || "both";
        const attendanceStatus = a.attendance_status || "present";
        const isAbsent = attendanceStatus === "absent";
        return !isAbsent && transportStatus === "dropoff_only";
      })
      .filter(a => children.some((c: any) => c.id === a.child_id))
      .map(a => toMagnet(a.child_id, children, attsToUse));

    if (activeTab === "inbound") {
      setBoard("inbound", {
        columns: state.inboundBoard.columns.map((col: any) => {
          const firstTrip = (col.trips || []).find((t: any) => t.tripIndex === 1) || {
            id: `${col.shiftId || col.id}-trip-1`,
            tripIndex: 1,
          };
          return {
            ...col,
            trips: [{ ...firstTrip, children: [] }],
          };
        }),
        unassigned: { id: "unassigned", children: inboundChildren },
        familyPickup: { id: "family-pickup", children: [] },
      });
    } else {
      setBoard("outbound", {
        columns: state.outboundBoard.columns.map((col: any) => {
          const firstTrip = (col.trips || []).find((t: any) => t.tripIndex === 1) || {
            id: `${col.shiftId || col.id}-trip-1`,
            tripIndex: 1,
          };
          return {
            ...col,
            trips: [{ ...firstTrip, children: [] }],
          };
        }),
        unassigned: { id: "unassigned", children: outboundChildren },
        familyPickup: { id: "family-pickup", children: familyPickupChildren },
      });
    }

    // リセット後、最新状態をSupabaseに上書き保存
    setTimeout(async () => {
      await performAutoSave();
    }, 0);
  };

  // ボード表示用カラム: 常に Zustand の board.columns を直接使用（参照の乖離を完全排除）
  const displayColumns = board?.columns || [];

  // Initialize board on mount and date change
  useEffect(() => {
    if (children.length === 0) return;

    const targetDateStr = formatDate(selectedDate);
    let isMounted = true;

    const loadData = async () => {
      try {
        const { attendances: fetchedAtts, boardState, dailyStaff: fetchedStaff, dailyVehicles: fetchedVehicles } = await fetchDailyData(targetDateStr);
        if (!isMounted) return;
        // 編集中は下書き状態を DB の内容で上書きしない
        if (isEditingRef.current) return;

        // Merge dailyStaff: masterStaff をベースに daily_staff の assigned_vehicle_id などを上書き
        const mergedStaff = masterStaff.map((s) => {
          const existing = fetchedStaff?.find((ds: any) => ds.staff_id === s.id);
          return existing
            ? { ...existing, staff: s }
            : { staff_id: s.id, status: "present", role: s.role, assigned_vehicle_id: null, staff: s };
        });
        setDailyStaff(mergedStaff);

        // Merge dailyVehicles: masterVehicles をベースに daily_vehicles の is_active などを上書き
        const mergedVehicles = masterVehicles.map((v) => {
          const existing = fetchedVehicles?.find((dv: any) => dv.vehicle_id === v.id);
          return existing
            ? { ...existing, vehicle: v }
            : { vehicle_id: v.id, is_active: v.is_active ?? true, vehicle: v };
        });
        setDailyVehicles(mergedVehicles);

        const dayOfWeek = selectedDate.getDay();

        // Children logic (sync with daily-setup)
        const relevantChildren = children.filter(child => {
          const dbRecord = fetchedAtts.find(a => a.child_id === child.id);
          if (dbRecord && dbRecord.attendance_status === ("excluded" as any)) return false;
          const scheduled = (child.weekly_schedule ?? [1, 2, 3, 4, 5]).includes(dayOfWeek);
          return !!dbRecord || scheduled;
        });

        const mergedAtts = relevantChildren.map((child) => {
          const existing = fetchedAtts.find((a) => a.child_id === child.id);
          const isAbukuma = (child.school?.name || '').includes('あぶくま');
          const defaultPickup = isAbukuma ? (child.default_dismissal_time || child.school?.default_dismissal_time || "14:30") : null;
          return (
            existing ?? {
              id: `att-${targetDateStr}-${child.id}`,
              target_date: targetDateStr,
              child_id: child.id,
              status: "both" as any,
              pickup_time: defaultPickup,
              attendance_status: "present" as const,
              attendance_time: null,
              child,
            }
          );
        });
        
        console.log(`[Board] Daily attendances count for ${targetDateStr}:`, mergedAtts.length);
        useMasterStore.getState().setAttendances(mergedAtts);

        // 稼働車両（is_active !== false）を元に、日別設定（mergedStaff）のドライバー情報をマージした最新コラム枠を作成
        const activeVehicles = masterVehicles.filter(v => v.is_active !== false);
        const vehiclesToUse = activeVehicles.length > 0 ? activeVehicles : masterVehicles;

        const buildColumnsForBoard = (savedBoard: any) => {
          return vehiclesToUse.map((v) => {
            // この車両に日別設定で割り当てられているドライバー
            const assignedStaff = mergedStaff.find((ds: any) => ds.assigned_vehicle_id === v.id && ds.status !== "absent");
            const driverName = assignedStaff ? (assignedStaff.staff?.name || "担当スタッフ") : "(未定)";
            const driverId = assignedStaff?.staff_id || null;
            const driverStatus = assignedStaff?.status;
            const driverStatusTime = assignedStaff?.status_time;
            const shiftId = `shift-${v.id}`;

            // 保存データがあればその便・乗客を引き継ぐ
            const savedCol = (savedBoard?.columns || []).find((c: any) => 
              String(c.vehicleId) === String(v.id) || String(c.id) === String(v.id) || c.vehicleName === v.name
            );

            let trips = savedCol?.trips || [];
            if (trips.length === 0) {
              trips = [{ id: `${shiftId}-trip-1`, tripIndex: 1, children: [] }];
            }

            return {
              id: shiftId,
              shiftId,
              vehicleId: v.id,
              vehicleName: v.name,
              driverId,
              driverName,
              driverStatus,
              driverStatusTime,
              capacity: v.capacity || 6,
              trips: trips.map((t: any, idx: number) => ({
                ...t,
                id: t.id || `${shiftId}-trip-${idx + 1}`,
                tripIndex: t.tripIndex || (idx + 1),
                children: (t.children || []).map((c: any) => toMagnet(c.id, children, mergedAtts))
              }))
            };
          });
        };

        // 迎えタブ：すでに車両に乗っている児童は未割り当てから除外
        const inboundCols = buildColumnsForBoard(boardState?.inbound_board);
        const assignedInboundIds = new Set(
          inboundCols.flatMap(c => c.trips.flatMap((t: any) => (t.children || []).map((ch: any) => String(ch.id))))
        );
        const inboundUnassigned = mergedAtts
          .filter(a => {
            const ts = (a as any).status || "both";
            const as2 = (a as any).attendance_status || "present";
            return as2 !== "absent" && ["both", "pickup_only"].includes(ts);
          })
          .filter(a => !assignedInboundIds.has(String(a.child_id)))
          .map(a => toMagnet(a.child_id, children, mergedAtts));

        // 送りタブ：すでに車両または家族迎えにいる児童は未割り当てから除外
        const outboundCols = buildColumnsForBoard(boardState?.outbound_board);
        const savedFamilyPickup = (boardState?.outbound_board?.familyPickup?.children || []).map((c: any) => 
          toMagnet(c.id, children, mergedAtts)
        );
        const assignedOutboundIds = new Set([
          ...outboundCols.flatMap(c => c.trips.flatMap((t: any) => (t.children || []).map((ch: any) => String(ch.id)))),
          ...savedFamilyPickup.map((c: any) => String(c.id))
        ]);
        const outboundUnassigned = mergedAtts
          .filter(a => {
            const ts = (a as any).status || "both";
            const as2 = (a as any).attendance_status || "present";
            return as2 !== "absent" && ts === "both";
          })
          .filter(a => !assignedOutboundIds.has(String(a.child_id)))
          .map(a => toMagnet(a.child_id, children, mergedAtts));

        // Zustand ストアにセット
        useBoardStore.getState().setBoard("inbound", {
          columns: inboundCols,
          unassigned: { id: "unassigned", children: inboundUnassigned },
          familyPickup: { id: "family-pickup", children: [] },
        });
        useBoardStore.getState().setBoard("outbound", {
          columns: outboundCols,
          unassigned: { id: "unassigned", children: outboundUnassigned },
          familyPickup: { id: "family-pickup", children: savedFamilyPickup },
        });

      } catch (err) {
        console.error("Board load error", err);
      }
    };

    loadData();

    // リアルタイム購読の設定（編集中は下書きを守るため再読み込みしない）
    const channel = supabase
      .channel(`board-${targetDateStr}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "board_states", filter: `target_date=eq.${targetDateStr}` },
        () => {
          if (!isSavingRef.current && !isEditingRef.current) loadData();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "daily_attendances", filter: `target_date=eq.${targetDateStr}` },
        () => {
          if (!isSavingRef.current && !isEditingRef.current) loadData();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "daily_staff", filter: `target_date=eq.${targetDateStr}` },
        () => {
          if (!isSavingRef.current && !isEditingRef.current) loadData();
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [children, selectedDate, masterStaff, masterVehicles, reloadKey]);

  // 同期用useEffect (児童・出欠情報が更新されたらボード上の情報を最新化)
  // ★ 保存中（isSavingRef.current）は発火しない → 配車直後の状態を保護
  useEffect(() => {
    if (children.length === 0 || attendances.length === 0) return;
    // 保存処理中はスキップして配車状態を保護する
    if (isSavingRef.current) {
      console.log("[syncBoard] Skipped – save in progress");
      return;
    }

    const syncBoard = (boardState: any, mode: "inbound" | "outbound") => {
      // コラムは既存のものをそのまま保持（dynamicShiftsでフィルタしない）
      const newCols = (boardState.columns || [])
        .map((col: any) => {
          const driver = dailyStaff.find((ds: any) => ds.staff_id === col.driverId);
          // trips が未設定の古いデータは変換
          const tripsToUse = (col.trips && col.trips.length > 0) ? col.trips : [
            {
              id: `${col.shiftId || col.id}-trip-1`,
              tripIndex: 1,
              children: col.children || []
            }
          ];
          return {
            ...col,
            driverStatus: driver?.status ?? col.driverStatus,
            driverStatusTime: driver?.status_time ?? col.driverStatusTime,
            driverRole: driver?.role || driver?.staff?.role || col.driverRole,
            trips: tripsToUse.map((trip: any) => ({
              ...trip,
              children: (trip.children || [])
                .filter((m: any) => {
                  const child = children.find((c: any) => c.id === m.id);
                  const att = attendances.find(a => a.child_id === m.id);
                  const transportStatus = att?.status || "both";
                  const attendanceStatus = att?.attendance_status || "present";
                  const isAbsent = attendanceStatus === "absent";
                  const isValidForMode = mode === "inbound"
                    ? ["both", "pickup_only"].includes(transportStatus)
                    : ["both", "dropoff_only"].includes(transportStatus);
                  return child && !isAbsent && isValidForMode;
                })
                .map((m: any) => {
                  const child = children.find((c: any) => c.id === m.id);
                  const att = attendances.find(a => a.child_id === m.id);
                  return { 
                    ...m, 
                    status: child?.status, 
                    status_time: child?.status_time, 
                    has_caution: child?.has_caution ?? false,
                    pickup_time: att ? att.pickup_time : null
                  };
                })
            }))
          };
        });
      
      const newUnassignedChildren = (boardState.unassigned?.children || [])
        .filter((m: any) => {
          const child = children.find((c: any) => c.id === m.id);
          const att = attendances.find(a => a.child_id === m.id);
          const transportStatus = att?.status || "both";
          const attendanceStatus = att?.attendance_status || "present";
          const isAbsent = attendanceStatus === "absent";
          const isValidForMode = mode === "inbound"
            ? ["both", "pickup_only"].includes(transportStatus)
            : ["both", "dropoff_only"].includes(transportStatus);
          return child && !isAbsent && isValidForMode;
        })
        .map((m: any) => {
          const child = children.find((c: any) => c.id === m.id);
          const att = attendances.find(a => a.child_id === m.id);
          return { 
            ...m, 
            status: child?.status, 
            status_time: child?.status_time, 
            has_caution: child?.has_caution ?? false,
            pickup_time: att ? att.pickup_time : null
          };
        });

      // 家族迎えプールを同期（送りタブのみ）
      const newFamilyPickupChildren = mode === "outbound"
        ? (boardState.familyPickup?.children || [])
            .filter((m: any) => {
              const child = children.find((c: any) => c.id === m.id);
              const att = attendances.find(a => a.child_id === m.id);
              const attendanceStatus = att?.attendance_status || "present";
              return child && attendanceStatus !== "absent";
            })
            .map((m: any) => {
              const child = children.find((c: any) => c.id === m.id);
              const att = attendances.find(a => a.child_id === m.id);
              return {
                ...m,
                status: child?.status,
                status_time: child?.status_time,
                has_caution: child?.has_caution ?? false,
                pickup_time: att ? att.pickup_time : null
              };
            })
        : [];

      // 現在ボード上にいる児童のIDセット（コラム + 未割り当て + 家族迎え）
      const currentIds = new Set([
        ...newCols.flatMap((col: any) => (col.trips || []).flatMap((t: any) => (t.children || []).map((c: any) => c.id))),
        ...newUnassignedChildren.map((c: any) => c.id),
        ...newFamilyPickupChildren.map((c: any) => c.id),
      ]);

      // まだボードに存在しない出席児童を未割り当てプールに追加
      const missingChildren = attendances
        .filter(a => {
          const transportStatus = a.status || "both";
          const attendanceStatus = a.attendance_status || "present";
          const isAbsent = attendanceStatus === "absent";
          const isValidForMode = mode === "inbound"
            ? ["both", "pickup_only"].includes(transportStatus)
            : transportStatus === "both";
          return !isAbsent && isValidForMode;
        })
        .filter(a => children.some((c: any) => c.id === a.child_id))
        .filter(a => !currentIds.has(a.child_id))
        .map(a => toMagnet(a.child_id, children, attendances));

      // 送りタブ: dropoff_only で未登録の児童を家族迎えプールに追加
      const missingFamilyPickup = mode === "outbound"
        ? attendances
            .filter(a => {
              const transportStatus = a.status || "both";
              const attendanceStatus = a.attendance_status || "present";
              return attendanceStatus !== "absent" && transportStatus === "dropoff_only" && !currentIds.has(a.child_id);
            })
            .filter(a => children.some((c: any) => c.id === a.child_id))
            .map(a => toMagnet(a.child_id, children, attendances))
        : [];

      const newUnassigned = {
        ...boardState.unassigned,
        children: [...newUnassignedChildren, ...missingChildren]
      };

      const newFamilyPickup = {
        id: "family-pickup" as const,
        children: [...newFamilyPickupChildren, ...missingFamilyPickup]
      };

      useBoardStore.getState().setBoard(mode, { columns: newCols, unassigned: newUnassigned, familyPickup: newFamilyPickup });
    };

    syncBoard(useBoardStore.getState().inboundBoard, "inbound");
    syncBoard(useBoardStore.getState().outboundBoard, "outbound");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  // ★ attendances が変わっても保存中（isSavingRef.current）はスキップ
  }, [children, dailyStaff, attendances]);




  const displayDate = selectedDate.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });

  const totalPresent = displayColumns.reduce(
    (sum, col) => sum + (col.trips || []).reduce((tsum, t) => tsum + (t.children || []).length, 0),
    0
  ) + (board.unassigned?.children || []).length;

  const overCapacityCols = displayColumns.filter(
    (col) => (col.trips || []).some((t: any) => (t.children || []).length > col.capacity)
  );

  const handlePrint = () => {
    window.print();
  };

  const handleDirectReorder = async (columnId: string, childId: string, direction: -1 | 1) => {
    if (!isEditingRef.current) return;
    try {
      reorderChild(activeTab, columnId, childId, direction);
      await performAutoSave();
    } catch (err) {
      console.error("Failed to reorder directly", err);
    }
  };

  return (
    <>
      <div className="p-2 sm:p-4 md:p-6 h-[calc(100vh-4rem)] flex flex-col print:hidden">
      {/* Page header */}
      <div className="flex flex-col gap-1.5 sm:gap-3 mb-2 md:mb-4 print:mb-6 shrink-0">
        
        {/* Top Row: Title & Primary Actions */}
        <div className="flex flex-wrap items-center justify-between gap-1.5 sm:gap-3">
          <div className="flex items-baseline gap-2">
            <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-800 print:text-3xl">送迎ボード</h1>
            <p className="text-[11px] sm:text-xs md:text-sm text-gray-500 print:text-base">出席 {totalPresent}名</p>
          </div>
          
          <div className="flex items-center gap-1.5 sm:gap-2 print:hidden">
            {/* 迎え/送り 切り替え */}
            <div className="flex bg-gray-100 p-0.5 sm:p-1 rounded-lg shrink-0">
              <button
                onClick={() => setActiveTab("inbound")}
                className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-md text-[11px] sm:text-xs font-bold transition-colors ${
                  activeTab === "inbound" ? "bg-white shadow-sm text-blue-700" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                迎え
              </button>
              <button
                onClick={() => setActiveTab("outbound")}
                className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-md text-[11px] sm:text-xs font-bold transition-colors ${
                  activeTab === "outbound" ? "bg-white shadow-sm text-indigo-700" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                送り
              </button>
            </div>

            {/* 編集 / 保存 ボタン */}
            {!isEditing ? (
              <Button
                size="sm"
                onClick={handleStartEdit}
                className="gap-1 h-7 sm:h-8 md:h-9 px-2.5 sm:px-3.5 text-xs sm:text-sm font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-sm shrink-0"
              >
                ✏️ 編集する
              </Button>
            ) : (
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  onClick={handleSaveEdit}
                  disabled={isSaving}
                  className="gap-1 h-7 sm:h-8 md:h-9 px-2 sm:px-3 text-xs sm:text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-sm shrink-0"
                >
                  {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "💾"} 保存
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCancelEdit}
                  disabled={isSaving}
                  className="h-7 sm:h-8 md:h-9 px-1.5 sm:px-2.5 text-[11px] sm:text-xs shrink-0"
                >
                  破棄
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* 2行目: サブアクション（印刷, リセット, 自動配車, 超過警告） */}
        <div className="flex items-center justify-between gap-1 overflow-x-auto pb-0.5 print:hidden">
          <div className="flex items-center gap-1 sm:gap-2">
            <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1 h-6 sm:h-7 px-2 text-[11px] sm:text-xs shrink-0">
              <Printer className="w-3 h-3" />
              印刷
            </Button>
            <Button variant="outline" size="sm" disabled={!isEditing} onClick={() => handleReset()} className="gap-1 h-6 sm:h-7 px-2 text-[11px] sm:text-xs shrink-0 disabled:opacity-40">
              <RotateCcw className="w-3 h-3" />
              リセット
            </Button>
            <Button 
              size="sm" 
              onClick={handleAutoAssign} 
              disabled={isAutoAssigning || !isEditing}
              className="gap-1 h-6 sm:h-7 px-2 text-[11px] sm:text-xs bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-40 shrink-0"
            >
              <Sparkles className={`w-3 h-3 ${isAutoAssigning ? "animate-pulse" : ""}`} />
              {isAutoAssigning ? "配車中" : "自動配車"}
            </Button>
          </div>
          {overCapacityCols.length > 0 && (
            <div className="flex items-center gap-1 px-1.5 py-0.5 bg-red-100 text-red-700 rounded text-[10px] sm:text-xs font-bold shrink-0">
              ⚠️ {overCapacityCols.length}台超過
            </div>
          )}
        </div>

        {/* Bottom Row: Date Selector */}
        <DateSelector selectedDate={selectedDate} onChange={handleDateChange} />
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

      {/* 編集モード通知バー */}
      {isEditing && (
        <div className="shrink-0 mb-2 px-2.5 py-1 sm:px-4 sm:py-2.5 bg-amber-100 border border-amber-400 rounded-md sm:rounded-lg text-xs sm:text-sm font-bold text-amber-900 flex items-center gap-1.5 print:hidden">
          ⚠️ 編集中: 【{formatDate(selectedDate).replace("-", "年").replace("-", "月")}日】（「保存」で確定）
        </div>
      )}

      {/* Auto-assign banner */}
      {isAutoAssigned && (
        <div className="shrink-0 mb-2 px-2.5 py-1 sm:px-4 sm:py-2 bg-indigo-50 border border-indigo-200 rounded-md sm:rounded-lg text-xs sm:text-sm text-indigo-700 print:hidden">
          ✨ 自動配車が完了しました
        </div>
      )}

      {/* ===== スマホ表示（モバイル・md未満）: 左右スワイプカンバン方式 ===== */}
      <div className="flex md:hidden flex-1 overflow-x-auto overflow-y-hidden print:overflow-visible min-h-0 touch-pan-x">
        <div className="flex flex-row gap-3 h-full min-h-full pb-2 items-start snap-x snap-mandatory">
          {/* 未割り当て列 */}
          <div className="w-[86vw] min-w-[86vw] shrink-0 snap-start h-full max-h-full flex flex-col print:hidden">
            <UnassignedPool 
              className="w-full h-full max-h-full"
              children={(board?.unassigned?.children || [])} 
              mode={activeTab} 
              readOnly={!isEditing}
              onChildClick={handleChildClick} 
              onAssignTo={async (child, targetTripId) => {
                moveChild(activeTab, child.id, "unassigned", targetTripId);
                await performAutoSave();
              }}
            />
          </div>

          {/* 車両列群 */}
          {(displayColumns || []).map((col: any) => (
            <div
              key={col?.id || col?.vehicleId || col?.vehicleName}
              className="w-[86vw] min-w-[86vw] shrink-0 snap-start h-full max-h-full flex flex-col print:w-auto print:flex-1"
            >
              <VehicleColumn
                column={col}
                mode={activeTab}
                readOnly={!isEditing}
                className="w-full h-full max-h-full"
                onChildClick={handleChildClick}
                onReorderChild={handleDirectReorder}
                onChangeLocation={async () => { await performAutoSave(); }}
                onDeleteTrip={async () => { await performAutoSave(); }}
              />
            </div>
          ))}

          {/* 家族迎え専用列（送りタブのみ） */}
          {activeTab === "outbound" && (
            <div className="w-[86vw] min-w-[86vw] shrink-0 snap-start h-full max-h-full flex flex-col print:hidden">
              <FamilyPickupColumn
                className="w-full h-full max-h-full"
                children={board?.familyPickup?.children || []}
                onChildClick={handleChildClick}
              />
            </div>
          )}
        </div>
      </div>

      {/* ===== PC表示（デスクトップ・md以上）: 左右2カラム・全車両グリッド一望レイアウト ===== */}
      <div className="hidden md:flex flex-row gap-4 items-start flex-1 min-h-0 w-full print:overflow-visible">
        {/* 左カラム: 未割り当てリスト（スリム化） */}
        <div className="w-64 lg:w-[270px] shrink-0 h-full max-h-[calc(100vh-230px)] flex flex-col print:hidden">
          <UnassignedPool 
            className="w-full h-full max-h-[calc(100vh-230px)] flex flex-col"
            children={(board?.unassigned?.children || [])} 
            mode={activeTab} 
            readOnly={!isEditing}
            onChildClick={handleChildClick} 
            onAssignTo={async (child, targetTripId) => {
              moveChild(activeTab, child.id, "unassigned", targetTripId);
              await performAutoSave();
            }}
          />
        </div>

        {/* 右カラム: 車両カード一覧（グリッド展開で全車両を一望） */}
        <div className="flex-1 min-w-0 h-full max-h-[calc(100vh-230px)] overflow-y-auto pr-1">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3.5 xl:gap-4 items-start w-full">
            {(displayColumns || []).map((col: any) => (
              <VehicleColumn
                key={col?.id || col?.vehicleId || col?.vehicleName}
                column={col}
                mode={activeTab}
                readOnly={!isEditing}
                className="w-full min-w-[260px]"
                onChildClick={handleChildClick}
                onReorderChild={handleDirectReorder}
                onChangeLocation={async () => { await performAutoSave(); }}
                onDeleteTrip={async () => { await performAutoSave(); }}
              />
            ))}

            {/* 家族迎え専用列（送りタブのみ・グリッド内に美しく配置） */}
            {activeTab === "outbound" && (
              <FamilyPickupColumn
                className="w-full min-w-[260px]"
                children={board?.familyPickup?.children || []}
                onChildClick={handleChildClick}
              />
            )}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-2 flex flex-wrap items-center gap-2 sm:gap-4 text-[10px] sm:text-xs text-gray-500 border-t border-gray-200 pt-2 shrink-0">
        <span className="font-medium">凡例:</span>
        <span className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-blue-500 rounded-full" /> 通常
        </span>
        <span className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-amber-500 rounded-full" /> 満員
        </span>
        <span className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-red-500 rounded-full" /> 定員超過
        </span>
        <span className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-amber-100 border border-amber-300 rounded-sm" /> 配慮事項
        </span>
      </div>
    </div>
      
    {/* ===== 印刷用レイアウト（通常は非表示） ===== */}
    <div className="hidden print:flex font-sans text-black board-print-container">
      <div>
        {/* 印刷ヘッダー */}
        <div className="mb-1.5 border-b-2 border-gray-400 pb-1 flex justify-between items-end">
          <div>
            <h1 className="text-[15px] font-bold leading-tight">
              放デイ 送迎運行表（{activeTab === "inbound" ? "迎え" : "送り"}）
            </h1>
            <p className="text-[13px] font-bold text-gray-800">{displayDate}</p>
          </div>
          <p className="text-[9px] text-gray-500">出力日時: {new Date().toLocaleString("ja-JP")}</p>
        </div>

        {/* 車両別運行表 */}
        <div className="grid grid-cols-4 gap-2">
          {displayColumns
            .filter((col: any) => (col.trips || []).some((t: any) => (t.children || []).length > 0))
            .map((col: any) => (
              <div key={col.id} className="break-inside-avoid mb-1 border border-gray-300 rounded p-1 bg-white">
                {/* 車両ヘッダー */}
                <div className="flex items-center gap-1.5 mb-1 border-b-2 border-gray-400 pb-0.5 bg-gray-50 px-1">
                  <h2 className="text-[13px] font-bold flex-1 truncate">
                    🚗 {col.vehicleName}
                  </h2>
                  <div className="text-[11.5px] flex gap-2 font-semibold text-gray-700 shrink-0">
                    <span>運転: {col.driverName}</span>
                    <span>定員: {col.capacity}</span>
                  </div>
                </div>

                {/* 便別テーブル */}
                {(col.trips || [])
                  .filter((t: any) => (t.children || []).length > 0)
                  .map((trip: any) => {
                    const sortedChildren = [...(trip.children || [])].sort((a, b) => {
                      const timeA = a.pickup_time || "99:99";
                      const timeB = b.pickup_time || "99:99";
                      return timeA.localeCompare(timeB);
                    });
                    const hasMultipleTrips = (col.trips || []).filter((t: any) => (t.children || []).length > 0).length > 1;
                    return (
                      <div key={trip.id} className="mb-1 break-inside-avoid">
                        {hasMultipleTrips && (
                          <div className="mb-0.5 text-[11px] font-bold">
                            <span className="px-1.5 py-0.5 bg-gray-200 border border-gray-400 rounded">
                              【{trip.tripIndex}便】 {activeTab === "inbound" ? "各所➔施設" : "施設➔各所"}
                            </span>
                          </div>
                        )}
                        <table className="w-full text-left border-collapse border border-gray-400 text-[11px] leading-[1.2]">
                          <thead>
                            <tr className="bg-gray-100 border-b border-gray-400 text-[11px]">
                              <th className="border border-gray-400 px-1 py-0.5 w-[12%] text-center font-bold">順</th>
                              <th className="border border-gray-400 px-1.5 py-0.5 w-[60%] font-bold">児童名</th>
                              <th className="border border-gray-400 px-1 py-0.5 w-[28%] text-center font-bold">時間</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sortedChildren.map((child: any, idx: number) => (
                              <tr key={child.id} className="border-b border-gray-300">
                                <td className="border border-gray-400 px-1 py-0.5 text-center font-semibold text-[11px]">{idx + 1}</td>
                                <td className="border border-gray-400 px-1.5 py-0.5 font-bold text-[12.5px] truncate">
                                  {child.name}
                                  {child.status === "late" && <span className="text-amber-700 text-[10px] ml-1 font-bold">遅刻</span>}
                                  {child.status === "early_leave" && <span className="text-purple-700 text-[10px] ml-1 font-bold">早退</span>}
                                </td>
                                <td className="border border-gray-400 px-1 py-0.5 font-mono text-center font-bold text-[12px]">{child.pickup_time || "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    );
                  })}
              </div>
            ))}
        </div>

        {/* ===== 家族迎え枠（送りのみ） ===== */}
        {activeTab === "outbound" && (board.familyPickup?.children || []).length > 0 && (
          <div className="break-inside-avoid mt-1.5 border border-gray-300 rounded p-1 bg-white">
            <div className="flex items-center gap-2 mb-1 border-b-2 border-gray-400 pb-0.5 px-1 bg-gray-50">
              <h2 className="text-[12.5px] font-bold flex-1">🏠 家族迎え／来所受取</h2>
              <span className="text-[11px] font-semibold text-gray-700">
                {(board.familyPickup?.children || []).length}名
              </span>
            </div>
            <table className="w-full text-left border-collapse border border-gray-400 text-[11px] leading-[1.2]">
              <thead>
                <tr className="bg-gray-100 border-b border-gray-400 text-[11px]">
                  <th className="border border-gray-400 px-1 py-0.5 w-[12%] text-center font-bold">順</th>
                  <th className="border border-gray-400 px-1.5 py-0.5 w-[60%] font-bold">児童名</th>
                  <th className="border border-gray-400 px-1 py-0.5 w-[28%] text-center font-bold">時間</th>
                </tr>
              </thead>
              <tbody>
                {[...(board.familyPickup?.children || [])].sort((a: any, b: any) => {
                  const timeA = a.pickup_time || "99:99";
                  const timeB = b.pickup_time || "99:99";
                  return timeA.localeCompare(timeB);
                }).map((child: any, idx: number) => (
                  <tr key={child.id} className="border-b border-gray-300">
                    <td className="border border-gray-400 px-1 py-0.5 text-center font-semibold text-[11px]">{idx + 1}</td>
                    <td className="border border-gray-400 px-1.5 py-0.5 font-bold text-[12.5px] truncate">
                      {child.name}
                      {child.status === "late" && <span className="text-amber-700 text-[10px] ml-1 font-bold">遅刻</span>}
                      {child.status === "early_leave" && <span className="text-purple-700 text-[10px] ml-1 font-bold">早退</span>}
                    </td>
                    <td className="border border-gray-400 px-1 py-0.5 font-mono text-center font-bold text-[12px]">{child.pickup_time || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* フッター（余白最小化） */}
      <div className="mt-1 pt-1 border-t border-gray-300 flex justify-between text-[9px] text-gray-400">
        <span>放課後等デイサービス 送迎運行表</span>
        <span>{displayDate} — {activeTab === "inbound" ? "迎え" : "送り"}</span>
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
                <h3 className="text-sm font-semibold text-gray-500">別の車両・便へ移動 (最後尾に追加)</h3>
                <div className="flex flex-col gap-2">
                  {displayColumns.flatMap((col) => 
                    (col.trips || []).map(trip => {
                      const isCurrent = trip.id === selectedChild.columnId;
                      const isFull = (trip.children || []).length >= col.capacity;
                      return (
                        <Button
                          key={trip.id}
                          variant="outline"
                          className={cn(
                            "justify-start text-left h-auto py-3",
                            isCurrent && "border-blue-500 bg-blue-50 cursor-default hover:bg-blue-50",
                            !isCurrent && isFull && "opacity-75"
                          )}
                          onClick={() => !isCurrent && handleAssignTo(trip.id)}
                        >
                          <div className="flex flex-col items-start gap-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold">{col.vehicleName} {(col.trips || []).length > 1 ? `(${trip.tripIndex}便)` : ""}</span>
                              {isCurrent && <span className="text-xs text-blue-600 font-bold bg-blue-100 px-2 py-0.5 rounded">現在</span>}
                              {!isCurrent && isFull && <span className="text-xs text-amber-600 font-bold bg-amber-100 px-2 py-0.5 rounded">満員</span>}
                            </div>
                            <span className="text-xs text-gray-500">{col.driverName}</span>
                          </div>
                        </Button>
                      );
                    })
                  )}
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

                  {/* 家族迎えボタン（送りタブのみ） */}
                  {activeTab === "outbound" && (
                    <Button
                      variant="outline"
                      className={cn(
                        "justify-start text-left h-auto py-3 mt-1 border-emerald-300 text-emerald-800 hover:bg-emerald-50",
                        selectedChild.columnId === "family-pickup" && "border-emerald-500 bg-emerald-50 cursor-default hover:bg-emerald-50"
                      )}
                      onClick={() => selectedChild.columnId !== "family-pickup" && handleAssignTo("family-pickup")}
                    >
                      <div className="flex flex-col items-start gap-0.5">
                        <div className="font-bold">🏠 家族迎えへ移動</div>
                        {selectedChild.columnId === "family-pickup" && (
                          <span className="text-xs text-emerald-600 font-bold">現在ここにいます</span>
                        )}
                      </div>
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <style jsx global>{`
        @media print {
          /* 1. 用紙設定: A4横向き、上下マージン各6mm、左右各8mm */
          @page {
            size: A4 landscape;
            margin: 6mm 8mm;
          }

          html, body {
            margin: 0 !important;
            padding: 0 !important;
            height: 100% !important;
            overflow: hidden !important;
            background: #fff !important;
          }

          /* 2. 印刷ルートコンテナ: A4横の高さ(210mm)から上下マージン(12mm)を引いたジャスト枠 */
          .board-print-container {
            width: 100% !important;
            height: calc(210mm - 12mm) !important;
            max-height: calc(210mm - 12mm) !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            page-break-after: avoid !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            overflow: hidden !important;
            box-sizing: border-box !important;
          }

          .board-print-container table {
            width: 100% !important;
            table-layout: fixed !important;
            border-collapse: collapse !important;
          }

          .board-print-container th,
          .board-print-container td {
            padding: 2.5px 4px !important;
            line-height: 1.2 !important;
            vertical-align: middle !important;
          }

          .board-print-container tr {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      `}</style>
    </>
  );
}
