"use client";

import { useState, useEffect, useRef } from "react";
import { CheckCircle2, XCircle, Users, Clock, ChevronLeft, ChevronRight, Loader2, CalendarIcon } from "lucide-react";
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
  pickup_only: { label: "行きのみ", color: "text-cyan-700", bg: "bg-cyan-100 border-cyan-300" },
  dropoff_only: { label: "帰りのみ", color: "text-indigo-700", bg: "bg-indigo-100 border-indigo-300" },
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


  useEffect(() => {
    if (children.length === 0) return;
    
    const targetDateStr = formatDate(selectedDate);
    let isMounted = true;

    const loadData = async () => {
      try {
        const { attendances: fetchedAtts } = await fetchDailyData(targetDateStr);
        
        if (!isMounted) return;

        const mergedAtts = children.map((child) => {
          const existing = fetchedAtts.find((a) => a.child_id === child.id);
          return (
            existing ?? {
              id: `att-${targetDateStr}-${child.id}`,
              target_date: targetDateStr,
              child_id: child.id,
              status: "both" as TransportMode,
              pickup_time: "14:30",
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
        pickup_time: updatedAtt.pickup_time
      });
      // グローバルStoreへの書き込みは state から反映するか、fetch し直すかで担保
      // 今回は local state の attendances をそのまま global にセットしてOK
    } catch (err) {
      console.error("Failed to save attendance", err);
    } finally {
      setIsSaving(false);
    }
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

  const presentCount = attendances.filter((a) => ["both", "pickup_only", "dropoff_only", "no_transport"].includes(a.status)).length;
  const absentCount = attendances.filter((a) => a.status === "absent").length;
  const noTransportCount = attendances.filter((a) => a.status === "no_transport").length;

  const displayDate = selectedDate.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });

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
          <div className="relative group">
            <div className="flex items-center gap-2 group-hover:bg-gray-100 px-4 py-2 rounded-lg transition-colors">
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

      {/* Summary badges */}
      <div className="flex flex-wrap gap-2 md:gap-3 mb-4 md:mb-6">
        <div className="flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 bg-blue-50 border border-blue-200 rounded-lg">
          <CheckCircle2 className="w-4 h-4 text-blue-600" />
          <span className="text-xs md:text-sm font-semibold text-blue-700 whitespace-nowrap">出席 {presentCount}名</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 bg-red-50 border border-red-200 rounded-lg">
          <XCircle className="w-4 h-4 text-red-600" />
          <span className="text-xs md:text-sm font-semibold text-red-700 whitespace-nowrap">欠席 {absentCount}名</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 bg-orange-50 border border-orange-200 rounded-lg">
          <Users className="w-4 h-4 text-orange-600" />
          <span className="text-xs md:text-sm font-semibold text-orange-700 whitespace-nowrap">送迎不要 {noTransportCount}名</span>
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
              <TableHead className="whitespace-nowrap">学校</TableHead>
              <TableHead className="w-[220px] whitespace-nowrap">送迎区分</TableHead>
              <TableHead className="w-[180px] whitespace-nowrap">下校時間</TableHead>
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

                  {/* Status column (Global Status) */}
                  <TableCell className="whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <Select 
                        value={child.status || "present"}
                        onValueChange={(v: "present" | "absent" | "late" | "early_leave") => {
                          updateChild(child.id, { 
                            status: v, 
                            status_time: (v === "late" || v === "early_leave") ? (child.status_time || "14:00") : null 
                          });
                        }}
                      >
                        <SelectTrigger className={cn("w-[110px] h-8 text-xs font-bold border", getStatusColor(child.status))}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="present"><span className="text-pink-700 font-bold">出席</span></SelectItem>
                          <SelectItem value="absent"><span className="text-slate-600 font-bold">休み</span></SelectItem>
                          <SelectItem value="late"><span className="text-amber-700 font-bold">遅刻</span></SelectItem>
                          <SelectItem value="early_leave"><span className="text-purple-700 font-bold">早退</span></SelectItem>
                        </SelectContent>
                      </Select>

                      {(child.status === "late" || child.status === "early_leave") && (
                        <Select
                          value={child.status_time || "14:00"}
                          onValueChange={(v) => updateChild(child.id, { status_time: v })}
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
                      <option value="both">往復（行き・帰り）</option>
                      <option value="pickup_only">行きのみ（迎え）</option>
                      <option value="dropoff_only">帰りのみ（送り）</option>
                      <option value="no_transport">送迎不要</option>
                      <option value="absent">欠席</option>
                    </select>
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
