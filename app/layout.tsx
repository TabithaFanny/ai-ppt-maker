import type { Metadata } from "next";
import "./globals.css";
import ErrorBoundary from "@/components/ErrorBoundary";
import Toast from "@/components/Toast";
import NetworkStatus from "@/components/NetworkStatus";
import MobileNav from "@/components/MobileNav";

export const metadata: Metadata = {
  title: "AI PPT 生成平台",
  description: "基于 Claude API 的智能 PPT 生成工具",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <ErrorBoundary>
          <NetworkStatus />
          <Toast />
          {children}
        </ErrorBoundary>
        <MobileNav />
      </body>
    </html>
  );
}
