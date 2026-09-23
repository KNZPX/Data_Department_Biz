import type { Metadata } from "next";
import { AppShell } from "@/components/layout/AppShell";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bangkok Hospital · Data Department & Power BI Portal",
  description: "พัฒนาไม่หยุด สู่ขีดสุดการดูแล — ระบบแคตตาล็อกรายงาน Power BI, ประวัติ Version History และการบริหารจัดการสิทธิ์ License 32 คอลัมน์ เครือ BDMS",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th">
      <body className="antialiased min-h-screen bg-slate-50 text-slate-900">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
