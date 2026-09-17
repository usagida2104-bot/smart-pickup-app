"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSidebarStore } from "@/lib/store/sidebarStore";
import { useEffect } from "react";
import {
  Bus,
  Calendar,
  CalendarDays,
  Car,
  GraduationCap,
  LayoutDashboard,
  School,
  Smartphone,
  Users,
  UserSquare2,
  LogOut,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth/AuthProvider";

const navItems = [
  {
    label: "ダッシュボード",
    href: "/",
    icon: LayoutDashboard,
  },
  {
    label: "送迎ボード",
    href: "/board",
    icon: Bus,
  },
  {
    label: "日別設定",
    href: "/daily-setup",
    icon: Calendar,
  },
  {
    label: "担当スケジュール",
    href: "/schedule",
    icon: CalendarDays,
  },
  {
    label: "─── マスター管理",
    href: "#",
    icon: null,
    isSection: true,
  },
  {
    label: "児童管理",
    href: "/admin/children",
    icon: Users,
  },
  {
    label: "スタッフ管理",
    href: "/admin/staff",
    icon: UserSquare2,
  },
  {
    label: "学校管理",
    href: "/admin/schools",
    icon: GraduationCap,
  },
  {
    label: "車両管理",
    href: "/admin/vehicles",
    icon: Car,
  },
];

export function Sidebar({ className }: { className?: string }) {
  const pathname = usePathname();
  const { logout } = useAuth();
  const { isOpen, setIsOpen } = useSidebarStore();

  useEffect(() => {
    setIsOpen(false);
  }, [pathname, setIsOpen]);

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/50 md:hidden transition-opacity"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={cn(
          "fixed left-0 top-0 h-screen w-64 bg-gray-900 text-white flex flex-col z-50 shadow-2xl transition-transform duration-300 ease-in-out md:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full",
          className
        )}
      >
        {/* Logo */}
        <div className="px-6 py-5 border-b border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
              <School className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold leading-tight">放デイ</h1>
              <p className="text-xs text-gray-400">送迎表システム</p>
            </div>
          </div>
          <button 
            className="md:hidden p-1 text-gray-400 hover:text-white rounded-md hover:bg-gray-800"
            onClick={() => setIsOpen(false)}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          <ul className="space-y-1">
            {navItems.map((item, idx) => {
              if (item.isSection) {
                return (
                  <li key={idx} className="px-3 pt-4 pb-1">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      マスター管理
                    </span>
                  </li>
                );
              }

              const isActive = pathname === item.href;
              const Icon = item.icon;

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setIsOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                      isActive
                        ? "bg-blue-600 text-white shadow-lg shadow-blue-500/25"
                        : "text-gray-300 hover:bg-gray-800 hover:text-white"
                    )}
                  >
                    {Icon && <Icon className="w-4 h-4 shrink-0" />}
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-700">
          <button 
            onClick={logout}
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors mb-3 w-full text-left"
          >
            <LogOut className="w-4 h-4" />
            <span>ログアウト</span>
          </button>
          <p className="text-xs text-gray-600">ver 1.0.0 — Demo Mode</p>
        </div>
      </aside>
    </>
  );
}
