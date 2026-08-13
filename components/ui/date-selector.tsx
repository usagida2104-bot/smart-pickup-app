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

  return (
    <div className="flex items-center justify-between gap-2 md:gap-4 p-3 md:p-4 bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto print:hidden">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => onChange(addDays(selectedDate, -1))}
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
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onChange(addDays(selectedDate, 1))}
        >
          <ChevronRight className="w-5 h-5" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onChange(new Date())}
          className="ml-2 whitespace-nowrap"
        >
          今日
        </Button>
      </div>
    </div>
  );
}
