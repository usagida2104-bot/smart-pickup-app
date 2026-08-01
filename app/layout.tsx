import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";

export const metadata: Metadata = {
  title: "放デイ 送迎表システム",
  description: "放課後等デイサービスの送迎予定表デジタル管理システム",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased bg-gray-50">
        <Sidebar />
        <Header />
        <main className="ml-64 pt-16 min-h-screen">
          {children}
        </main>
      </body>
    </html>
  );
}
