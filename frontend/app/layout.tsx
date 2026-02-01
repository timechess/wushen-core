import type { Metadata } from "next";
import { Geist_Mono, Noto_Sans_SC, Noto_Serif_SC } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import AppShell from "@/components/AppShell";

const notoSans = Noto_Sans_SC({
  variable: "--font-wushen-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const displayFont = Noto_Serif_SC({
  variable: "--font-wushen-display",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-wushen-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "武神核心系统",
  description: "武神核心系统的前端编辑器和管理界面",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body
        className={`${notoSans.variable} ${displayFont.variable} ${geistMono.variable} antialiased`}
      >
        <AppShell>
          <Navbar />
          {children}
        </AppShell>
      </body>
    </html>
  );
}
