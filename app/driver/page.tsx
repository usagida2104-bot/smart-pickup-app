"use client";

import { useState, useEffect } from "react";
import { useBoardStore } from "@/lib/store/boardStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Clock, MapPin, User } from "lucide-react";
import { ChildMagnet } from "@/types";
import { autoAssignVehicles } from "@/lib/autoAssignVehicles";
import { MOCK_DAILY_ATTENDANCE, MOCK_DAILY_SHIFTS } from "@/lib/mockData";

export default function DriverPage() {
  const { board, setBoard } = useBoardStore();
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>("");

  useEffect(() => {
    // If the board is empty, initialize it with auto-assign
    if (board.columns.length === 0) {
      const result = autoAssignVehicles({
        attendances: MOCK_DAILY_ATTENDANCE,
        shifts: MOCK_DAILY_SHIFTS,
      });
      setBoard({
        columns: result.columns,
        unassigned: { id: "unassigned", children: result.unassigned },
      });
    }
  }, [board.columns.length, setBoard]);

  // Find the selected column based on vehicle/shift ID
  const selectedColumn = board.columns.find((col) => col.id === selectedVehicleId);

  // Sort children by pickup time for the timeline
  const sortedChildren: ChildMagnet[] = selectedColumn
    ? [...selectedColumn.children].sort((a, b) => {
        if (!a.pickup_time && !b.pickup_time) return 0;
        if (!a.pickup_time) return 1;
        if (!b.pickup_time) return -1;
        return a.pickup_time.localeCompare(b.pickup_time);
      })
    : [];

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Mobile Header */}
      <header className="bg-indigo-600 text-white p-4 shadow-md sticky top-0 z-10">
        <h1 className="text-xl font-bold mb-3">ドライバー専用ビュー</h1>
        <Select
          value={selectedVehicleId}
          onValueChange={setSelectedVehicleId}
        >
          <SelectTrigger className="w-full bg-white text-gray-900 border-0 h-12">
            <SelectValue placeholder="担当車両を選択してください" />
          </SelectTrigger>
          <SelectContent>
            {board.columns.map((col) => (
              <SelectItem key={col.id} value={col.id}>
                {col.vehicleName} ({col.driverName})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </header>

      {/* Main Content */}
      <main className="p-4 max-w-md mx-auto">
        {!selectedVehicleId ? (
          <div className="text-center py-10 text-gray-500">
            <CarIcon className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p>担当する車両を選択して、</p>
            <p>今日の送迎スケジュールを確認してください。</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex justify-between items-end mb-2 px-1">
              <h2 className="font-bold text-gray-700">乗車予定: {sortedChildren.length}名</h2>
              <span className="text-sm text-gray-500">{selectedColumn?.vehicleName}</span>
            </div>

            {sortedChildren.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center text-gray-500">
                  乗車予定の児童はいません
                </CardContent>
              </Card>
            ) : (
              <div className="relative border-l-2 border-indigo-200 ml-3 space-y-6">
                {sortedChildren.map((child, index) => (
                  <div key={child.id} className="relative pl-6">
                    {/* Timeline dot */}
                    <div className="absolute -left-[9px] top-4 w-4 h-4 rounded-full bg-indigo-500 border-2 border-white shadow-sm" />

                    <Card className="shadow-sm border-gray-200">
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-1.5 text-indigo-700 font-bold text-lg">
                            <Clock className="w-5 h-5" />
                            {child.pickup_time || "時間未定"}
                          </div>
                          {child.has_caution && (
                            <Badge variant="destructive" className="flex items-center gap-1">
                              <AlertCircle className="w-3.5 h-3.5" />
                              配慮
                            </Badge>
                          )}
                        </div>

                        <div className="space-y-2 mt-3">
                          <div className="flex items-start gap-2 text-gray-700">
                            <MapPin className="w-4 h-4 mt-0.5 text-gray-400 shrink-0" />
                            <div>
                              <p className="font-medium">{child.school_name}</p>
                              {child.unit_name && (
                                <p className="text-xs text-gray-500">{child.unit_name}</p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 text-gray-900 font-bold text-lg pt-1">
                            <User className="w-4 h-4 text-gray-400" />
                            {child.name}
                          </div>

                          {child.notes && (
                            <div className="mt-2 text-sm bg-amber-50 text-amber-800 p-2 rounded-md border border-amber-100 flex items-start gap-1.5">
                              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                              <p>{child.notes}</p>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function CarIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" />
      <circle cx="7" cy="17" r="2" />
      <path d="M9 17h6" />
      <circle cx="17" cy="17" r="2" />
    </svg>
  );
}
