"use client";

import { useEffect, useState } from "react";
import {
  Check,
  Copy,
  Database,
  ExternalLink,
  KeyRound,
  LogIn,
  RefreshCw,
  Server,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { Button, Panel } from "@/components/ui";
import { TokenModal } from "@/components/TokenModal";

export function SettingsPage() {
  const [tokenStatus, setTokenStatus] = useState<{
    hasToken: boolean;
    accessToken?: string | null;
    expiresAt: string | null;
    expired: boolean;
  } | null>(null);
  const [tokenModalOpen, setTokenModalOpen] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [migrationResult, setMigrationResult] = useState<string | null>(null);

  useEffect(() => {
    void fetchToken();
  }, []);

  async function fetchToken() {
    try {
      const res = await fetch("/api/powerbi/token", { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        setTokenStatus(json);
      }
    } catch {}
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* 1. Power BI Connection Settings */}
      <Panel className="p-5 sm:p-6 space-y-4">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-[#002D72]/10 text-[#002D72] border border-[#002D72]/20 shadow-2xs">
            <KeyRound className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">Microsoft Power BI Connection</h2>
            <p className="text-xs text-slate-500">
              การเชื่อมต่อบัญชี Microsoft OAuth 2.0 PKCE เพื่อเข้าถึง Power BI REST API
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700">สถานะ Token ปัจจุบัน</span>
            {tokenStatus?.hasToken && !tokenStatus.expired ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800 border border-emerald-200">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                เชื่อมต่อสำเร็จ (OAuth Active)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#AB2328]/10 px-3 py-1 text-xs font-bold text-[#AB2328] border border-[#AB2328]/20">
                <span className="h-2 w-2 rounded-full bg-[#AB2328]" />
                ยังไม่ได้เชื่อมต่อ หรือ Token หมดอายุ
              </span>
            )}
          </div>

          {tokenStatus?.expiresAt ? (
            <p className="text-xs font-mono text-slate-500">
              วันหมดอายุ: {new Date(tokenStatus.expiresAt).toLocaleString("th-TH")}
            </p>
          ) : null}

          <div className="pt-2 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="primary"
              dense
              onClick={() => setTokenModalOpen(true)}
            >
              <LogIn className="h-4 w-4" />
              <span>เข้าสู่ระบบหรือจัดการ Token</span>
            </Button>
          </div>
        </div>
      </Panel>

      {/* 2. Dedicated Database Configuration */}
      <Panel className="p-5 sm:p-6 space-y-4">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-blue-50 text-blue-700 border border-blue-200">
            <Database className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">ฐานข้อมูลแยกเฉพาะ (Dedicated Database)</h2>
            <p className="text-xs text-slate-500">
              ระบบจัดเก็บข้อมูลแยกอิสระจาก Timesheet รองรับทั้ง SQLite Local และ Supabase Cloud
            </p>
          </div>
        </div>

        <div className="space-y-3 text-xs text-slate-600">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 p-4 bg-white space-y-1.5">
              <span className="font-bold text-slate-800 flex items-center gap-1.5">
                <Server className="h-4 w-4 text-blue-600" />
                <span>โหมดปัจจุบัน: SQLite Local DB</span>
              </span>
              <p className="text-slate-500">
                เก็บข้อมูลลงในไฟล์ฐานข้อมูล <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-slate-800">powerbi.db</code> ภายในเครื่อง
              </p>
              <div className="pt-1">
                <span className="inline-block rounded-full bg-emerald-50 text-emerald-700 px-2 py-0.5 text-[10px] font-bold border border-emerald-200">
                  Ready & Autonomous (ทำงานได้ 100% โดยไม่ต้องต่อ Cloud)
                </span>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 p-4 bg-white space-y-1.5">
              <span className="font-bold text-slate-800 flex items-center gap-1.5">
                <ExternalLink className="h-4 w-4 text-purple-600" />
                <span>โหมด Supabase / PostgreSQL</span>
              </span>
              <p className="text-slate-500">
                หากต้องการใช้ Supabase แยกเฉพาะสำหรับทีมงาน สามารถกำหนดใน <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-slate-800">.env.local</code>:
              </p>
              <pre className="bg-slate-900 text-slate-100 p-2.5 rounded-xl font-mono text-[10px] overflow-x-auto">
{`DATABASE_PROVIDER=supabase
NEXT_PUBLIC_SUPABASE_URL=https://...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...`}
              </pre>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 space-y-2">
            <h4 className="font-bold text-slate-800">ไฟล์ Schema พร้อมใช้งาน:</h4>
            <ul className="list-disc list-inside space-y-1 text-slate-500 font-mono text-[11px]">
              <li><code className="text-slate-800">database/schema.sqlite.sql</code> &mdash; สคริปต์ SQLite สำหรับ Local Database</li>
              <li><code className="text-slate-800">database/schema.sql</code> &mdash; สคริปต์ PostgreSQL / Supabase สำหรับ Cloud Database พร้อม RLS Policies</li>
            </ul>
          </div>
        </div>
      </Panel>

      <TokenModal
        isOpen={tokenModalOpen}
        onClose={() => setTokenModalOpen(false)}
        onSuccess={() => fetchToken()}
      />
    </div>
  );
}
