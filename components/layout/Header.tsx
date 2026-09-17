"use client";

import { usePathname } from "next/navigation";

const pageNames: Record<string, string> = {
  "/": "ダッシュボード",
  "/board": "送迎ボード",
  "/daily-setup": "日別設定",
  "/driver": "ドライバービュー",
  "/admin/children": "児童管理",
  "/admin/schools": "学校管理",
  "/admin/vehicles": "車両管理",
  "/admin/staff": "スタッフ管理",
};

import { cn } from "@/lib/utils";
import { useState } from "react";
import Link from "next/link";
import { Menu, X, LayoutDashboard, Bus, Calendar, CalendarDays, Users, GraduationCap, Car, UserSquare2 } from "lucide-react";

const mobileNavItems = [
  { label: "ダッシュボード", href: "/", icon: LayoutDashboard },
  { label: "送迎ボード", href: "/board", icon: Bus },
  { label: "日別設定", href: "/daily-setup", icon: Calendar },
  { label: "担当スケジュール", href: "/schedule", icon: CalendarDays },
  { label: "児童管理", href: "/admin/children", icon: Users },
  { label: "スタッフ管理", href: "/admin/staff", icon: UserSquare2 },
  { label: "学校管理", href: "/admin/schools", icon: GraduationCap },
  { label: "車両管理", href: "/admin/vehicles", icon: Car },
];

export function Header({ className }: { className?: string }) {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const title = pageNames[pathname] ?? "管理画面";
  const today = new Date().toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });

  return (
    <>
      <header className={cn("fixed top-0 left-0 md:left-64 right-0 h-16 bg-white/80 backdrop-blur-sm border-b border-gray-200 z-30 flex items-center justify-between px-4 md:px-6", className)}>
        <div className="flex items-center gap-3">
          <button 
            className="md:hidden p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-lg"
            onClick={() => setIsMobileMenuOpen(true)}
          >
            <Menu className="w-6 h-6" />
          </button>
          <h2 className="text-lg md:text-xl font-bold text-gray-800">{title}</h2>
        </div>
        <div className="flex items-center gap-4">
          <span className="hidden sm:inline text-sm text-gray-500">{today}</span>
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-sm font-bold shadow">
            管
          </div>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div className="fixed inset-0 bg-black/50" onClick={() => setIsMobileMenuOpen(false)} />
          <div className="relative w-64 h-full bg-white shadow-xl flex flex-col">
            <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200">
              <span className="font-bold text-gray-800">メニュー</span>
              <button 
                className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto py-4">
              <ul className="space-y-1 px-2">
                {mobileNavItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => setIsMobileMenuOpen(false)}
                        className={cn(
                          "flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors",
                          isActive
                            ? "bg-blue-50 text-blue-700"
                            : "text-gray-700 hover:bg-gray-50"
                        )}
                      >
                        <Icon className={cn("w-5 h-5", isActive ? "text-blue-700" : "text-gray-400")} />
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
          </div>
        </div>
      )}
    </>
  );
}
