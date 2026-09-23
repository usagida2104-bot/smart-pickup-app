"use client";

import { useState, useEffect } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Button } from "@/components/ui/button";
import { CalendarIcon, Printer, Sparkles, ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { fetchMonthlySchedule, saveMonthlySchedule } from "@/lib/supabase/service";
import { Loader2 } from "lucide-react";

const STAFF_LIST = ["増子", "内山", "熊田", "逵", "大平"];

const ROLES = [
  { id: "ぽっけリーダー", label: "ぽっけリーダー", colorClass: "bg-[#dbeafe] text-[#1d4ed8]" },
  { id: "日中リーダー", label: "日中リーダー", colorClass: "bg-[#dcfce7] text-[#15803d]" },
  { id: "集団担当", label: "集団担当", colorClass: "bg-slate-100 text-slate-800" },
  { id: "フリー", label: "(空欄)", colorClass: "bg-transparent text-gray-800" },
];

const ATTENDANCES = [
  { id: "通常", label: "通常", colorClass: "bg-gray-100 text-gray-700" },
  { id: "休み", label: "休み", colorClass: "bg-red-100 text-red-700 font-bold" },
  { id: "研修", label: "研修", colorClass: "bg-amber-100 text-amber-800 font-bold" },
  { id: "遅刻", label: "遅刻", colorClass: "bg-red-100 text-red-700 font-bold" },
  { id: "早退", label: "早退", colorClass: "bg-red-100 text-red-700 font-bold" },
];

export const getCellData = (raw: string) => {
  if (!raw) return { role: "フリー", attendance: "通常", time: "" };
  const parts = raw.split("|");
  let role = parts[0] || "フリー";
  let attendanceRaw = parts[1] || "通常";

  if (role === "休み" || role === "研修") {
    attendanceRaw = role;
    role = "フリー";
  }

  let attendance = attendanceRaw;
  let time = "";
  if (attendanceRaw.includes(":")) {
    const attParts = attendanceRaw.split(":", 2);
    attendance = attParts[0];
    time = attParts[1];
  }

  return { role, attendance, time };
};

export const packCellData = (role: string, attendance: string, time?: string) => {
  const attStr = (time && (attendance === "遅刻" || attendance === "早退")) ? `${attendance}:${time}` : attendance;
  return `${role}|${attStr}`;
};

export default function SchedulePage() {
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [scheduleData, setScheduleData] = useState<Record<string, Record<string, string>>>({});
  const [isLoaded, setIsLoaded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedCell, setSelectedCell] = useState<{ dateStr: string; staff: string } | null>(null);
  const [tempRole, setTempRole] = useState("フリー");
  const [tempAttendance, setTempAttendance] = useState("通常");
  const [tempHour, setTempHour] = useState("13");
  const [tempMinute, setTempMinute] = useState("00");

  useEffect(() => {
    if (selectedCell) {
      const raw = scheduleData[selectedCell.dateStr]?.[selectedCell.staff] || "";
      const { role, attendance, time } = getCellData(raw);
      setTempRole(role);
      setTempAttendance(attendance);
      if (time) {
        const parts = time.split(":");
        setTempHour(parts[0]?.padStart(2, "0") || "13");
        setTempMinute(parts[1]?.padStart(2, "0") || "00");
      } else {
        setTempHour("13");
        setTempMinute("00");
      }
    }
  }, [selectedCell, scheduleData]);

  const handleSaveCell = () => {
    if (selectedCell) {
      const timeStr = `${tempHour}:${tempMinute}`;
      updateCell(selectedCell.dateStr, selectedCell.staff, packCellData(tempRole, tempAttendance, timeStr));
      setSelectedCell(null);
    }
  };

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;
  const monthStr = `${year}-${String(month).padStart(2, '0')}`;
  const daysInMonth = new Date(year, month, 0).getDate();

  // Load from Supabase
  useEffect(() => {
    let isMounted = true;
    setIsLoaded(false);

    async function loadData() {
      try {
        const data = await fetchMonthlySchedule(monthStr);
        if (isMounted) {
          setScheduleData(data || {});
          setIsLoaded(true);
        }
      } catch (e) {
        console.error("Failed to load schedule data", e);
        if (isMounted) setIsLoaded(true);
      }
    }
    loadData();

    return () => {
      isMounted = false;
    };
  }, [monthStr]);

  const saveToSupabase = async (newData: Record<string, Record<string, string>>) => {
    setIsSaving(true);
    try {
      await saveMonthlySchedule(monthStr, newData);
    } catch (e) {
      console.error("Failed to save schedule data", e);
      alert("保存に失敗しました");
    } finally {
      setIsSaving(false);
    }
  };

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 2, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month, 1));
  };

  const updateCell = (dateStr: string, staff: string, role: string) => {
    const newData = {
      ...scheduleData,
      [dateStr]: {
        ...(scheduleData[dateStr] || {}),
        [staff]: role
      }
    };
    setScheduleData(newData);
    saveToSupabase(newData);
  };

  const generateSchedule = () => {
    if (!confirm("現在の「休み」「研修」「遅刻」「早退」設定を残して、それ以外のシフトを自動生成します。よろしいですか？")) return;

    const newData = { ...scheduleData };
    
    // 各役職ごとの担当回数をカウント
    const roleCounts: Record<string, Record<string, number>> = {
      "ぽっけリーダー": { "増子": 0, "内山": 0, "熊田": 0, "逵": 0, "大平": 0 },
      "日中リーダー": { "増子": 0, "内山": 0, "熊田": 0, "逵": 0, "大平": 0 },
      "集団担当": { "増子": 0, "内山": 0, "熊田": 0, "逵": 0, "大平": 0 },
    };

    // 役割をシャッフルする関数
    const shuffleArray = (array: any[]) => {
      for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
      }
      return array;
    };

    for (let d = 1; d <= daysInMonth; d++) {
      const dateObj = new Date(year, month - 1, d);
      if (dateObj.getDay() === 0 || dateObj.getDay() === 6) continue;

      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayData = newData[dateStr] || {};
      
      const availableStaff = STAFF_LIST.filter(s => {
        const { attendance } = getCellData(dayData[s]);
        return attendance === "通常";
      });
      
      // 役職の割り当て順も毎日シャッフルして偏りを防ぐ
      const rolesToAssign = shuffleArray(["ぽっけリーダー", "日中リーダー", "集団担当"]);
      const assignedRoles: Record<string, string> = {};

      for (const role of rolesToAssign) {
        let candidates = availableStaff.filter(s => {
          if (assignedRoles[s]) return false;
          
          // 前日と同じ役職は禁止
          const prevDate = new Date(year, month - 1, d - 1);
          const pStr = `${prevDate.getFullYear()}-${String(prevDate.getMonth()+1).padStart(2, '0')}-${String(prevDate.getDate()).padStart(2, '0')}`;
          if (newData[pStr]) {
             const prevCell = getCellData(newData[pStr][s]);
             if (prevCell.role === role) return false;
          }
          return true;
        });

        if (candidates.length === 0) {
           // 前日制限を解除して再検索
           candidates = availableStaff.filter(s => !assignedRoles[s]);
        }

        if (candidates.length > 0) {
          // シャッフルしてからソートすることで、同回数の場合にランダムになる
          shuffleArray(candidates);
          // その役職の担当回数が少ない人を優先
          candidates.sort((a, b) => roleCounts[role][a] - roleCounts[role][b]);
          
          const selected = candidates[0];
          assignedRoles[selected] = role;
          roleCounts[role][selected]++;
        }
      }

      for (const s of availableStaff) {
        if (!assignedRoles[s]) {
          assignedRoles[s] = "フリー";
        }
      }

      // 出欠情報は維持しつつ役職をパックして保存
      const packedDayData: Record<string, string> = { ...dayData };
      for (const s of STAFF_LIST) {
        const existingData = getCellData(dayData[s]);
        if (existingData.attendance !== "通常") {
           packedDayData[s] = packCellData("フリー", existingData.attendance, existingData.time);
        } else {
           packedDayData[s] = packCellData(assignedRoles[s] || "フリー", existingData.attendance, existingData.time);
        }
      }

      newData[dateStr] = packedDayData;
    }

    setScheduleData(newData);
    saveToSupabase(newData);
  };

  const handlePrint = () => {
    window.print();
  };

  if (!isLoaded) return null;

  const days = Array.from({ length: daysInMonth }, (_, i) => {
    const d = i + 1;
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dateObj = new Date(year, month - 1, d);
    const dayOfWeek = ["日", "月", "火", "水", "木", "金", "土"][dateObj.getDay()];
    return { day: d, dateStr, dayOfWeek, isWeekend: dateObj.getDay() === 0 || dateObj.getDay() === 6, isSaturday: dateObj.getDay() === 6, isSunday: dateObj.getDay() === 0 };
  });

  return (
    <div className="flex flex-col w-full h-full min-h-[calc(100vh-64px)]">
      <main className="flex-1 p-4 md:p-8 print:m-0 print:p-0 print:w-full">
        {/* Header - Hidden on print */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 md:mb-6 gap-4 print:hidden">
          <div className="flex items-center gap-3">
            <CalendarIcon className="w-6 h-6 md:w-8 md:h-8 text-blue-600" />
            <div className="flex items-center gap-2">
              <h1 className="text-xl md:text-2xl font-bold text-gray-900">担当スケジュール</h1>
              {isSaving && <span className="text-sm text-gray-500 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> 保存中...</span>}
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-3">
            <Button onClick={generateSchedule} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold gap-1 md:gap-2 text-xs md:text-sm px-2 md:px-4">
              <Sparkles className="w-4 h-4" />
              自動生成
            </Button>
            <Button onClick={handlePrint} variant="outline" className="gap-1 md:gap-2 border-gray-300 text-xs md:text-sm px-2 md:px-4">
              <Printer className="w-4 h-4" />
              印刷
            </Button>
          </div>
        </div>

        {/* Date Selector - Hidden on print */}
        <div className="flex items-center justify-center gap-4 md:gap-6 mb-4 md:mb-6 print:hidden">
          <Button variant="ghost" size="icon" onClick={handlePrevMonth} className="rounded-full hover:bg-gray-200">
            <ChevronLeft className="w-5 h-5 md:w-6 md:h-6" />
          </Button>
          <div className="text-lg md:text-2xl font-bold w-32 md:w-48 text-center tracking-wider">
            {year}年 {month}月
          </div>
          <Button variant="ghost" size="icon" onClick={handleNextMonth} className="rounded-full hover:bg-gray-200">
            <ChevronRight className="w-5 h-5 md:w-6 md:h-6" />
          </Button>
        </div>

        {/* Print Header - Visible only on print */}
        <div className="hidden print:block text-center mb-1">
          <h1 className="text-[11px] font-bold">{year}年 {month}月 担当スケジュール</h1>
        </div>

        {/* Schedule Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto print:overflow-visible print:shadow-none print:border-none print:w-full schedule-print-container">
          <table className="w-full text-sm text-left border-collapse print:text-[10px] min-w-[600px] md:min-w-0">
            <thead className="bg-gray-100 text-gray-700 border-b border-gray-200">
              <tr>
                <th className="py-3 px-4 border-r border-gray-200 font-bold text-center w-20 print:py-[2px] print:px-1 print:text-[10px]">日付</th>
                {STAFF_LIST.map(staff => (
                  <th key={staff} className="py-3 px-4 border-r border-gray-200 font-bold text-center print:py-[2px] print:px-1 print:text-[10px]">
                    {staff}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {days.map(({ day, dateStr, dayOfWeek, isWeekend, isSaturday, isSunday }) => {
                const dayData = scheduleData[dateStr] || {};
                return (
                  <tr key={dateStr} className={cn("border-b transition-colors print:border-gray-300", isWeekend ? "bg-gray-100/50 print:bg-gray-100/50" : "border-gray-100 hover:bg-gray-50")}>
                    <td className={cn(
                      "border-r border-gray-200 text-center font-medium print:py-[2px] print:px-1 print:text-[9.5px] print:leading-[1.12]",
                      isSunday ? "text-red-500" : isSaturday ? "text-blue-500" : "text-gray-900",
                      "py-2 px-4"
                    )}>
                      {month}/{day}({dayOfWeek})
                    </td>
                    {STAFF_LIST.map(staff => {
                      const rawData = dayData[staff] || "";
                      const { role, attendance, time } = getCellData(rawData);
                      
                      let displayLabel = role === "フリー" ? "" : role;
                      let colorClass = ROLES.find(r => r.id === role)?.colorClass || "bg-transparent text-gray-800";
                      
                      let formattedTime = "";
                      if (time) {
                        const tParts = time.split(":");
                        formattedTime = `${(tParts[0] || "00").padStart(2, "0")}:${(tParts[1] || "00").padStart(2, "0")}`;
                      }
                      
                      if (attendance !== "通常") {
                        if (attendance === "休み") {
                          displayLabel = "休み";
                          colorClass = "bg-red-100 text-red-700 font-bold border-red-200";
                        } else if (attendance === "研修") {
                          displayLabel = "研修";
                          colorClass = "bg-amber-100 text-amber-800 font-bold border-amber-200";
                        } else if (attendance === "遅刻") {
                          displayLabel = formattedTime ? `遅刻 (${formattedTime}〜)` : "遅刻";
                          colorClass = "bg-red-100 text-red-700 font-bold border-red-200";
                        } else if (attendance === "早退") {
                          displayLabel = formattedTime ? `早退 (〜${formattedTime})` : "早退";
                          colorClass = "bg-red-100 text-red-700 font-bold border-red-200";
                        }
                      }

                      if (isWeekend) {
                        return (
                          <td key={staff} className="border-r border-gray-200 p-0.5 print:p-[2px]">
                            <div className="w-full h-full min-h-[14px] print:min-h-[14px] md:h-12 bg-transparent"></div>
                          </td>
                        );
                      }

                      return (
                        <td key={staff} className="border-r border-gray-200 p-0.5 print:p-[2px] relative">
                          {/* Print view: simple colored div */}
                          <div className={cn(
                            "hidden print:flex items-center justify-center w-full h-full min-h-[14px] rounded-sm text-[9.5px] font-bold tracking-tight leading-[1.12] py-[1px] px-1 border",
                            attendance === "通常" ? "border-transparent" : "",
                            colorClass
                          )}>
                            {displayLabel}
                          </div>

                          {/* Screen view: clickable cell */}
                          <div 
                            className={cn(
                              "print:hidden h-12 w-full rounded-lg cursor-pointer flex flex-col items-center justify-center transition-opacity hover:opacity-80 relative border",
                              role === "フリー" && attendance === "通常" ? "bg-white border-dashed border-gray-300 text-gray-400" : "border-transparent",
                              colorClass
                            )}
                            onClick={() => !isWeekend && setSelectedCell({ dateStr, staff })}
                          >
                            <span className="text-sm font-bold">{displayLabel || "-"}</span>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

      </main>

      <style jsx global>{`
        @media print {
          @page {
            size: A4 landscape;
            margin: 3mm 5mm;
          }
          body {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .schedule-print-container {
            width: 100%;
            zoom: 0.93; /* Chrome / Edge */
            transform: scale(0.93); /* Firefox etc */
            transform-origin: top center;
            page-break-inside: avoid;
            break-inside: avoid;
          }
          .schedule-print-container table {
            page-break-inside: avoid;
            break-inside: avoid;
            width: 100%;
          }
          .schedule-print-container th,
          .schedule-print-container td {
            padding: 1.8px 4px !important;
            line-height: 1.12 !important;
          }
          .schedule-print-container td > div {
            padding-top: 1px !important;
            padding-bottom: 1px !important;
            min-height: 14px !important;
          }
          .schedule-print-container tr {
            page-break-inside: avoid;
            break-inside: avoid;
            page-break-after: auto;
          }
        }
      `}</style>
      <Dialog open={!!selectedCell} onOpenChange={(open) => !open && setSelectedCell(null)}>
        <DialogContent className="max-w-sm rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-center text-lg">
              {selectedCell && `${selectedCell.dateStr.split('-')[1]}/${selectedCell.dateStr.split('-')[2]} - ${selectedCell.staff}`}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-6 py-4">
            <div className="space-y-3">
              <label className="text-sm font-bold text-gray-700">1. 勤務状態（ステータス）</label>
              <div className="grid grid-cols-3 gap-2">
                {ATTENDANCES.map(a => (
                  <button
                    key={a.id}
                    onClick={() => {
                      setTempAttendance(a.id);
                      if (a.id !== "通常") {
                        setTempRole("フリー");
                      }
                      if (a.id !== "遅刻" && a.id !== "早退") {
                        setTempHour("13");
                        setTempMinute("00");
                      }
                    }}
                    className={cn(
                      "py-2 rounded-lg text-sm font-semibold border-2 transition-all",
                      tempAttendance === a.id ? cn(a.colorClass, "border-current opacity-100") : "border-gray-100 bg-gray-50 text-gray-400 hover:bg-gray-100 opacity-60"
                    )}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
              {(tempAttendance === "遅刻" || tempAttendance === "早退") && (
                <div className="mt-3 flex items-center gap-3 bg-purple-50 p-3 rounded-lg border border-purple-100">
                  <label className="text-sm font-bold text-purple-700">時間</label>
                  <div className="flex items-center gap-1 flex-1">
                    <select
                      value={tempHour}
                      onChange={(e) => setTempHour(e.target.value)}
                      className="px-2 py-1.5 rounded border border-purple-200 focus:outline-none focus:ring-2 focus:ring-purple-400 font-medium w-full text-center"
                    >
                      {Array.from({ length: 13 }, (_, i) => i + 7).map(h => {
                         const hs = String(h).padStart(2, "0");
                         return <option key={hs} value={hs}>{hs}</option>;
                      })}
                    </select>
                    <span className="font-bold text-purple-700">:</span>
                    <select
                      value={tempMinute}
                      onChange={(e) => setTempMinute(e.target.value)}
                      className="px-2 py-1.5 rounded border border-purple-200 focus:outline-none focus:ring-2 focus:ring-purple-400 font-medium w-full text-center"
                    >
                      {["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"].map(m => (
                         <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>
            
            <div className="space-y-3">
              <label className={cn("text-sm font-bold", tempAttendance !== "通常" ? "text-gray-400" : "text-gray-700")}>
                2. 担当役割
              </label>
              <div className="grid grid-cols-2 gap-2">
                {ROLES.map(r => (
                  <button
                    key={r.id}
                    disabled={tempAttendance !== "通常"}
                    onClick={() => setTempRole(r.id)}
                    className={cn(
                      "py-2 rounded-lg text-sm font-semibold border-2 transition-all",
                      tempAttendance !== "通常" ? "opacity-30 cursor-not-allowed" :
                      tempRole === r.id ? cn(r.colorClass, "border-current opacity-100 shadow-sm") : "border-gray-100 bg-gray-50 text-gray-400 hover:bg-gray-100 opacity-60"
                    )}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="outline" onClick={() => setSelectedCell(null)}>キャンセル</Button>
            <Button onClick={handleSaveCell} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6">保存</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
