import type { Metadata } from "next";
import { AppShell } from "@/components/layout/AppShell";
import { ThemeProvider } from "@/context/ThemeContext";
import "./globals.css";

export const metadata: Metadata = {
  title: "Biz-Analytic · Enterprise BI & Analytics Portal",
  description: "Enterprise Business Intelligence, Analytics Hub, Power BI Catalog & Governance for Biz-Analytic Department",
};

// Runs before the first paint: checks that CSS zoom scales element boxes and
// viewport units the standard way (Chromium 128+, Firefox 126+). If not, the
// page-size zoom is switched off so nothing overflows or lands in the wrong place.
const ZOOM_CHECK = `(function(){var d=document.documentElement;try{var t=document.createElement("div");t.style.cssText="position:fixed;left:0;top:0;width:100px;height:40vh;zoom:.5;visibility:hidden;pointer-events:none";d.appendChild(t);var r=t.getBoundingClientRect();d.removeChild(t);if(Math.abs(r.width-50)>2||Math.abs(r.height-0.2*innerHeight)>3)d.setAttribute("data-nozoom","")}catch(e){d.setAttribute("data-nozoom","")}})();`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: ZOOM_CHECK }} />
      </head>
      <body className="antialiased text-slate-900">
        <ThemeProvider>
          <AppShell>{children}</AppShell>
        </ThemeProvider>
      </body>
    </html>
  );
}
