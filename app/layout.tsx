import type { Metadata } from "next";
import "./globals.css";
import ErrorBoundary from "@/components/shell/ErrorBoundary";
import Toast from "@/components/shell/Toast";
import NetworkStatus from "@/components/shell/NetworkStatus";
import MobileNav from "@/components/shell/MobileNav";
import ThemeProvider from "@/components/shell/ThemeProvider";

export const metadata: Metadata = {
  title: "AI PPT 生成平台",
  description: "基于 Claude API 的智能 PPT 生成工具",
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          <ErrorBoundary>
            <NetworkStatus />
            <Toast />
            {children}
          </ErrorBoundary>
          <MobileNav />
        </ThemeProvider>
      </body>
    </html>
  );
}
