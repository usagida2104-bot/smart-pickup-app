import { ChevronLeft, ChevronRight, CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DateSelectorProps {
  selectedDate: Date;
  onChange: (date: Date) => void;
}

export function DateSelector({ selectedDate, onChange }: DateSelectorProps) {
  const displayDate = selectedDate.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });

  const formatDate = (date: Date) => date.toISOString().split("T")[0];
  const addDays = (date: Date, days: number) => {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
  };

  const today = new Date();
  const isToday =
    selectedDate.getFullYear() === today.getFullYear() &&
    selectedDate.getMonth() === today.getMonth() &&
    selectedDate.getDate() === today.getDate();

  return (
    <div className={`flex items-center justify-between gap-1 sm:gap-2 md:gap-4 p-1.5 sm:p-2 md:p-3.5 rounded-lg md:rounded-xl border shadow-sm overflow-x-auto print:hidden ${isToday ? "bg-white border-gray-200" : "bg-amber-50 border-amber-300"}`}>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 sm:h-8 sm:w-8 md:h-9 md:w-9 shrink-0"
        onClick={() => onChange(addDays(selectedDate, -1))}
      >
        <ChevronLeft className="w-4 h-4 md:w-5 md:h-5" />
      </Button>
      <div className="flex-1 text-center flex justify-center items-center">
        <div className="relative group flex items-center justify-center cursor-pointer">
          <div className={`flex items-center gap-1.5 md:gap-2 px-2.5 py-1 md:px-4 md:py-2 rounded-lg transition-colors pointer-events-none ${isToday ? "group-hover:bg-gray-100" : "bg-amber-200 group-hover:bg-amber-300"}`}>
            <CalendarIcon className={`w-3.5 h-3.5 md:w-5 md:h-5 ${isToday ? "text-gray-500" : "text-amber-800"}`} />
            <p className={`text-xs sm:text-sm md:text-lg font-semibold whitespace-nowrap ${isToday ? "text-gray-800" : "text-amber-900"}`}>{displayDate}</p>
            {!isToday && <span className="text-[9px] md:text-[10px] font-bold bg-amber-600 text-white px-1 py-0.2 md:px-1.5 md:py-0.5 rounded">今日以外</span>}
          </div>
          <input 
            type="date" 
            value={formatDate(selectedDate)}
            onChange={(e) => {
              if (e.target.value) {
                const d = new Date(e.target.value);
                onChange(d);
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
      <div className="flex items-center gap-1 sm:gap-2 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 sm:h-8 sm:w-8 md:h-9 md:w-9"
          onClick={() => onChange(addDays(selectedDate, 1))}
        >
          <ChevronRight className="w-4 h-4 md:w-5 md:h-5" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onChange(new Date())}
          className="h-7 md:h-8 px-2 md:px-3 text-xs md:text-sm ml-0.5 sm:ml-1 whitespace-nowrap"
        >
          今日
        </Button>
      </div>
    </div>
  );
}
