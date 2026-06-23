import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://ca.orderpoint.tw"),
  title: "現況鑑定報告系統",
  description: "土木技師專用的現況鑑定報告工作台，支援案件管理、現場照片紀錄、平面圖標註、測量資料與 PDF 報告匯出。",
  manifest: "/manifest.webmanifest",
  openGraph: {
    title: "現況鑑定報告系統",
    description: "土木技師專用的現況鑑定報告工作台，支援案件管理、現場照片紀錄、平面圖標註、測量資料與 PDF 報告匯出。",
    url: "https://ca.orderpoint.tw",
    siteName: "現況鑑定報告系統",
    locale: "zh_TW",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "現況鑑定報告系統",
    description: "土木技師專用的現況鑑定報告工作台，支援案件管理、現場照片紀錄、平面圖標註、測量資料與 PDF 報告匯出。",
  },
  appleWebApp: {
    capable: true,
    title: "現況鑑定",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#1c1917",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}
