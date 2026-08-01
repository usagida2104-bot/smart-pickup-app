import Link from "next/link";
import { Bus, Calendar, Car, GraduationCap, Users, UserSquare2, ArrowRight } from "lucide-react";

const cards = [
  {
    title: "送迎ボード",
    desc: "ドラッグ＆ドロップで配車を管理",
    href: "/board",
    icon: Bus,
    color: "from-blue-500 to-indigo-600",
    bg: "bg-blue-50",
    textColor: "text-blue-600",
  },
  {
    title: "日別設定",
    desc: "出欠・下校時間を設定",
    href: "/daily-setup",
    icon: Calendar,
    color: "from-green-500 to-emerald-600",
    bg: "bg-green-50",
    textColor: "text-green-600",
  },
  {
    title: "児童管理",
    desc: "児童情報のCRUD",
    href: "/admin/children",
    icon: Users,
    color: "from-purple-500 to-violet-600",
    bg: "bg-purple-50",
    textColor: "text-purple-600",
  },
  {
    title: "学校管理",
    desc: "学校情報のCRUD",
    href: "/admin/schools",
    icon: GraduationCap,
    color: "from-orange-500 to-amber-600",
    bg: "bg-orange-50",
    textColor: "text-orange-600",
  },
  {
    title: "車両管理",
    desc: "車両情報のCRUD",
    href: "/admin/vehicles",
    icon: Car,
    color: "from-red-500 to-rose-600",
    bg: "bg-red-50",
    textColor: "text-red-600",
  },
  {
    title: "スタッフ管理",
    desc: "スタッフ情報のCRUD",
    href: "/admin/staff",
    icon: UserSquare2,
    color: "from-teal-500 to-cyan-600",
    bg: "bg-teal-50",
    textColor: "text-teal-600",
  },
];

export default function DashboardPage() {
  const today = new Date().toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });

  return (
    <div className="p-8">
      {/* Welcome banner */}
      <div className="mb-8 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-700 p-8 text-white shadow-xl">
        <p className="text-blue-200 text-sm mb-1">{today}</p>
        <h1 className="text-3xl font-bold mb-2">おはようございます 👋</h1>
        <p className="text-blue-100">
          放課後等デイサービス 送迎表管理システムへようこそ。
        </p>
        <Link
          href="/board"
          className="mt-4 inline-flex items-center gap-2 bg-white text-blue-600 px-5 py-2 rounded-lg font-semibold text-sm hover:bg-blue-50 transition-colors shadow-md"
        >
          今日の送迎ボードを開く
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Quick access cards */}
      <h2 className="text-lg font-semibold text-gray-700 mb-4">クイックアクセス</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.href}
              href={card.href}
              className="group rounded-xl border border-gray-200 bg-white p-6 hover:shadow-lg hover:border-gray-300 transition-all duration-200"
            >
              <div className={`inline-flex w-12 h-12 rounded-xl ${card.bg} items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                <Icon className={`w-6 h-6 ${card.textColor}`} />
              </div>
              <h3 className="font-semibold text-gray-800 mb-1">{card.title}</h3>
              <p className="text-sm text-gray-500 mb-3">{card.desc}</p>
              <div className={`flex items-center gap-1 text-sm font-medium ${card.textColor}`}>
                開く <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </Link>
          );
        })}
      </div>

      {/* Info banner */}
      <div className="mt-8 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-800 text-sm">
        <strong>ℹ️ デモモードで動作中</strong> —
        Supabaseに接続するには <code className="bg-amber-100 px-1 rounded">.env.local</code> に接続情報を設定してください。
        現在はモックデータを使用しています。
      </div>
    </div>
  );
}
