"use client";

import { useState } from "react";
import { CheckCircle2, XCircle, Users, Clock, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { MOCK_CHILDREN, MOCK_DAILY_ATTENDANCE } from "@/lib/mockData";
import { AttendanceStatus, DailyAttendance } from "@/types";
import { cn } from "@/lib/utils";

const STATUS_CONFIG: Record<AttendanceStatus, { label: string; color: string; bg: string }> = {
  present: { label: "出席", color: "text-green-700", bg: "bg-green-100 border-green-300" },
  absent: { label: "欠席", color: "text-red-700", bg: "bg-red-100 border-red-300" },
  parent_pickup: { label: "保護者送迎", color: "text-orange-700", bg: "bg-orange-100 border-orange-300" },
};

const STATUS_CYCLE: AttendanceStatus[] = ["present", "absent", "parent_pickup"];

function formatDate(date: Date) {
  return date.toISOString().split("T")[0];
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export default function DailySetupPage() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [attendances, setAttendances] = useState<DailyAttendance[]>(
    MOCK_CHILDREN.map((child) => {
      const existing = MOCK_DAILY_ATTENDANCE.find((a) => a.child_id === child.id);
      return (
        existing ?? {
          id: `att-${child.id}`,
          target_date: formatDate(new Date()),
          child_id: child.id,
          status: "present" as AttendanceStatus,
          pickup_time: "14:30",
          child,
        }
      );
    })
  );

  const toggleStatus = (childId: string) => {
    setAttendances((prev) =>
      prev.map((a) => {
        if (a.child_id !== childId) return a;
        const currentIdx = STATUS_CYCLE.indexOf(a.status);
        const nextStatus = STATUS_CYCLE[(currentIdx + 1) % STATUS_CYCLE.length];
        return { ...a, status: nextStatus };
      })
    );
  };

  const updatePickupTime = (childId: string, time: string) => {
    setAttendances((prev) =>
      prev.map((a) =>
        a.child_id === childId ? { ...a, pickup_time: time || null } : a
      )
    );
  };

  const presentCount = attendances.filter((a) => a.status === "present").length;
  const absentCount = attendances.filter((a) => a.status === "absent").length;
  const parentCount = attendances.filter((a) => a.status === "parent_pickup").length;

  const displayDate = selectedDate.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">日別設定</h1>
        <p className="text-sm text-gray-500 mt-1">出欠・下校時間を設定します</p>
      </div>

      {/* Date Selector */}
      <div className="flex items-center gap-4 mb-6 p-4 bg-white rounded-xl border border-gray-200 shadow-sm">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSelectedDate((d) => addDays(d, -1))}
        >
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1 text-center">
          <p className="text-lg font-semibold text-gray-800">{displayDate}</p>
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
      <div className="flex gap-3 mb-6">
        <div className="flex items-center gap-2 px-4 py-2 bg-green-50 border border-green-200 rounded-lg">
          <CheckCircle2 className="w-4 h-4 text-green-600" />
          <span className="text-sm font-semibold text-green-700">出席 {presentCount}名</span>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-red-50 border border-red-200 rounded-lg">
          <XCircle className="w-4 h-4 text-red-600" />
          <span className="text-sm font-semibold text-red-700">欠席 {absentCount}名</span>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-orange-50 border border-orange-200 rounded-lg">
          <Users className="w-4 h-4 text-orange-600" />
          <span className="text-sm font-semibold text-orange-700">保護者送迎 {parentCount}名</span>
        </div>
      </div>

      {/* Attendance List */}
      <div className="space-y-3">
        {attendances.map((att) => {
          const child = MOCK_CHILDREN.find((c) => c.id === att.child_id);
          if (!child) return null;
          const config = STATUS_CONFIG[att.status];
          return (
            <div
              key={att.child_id}
              className="flex items-center gap-4 p-4 bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
            >
              {/* Color dot */}
              <div
                className="w-4 h-4 rounded-full shrink-0 shadow-sm"
                style={{ backgroundColor: child.school?.color_code ?? "#ccc" }}
              />

              {/* Child info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {child.has_caution && <span className="text-red-500 text-sm">❤️</span>}
                  <span className="font-semibold text-gray-800">{child.name}</span>
                  {child.unit_name && (
                    <Badge variant="secondary" className="text-xs">{child.unit_name}</Badge>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  {child.school?.name ?? "学校未設定"}
                </p>
              </div>

              {/* Status toggle */}
              <button
                onClick={() => toggleStatus(att.child_id)}
                className={cn(
                  "px-4 py-1.5 rounded-full text-sm font-semibold border transition-all hover:scale-105",
                  config.bg,
                  config.color
                )}
              >
                {config.label}
              </button>

              {/* Pickup time */}
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-400 shrink-0" />
                <Input
                  type="time"
                  value={att.pickup_time ?? ""}
                  onChange={(e) => updatePickupTime(att.child_id, e.target.value)}
                  disabled={att.status !== "present"}
                  className={cn(
                    "w-32 text-sm",
                    att.status !== "present" && "opacity-40 cursor-not-allowed"
                  )}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Save button */}
      <div className="mt-6 flex justify-end">
        <Button size="lg" className="gap-2 px-8">
          <CheckCircle2 className="w-4 h-4" />
          設定を保存
        </Button>
      </div>
    </div>
  );
}
