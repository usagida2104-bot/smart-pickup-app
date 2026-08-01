"use client";

import { usePathname } from "next/navigation";

const pageNames: Record<string, string> = {
  "/": "ダッシュボード",
  "/board": "送迎ボード",
  "/daily-setup": "日別設定",
  "/admin/children": "児童管理",
  "/admin/schools": "学校管理",
  "/admin/vehicles": "車両管理",
  "/admin/staff": "スタッフ管理",
};

export function Header() {
  const pathname = usePathname();
  const title = pageNames[pathname] ?? "管理画面";
  const today = new Date().toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });

  return (
    <header className="fixed top-0 left-64 right-0 h-16 bg-white/80 backdrop-blur-sm border-b border-gray-200 z-30 flex items-center justify-between px-6">
      <h2 className="text-xl font-bold text-gray-800">{title}</h2>
      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-500">{today}</span>
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-sm font-bold shadow">
          管
        </div>
      </div>
    </header>
  );
}
