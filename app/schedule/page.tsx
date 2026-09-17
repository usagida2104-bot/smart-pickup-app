"use client";

import { useState, useEffect } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Button } from "@/components/ui/button";
import { CalendarIcon, Printer, Sparkles, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const STAFF_LIST = ["増子", "内山", "熊田", "逵", "大平"];

const ROLES = [
  { id: "ぽっけリーダー", label: "ぽっけリーダー", colorClass: "bg-[#dbeafe] text-[#1d4ed8]" },
  { id: "日中リーダー", label: "日中リーダー", colorClass: "bg-[#dcfce7] text-[#15803d]" },
  { id: "集団担当", label: "集団担当", colorClass: "bg-[#f3f4f6] text-[#111827] font-bold border border-[#111827]" },
  { id: "フリー", label: "フリー", colorClass: "bg-gray-100 text-gray-500" },
  { id: "休み", label: "休み / 担当不可", colorClass: "bg-[#fee2e2] text-[#b91c1c]" },
];

export default function SchedulePage() {
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [scheduleData, setScheduleData] = useState<Record<string, Record<string, string>>>({});
  const [isLoaded, setIsLoaded] = useState(false);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;
  const daysInMonth = new Date(year, month, 0).getDate();

  // Load from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("staff-schedule");
    if (saved) {
      try {
        setScheduleData(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse schedule data", e);
      }
    }
    setIsLoaded(true);
  }, []);

  // Save to localStorage
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem("staff-schedule", JSON.stringify(scheduleData));
    }
  }, [scheduleData, isLoaded]);

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 2, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month, 1));
  };

  const updateCell = (dateStr: string, staff: string, role: string) => {
    setScheduleData(prev => ({
      ...prev,
      [dateStr]: {
        ...(prev[dateStr] || {}),
        [staff]: role
      }
    }));
  };

  const generateSchedule = () => {
    if (!confirm("現在の「休み」設定を残して、それ以外のシフトを自動生成します。よろしいですか？")) return;

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
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayData = newData[dateStr] || {};
      
      const availableStaff = STAFF_LIST.filter(s => dayData[s] !== "休み");
      
      // 役職の割り当て順も毎日シャッフルして偏りを防ぐ
      const rolesToAssign = shuffleArray(["ぽっけリーダー", "日中リーダー", "集団担当"]);
      const assignedRoles: Record<string, string> = {};

      for (const role of rolesToAssign) {
        let candidates = availableStaff.filter(s => {
          if (assignedRoles[s]) return false;
          // 前日と同じ役職は禁止
          const prevDate = new Date(year, month - 1, d - 1);
          const pStr = `${prevDate.getFullYear()}-${String(prevDate.getMonth()+1).padStart(2, '0')}-${String(prevDate.getDate()).padStart(2, '0')}`;
          if (newData[pStr] && newData[pStr][s] === role) return false;
          return true;
        });

        if (candidates.length === 0) {
           // 前日制限で誰もいない場合は、前日制限を解除
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

      newData[dateStr] = { ...dayData, ...assignedRoles };
    }

    setScheduleData(newData);
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
    return { day: d, dateStr, dayOfWeek, isWeekend: dateObj.getDay() === 0 || dateObj.getDay() === 6 };
  });

  return (
    <div className="flex flex-col w-full h-full min-h-[calc(100vh-64px)]">
      <main className="flex-1 p-4 md:p-8 print:m-0 print:p-0 print:w-full">
        {/* Header - Hidden on print */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 md:mb-6 gap-4 print:hidden">
          <div className="flex items-center gap-3">
            <CalendarIcon className="w-6 h-6 md:w-8 md:h-8 text-blue-600" />
            <h1 className="text-xl md:text-2xl font-bold text-gray-900">担当スケジュール</h1>
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
        <div className="hidden print:block text-center mb-2">
          <h1 className="text-xl font-bold">{year}年 {month}月 担当スケジュール</h1>
        </div>

        {/* Schedule Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto print:overflow-visible print:shadow-none print:border-none print:w-full schedule-print-container">
          <table className="w-full text-sm text-left border-collapse print:text-[9px] min-w-[600px] md:min-w-0">
            <thead className="bg-gray-100 text-gray-700 border-b border-gray-200">
              <tr>
                <th className="py-3 px-4 border-r border-gray-200 font-bold text-center w-20 print:py-0.5 print:px-1">日付</th>
                {STAFF_LIST.map(staff => (
                  <th key={staff} className="py-3 px-4 border-r border-gray-200 font-bold text-center print:py-0.5 print:px-1">
                    {staff}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {days.map(({ day, dateStr, dayOfWeek, isWeekend }) => {
                const dayData = scheduleData[dateStr] || {};
                return (
                  <tr key={dateStr} className="border-b border-gray-100 hover:bg-gray-50 transition-colors print:border-gray-300">
                    <td className={cn(
                      "border-r border-gray-200 text-center font-medium print:py-0.5 print:px-1",
                      isWeekend ? "text-red-500 bg-red-50/30 print:bg-red-50" : "py-2 px-4"
                    )}>
                      {month}/{day} ({dayOfWeek})
                    </td>
                    {STAFF_LIST.map(staff => {
                      const currentRole = dayData[staff] || "フリー";
                      const roleDef = ROLES.find(r => r.id === currentRole) || ROLES[3];

                      return (
                        <td key={staff} className="border-r border-gray-200 p-1 print:p-0.5">
                          {/* Print view: simple colored div */}
                          <div className={cn(
                            "hidden print:flex items-center justify-center w-full h-full min-h-[14px] rounded-sm text-[9px] font-bold tracking-tighter leading-none py-0.5 border border-transparent",
                            roleDef.colorClass,
                            roleDef.id === "集団担当" && "border-gray-800"
                          )}>
                            {roleDef.id === "休み" ? "休み" : roleDef.id}
                          </div>

                          {/* Screen view: select dropdown */}
                          <div className="print:hidden h-full">
                            <select
                              value={currentRole}
                              onChange={(e) => updateCell(dateStr, staff, e.target.value)}
                              className={cn(
                                "w-full h-10 px-2 rounded-lg text-sm font-semibold appearance-none cursor-pointer outline-none transition-colors text-center",
                                roleDef.colorClass
                              )}
                            >
                              {ROLES.map(r => (
                                <option key={r.id} value={r.id} className="bg-white text-gray-900 font-normal">
                                  {r.label}
                                </option>
                              ))}
                            </select>
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
            margin: 6mm;
          }
          body {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .schedule-print-container {
            width: 100%;
          }
          .schedule-print-container table {
            page-break-inside: avoid;
            width: 100%;
          }
          .schedule-print-container tr {
            page-break-inside: avoid;
            page-break-after: auto;
          }
        }
      `}</style>
    </div>
  );
}
