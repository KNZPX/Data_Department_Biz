"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Activity,
  Check,
  CheckCircle2,
  Clock,
  Code2,
  Database,
  Edit3,
  ExternalLink,
  Eye,
  FileText,
  History,
  KeyRound,
  Layers,
  Loader2,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Terminal,
  Trash2,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import { clsx } from "clsx";
import { Button, EmptyState, Panel } from "@/components/ui";

type AppUser = {
  email: string;
  name: string;
  lastLoginAt: string;
  loginCount: number;
  recentLogins: Array<{ date: string; userAgent?: string; ip?: string }>;
};

type AuditLog = {
  id: string;
  entity_table: string;
  entity_id: string;
  action: string;
  summary: string;
  changed_by: string;
  changed_at: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  is_restored?: boolean;
};

export function UserManagementPage() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"users" | "audit">("users");
  const [userSearch, setUserSearch] = useState("");
  const [logSearch, setLogSearch] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [restoreFeedback, setRestoreFeedback] = useState<{ id: string; msg: string; error?: boolean } | null>(null);
  const [expandedPayloadId, setExpandedPayloadId] = useState<string | null>(null);

  useEffect(() => {
    void fetchUsersAndLogs();
  }, []);

  async function fetchUsersAndLogs() {
    setLoading(true);
    try {
      const res = await fetch("/api/users?includeLogs=true", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
        setLogs(data.logs || []);
      }
    } catch (err) {
      console.error("Failed to load users:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleRestore(logId: string) {
    if (!confirm("Are you sure you want to restore/rollback this change?")) return;
    setRestoringId(logId);
    setRestoreFeedback(null);
    try {
      const res = await fetch("/api/powerbi/changelog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "restore", id: logId, restoredBy: "Admin" }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setRestoreFeedback({ id: logId, msg: json.message || "Restored successfully!" });
        void fetchUsersAndLogs();
        setTimeout(() => setRestoreFeedback(null), 4000);
      } else {
        setRestoreFeedback({ id: logId, msg: json.error || "Failed to restore", error: true });
      }
    } catch (err: any) {
      setRestoreFeedback({ id: logId, msg: err.message || "Network error restoring item", error: true });
    } finally {
      setRestoringId(null);
    }
  }

  const filteredUsers = useMemo(() => {
    if (!userSearch.trim()) return users;
    const q = userSearch.toLowerCase();
    return users.filter(
      (u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    );
  }, [users, userSearch]);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const act = log.action?.toLowerCase() || "";
      const matchAction =
        actionFilter === "all" ||
        (actionFilter === "login" && act === "login") ||
        (actionFilter === "create" && act === "create") ||
        (actionFilter === "update" && act === "update") ||
        (actionFilter === "delete" && act === "delete") ||
        (actionFilter === "restore" && act === "restore");

      if (!matchAction) return false;
      if (!logSearch.trim()) return true;

      const q = logSearch.toLowerCase();
      return (
        (log.summary && log.summary.toLowerCase().includes(q)) ||
        (log.entity_table && log.entity_table.toLowerCase().includes(q)) ||
        (log.entity_id && log.entity_id.toLowerCase().includes(q)) ||
        (log.changed_by && log.changed_by.toLowerCase().includes(q))
      );
    });
  }, [logs, actionFilter, logSearch]);

  const totalSessions = users.reduce((acc, u) => acc + (u.loginCount || 1), 0);
  const restorableCount = logs.filter(
    (l) => !l.is_restored && (l.action === "delete" || l.action === "update" || l.action === "create" || l.before)
  ).length;

  return (
    <div className="h-full overflow-y-auto pr-1 space-y-4 pb-12 font-sans select-none">
      {/* 1. TOP HEADER & COMPACT KPI STRIP */}
      <div className="bg-white rounded-3xl p-5 shadow-xs border border-slate-200/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-blue-50 text-blue-600 shadow-xs">
            <ShieldCheck className="h-5 w-5 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-slate-900 tracking-tight">
                User Management & Security Audit
              </h1>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-extrabold uppercase border border-emerald-200">
                Live Supabase DB
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Direct telemetry from Azure Entra ID SSO &bull; Audit Trail with Instant Rollback
            </p>
          </div>
        </div>

        {/* Compact KPI Row */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200/80 px-3.5 py-1.5 rounded-2xl">
            <Users className="h-4 w-4 text-blue-600" />
            <div className="text-left">
              <span className="text-[10px] font-bold text-slate-400 uppercase block leading-none">Users</span>
              <span className="text-xs font-bold text-slate-800 font-mono">{users.length}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200/80 px-3.5 py-1.5 rounded-2xl">
            <UserCheck className="h-4 w-4 text-emerald-600" />
            <div className="text-left">
              <span className="text-[10px] font-bold text-slate-400 uppercase block leading-none">Sessions</span>
              <span className="text-xs font-bold text-slate-800 font-mono">{totalSessions}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200/80 px-3.5 py-1.5 rounded-2xl">
            <History className="h-4 w-4 text-purple-600" />
            <div className="text-left">
              <span className="text-[10px] font-bold text-slate-400 uppercase block leading-none">Audit Logs</span>
              <span className="text-xs font-bold text-slate-800 font-mono">{logs.length}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void fetchUsersAndLogs()}
            title="Refresh Users & Audit Logs"
            className="p-2 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition"
          >
            <RefreshCw className={clsx("h-4 w-4", loading && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* Restore Toast Banner */}
      {restoreFeedback && (
        <div
          className={clsx(
            "p-3 rounded-2xl text-xs font-semibold flex items-center justify-between shadow-sm animate-in slide-in-from-top duration-200",
            restoreFeedback.error
              ? "bg-rose-50 border border-rose-200 text-rose-800"
              : "bg-emerald-50 border border-emerald-200 text-emerald-800"
          )}
        >
          <div className="flex items-center gap-2">
            {restoreFeedback.error ? (
              <ShieldAlert className="h-4 w-4 text-rose-600" />
            ) : (
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            )}
            <span>{restoreFeedback.msg}</span>
          </div>
          <button
            type="button"
            onClick={() => setRestoreFeedback(null)}
            className="text-slate-400 hover:text-slate-600"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* 2. TAB SWITCHER */}
      <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("users")}
            className={clsx(
              "flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition",
              activeTab === "users"
                ? "bg-blue-600 text-white shadow-xs"
                : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80"
            )}
          >
            <Users className="h-3.5 w-3.5" />
            <span>Active Users ({users.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("audit")}
            className={clsx(
              "flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition",
              activeTab === "audit"
                ? "bg-blue-600 text-white shadow-xs"
                : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80"
            )}
          >
            <History className="h-3.5 w-3.5" />
            <span>System Activity Logs ({logs.length})</span>
          </button>
        </div>

        {activeTab === "audit" && restorableCount > 0 && (
          <span className="hidden sm:inline-flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full font-bold">
            <RotateCcw className="h-3 w-3" />
            <span>{restorableCount} changes restorable</span>
          </span>
        )}
      </div>

      {/* 3. TAB CONTENT: USERS DIRECTORY */}
      {activeTab === "users" && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs">
            <div className="relative flex-1 min-w-[220px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Search user by name or corporate email..."
                className="w-full rounded-full border border-slate-200 bg-slate-50 pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-blue-600 outline-none transition"
              />
            </div>
            <span className="text-xs text-slate-400 font-mono">
              Showing {filteredUsers.length} of {users.length} registered accounts
            </span>
          </div>

          {loading ? (
            <div className="py-20 text-center text-slate-400 space-y-2">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600" />
              <p className="text-xs">Loading user registry from Supabase...</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <EmptyState>
              <Users className="h-10 w-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-700">No users found</p>
              <p className="text-xs text-slate-400">Users who sign into the portal will automatically appear here</p>
            </EmptyState>
          ) : (
            <div className="rounded-3xl border border-slate-200/80 bg-white overflow-hidden shadow-2xs">
              <table className="table w-full text-left text-xs">
                <thead className="bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100">
                  <tr>
                    <th className="py-3 px-4">User</th>
                    <th className="py-3 px-4">Corporate Email</th>
                    <th className="py-3 px-4">Total Logins</th>
                    <th className="py-3 px-4">Last Login Time</th>
                    <th className="py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-sans">
                  {filteredUsers.map((u) => {
                    const initials = (u.name || u.email).slice(0, 2).toUpperCase();
                    const lastLogin = new Date(u.lastLoginAt);
                    const lastLoginStr = !isNaN(lastLogin.getTime())
                      ? lastLogin.toLocaleString("en-US", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "-";

                    return (
                      <tr key={u.email} className="hover:bg-slate-50/60 transition">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-blue-600 text-white font-bold grid place-items-center text-xs shadow-xs">
                              {initials}
                            </div>
                            <div>
                              <p className="font-bold text-slate-900">{u.name}</p>
                              <p className="text-[10px] text-slate-400 font-mono">Azure Entra SSO</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono text-[11px] text-slate-600">
                          {u.email}
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-blue-50 text-blue-700 border border-blue-200">
                            {u.loginCount} {u.loginCount === 1 ? "session" : "sessions"}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                          <div className="flex items-center gap-1.5">
                            <Clock className="h-3 w-3 text-slate-400" />
                            <span>{lastLoginStr}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            Active
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 4. TAB CONTENT: MODERN HIGH-DENSITY AUDIT TRAIL */}
      {activeTab === "audit" && (
        <div className="space-y-3">
          {/* Controls Bar */}
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 flex-wrap">
              {[
                { id: "all", label: "All Activities" },
                { id: "login", label: "Logins" },
                { id: "create", label: "Creations" },
                { id: "update", label: "Updates" },
                { id: "delete", label: "Deletions" },
                { id: "restore", label: "Restores" },
              ].map((btn) => (
                <button
                  key={btn.id}
                  type="button"
                  onClick={() => setActionFilter(btn.id)}
                  className={clsx(
                    "px-3 py-1 rounded-full text-xs font-bold transition",
                    actionFilter === btn.id
                      ? "bg-blue-600 text-white shadow-xs"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  )}
                >
                  {btn.label}
                </button>
              ))}
            </div>

            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={logSearch}
                onChange={(e) => setLogSearch(e.target.value)}
                placeholder="Search audit events, author, or entity..."
                className="w-full rounded-full border border-slate-200 bg-slate-50 pl-8 pr-3 py-1 text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-blue-600 outline-none transition"
              />
            </div>
          </div>

          {loading ? (
            <div className="py-20 text-center text-slate-400 space-y-2">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600" />
              <p className="text-xs">Loading audit stream from database...</p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <EmptyState>
              <History className="h-10 w-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-700">No activity logs found</p>
              <p className="text-xs text-slate-400">All system events, user logins, and updates will be logged here</p>
            </EmptyState>
          ) : (
            <div className="rounded-3xl border border-slate-200/80 bg-white overflow-hidden shadow-2xs">
              <table className="table w-full text-left text-xs">
                <thead className="bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100">
                  <tr>
                    <th className="py-3 px-4">Action</th>
                    <th className="py-3 px-4">Event Description</th>
                    <th className="py-3 px-4">Actor</th>
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4 text-right">Rollback / Restore</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-sans">
                  {filteredLogs.map((log) => {
                    const act = log.action?.toLowerCase() || "";
                    const isLogin = act === "login";
                    const isCreate = act === "create";
                    const isUpdate = act === "update";
                    const isDelete = act === "delete";
                    const isRestore = act === "restore";

                    const date = new Date(log.changed_at);
                    const dateStr = !isNaN(date.getTime())
                      ? date.toLocaleString("en-US", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })
                      : "-";

                    const isRestorable =
                      !log.is_restored &&
                      !isLogin &&
                      !isRestore &&
                      (isDelete || isUpdate || isCreate || Boolean(log.before));

                    const isPayloadExpanded = expandedPayloadId === log.id;

                    return (
                      <tr key={log.id} className="hover:bg-slate-50/70 transition">
                        {/* Action Badge */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span
                            className={clsx(
                              "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border",
                              isLogin && "bg-blue-50 text-blue-700 border-blue-200",
                              isCreate && "bg-emerald-50 text-emerald-700 border-emerald-200",
                              isUpdate && "bg-amber-50 text-amber-700 border-amber-200",
                              isDelete && "bg-rose-50 text-rose-700 border-rose-200",
                              isRestore && "bg-purple-50 text-purple-700 border-purple-200"
                            )}
                          >
                            {isLogin && <KeyRound className="h-3 w-3" />}
                            {isCreate && <Plus className="h-3 w-3" />}
                            {isUpdate && <Edit3 className="h-3 w-3" />}
                            {isDelete && <Trash2 className="h-3 w-3" />}
                            {isRestore && <RotateCcw className="h-3 w-3" />}
                            <span>{log.action}</span>
                          </span>
                        </td>

                        {/* Summary Description & Entity */}
                        <td className="py-3 px-4 min-w-[280px]">
                          <div>
                            <p className="font-bold text-slate-900 leading-snug">
                              {log.summary}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5 text-[10px] font-mono text-slate-400">
                              <span className="font-semibold text-slate-600">
                                {log.entity_table}
                              </span>
                              <span>&bull;</span>
                              <span className="truncate max-w-xs">{log.entity_id}</span>
                              {(log.before || log.after) && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpandedPayloadId(isPayloadExpanded ? null : log.id)
                                  }
                                  className="text-blue-600 hover:underline font-bold ml-1"
                                >
                                  {isPayloadExpanded ? "Hide Details" : "View Payload"}
                                </button>
                              )}
                            </div>

                            {/* Collapsible JSON payload */}
                            {isPayloadExpanded && (
                              <div className="mt-2 p-2.5 rounded-xl bg-slate-900 text-emerald-400 font-mono text-[10px] max-h-48 overflow-y-auto">
                                {log.before && (
                                  <div className="mb-2">
                                    <span className="text-rose-400 font-bold block">BEFORE:</span>
                                    <pre className="whitespace-pre-wrap">
                                      {JSON.stringify(log.before, null, 2)}
                                    </pre>
                                  </div>
                                )}
                                {log.after && (
                                  <div>
                                    <span className="text-emerald-400 font-bold block">AFTER:</span>
                                    <pre className="whitespace-pre-wrap">
                                      {JSON.stringify(log.after, null, 2)}
                                    </pre>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Actor */}
                        <td className="py-3 px-4 whitespace-nowrap text-slate-700 font-medium">
                          {log.changed_by || "System"}
                        </td>

                        {/* Timestamp */}
                        <td className="py-3 px-4 whitespace-nowrap font-mono text-[11px] text-slate-400">
                          {dateStr}
                        </td>

                        {/* Restore Button */}
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          {log.is_restored ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500">
                              <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                              Restored
                            </span>
                          ) : isRestorable ? (
                            <button
                              type="button"
                              onClick={() => handleRestore(log.id)}
                              disabled={restoringId === log.id}
                              title="Restore previous state / undo this action"
                              className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 transition shadow-2xs disabled:opacity-50"
                            >
                              <RotateCcw
                                className={clsx(
                                  "h-3 w-3",
                                  restoringId === log.id && "animate-spin"
                                )}
                              />
                              <span>Restore</span>
                            </button>
                          ) : (
                            <span className="text-slate-300 text-xs">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
