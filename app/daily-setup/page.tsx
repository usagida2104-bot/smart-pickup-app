"use client";

import { useState, useEffect, useRef } from "react";
import { CheckCircle2, XCircle, Users, Clock, ChevronLeft, ChevronRight, Loader2, CalendarIcon, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { TransportMode, DailyAttendance } from "@/types";
import { cn } from "@/lib/utils";
import { useMasterStore } from "@/lib/store/masterStore";
import { fetchDailyData, upsertDailyAttendance } from "@/lib/supabase/service";
import { supabase } from "@/lib/supabase/client";

const TIME_OPTIONS = Array.from({ length: 13 * 12 + 1 }).map((_, i) => {
  const h = Math.floor(i / 12) + 8;
  const m = (i % 12) * 5;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
});

const getStatusColor = (status?: string) => {
  switch (status) {
    case "absent": return "text-slate-600 bg-slate-100 border-slate-300";
    case "late": return "text-amber-700 bg-amber-50 border-amber-200";
    case "early_leave": return "text-purple-700 bg-purple-50 border-purple-200";
    case "present":
    default: return "text-pink-700 bg-pink-50 border-pink-200";
  }
};

const STATUS_CONFIG: Record<TransportMode, { label: string; color: string; bg: string }> = {
  both: { label: "往復", color: "text-blue-700", bg: "bg-blue-100 border-blue-300" },
  pickup_only: { label: "迎えのみ", color: "text-cyan-700", bg: "bg-cyan-100 border-cyan-300" },
  dropoff_only: { label: "送りのみ", color: "text-indigo-700", bg: "bg-indigo-100 border-indigo-300" },
  no_transport: { label: "送迎不要", color: "text-orange-700", bg: "bg-orange-100 border-orange-300" },
  absent: { label: "欠席", color: "text-red-700", bg: "bg-red-100 border-red-300" },
};

function formatDate(date: Date) {
  return date.toISOString().split("T")[0];
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

const HOURS = Array.from({ length: 14 }, (_, i) => i + 8); // 8〜21時
const MINUTES = ["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"];

export default function DailySetupPage() {
  const { children, attendances: globalAttendances, setAttendances: setGlobalAttendances, updateChild } = useMasterStore();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [attendances, setAttendances] = useState<DailyAttendance[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [selectedSpotChildId, setSelectedSpotChildId] = useState<string>("");


  useEffect(() => {
    if (children.length === 0) return;
    
    const targetDateStr = formatDate(selectedDate);
    let isMounted = true;

    const loadData = async () => {
      try {
        const { attendances: fetchedAtts } = await fetchDailyData(targetDateStr);
        
        if (!isMounted) return;

        const dayOfWeek = selectedDate.getDay();

        // 既にDBにレコードがある児童、または利用曜日に該当する児童のみ抽出
        const relevantChildren = children.filter(child => {
          const dbRecord = fetchedAtts.find(a => a.child_id === child.id);
          
          if (dbRecord && dbRecord.attendance_status === ("excluded" as any)) {
            return false;
          }

          const scheduled = (child.weekly_schedule ?? [1, 2, 3, 4, 5]).includes(dayOfWeek);
          return !!dbRecord || scheduled;
        });

        const mergedAtts = relevantChildren.map((child) => {
          const existing = fetchedAtts.find((a) => a.child_id === child.id);
          return (
            existing ?? {
              id: `att-${targetDateStr}-${child.id}`,
              target_date: targetDateStr,
              child_id: child.id,
              status: "both" as TransportMode,
              pickup_time: child.default_dismissal_time || null,
              attendance_status: "present" as const,
              attendance_time: null,
              child,
            }
          );
        });
        
        setAttendances(mergedAtts);
        setGlobalAttendances(mergedAtts);
      } catch (err) {
        console.error("Failed to fetch daily attendances", err);
      }
    };

    loadData();

    // Subscribe to realtime changes for this date
    const channel = supabase
      .channel(`attendances-${targetDateStr}`)
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
  }, [children, selectedDate, setGlobalAttendances]);

  const performSave = async (updatedAtt: DailyAttendance) => {
    setIsSaving(true);
    try {
      await upsertDailyAttendance({
        id: updatedAtt.id,
        target_date: updatedAtt.target_date,
        child_id: updatedAtt.child_id,
        status: updatedAtt.status,
        pickup_time: updatedAtt.pickup_time,
        attendance_status: updatedAtt.attendance_status,
        attendance_time: updatedAtt.attendance_time
      });
      // グローバルStoreへの書き込みは state から反映するか、fetch し直すかで担保
      // 今回は local state の attendances をそのまま global にセットしてOK
    } catch (err) {
      console.error("Failed to save attendance", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemove = async (childId: string) => {
    const targetDateStr = formatDate(selectedDate);
    const excludedAtt: DailyAttendance = {
      id: `att-${targetDateStr}-${childId}`,
      target_date: targetDateStr,
      child_id: childId,
      status: "both" as TransportMode,
      pickup_time: "14:30",
      attendance_status: "excluded" as any,
      attendance_time: null
    };

    const newAtts = attendances.filter(a => a.child_id !== childId);
    setAttendances(newAtts);
    setGlobalAttendances(newAtts);
    
    setIsSaving(true);
    try {
      await upsertDailyAttendance(excludedAtt);
    } catch (err) {
      console.error("Failed to exclude child", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSpotAdd = () => {
    if (!selectedSpotChildId) return;
    const child = children.find(c => c.id === selectedSpotChildId);
    if (!child) return;

    const targetDateStr = formatDate(selectedDate);
    const newAtt = {
      id: `att-${targetDateStr}-${child.id}`,
      target_date: targetDateStr,
      child_id: child.id,
      status: "both" as TransportMode,
      pickup_time: child.school?.default_dismissal_time ?? "14:30",
      attendance_status: "present" as const,
      attendance_time: null,
      child,
    };

    const newAtts = [...attendances, newAtt];
    setAttendances(newAtts);
    setGlobalAttendances(newAtts);
    performSave(newAtt);
    setSelectedSpotChildId("");
  };

  const updateStatus = (childId: string, status: TransportMode) => {
    const target = attendances.find((a) => a.child_id === childId);
    if (!target) return;
    const updated = { ...target, status };
    
    const newAtts = attendances.map((a) => (a.child_id === childId ? updated : a));
    setAttendances(newAtts);
    setGlobalAttendances(newAtts);
    performSave(updated);
  };

  const updatePickupTime = (childId: string, time: string) => {
    const target = attendances.find((a) => a.child_id === childId);
    if (!target) return;
    const updated = { ...target, pickup_time: time || null };

    const newAtts = attendances.map((a) => (a.child_id === childId ? updated : a));
    setAttendances(newAtts);
    setGlobalAttendances(newAtts);
    performSave(updated);
  };

  const updateAttendanceStatus = (childId: string, status: "present" | "absent" | "late" | "early_leave", time?: string | null) => {
    const target = attendances.find((a) => a.child_id === childId);
    if (!target) return;
    const updated = { 
      ...target, 
      attendance_status: status,
      attendance_time: time !== undefined ? time : target.attendance_time
    };
    if (status === "late" || status === "early_leave") {
      updated.attendance_time = updated.attendance_time || "14:00";
    } else {
      updated.attendance_time = null;
    }

    const newAtts = attendances.map((a) => (a.child_id === childId ? updated : a));
    setAttendances(newAtts);
    setGlobalAttendances(newAtts);
    performSave(updated);
  };

  const presentCount = attendances.filter((a) => a.attendance_status === "present" || a.attendance_status === "late" || a.attendance_status === "early_leave").length;
  const absentCount = attendances.filter((a) => a.attendance_status === "absent").length;
  const noTransportCount = attendances.filter((a) => a.status === "no_transport").length;

  const unitCounts = { ぽっけ: 0, ぽっけⅡ: 0, 日中一時: 0 };
  attendances.forEach(a => {
    if (a.attendance_status !== "absent") {
      const child = children.find(c => c.id === a.child_id);
      if (child && child.unit_name) {
        if (child.unit_name === "ぽっけ") unitCounts.ぽっけ++;
        else if (child.unit_name === "ぽっけⅡ") unitCounts["ぽっけⅡ"]++;
        else if (child.unit_name === "日中一時") unitCounts.日中一時++;
      }
    }
  });

  const displayDate = selectedDate.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });

  const unassignedChildren = children.filter(c => !attendances.some(a => a.child_id === c.id));

  return (
    <div className="p-4 md:p-8">
      {/* Header */}
      <div className="mb-4 md:mb-6">
        <h1 className="text-xl md:text-2xl font-bold text-gray-800">日別設定</h1>
        <p className="text-xs md:text-sm text-gray-500 mt-1">出欠・下校時間を設定します</p>
      </div>

      {/* Date Selector */}
      <div className="flex items-center justify-between gap-2 md:gap-4 mb-4 md:mb-6 p-3 md:p-4 bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSelectedDate((d) => addDays(d, -1))}
        >
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1 text-center flex justify-center items-center">
          <div className="relative group flex items-center justify-center cursor-pointer">
            <div className="flex items-center gap-2 group-hover:bg-gray-100 px-4 py-2 rounded-lg transition-colors pointer-events-none">
              <CalendarIcon className="w-4 h-4 md:w-5 md:h-5 text-gray-500" />
              <p className="text-base md:text-lg font-semibold text-gray-800 whitespace-nowrap">{displayDate}</p>
            </div>
            <input 
              type="date" 
              value={formatDate(selectedDate)}
              onChange={(e) => {
                if (e.target.value) {
                  const d = new Date(e.target.value);
                  setSelectedDate(d);
                }
              }}
              onClick={(e) => {
                try {
                  if (typeof (e.currentTarget as any).showPicker === 'function') {
                    (e.currentTarget as any).showPicker();
                  }
                } catch (err) {
                  console.error(err);
                }
              }}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            />
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSelectedDate((d) => addDays(d, 1))}
        >
          <ChevronRight className="w-5 h-5" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setSelectedDate(new Date())}
          className="ml-2"
        >
          今日
        </Button>
      </div>

      {/* Summary & Spot Add */}
      <div className="flex flex-col 2xl:flex-row 2xl:items-center justify-between gap-4 mb-4 md:mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3 lg:gap-4">
          {/* Status Group */}
          <div className="flex flex-wrap gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 md:px-4 md:py-2 bg-blue-50 border border-blue-200 rounded-lg">
              <CheckCircle2 className="w-4 h-4 text-blue-600" />
              <span className="text-xs md:text-sm font-semibold text-blue-700 whitespace-nowrap">出席 {presentCount}名</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 md:px-4 md:py-2 bg-red-50 border border-red-200 rounded-lg">
              <XCircle className="w-4 h-4 text-red-600" />
              <span className="text-xs md:text-sm font-semibold text-red-700 whitespace-nowrap">欠席 {absentCount}名</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 md:px-4 md:py-2 bg-orange-50 border border-orange-200 rounded-lg">
              <Users className="w-4 h-4 text-orange-600" />
              <span className="text-xs md:text-sm font-semibold text-orange-700 whitespace-nowrap">送迎不要 {noTransportCount}名</span>
            </div>
          </div>

          <div className="hidden lg:block w-px bg-gray-300 h-8" />

          {/* Unit Group */}
          <div className="flex flex-wrap gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 md:px-4 md:py-2 bg-indigo-50 border border-indigo-200 rounded-lg shadow-sm">
              <span className="text-xs md:text-sm font-bold text-indigo-700 whitespace-nowrap">ぽっけ: {unitCounts.ぽっけ}名</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 md:px-4 md:py-2 bg-violet-50 border border-violet-200 rounded-lg shadow-sm">
              <span className="text-xs md:text-sm font-bold text-violet-700 whitespace-nowrap">ぽっけⅡ: {unitCounts["ぽっけⅡ"]}名</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 md:px-4 md:py-2 bg-teal-50 border border-teal-200 rounded-lg shadow-sm">
              <span className="text-xs md:text-sm font-bold text-teal-700 whitespace-nowrap">日中一時: {unitCounts.日中一時}名</span>
            </div>
          </div>
        </div>

        {/* Spot Add */}
        <div className="flex items-center gap-2">
          <Select value={selectedSpotChildId} onValueChange={setSelectedSpotChildId}>
            <SelectTrigger className="w-[200px] bg-white text-sm">
              <SelectValue placeholder="スポット追加する児童" />
            </SelectTrigger>
            <SelectContent>
              {unassignedChildren.length === 0 && (
                <SelectItem value="none" disabled>対象児童がいません</SelectItem>
              )}
              {unassignedChildren.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handleSpotAdd} disabled={!selectedSpotChildId || selectedSpotChildId === "none"} size="sm" className="gap-1 bg-blue-600 hover:bg-blue-700 text-white shadow-sm">
            <Plus className="w-4 h-4" /> 追加
          </Button>
        </div>
      </div>

      {/* Attendance List (Table Format) */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead className="w-[200px] whitespace-nowrap">児童名</TableHead>
              <TableHead className="min-w-[220px] whitespace-nowrap">ステータス</TableHead>
              <TableHead className="w-[180px] whitespace-nowrap">下校時間</TableHead>
              <TableHead className="whitespace-nowrap">学校</TableHead>
              <TableHead className="w-[220px] whitespace-nowrap">送迎区分</TableHead>
              <TableHead className="w-[60px] text-right whitespace-nowrap">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {attendances.map((att) => {
              const child = children.find((c) => c.id === att.child_id);
              if (!child) return null;
              const config = STATUS_CONFIG[att.status];
              return (
                <TableRow key={att.child_id} className={cn(
                  "hover:bg-gray-50/50",
                  child.has_caution && "bg-green-50 hover:bg-green-100/50"
                )}>
                  {/* Name column */}
                  <TableCell className="whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-gray-800">{child.name}</span>
                      {child.unit_name && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5">
                          {child.unit_name}
                        </Badge>
                      )}
                    </div>
                  </TableCell>

                  {/* Status column (Daily Attendance Status) */}
                  <TableCell className="whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <Select 
                        value={att.attendance_status || "present"}
                        onValueChange={(v: "present" | "absent" | "late" | "early_leave") => updateAttendanceStatus(child.id, v)}
                      >
                        <SelectTrigger className={cn("w-[110px] h-8 text-xs font-bold border", getStatusColor(att.attendance_status || "present"))}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="present"><span className="text-pink-700 font-bold">出席</span></SelectItem>
                          <SelectItem value="absent"><span className="text-slate-600 font-bold">休み</span></SelectItem>
                          <SelectItem value="late"><span className="text-amber-700 font-bold">遅刻</span></SelectItem>
                          <SelectItem value="early_leave"><span className="text-purple-700 font-bold">早退</span></SelectItem>
                        </SelectContent>
                      </Select>

                      {(att.attendance_status === "late" || att.attendance_status === "early_leave") && (
                        <Select
                          value={att.attendance_time || "14:00"}
                          onValueChange={(v) => updateAttendanceStatus(child.id, att.attendance_status as any, v)}
                        >
                          <SelectTrigger className="w-[85px] h-8 text-xs font-bold bg-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="max-h-[200px]">
                            {TIME_OPTIONS.map((time) => (
                              <SelectItem key={time} value={time}>{time}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </TableCell>

                  {/* Time column */}
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-gray-400 shrink-0" />
                      
                      {/* Hour Select */}
                      <select
                        value={att.pickup_time ? att.pickup_time.split(":")[0] : "14"}
                        onChange={(e) => {
                          const min = att.pickup_time ? att.pickup_time.split(":")[1] : "30";
                          updatePickupTime(att.child_id, `${e.target.value}:${min}`);
                        }}
                        disabled={!["both", "pickup_only"].includes(att.status)}
                        className={cn(
                          "w-16 px-2 py-1.5 rounded-md text-sm border outline-none cursor-pointer bg-white text-center font-medium focus:ring-2 focus:ring-blue-500",
                          !["both", "pickup_only"].includes(att.status) && "opacity-40 cursor-not-allowed bg-gray-50 text-gray-400"
                        )}
                      >
                        {HOURS.map(h => {
                          const hStr = h.toString().padStart(2, "0");
                          return <option key={hStr} value={hStr}>{hStr}</option>;
                        })}
                      </select>
                      
                      <span className="font-bold text-gray-500">:</span>
                      
                      {/* Minute Select */}
                      <select
                        value={att.pickup_time ? att.pickup_time.split(":")[1] : "30"}
                        onChange={(e) => {
                          const hr = att.pickup_time ? att.pickup_time.split(":")[0] : "14";
                          updatePickupTime(att.child_id, `${hr}:${e.target.value}`);
                        }}
                        disabled={!["both", "pickup_only"].includes(att.status)}
                        className={cn(
                          "w-16 px-2 py-1.5 rounded-md text-sm border outline-none cursor-pointer bg-white text-center font-medium focus:ring-2 focus:ring-blue-500",
                          !["both", "pickup_only"].includes(att.status) && "opacity-40 cursor-not-allowed bg-gray-50 text-gray-400"
                        )}
                      >
                        {MINUTES.map(m => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                    </div>
                  </TableCell>

                  {/* School column */}
                  <TableCell className="whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3.5 h-3.5 rounded-full shadow-sm shrink-0"
                        style={{ backgroundColor: child.school?.color_code ?? "#ccc" }}
                      />
                      <span className="text-sm text-gray-600 truncate max-w-[150px]">
                        {child.school?.name ?? "学校未設定"}
                      </span>
                    </div>
                  </TableCell>

                  {/* Status column */}
                  <TableCell>
                    <select
                      value={att.status}
                      onChange={(e) => updateStatus(att.child_id, e.target.value as TransportMode)}
                      className={cn(
                        "w-full px-3 py-2 rounded-lg text-sm font-semibold border outline-none cursor-pointer",
                        config.bg,
                        config.color
                      )}
                    >
                      <option value="both">往復（迎え・送り）</option>
                      <option value="pickup_only">迎えのみ</option>
                      <option value="dropoff_only">送りのみ</option>
                      <option value="no_transport">送迎不要</option>
                      <option value="absent">欠席</option>
                    </select>
                  </TableCell>
                  
                  {/* Action column */}
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemove(att.child_id)}
                      className="text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                      title="この日の一覧から除外する"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        </div>
      </div>

      {/* Auto-Save Status */}
      <div className="mt-6 flex justify-end">
        <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-lg text-sm text-gray-500 border border-gray-200">
          {isSaving ? (
             <><Loader2 className="w-4 h-4 animate-spin text-gray-400" /> 自動保存中...</>
          ) : (
             <><CheckCircle2 className="w-4 h-4 text-green-500" /> すべての変更は自動保存されました</>
          )}
        </div>
      </div>
    </div>
  );
}
