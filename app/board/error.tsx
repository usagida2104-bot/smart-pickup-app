"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RotateCcw } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Board page error:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-8 text-center">
      <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
        <AlertTriangle className="w-8 h-8 text-red-600" />
      </div>
      <h2 className="text-2xl font-bold text-gray-800">問題が発生しました</h2>
      <p className="text-gray-600 max-w-md">
        送迎ボードの表示中にエラーが発生しました。データが正しく読み込めなかった可能性があります。
      </p>
      <div className="bg-gray-100 p-4 rounded-lg text-left text-xs text-red-800 w-full max-w-2xl overflow-auto mt-4 mb-4 font-mono">
        {error.message || "Unknown error"}
      </div>
      <Button
        onClick={() => {
          window.location.reload();
        }}
        className="gap-2 bg-indigo-600 hover:bg-indigo-700"
      >
        <RotateCcw className="w-4 h-4" />
        ページを再読み込みする
      </Button>
    </div>
  );
}
