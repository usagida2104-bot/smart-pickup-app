"use client";

import { useEffect, useState, useRef, useMemo, Suspense } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
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
import { ChildMagnet, VehicleColumn as VehicleColumnType, DailyAttendance, DailyStaff, DailyVehicle, BoardState } from "@/types";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase/client";
import { fetchDailyData, saveBoardState, fetchMonthlySchedule } from "@/lib/supabase/service";
import { getCellData } from "@/lib/scheduleUtils";
import { useDateStore, formatLocalDate, getTodayDateString, isValidDateString, parseDateString, changeDateByDays } from "@/lib/store/dateStore";
import { assignVehiclesWithoutOverlap, getVehicleColorTheme, getVehicleBadgeColor, getTripTimeSummary, isPickupRequired, isDropoffRequired, isTransportRequired, reconcileBoardWithAttendances, sortTripsByTime } from "@/lib/vehicleUtils";

function formatDate(date: Date) {
  return formatLocalDate(date);
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
    (col.trips || []).map((t: any) => {
      const tripLabel = mode === "outbound" ? (t?.departure_time || t?.time || "17:00") : `${t?.tripIndex || 1}便`;
      const vehiclePart = t?.vehicleId && t?.vehicleName && t.vehicleName !== "車両未選択" && t.vehicleName !== "車未定"
        ? ` (${t.vehicleName})`
        : "";
      return {
        id: t?.id,
        label: `${col?.staffName || col?.driverName || 'スタッフ'} ${tripLabel}${vehiclePart}`,
        isFull: (t?.children || []).length >= (t?.capacity || col?.capacity || 99)
      };
    })
  ).filter((t: any) => t.id);

  return (
    <div
      data-testid="unassigned-column"
      className={cn(
        "flex flex-col rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 overflow-hidden",
        className || "w-64 shrink-0"
      )}
    >
      <div className="px-3 py-1.5 md:py-2 border-b border-gray-200 bg-gray-100 flex items-center justify-between">
        <p className="font-bold text-gray-600 text-sm">📋 未割り当て</p>
        <span className="text-xs font-semibold px-2 py-0.5 bg-gray-200 text-gray-700 rounded-full">
          {(children || []).length}名
        </span>
      </div>
      <div
        data-testid="unassigned-pool"
        className="flex-1 p-1.5 md:p-2 min-h-[150px] overflow-visible md:overflow-y-auto md:overflow-x-hidden space-y-1 md:space-y-1.5 transition-colors"
      >
        {(children || []).map((magnet) => {
          const isLocked = !isTransportRequired(mode, magnet.transportMode);
          return (
            <ChildCard 
              key={magnet?.id || Math.random().toString()} 
              magnet={magnet} 
              mode={mode} 
              isLocked={isLocked}
              className="py-1.5 px-2"
              onClick={(m) => onChildClick(m, "unassigned")}
              actionSlot={
                <select
                  disabled={readOnly || isLocked}
                  className="text-[10px] bg-white border border-gray-300 rounded px-1 py-0.5 h-6 w-[64px] text-gray-700 cursor-pointer hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
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
          );
        })}
        {(children || []).length === 0 && (
          <div className="flex items-center justify-center h-24 text-gray-400 text-sm">
            全員が配車済みです 🎉
          </div>
        )}
      </div>
    </div>
  );
}

function BoardPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { selectedDateStr, setSelectedDateStr, setIsEditing: setGlobalIsEditing } = useDateStore();

  const queryDate = searchParams.get("date");
  const initialDateStr = (queryDate && isValidDateString(queryDate))
    ? queryDate
    : (selectedDateStr && isValidDateString(selectedDateStr) ? selectedDateStr : getTodayDateString());

  // 画面内部の日付State（UIの即時先行反映でチラつき・ループを完全防止）
  const [currentDateStr, setCurrentDateStr] = useState<string>(initialDateStr);
  const selectedDate = useMemo(() => parseDateString(currentDateStr), [currentDateStr]);

  // 最新の日付を保持するRef（高速連打時の最新日付の追跡＆Race Condition防止）
  const latestDateStrRef = useRef<string>(initialDateStr);
  latestDateStrRef.current = currentDateStr;

  // 直前にデータ取得した日付を記録するRef（重複ロード防止）
  const prevLoadedDateRef = useRef<string>("");

  const { children, attendances } = useMasterStore();
  const { staff: masterStaff, vehicles: masterVehicles } = useMasterStore();
  const { inboundBoard, outboundBoard, setBoard, moveChild, reorderChild } = useBoardStore();
  const [activeTab, setActiveTab] = useState<"inbound" | "outbound">("inbound");

  // 初回マウント時: URLにdateパラメータがない場合のみ一度だけ補完
  useEffect(() => {
    setSelectedDateStr(initialDateStr);
    const currentUrlParams = new URLSearchParams(window.location.search);
    if (!currentUrlParams.get("date")) {
      router.replace(`${pathname}?date=${initialDateStr}`, { scroll: false });
    }
  }, []);

  // ブラウザの戻る/進む等でURLクエリが変わった場合のみ内部Stateへ同期（相互ループ完全排除）
  useEffect(() => {
    if (queryDate && isValidDateString(queryDate)) {
      if (queryDate !== latestDateStrRef.current) {
        latestDateStrRef.current = queryDate;
        setCurrentDateStr(queryDate);
        setSelectedDateStr(queryDate);
      }
    }
  }, [queryDate, setSelectedDateStr]);

  // アンマウント時に編集フラグをクリア
  useEffect(() => {
    return () => {
      setGlobalIsEditing(false);
    };
  }, [setGlobalIsEditing]);
  
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
    setGlobalIsEditing(v);
  };
  // ローカルステートとして管理（masterStoreには存在しないため）
  const [dailyStaff, setDailyStaff] = useState<any[]>([]);
  const [dailyVehicles, setDailyVehicles] = useState<any[]>([]);

  // 作成者（localStorage保持）
  const [creatorName, setCreatorName] = useState<string>("");
  // 当日の各リーダー（ぽっけ、ぽっけⅡ、日中）
  const [leaders, setLeaders] = useState<{ pokke: string; pokke2: string; nichu: string }>({
    pokke: "-",
    pokke2: "-",
    nichu: "-",
  });

  useEffect(() => {
    try {
      const saved = localStorage.getItem("board_creator_name");
      if (saved) {
        setCreatorName(saved);
      }
    } catch (e) {
      console.warn("Failed to load creator name from localStorage", e);
    }
  }, []);

  const handleCreatorChange = (name: string) => {
    setCreatorName(name);
    try {
      localStorage.setItem("board_creator_name", name);
    } catch (e) {
      console.warn("Failed to save creator name to localStorage", e);
    }
  };

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

    // 送迎不要（日別設定の送迎フラグがOFF）の児童はスタッフ便への移動不可（ロック）
    const att = attendances.find((a) => a.child_id === magnet.id);
    const status = att ? att.status : magnet.transportMode;
    if (!isTransportRequired(activeTab, status)) {
      showToast("error", "⚠️ 送迎不要（家族送迎）の児童はスタッフ便へ移動できません");
      return;
    }

    setSelectedChild({ magnet, columnId });
  };

  const handleAssignTo = async (targetColumnId: string) => {
    if (!selectedChild) return;
    console.log("=== handleAssignTo ===", { selectedChild, targetColumnId });

    // 送迎不要児童の移動ガード（二重防御）
    const att = attendances.find((a) => a.child_id === selectedChild.magnet.id);
    const status = att ? att.status : selectedChild.magnet.transportMode;
    if (!isTransportRequired(activeTab, status) && targetColumnId !== "family-pickup") {
      showToast("error", "⚠️ 送迎不要（家族送迎）の児童はスタッフ便へ移動できません");
      setSelectedChild(null);
      return;
    }

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
      // ★家族迎えプールの児童および日別設定で送迎不要の児童は自動配車から完全に除外★
      const allChildrenOnBoard = [
        ...(board?.unassigned?.children || []),
        ...(board?.columns || []).flatMap((c: any) => (c.trips || []).flatMap((t: any) => t.children || []))
      ].filter((c: any) => {
        const att = attendances.find((a: any) => a.child_id === c.id);
        const status = att ? att.status : c.transportMode;
        return isTransportRequired(activeTab, status);
      });

      const currentAttendances = allChildrenOnBoard.map((c: any) => {
        const timeVal = c.pickup_time || (c as any).departure_time;
        const validTime = (timeVal && typeof timeVal === "string" && timeVal.trim() !== "" && timeVal.trim() !== "-")
          ? timeVal.trim()
          : null;
        return {
          id: c.id,
          child_id: c.id,
          status: c.transportMode,
          pickup_time: validTime,
          departure_time: validTime,
          attendance_status: "present",
          child: children.find(masterC => masterC.id === c.id) || {
            id: c.id,
            name: c.name,
            has_caution: c.has_caution,
            notes: c.notes,
            school: { name: c.school_name, color_code: c.color, area: c.school_area },
          }
        };
      });

      if (currentAttendances.length === 0) {
        setIsAutoAssigning(false);
        return;
      }

      const inputShifts = displayColumns.map((col: any, colIdx: number) => {
        const trip1 = (col.trips || [])[0];
        const v = availableVehiclesForSelect.find((v: any) => v.id === trip1?.vehicleId)
          || availableVehiclesForSelect[colIdx % availableVehiclesForSelect.length]
          || masterVehicles[0];
        return {
          id: col.id,
          target_date: formatDate(selectedDate),
          vehicle_id: v?.id || col.id,
          driver_id: col.staffId || col.driverId,
          vehicle: { id: v?.id, capacity: trip1?.capacity || v?.capacity || 6, name: trip1?.vehicleName || v?.name },
          driver: { id: col.staffId || col.driverId, name: col.staffName || col.driverName },
          driverStatus: col.driverStatus,
          driverStatusTime: col.driverStatusTime
        };
      }) as any[];

      // APIを通さず、直接ローカルでアルゴリズムを実行
      const result = autoAssignVehicles({ attendances: currentAttendances as any[], shifts: inputShifts });

      const mergedColumns = displayColumns.map((originalCol: any, cIdx: number) => {
        const assignedCol = result.columns.find((c: any) => c.id === originalCol.id) || result.columns[cIdx];
        const newTrips = (assignedCol?.trips || []).map((t: any) => {
          const existingTrip = (originalCol.trips || []).find((ot: any) => ot.tripIndex === t.tripIndex);
          const v = availableVehiclesForSelect.find((av: any) => av.id === existingTrip?.vehicleId)
            || availableVehiclesForSelect[cIdx % availableVehiclesForSelect.length]
            || masterVehicles[0];
          return {
            ...t,
            id: t.id || `${originalCol.id}-trip-${t.tripIndex}`,
            vehicleId: existingTrip?.vehicleId || v?.id,
            vehicleName: existingTrip?.vehicleName || v?.name,
            capacity: existingTrip?.capacity || v?.capacity || 6,
          };
        });
        return {
          ...originalCol,
          trips: newTrips.length > 0 ? newTrips : originalCol.trips,
        };
      });

      // ★時間重複（ダブルブッキング）完全排除アルゴリズム★
      // 1便目同士の重複禁止、2便目は1便目終了後の空き車両のみを再利用
      const newColumns = assignVehiclesWithoutOverlap(mergedColumns, availableVehiclesForSelect);

      // === デバッグ用コンソールログ ===
      console.log("=== 自動配車デバッグログ ===");
      console.log(`対象児童総数: ${currentAttendances.length}人`);
      newColumns.forEach((col: any) => {
        const tripsLog = (col.trips || []).map((t: any) => `${t.tripIndex}便 (${t.vehicleName}): ${(t.children || []).length}人`).join(", ");
        console.log(`${col.staffName || col.driverName} [${tripsLog}]`);
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

  // 矢印ナビゲーション（< / >）: 最新Refを元に即座に計算し、State先行反映＋URL更新
  const handleNavigateDate = (days: number) => {
    if (isEditingRef.current) {
      if (!window.confirm("未保存の変更があります。変更を破棄して移動しますか？")) return;
      setEditingMode(false);
      setIsAutoAssigned(false);
      setSelectedChild(null);
    }

    // 最新Ref（またはState・URL）から確実に現在の日付を取得し、JST/ローカル安全加減算
    const baseDateStr = latestDateStrRef.current || searchParams.get("date") || currentDateStr;
    const newDateStr = changeDateByDays(baseDateStr, days);

    // 最新Refを即座に更新（高速連打時も確実に連続移動）
    latestDateStrRef.current = newDateStr;

    // 画面内部Stateを即座に先行反映（UIチラつき・ピンポン往復ループを完全防止）
    setCurrentDateStr(newDateStr);
    setSelectedDateStr(newDateStr);

    // URLクエリを更新（scroll: false で位置を保持）
    router.replace(`${pathname}?date=${newDateStr}`, { scroll: false });
  };

  // 「今日」ボタン: 今日の一意な日付文字列へ安全に一度だけ遷移
  const handleSelectToday = () => {
    if (isEditingRef.current) {
      if (!window.confirm("未保存の変更があります。変更を破棄して移動しますか？")) return;
      setEditingMode(false);
      setIsAutoAssigned(false);
      setSelectedChild(null);
    }

    const todayStr = getTodayDateString();
    if (latestDateStrRef.current === todayStr) return;

    latestDateStrRef.current = todayStr;
    setCurrentDateStr(todayStr);
    setSelectedDateStr(todayStr);

    router.replace(`${pathname}?date=${todayStr}`, { scroll: false });
  };

  // カレンダー直接選択（<input type="date"> 等）
  const handleDateChange = (date: Date) => {
    if (isEditingRef.current) {
      if (!window.confirm("未保存の変更があります。変更を破棄して移動しますか？")) return;
      setEditingMode(false);
      setIsAutoAssigned(false);
      setSelectedChild(null);
    }
    const newDateStr = formatDate(date);
    if (latestDateStrRef.current === newDateStr) return;

    latestDateStrRef.current = newDateStr;
    setCurrentDateStr(newDateStr);
    setSelectedDateStr(newDateStr);

    router.replace(`${pathname}?date=${newDateStr}`, { scroll: false });
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
    
    // 迎え: 送迎が必要な児童 -> 未割り当て, 送迎不要(保護者来所等) -> 家族枠
    const inboundChildren = attsToUse
      .filter(a => {
        const transportStatus = a.status || "both";
        const attendanceStatus = a.attendance_status || "present";
        const isAbsent = attendanceStatus === "absent" || transportStatus === "absent";
        return !isAbsent && isPickupRequired(transportStatus);
      })
      .filter(a => children.some((c: any) => c.id === a.child_id))
      .map(a => toMagnet(a.child_id, children, attsToUse));

    const inboundFamilyPickupChildren = attsToUse
      .filter(a => {
        const transportStatus = a.status || "both";
        const attendanceStatus = a.attendance_status || "present";
        const isAbsent = attendanceStatus === "absent" || transportStatus === "absent";
        return !isAbsent && !isPickupRequired(transportStatus);
      })
      .filter(a => children.some((c: any) => c.id === a.child_id))
      .map(a => toMagnet(a.child_id, children, attsToUse));

    // 送り: 送迎が必要な児童 -> 未割り当て, 送迎不要(家族迎え等) -> 家族枠
    const outboundChildren = attsToUse
      .filter(a => {
        const transportStatus = a.status || "both";
        const attendanceStatus = a.attendance_status || "present";
        const isAbsent = attendanceStatus === "absent" || transportStatus === "absent";
        return !isAbsent && isDropoffRequired(transportStatus);
      })
      .filter(a => children.some((c: any) => c.id === a.child_id))
      .map(a => toMagnet(a.child_id, children, attsToUse));

    const outboundFamilyPickupChildren = attsToUse
      .filter(a => {
        const transportStatus = a.status || "both";
        const attendanceStatus = a.attendance_status || "present";
        const isAbsent = attendanceStatus === "absent" || transportStatus === "absent";
        return !isAbsent && !isDropoffRequired(transportStatus);
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
            vehicleId: null,
            vehicleName: null,
            capacity: undefined,
            trips: [{
              ...firstTrip,
              vehicleId: null,
              vehicleName: null,
              capacity: undefined,
              children: [],
            }],
          };
        }),
        unassigned: { id: "unassigned", children: inboundChildren },
        familyPickup: { id: "family-pickup", children: inboundFamilyPickupChildren },
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
            vehicleId: null,
            vehicleName: null,
            capacity: undefined,
            trips: [{
              ...firstTrip,
              vehicleId: null,
              vehicleName: null,
              capacity: undefined,
              children: [],
            }],
          };
        }),
        unassigned: { id: "unassigned", children: outboundChildren },
        familyPickup: { id: "family-pickup", children: outboundFamilyPickupChildren },
      });
    }

    // リセット後、最新状態をSupabaseに上書き保存
    setTimeout(async () => {
      await performAutoSave();
    }, 0);
  };

  // ボード表示用カラム: 常に Zustand の board.columns を直接使用（参照の乖離を完全排除）
  // ボード表示用カラム: 常に Zustand の board.columns を直接使用
  const displayColumns = board?.columns || [];

  // 使用可能車両一覧（各便ヘッダーの選択肢用）
  const activeDailyVehiclesList = (dailyVehicles || [])
    .filter((dv: any) => dv?.is_active !== false)
    .map((dv: any) => dv?.vehicle || masterVehicles.find((mv: any) => mv.id === dv.vehicle_id))
    .filter(Boolean);
  const availableVehiclesForSelect = activeDailyVehiclesList.length > 0 ? activeDailyVehiclesList : masterVehicles;

  // Initialize board on mount and date change
  useEffect(() => {
    if (children.length === 0) return;

    const targetDateStr = currentDateStr;

    // 直前に読み込んだ日付と同じでリロード要求もない場合はスキップ（過剰な二重取得を防止）
    if (prevLoadedDateRef.current === targetDateStr && reloadKey === 0) {
      return;
    }
    prevLoadedDateRef.current = targetDateStr;

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

        // 担当スケジュールからのリーダー情報取得
        const monthStr = targetDateStr.substring(0, 7);
        let daySchedule: Record<string, string> = {};
        try {
          const monthlySchedule = await fetchMonthlySchedule(monthStr);
          if (monthlySchedule && monthlySchedule[targetDateStr]) {
            daySchedule = monthlySchedule[targetDateStr];
          }
        } catch (e) {
          console.error("Failed to fetch monthly schedule for leaders:", e);
        }

        let leaderPokke = "-";
        let leaderPokke2 = "-";
        let leaderNichu = "-";

        // 1. スケジュール表のセルデータから探索
        Object.entries(daySchedule).forEach(([staffName, cellRaw]) => {
          const { role } = getCellData(cellRaw);
          if (/ぽっけ[2２ⅡII]リーダー/.test(role)) {
            leaderPokke2 = staffName;
          } else if (/ぽっけリーダー/.test(role)) {
            leaderPokke = staffName;
          } else if (/日中.*リーダー/.test(role)) {
            leaderNichu = staffName;
          }
        });

        // 2. dailyStaffのroleからもフォールバック探索
        mergedStaff.forEach((ds: any) => {
          const role = ds.role || "";
          const name = ds.staff?.name || "";
          if (!name) return;
          if (/ぽっけ[2２ⅡII]リーダー/.test(role) && leaderPokke2 === "-") {
            leaderPokke2 = name;
          } else if (/ぽっけリーダー/.test(role) && leaderPokke === "-") {
            leaderPokke = name;
          } else if (/日中.*リーダー/.test(role) && leaderNichu === "-") {
            leaderNichu = name;
          }
        });

        setLeaders({
          pokke: leaderPokke,
          pokke2: leaderPokke2,
          nichu: leaderNichu,
        });

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

        // 本日使用可能な車両（dailyVehicles で is_active === true）
        const activeDailyVehicles = (mergedVehicles || []).filter((dv: any) => dv?.is_active !== false);
        const activeVehicles = activeDailyVehicles.map((dv: any) => dv?.vehicle || masterVehicles.find((mv: any) => mv.id === dv.vehicle_id)).filter(Boolean);
        const availableVehiclesList = activeVehicles.length > 0 ? activeVehicles : masterVehicles;

        // 本日の出勤スタッフ（休み以外、かつ is_driver を優先、なければ出勤者全員）
        const activeDrivers = (mergedStaff || []).filter(
          (ds: any) => ds?.staff?.is_driver && ds?.status !== "absent"
        );
        const staffToUse = activeDrivers.length > 0
          ? activeDrivers
          : (mergedStaff || []).filter((ds: any) => ds?.status !== "absent");

        // 出勤スタッフが0名の場合は、全スタッフをフォールバック
        const finalStaffList = staffToUse.length > 0
          ? staffToUse
          : masterStaff.map(s => ({ staff_id: s.id, status: "present", role: s.role, staff: s }));

        const buildColumnsForBoard = (savedBoard: any) => {
          return finalStaffList.map((ds: any, staffIdx: number) => {
            const s = ds.staff;
            const staffId = ds.staff_id || s?.id;
            const staffName = s?.name || "担当スタッフ";
            const driverStatus = ds.status;
            const driverStatusTime = ds.status_time;
            const staffRole = ds.role;
            const colId = `staff-${staffId}`;

            // 保存データがあればそのスタッフのカラムを引き継ぐ
            const savedCol = (savedBoard?.columns || []).find((c: any) => 
              String(c.staffId) === String(staffId) ||
              String(c.driverId) === String(staffId) ||
              String(c.id) === String(colId) ||
              c.staffName === staffName ||
              c.driverName === staffName
            );

            let trips = savedCol?.trips || [];
            if (trips.length === 0) {
              trips = [
                {
                  id: `${colId}-trip-1`,
                  tripIndex: 1,
                  vehicleId: null,
                  vehicleName: null,
                  capacity: undefined,
                  children: [],
                }
              ];
            } else {
              trips = trips.map((t: any, idx: number) => {
                const matchedV = t.vehicleId
                  ? (availableVehiclesList.find((v: any) => String(v.id) === String(t.vehicleId))
                     || masterVehicles.find((v: any) => String(v.id) === String(t.vehicleId)))
                  : null;
                return {
                  ...t,
                  id: t.id || `${colId}-trip-${idx + 1}`,
                  tripIndex: t.tripIndex || (idx + 1),
                  vehicleId: matchedV ? matchedV.id : (t.vehicleId || null),
                  vehicleName: matchedV ? matchedV.name : (t.vehicleName || null),
                  capacity: matchedV ? matchedV.capacity : t.capacity,
                  children: (t.children || []).map((c: any) => toMagnet(c.id, children, mergedAtts))
                };
              });
            }

            return {
              id: colId,
              shiftId: colId,
              staffId,
              staffName,
              driverId: staffId,
              driverName: staffName,
              driverStatus,
              driverStatusTime,
              staffRole,
              vehicleId: trips[0]?.vehicleId || null,
              vehicleName: trips[0]?.vehicleName || null,
              capacity: trips[0]?.capacity,
              trips,
            };
          });
        };

        // 迎えタブ：初期カラム・保存済み枠を構築後、最新の日別出欠フラグ（Single Source of Truth）で厳格にリコンシリエーション
        const initialInboundBoard: BoardState = {
          columns: buildColumnsForBoard(boardState?.inbound_board),
          unassigned: {
            id: "unassigned",
            children: (boardState?.inbound_board?.unassigned?.children || []).map((c: any) => toMagnet(c.id, children, mergedAtts)).filter(Boolean)
          },
          familyPickup: {
            id: "family-pickup",
            children: (boardState?.inbound_board?.familyPickup?.children || []).map((c: any) => toMagnet(c.id, children, mergedAtts)).filter(Boolean)
          }
        };
        const reconciledInbound = reconcileBoardWithAttendances(initialInboundBoard, mergedAtts, children, "inbound");

        // 送りタブ：初期カラム・保存済み枠を構築後、最新の日別出欠フラグ（Single Source of Truth）で厳格にリコンシリエーション
        const initialOutboundBoard: BoardState = {
          columns: buildColumnsForBoard(boardState?.outbound_board),
          unassigned: {
            id: "unassigned",
            children: (boardState?.outbound_board?.unassigned?.children || []).map((c: any) => toMagnet(c.id, children, mergedAtts)).filter(Boolean)
          },
          familyPickup: {
            id: "family-pickup",
            children: (boardState?.outbound_board?.familyPickup?.children || []).map((c: any) => toMagnet(c.id, children, mergedAtts)).filter(Boolean)
          }
        };
        const reconciledOutbound = reconcileBoardWithAttendances(initialOutboundBoard, mergedAtts, children, "outbound");

        // Zustand ストアにセット
        useBoardStore.getState().setBoard("inbound", reconciledInbound);
        useBoardStore.getState().setBoard("outbound", reconciledOutbound);

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
  }, [children, currentDateStr, masterStaff, masterVehicles, reloadKey]);

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
      if (!boardState) return;

      // 1. コラムのドライバー最新情報を更新
      const updatedCols = (boardState.columns || []).map((col: any) => {
        const driver = dailyStaff.find((ds: any) => ds.staff_id === col.driverId);
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
          trips: tripsToUse,
        };
      });

      // 2. 最新出欠データ（Single Source of Truth）でボード全体をリコンシリエーション
      // 送迎フラグがONになった児童は家族枠から解放され未割り当てへ、OFFになった児童は家族枠へ即時再配置される
      const boardToReconcile: BoardState = {
        columns: updatedCols,
        unassigned: boardState.unassigned || { id: "unassigned", children: [] },
        familyPickup: boardState.familyPickup || { id: "family-pickup", children: [] },
      };

      const reconciled = reconcileBoardWithAttendances(boardToReconcile, attendances, children, mode);
      useBoardStore.getState().setBoard(mode, reconciled);
    };

    syncBoard(useBoardStore.getState().inboundBoard, "inbound");
    syncBoard(useBoardStore.getState().outboundBoard, "outbound");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  // ★ attendances が変わっても保存中（isSavingRef.current）はスキップ
  }, [children, dailyStaff, attendances]);

  // ウィンドウフォーカス復帰・タブ復帰時に最新データを自動再検証（revalidateOnFocus）
  useEffect(() => {
    const handleFocus = () => {
      // 編集中や保存中でない場合、DBから最新データを再検証・再取得
      if (!isSavingRef.current && !isEditingRef.current) {
        console.log("[Board] Window focused / tab activated, revalidating latest daily data...");
        setReloadKey(k => k + 1);
      }
    };

    window.addEventListener("focus", handleFocus);
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        handleFocus();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);




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

  // 当日の出席児童データから、所属（ぽっけ、ぽっけⅡ、日中一時）ごとの利用人数を集計
  const presentChildIds = new Set<string>();
  displayColumns.forEach((col: any) => {
    (col.trips || []).forEach((t: any) => {
      (t.children || []).forEach((c: any) => {
        if (c?.id) presentChildIds.add(c.id);
      });
    });
  });
  (board?.unassigned?.children || []).forEach((c: any) => {
    if (c?.id) presentChildIds.add(c.id);
  });
  (board?.familyPickup?.children || []).forEach((c: any) => {
    if (c?.id) presentChildIds.add(c.id);
  });

  // 万が一ボード上に児童がいなければ attendances からも補完
  if (presentChildIds.size === 0 && Array.isArray(attendances)) {
    attendances.forEach((a: any) => {
      const isAbsent = a.attendance_status === "absent" || a.status === "absent";
      if (!isAbsent && a.child_id) {
        presentChildIds.add(a.child_id);
      }
    });
  }

  let countPokke = 0;
  let countPokke2 = 0;
  let countNichu = 0;

  presentChildIds.forEach((id) => {
    const child = children.find((c: any) => c.id === id);
    const u = (child?.unit_name || child?.school?.name || "").trim();
    if (/ぽっけ[2２ⅡII]/.test(u)) {
      countPokke2++;
    } else if (/日中/.test(u)) {
      countNichu++;
    } else {
      countPokke++;
    }
  });

  const totalPresentCount = countPokke + countPokke2 + countNichu;

  const overCapacityCols = displayColumns.filter(
    (col) => (col.trips || []).some((t: any) => (t.children || []).length > (col.capacity || 0))
  );

  // iOS Safari での「自動印刷禁止」警告を完全防止するための直接同期的印刷
  // ユーザーのタップ操作イベントスタック内で直接 window.print() を同期実行
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
      <div
        className="p-2 sm:p-3 md:py-2.5 md:px-4 flex-1 w-full min-h-[calc(100vh-4rem)] md:h-[calc(100vh-4rem)] flex flex-col overflow-y-auto overflow-x-hidden pb-[calc(7.5rem+env(safe-area-inset-bottom,0px))] md:pb-2.5 print:hidden"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
      {/* Page header */}
      <div className="flex flex-col gap-1 sm:gap-1.5 mb-1.5 md:mb-2 print:mb-4 shrink-0">
        
        {/* Top Row: Title & Primary Actions */}
        <div className="flex flex-wrap items-center justify-between gap-1 sm:gap-2">
          <div className="flex items-baseline gap-2">
            <h1 className="text-base sm:text-lg md:text-xl font-bold text-gray-800 print:text-3xl">送迎ボード</h1>
            <p className="text-[11px] sm:text-xs md:text-sm text-gray-500 print:text-base">出席 {totalPresent}名</p>
          </div>
          
          <div className="flex items-center gap-1.5 sm:gap-2 print:hidden">
            {/* 迎え/送り 切り替え */}
            <div className="flex bg-gray-100 p-0.5 rounded-lg shrink-0">
              <button
                onClick={() => setActiveTab("inbound")}
                className={`px-2 sm:px-2.5 py-1 rounded-md text-[11px] sm:text-xs font-bold transition-colors ${
                  activeTab === "inbound" ? "bg-white shadow-sm text-blue-700" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                迎え
              </button>
              <button
                onClick={() => setActiveTab("outbound")}
                className={`px-2 sm:px-2.5 py-1 rounded-md text-[11px] sm:text-xs font-bold transition-colors ${
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
                className="gap-1 h-7 sm:h-7.5 md:h-8 px-2.5 sm:px-3 text-xs sm:text-sm font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-sm shrink-0"
              >
                ✏️ 編集する
              </Button>
            ) : (
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  onClick={handleSaveEdit}
                  disabled={isSaving}
                  className="gap-1 h-7 sm:h-7.5 md:h-8 px-2 sm:px-3 text-xs sm:text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-sm shrink-0"
                >
                  {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "💾"} 保存
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCancelEdit}
                  disabled={isSaving}
                  className="h-7 sm:h-7.5 md:h-8 px-1.5 sm:px-2.5 text-[11px] sm:text-xs shrink-0"
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
            <button
              type="button"
              onClick={() => window.print()}
              className="gap-1 h-6 sm:h-7 px-2 text-[11px] sm:text-xs shrink-0 inline-flex items-center justify-center font-bold border border-gray-300 bg-white hover:bg-gray-50 active:bg-gray-100 text-gray-700 rounded transition-colors select-none touch-manipulation cursor-pointer"
              title="A4運行表を印刷"
            >
              <Printer className="w-3 h-3" />
              印刷
            </button>
            {/* 作成者選択ドロップダウン */}
            <div className="flex items-center gap-1 bg-white border border-gray-300 rounded px-1.5 h-6 sm:h-7 shrink-0 text-gray-700">
              <span className="text-[10.5px] sm:text-xs font-bold text-gray-600 whitespace-nowrap">作成者:</span>
              <select
                value={creatorName}
                onChange={(e) => handleCreatorChange(e.target.value)}
                className="text-[11px] sm:text-xs bg-transparent border-none text-gray-800 font-semibold focus:outline-none cursor-pointer pr-1"
              >
                <option value="">(未選択)</option>
                {masterStaff.map((s) => (
                  <option key={s.id} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
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
        <DateSelector 
          selectedDate={selectedDate} 
          onChange={handleDateChange}
          onNavigateDays={handleNavigateDate}
          onSelectToday={handleSelectToday}
        />
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
        <div className="shrink-0 mb-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 bg-amber-100 border border-amber-400 rounded-md sm:rounded-lg text-xs font-bold text-amber-900 flex items-center gap-1.5 print:hidden">
          ⚠️ 編集中: 【{formatDate(selectedDate).replace("-", "年").replace("-", "月")}日】（「保存」で確定）
        </div>
      )}

      {/* Auto-assign banner */}
      {isAutoAssigned && (
        <div className="shrink-0 mb-1.5 px-2.5 py-1 sm:px-3 sm:py-1 bg-indigo-50 border border-indigo-200 rounded-md sm:rounded-lg text-xs text-indigo-700 print:hidden">
          ✨ 自動配車が完了しました
        </div>
      )}

      {/* ===== スマホ表示（モバイル・md未満）: 左右スワイプカンバン方式 ===== */}
      <div
        className="flex md:hidden flex-1 overflow-x-auto overflow-y-visible print:overflow-visible min-h-0 touch-pan-x touch-pan-y"
        style={{ touchAction: "pan-x pan-y", WebkitOverflowScrolling: "touch" }}
      >
        <div className="flex flex-row gap-3 h-auto items-start snap-x snap-mandatory pb-4">
          {/* 未割り当て列 */}
          <div className="w-[78vw] max-w-[320px] min-w-[270px] shrink-0 snap-start h-auto flex flex-col print:hidden">
            <UnassignedPool 
              className="w-full h-auto"
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
              className="w-[78vw] max-w-[320px] min-w-[270px] shrink-0 snap-start h-auto flex flex-col print:w-auto print:flex-1"
            >
              <VehicleColumn
                column={col}
                mode={activeTab}
                availableVehicles={availableVehiclesForSelect}
                allColumns={displayColumns}
                readOnly={!isEditing}
                className="w-full h-auto"
                onChildClick={handleChildClick}
                onReorderChild={handleDirectReorder}
                onChangeLocation={async () => { await performAutoSave(); }}
                onDeleteTrip={async () => { await performAutoSave(); }}
                onUpdateTripVehicle={async () => { await performAutoSave(); }}
              />
            </div>
          ))}

          {/* 家族枠専用列（送り: 家族迎え / 迎え: 家族送迎・送迎なし） */}
          <div className="w-[78vw] max-w-[320px] min-w-[270px] shrink-0 snap-start h-auto flex flex-col print:hidden">
            <FamilyPickupColumn
              className="w-full h-auto"
              children={board?.familyPickup?.children || []}
              mode={activeTab}
              onChildClick={handleChildClick}
            />
          </div>
        </div>
      </div>

      {/* ===== PC表示（デスクトップ・md以上）: 左右2カラム・全車両グリッド一望レイアウト ===== */}
      <div className="hidden md:flex flex-row gap-3 lg:gap-4 items-start flex-1 min-h-0 w-full overflow-x-hidden print:overflow-visible">
        {/* 左カラム: 未割り当てリスト（スリム化） */}
        <div className="w-60 lg:w-[260px] shrink-0 h-full max-h-[calc(100vh-210px)] flex flex-col print:hidden">
          <UnassignedPool 
            className="w-full h-full max-h-[calc(100vh-210px)] flex flex-col"
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

        {/* 右カラム: 車両カード一覧（グリッド展開で全車両を一望・最大3列） */}
        <div className="flex-1 min-w-0 w-full h-full max-h-[calc(100vh-210px)] overflow-y-auto overflow-x-hidden pr-1">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-3 gap-3.5 items-start w-full min-w-0">
            {(displayColumns || []).map((col: any) => (
              <VehicleColumn
                key={col?.id || col?.vehicleId || col?.vehicleName}
                column={col}
                mode={activeTab}
                availableVehicles={availableVehiclesForSelect}
                allColumns={displayColumns}
                readOnly={!isEditing}
                className="w-full"
                onChildClick={handleChildClick}
                onReorderChild={handleDirectReorder}
                onChangeLocation={async () => { await performAutoSave(); }}
                onDeleteTrip={async () => { await performAutoSave(); }}
                onUpdateTripVehicle={async () => { await performAutoSave(); }}
                onUpdateTripTime={async () => { await performAutoSave(); }}
                onShowToast={(type, text) => setToastMessage({ type, text })}
              />
            ))}

            {/* 家族枠専用列（グリッド内に美しく配置） */}
            <FamilyPickupColumn
              className="w-full"
              children={board?.familyPickup?.children || []}
              mode={activeTab}
              onChildClick={handleChildClick}
            />
          </div>
        </div>
      </div>

      {/* Legend (スマホでは画面最下部に固定表示、PCではグリッド下部にインライン配置) */}
      <div
        className="fixed bottom-0 left-0 right-0 z-20 bg-white/95 backdrop-blur-sm border-t border-gray-200 px-3 py-2 flex flex-wrap items-center gap-2 sm:gap-4 text-[10px] sm:text-xs text-gray-600 shadow-sm md:static md:bg-transparent md:border-t md:border-gray-200 md:px-0 md:py-1 md:mt-2 md:shadow-none shrink-0"
        style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom, 0px))" }}
      >
        <span className="font-medium text-gray-700">凡例:</span>
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
      
    {/* ===== 印刷用レイアウト（通常は非表示、印刷時のみA4縦1枚で表示） ===== */}
    <div className="hidden print:flex flex-col font-sans text-black board-print-container print-container w-full h-auto max-h-none box-border">
      {(() => {
        const inboundCols = inboundBoard?.columns || [];
        const outboundCols = outboundBoard?.columns || [];

        const inboundActiveStaff = (inboundCols || []).filter((col: any) =>
          (col?.trips || []).some((trip: any) => (trip?.children || []).length > 0)
        );
        const outboundActiveStaff = (outboundCols || []).filter((col: any) =>
          (col?.trips || []).some((trip: any) => (trip?.children || []).length > 0)
        );

        // 迎えの全スタッフ送迎車に乗っている児童ID
        const inboundAssignedChildIds = new Set<string>();
        (inboundCols || []).forEach((c: any) => {
          (c?.trips || []).forEach((t: any) => {
            (t?.children || []).forEach((ch: any) => {
              if (ch?.id) inboundAssignedChildIds.add(String(ch.id));
            });
          });
        });

        // 迎えの家族枠（送迎なし／家族送迎）
        const inboundFamilyChildrenMap = new Map<string, any>();
        (inboundBoard?.familyPickup?.children || []).forEach((c: any) => {
          if (c && c.id) inboundFamilyChildrenMap.set(String(c.id), c);
        });
        (attendances || []).forEach((a: any) => {
          if (!a) return;
          const isAbsent = a.attendance_status === "absent" || a.status === "absent";
          if (isAbsent) return;
          const isNoTransportInbound = a.status === "dropoff_only" || a.status === "no_transport";
          if (isNoTransportInbound) {
            const childIdStr = String(a.child_id);
            if (!inboundAssignedChildIds.has(childIdStr) && !inboundFamilyChildrenMap.has(childIdStr)) {
              const magnet = toMagnet(a.child_id, children, attendances);
              if (magnet) inboundFamilyChildrenMap.set(childIdStr, magnet);
            }
          }
        });
        const inboundFamilyChildren = Array.from(inboundFamilyChildrenMap.values()).sort((a: any, b: any) => {
          const timeA = a?.pickup_time || "99:99";
          const timeB = b?.pickup_time || "99:99";
          return timeA.localeCompare(timeB);
        });

        // 送りの全スタッフ送迎車に乗っている児童ID
        const outboundAssignedChildIds = new Set<string>();
        (outboundCols || []).forEach((c: any) => {
          (c?.trips || []).forEach((t: any) => {
            (t?.children || []).forEach((ch: any) => {
              if (ch?.id) outboundAssignedChildIds.add(String(ch.id));
            });
          });
        });

        // 送りの家族枠（送迎なし／家族送り・家族お迎え）
        const outboundFamilyChildrenMap = new Map<string, any>();
        (outboundBoard?.familyPickup?.children || []).forEach((c: any) => {
          if (c && c.id) outboundFamilyChildrenMap.set(String(c.id), c);
        });
        (attendances || []).forEach((a: any) => {
          if (!a) return;
          const isAbsent = a.attendance_status === "absent" || a.status === "absent";
          if (isAbsent) return;
          const isNoTransportOutbound = a.status === "pickup_only" || a.status === "no_transport";
          if (isNoTransportOutbound) {
            const childIdStr = String(a.child_id);
            if (!outboundAssignedChildIds.has(childIdStr) && !outboundFamilyChildrenMap.has(childIdStr)) {
              const magnet = toMagnet(a.child_id, children, attendances);
              if (magnet) outboundFamilyChildrenMap.set(childIdStr, magnet);
            }
          }
        });
        const outboundFamilyChildren = Array.from(outboundFamilyChildrenMap.values()).sort((a: any, b: any) => {
          const timeA = a?.departure_time || a?.pickup_time || "99:99";
          const timeB = b?.departure_time || b?.pickup_time || "99:99";
          return timeA.localeCompare(timeB);
        });

        // 共通の便テーブル描画関数（送りは時刻列なしの2列構成、迎えは時刻列ありの3列構成）
        const renderTripTable = (childrenList: any[] = [], tripMode: "inbound" | "outbound", isFamily: boolean = false) => {
          const isOutbound = tripMode === "outbound";
          const safeChildren = childrenList || [];
          return (
            <table className="w-full table-fixed border-collapse border border-gray-400 leading-tight box-border">
              <colgroup>
                <col style={{ width: "18px" }} />
                <col />
                {!isOutbound && <col style={{ width: "40px" }} />}
              </colgroup>
              <tbody>
                {safeChildren.map((child: any, idx: number) => {
                  if (!child) return null;
                  return (
                    <tr key={child.id || idx} className="border-b border-gray-300">
                      <td className="w-[18px] max-w-[18px] border border-gray-400 px-0.5 py-[1px] text-center font-bold text-[11px] shrink-0">
                        {idx + 1}
                      </td>
                      <td className="border border-gray-400 px-1.5 py-[1px] font-bold text-[11.5px] leading-tight truncate overflow-hidden tracking-tight">
                        {child.name || "名前未設定"}
                        {child.status === "late" && <span className="text-amber-700 text-[9px] ml-0.5 font-bold">遅</span>}
                        {child.status === "early_leave" && <span className="text-purple-700 text-[9px] ml-0.5 font-bold">早</span>}
                      </td>
                      {!isOutbound && (
                        <td className="w-[40px] max-w-[40px] border border-gray-400 px-0.5 py-[1px] font-mono text-center font-bold text-[11px] text-gray-800 shrink-0">
                          {child.pickup_time || "—"}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          );
        };

        // スタッフごとの便カード描画関数
        const renderStaffCard = (col: any, cardMode: "inbound" | "outbound") => {
          if (!col) return null;
          const staffName = col?.staffName || col?.driverName || "担当スタッフ";
          
          // 児童がいる便のみ抽出し、時系列順（送りは departure_time 昇順、迎えは tripIndex 昇順）にソート
          const filteredTrips = (col?.trips || []).filter((t: any) => (t?.children || []).length > 0);
          const activeTrips = sortTripsByTime(filteredTrips, cardMode) || [];

          if (activeTrips.length === 0) return null;

          return (
            <div key={col.id || col.shiftId || staffName} className="staff-card break-inside-avoid border border-gray-400 rounded bg-white flex flex-col overflow-hidden text-black shadow-none w-full box-border">
              {/* スタッフヘッダー: 👤 スタッフ名 */}
              <div className="px-1.5 py-0.5 bg-gray-100 border-b border-gray-300 flex items-center justify-between overflow-hidden">
                <div className="flex items-center gap-1 min-w-0 overflow-hidden">
                  <span className="text-[12.5px] font-bold text-gray-900 truncate">👤 {staffName}</span>
                  {col?.staffRole && col?.staffRole !== "一般スタッフ" && (
                    <span className="text-[9.5px] font-bold text-gray-600 bg-gray-200 px-1 py-0.2 rounded shrink-0">
                      {col.staffRole}
                    </span>
                  )}
                </div>
                {col?.driverStatus && col?.driverStatus !== "present" && (
                  <span className="text-[8.5px] font-bold text-rose-800 bg-rose-50 border border-rose-300 px-1 py-0.2 rounded shrink-0">
                    {col.driverStatus === "late" ? `遅刻 ${col?.driverStatusTime || ""}` : col.driverStatus === "early_leave" ? `早退 ${col?.driverStatusTime || ""}` : `中抜け ${col?.driverStatusTime || ""}`}
                  </span>
                )}
              </div>

              {/* 運行便コンテナ（児童がいる便のみ時刻順に出力） */}
              <div className="flex flex-col divide-y divide-gray-200 flex-1 overflow-hidden">
                {activeTrips.map((trip: any, tIdx: number) => {
                  if (!trip) return null;
                  const tripChildren = trip?.children || [];
                  const theme = getVehicleColorTheme(trip?.vehicleName);
                  const sortedChildren = [...tripChildren].sort((a: any, b: any) => {
                    const timeA = cardMode === "outbound" ? (a?.departure_time || a?.pickup_time || "99:99") : (a?.pickup_time || "99:99");
                    const timeB = cardMode === "outbound" ? (b?.departure_time || b?.pickup_time || "99:99") : (b?.pickup_time || "99:99");
                    return timeA.localeCompare(timeB);
                  });

                  // ヘッダーラベル: 迎えは【1便】、送りは【17:00】等の時刻表記
                  const tripLabel = cardMode === "outbound"
                    ? `【${trip?.departure_time || trip?.time || "17:00"}】`
                    : `【${trip?.tripIndex || tIdx + 1}便】`;

                  const isSecondOrLater = tIdx > 0;

                  return (
                    <div
                      key={trip?.id || tIdx}
                      className={cn(
                        "p-1 flex flex-col overflow-hidden",
                        isSecondOrLater && "bg-slate-50/50"
                      )}
                    >
                      <div className="flex items-center justify-between gap-1 mb-0.5 pb-0.5 border-b border-gray-200 bg-gray-50 px-1 py-0.2 rounded-sm overflow-hidden min-w-0">
                        <span className="font-bold text-[10.5px] text-gray-900 shrink-0">
                          {tripLabel}
                        </span>
                        {trip?.vehicleId && (trip?.vehicleName || trip?.vehicle?.name) && (trip?.vehicleName || trip?.vehicle?.name) !== "車両未選択" && (trip?.vehicleName || trip?.vehicle?.name) !== "車未定" ? (
                          <span
                            className={cn(
                              "text-[10.5px] font-bold px-1.5 py-0.2 rounded border shrink min-w-0 max-w-[120px] truncate",
                              theme?.badgeBg,
                              theme?.badgeText,
                              theme?.badgeBorder,
                              theme?.printBg,
                              theme?.printText,
                              theme?.printBorder
                            )}
                            style={{
                              WebkitPrintColorAdjust: "exact",
                              printColorAdjust: "exact",
                            }}
                          >
                            🚙 {trip?.vehicleName || trip?.vehicle?.name}
                          </span>
                        ) : null}
                      </div>

                      {renderTripTable(sortedChildren, cardMode)}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        };

        // 家族枠（送迎なし）専用カード描画関数
        const renderFamilyBox = (
          title: string,
          list: any[] = [],
          boxMode: "inbound" | "outbound",
          variant: "compact" | "fixed" = "fixed"
        ) => {
          const isCompact = variant === "compact";
          const safeList = list || [];
          return (
            <div
              className={cn(
                "family-card break-inside-avoid border border-gray-400 rounded bg-white flex flex-col overflow-hidden text-black shadow-none box-border",
                isCompact ? "w-full" : "w-[22%] shrink-0"
              )}
            >
              <div className="px-1.5 py-0.5 bg-gray-100 border-b border-gray-300 flex items-center justify-between overflow-hidden">
                <span className="text-[12.5px] font-bold text-gray-900 truncate">{title}</span>
                <span className="text-[10px] font-semibold text-gray-600 bg-gray-200 px-1.5 py-0.2 rounded shrink-0">
                  {safeList.length}名
                </span>
              </div>
              <div className="p-1 flex flex-col overflow-hidden">
                {safeList.length === 0 ? (
                  <div className={cn("text-center text-[10.5px] text-gray-400 font-medium", isCompact ? "py-1" : "py-2")}>
                    なし
                  </div>
                ) : (
                  renderTripTable(safeList, boxMode, true)
                )}
              </div>
            </div>
          );
        };

        return (
          <div className="flex flex-col w-full min-h-0">
            <div>
              {/* 印刷メインヘッダー */}
              <div className="mb-0.5 border-b-2 border-gray-400 pb-0.5 flex justify-between items-end">
                <div>
                  <div className="flex items-baseline gap-2.5">
                    <h1 className="text-[15px] font-bold leading-tight">
                      放デイ 送迎運行表（迎え・送り）
                    </h1>
                    <span className="text-[12px] font-bold text-gray-800">{displayDate}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5 leading-tight">
                    <p className="text-[10.5px] font-semibold text-gray-700 leading-tight">
                      利用者数: ぽっけ {countPokke}名 / ぽっけⅡ {countPokke2}名 / 日中一時 {countNichu}名 （合計 {totalPresentCount}名）
                    </p>
                    <p className="text-[10px] font-medium text-gray-600 leading-tight">
                      リーダー: [ぽっけ] {leaders.pokke} / [ぽっけⅡ] {leaders.pokke2} / [日中] {leaders.nichu}
                    </p>
                  </div>
                </div>
                <div className="text-right flex flex-col items-end gap-0.5 shrink-0 leading-tight">
                  <p className="text-[8.5px] text-gray-500 leading-tight">出力日時: {new Date().toLocaleString("ja-JP")}</p>
                  <div className="text-[10.5px] font-semibold text-gray-800 flex items-center leading-tight">
                    <span>作成者: </span>
                    {creatorName ? (
                      <span className="font-bold underline ml-1">{creatorName}</span>
                    ) : (
                      <span className="inline-block border-b border-gray-600 w-20 ml-1"></span>
                    )}
                  </div>
                </div>
              </div>

              {/* 【上段: 迎え（来所）】 */}
              <div className="flex flex-col mb-0.5 print-block print-section-pickup">
                <div className="flex items-center justify-between mb-0.5 bg-blue-50/90 px-1.5 py-0.5 rounded border border-blue-200">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[11.5px] text-blue-900">▼ 【迎え（来所）】送迎運行表</span>
                    <span className="text-[10px] text-blue-700 font-medium">
                      （送迎運行スタッフ: {(inboundActiveStaff || []).length}名 / 家族迎え: {(inboundFamilyChildren || []).length}名）
                    </span>
                  </div>
                </div>
                {/* 共通4列グリッド: 家族枠を第1マスに配置し、スタッフ便が隙間なく自然に回り込む */}
                <div className="grid grid-cols-4 gap-1.5 items-start w-full">
                  {renderFamilyBox("🏠 家族迎え", inboundFamilyChildren, "inbound", "compact")}
                  {(inboundActiveStaff || []).map((col: any) => renderStaffCard(col, "inbound"))}
                  {(inboundActiveStaff || []).length === 0 && (
                    <div className="col-span-3 p-3 text-center text-xs font-medium text-gray-500 border border-dashed border-gray-300 rounded bg-gray-50">
                      配車されている運行便がありません（送迎便なし）
                    </div>
                  )}
                </div>
              </div>

              {/* 【中央区切り線（細い破線）】 */}
              <div className="border-t border-dashed border-gray-300 my-0.5" />

              {/* 【下段: 送り（帰宅）】 */}
              <div className="flex flex-col mb-0.5 print-block print-section-dropoff">
                <div className="flex items-center justify-between mb-0.5 bg-amber-50/90 px-1.5 py-0.5 rounded border border-amber-200">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[11.5px] text-amber-900">▼ 【送り（帰宅）】送迎運行表</span>
                    <span className="text-[10px] text-amber-700 font-medium">
                      （送迎運行スタッフ: {(outboundActiveStaff || []).length}名 / 家族送り: {(outboundFamilyChildren || []).length}名）
                    </span>
                  </div>
                </div>
                {/* 横4列構成: [左: 家族送り枠 22%] + [右: スタッフ送迎車グリッド3列 78%] */}
                <div className="flex gap-1.5 items-start w-full">
                  {renderFamilyBox("🏠 家族送り", outboundFamilyChildren, "outbound", "fixed")}
                  <div className="flex-1 min-w-0">
                    {(outboundActiveStaff || []).length === 0 ? (
                      <div className="p-3 text-center text-xs font-medium text-gray-500 border border-dashed border-gray-300 rounded my-1 bg-gray-50">
                        配車されている運行便がありません（送迎便なし）
                      </div>
                    ) : (
                      <div
                        className={cn(
                          "grid gap-1.5 items-start w-full",
                          (outboundActiveStaff || []).length === 1
                            ? "grid-cols-1"
                            : (outboundActiveStaff || []).length === 2
                            ? "grid-cols-2"
                            : "grid-cols-3"
                        )}
                      >
                        {(outboundActiveStaff || []).map((col: any) => renderStaffCard(col, "outbound"))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* フッター（余白最小化） */}
            <div className="pt-0.5 border-t border-gray-300 flex justify-between text-[8.5px] text-gray-400 mt-0.5 shrink-0">
              <span>放課後等デイサービス 送迎運行表（迎え・送り）</span>
              <span>{displayDate}</span>
            </div>
          </div>
        );
      })()}
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
                      const isFull = (trip.children || []).length >= (trip.capacity || col.capacity || 6);
                      const tripLabel = activeTab === "outbound"
                        ? `【${trip.departure_time || trip.time || "17:00"}】`
                        : ((col.trips || []).length > 1 ? `(${trip.tripIndex}便)` : "");
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
                              <span className="font-bold">{col.staffName || col.driverName || "スタッフ"} {tripLabel} - {trip.vehicleName || "車未定"}</span>
                              {isCurrent && <span className="text-xs text-blue-600 font-bold bg-blue-100 px-2 py-0.5 rounded">現在</span>}
                              {!isCurrent && isFull && <span className="text-xs text-amber-600 font-bold bg-amber-100 px-2 py-0.5 rounded">満員</span>}
                            </div>
                            <span className="text-xs text-gray-500">{col.driverName || col.staffName}</span>
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

                  {/* 家族迎え／家族送迎ボタン */}
                  <Button
                    variant="outline"
                    className={cn(
                      "justify-start text-left h-auto py-3 mt-1 border-emerald-300 text-emerald-800 hover:bg-emerald-50",
                      selectedChild.columnId === "family-pickup" && "border-emerald-500 bg-emerald-50 cursor-default hover:bg-emerald-50"
                    )}
                    onClick={() => selectedChild.columnId !== "family-pickup" && handleAssignTo("family-pickup")}
                  >
                    <div className="flex flex-col items-start gap-0.5">
                      <div className="font-bold">
                        {activeTab === "inbound" ? "🏠 家族送迎へ移動" : "🏠 家族迎えへ移動"}
                      </div>
                      {selectedChild.columnId === "family-pickup" && (
                        <span className="text-xs text-emerald-600 font-bold">現在ここにいます</span>
                      )}
                    </div>
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
            /* 上下5mm、左右7mm（ファイル穴あけ余白を保ちつつ上下を確保） */
            margin: 5mm 7mm;
          }

          /* Safariで下部が消える原因となる overflow: hidden を解除 */
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            height: auto !important;
            min-height: 100% !important;
            overflow: visible !important;
            background: #fff !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* 印刷用親コンテナ: 強制クリップ（上限カット）を完全撤廃 */
          .print-page,
          .print-container,
          .board-print-container {
            width: 100% !important;
            max-width: 100% !important;
            height: auto !important;
            max-height: none !important; /* ← 強制クリップ（上限カット）を完全撤廃 */
            overflow: visible !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: flex-start !important;
            transform: none !important;
            box-sizing: border-box !important;
            padding: 0 !important;
          }

          /* 上段・下段が消えずに確実に描画されるようにする */
          .print-section-pickup,
          .print-section-dropoff {
            display: block !important;
            width: 100% !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          /* 改ページ防止（各カード・ブロック・行） */
          .break-inside-avoid,
          .print-block,
          .staff-card,
          .family-card {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            page-break-after: avoid !important;
            break-after: avoid !important;
          }

          .board-print-container table,
          .print-container table {
            width: 100% !important;
            table-layout: fixed !important;
            border-collapse: collapse !important;
            box-sizing: border-box !important;
          }

          .board-print-container th,
          .board-print-container td,
          .print-container th,
          .print-container td {
            box-sizing: border-box !important;
            padding: 1px 2px !important;
            line-height: 1.15 !important;
            vertical-align: middle !important;
          }

          .board-print-container tr,
          .print-container tr {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      `}</style>
    </>
  );
}

export default function BoardPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    }>
      <BoardPageContent />
    </Suspense>
  );
}
