import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "土木技師鄰房現況鑑定 PWA",
  description: "附件七與附件八現況調查、照片標點與 PDF 匯出工具",
  manifest: "/manifest.webmanifest",
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
  themeColor: "#9f1d1d",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}
