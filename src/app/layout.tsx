import type { Metadata } from "next";
import { AppShell } from "@/components/layout/AppShell";
import { ThemeProvider } from "@/context/ThemeContext";
import "./globals.css";

export const metadata: Metadata = {
  title: "Biz-Analytic · Enterprise BI & Analytics Portal",
  description: "Enterprise Business Intelligence, Analytics Hub, Power BI Catalog & Governance for Biz-Analytic Department",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen text-slate-900">
        <ThemeProvider>
          <AppShell>{children}</AppShell>
        </ThemeProvider>
      </body>
    </html>
  );
}
