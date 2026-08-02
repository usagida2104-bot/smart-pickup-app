"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useMasterStore } from "@/lib/store/masterStore";
import { fetchMasterData } from "@/lib/supabase/service";

export function SupabaseProvider({ children }: { children: React.ReactNode }) {
  const { setMasterData } = useMasterStore();
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    // 1. 初回ロード
    const initData = async () => {
      try {
        const data = await fetchMasterData();
        setMasterData(data);
      } catch (error) {
        console.error("Supabase init error:", error);
      } finally {
        setIsInitializing(false);
      }
    };
    initData();

    // 2. リアルタイム購読の設定
    const channel = supabase
      .channel("public-db-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public" },
        (payload) => {
          console.log("Realtime event received:", payload);
          // マスター関連のテーブルに変更があった場合、雑に再フェッチして同期する
          // （本来は payload.new / payload.old を使って差分更新する方が高速ですが、
          // マスターデータは件数も限られるため全取得で実装をシンプルにしています）
          if (["schools", "vehicles", "staff", "children"].includes(payload.table)) {
            fetchMasterData().then(data => setMasterData(data));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [setMasterData]);

  if (isInitializing) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-medium text-gray-600">データを読み込み中...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
