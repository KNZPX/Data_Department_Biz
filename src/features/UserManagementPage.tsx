"use client";

import { useEffect, useState, useMemo } from "react";
import { Clock, History, Loader2, RefreshCw, Search, Shield, ShieldCheck, UserCheck, Users } from "lucide-react";
import { clsx } from "clsx";
import { Button, EmptyState, Panel, StatCard } from "@/components/ui";

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
};

export function UserManagementPage() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"users" | "audit">("users");
  const [userSearch, setUserSearch] = useState("");
  const [logSearch, setLogSearch] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");

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
      if (actionFilter === "login" && act !== "login") return false;
      if (actionFilter === "create" && act !== "create") return false;
      if (actionFilter === "update" && act !== "update") return false;
      if (actionFilter === "delete" && act !== "delete") return false;

      if (!logSearch.trim()) return true;
      const q = logSearch.toLowerCase();
      return (
        log.summary?.toLowerCase().includes(q) ||
        log.changed_by?.toLowerCase().includes(q) ||
        log.entity_id?.toLowerCase().includes(q)
      );
    });
  }, [logs, actionFilter, logSearch]);

  const totalLogins = useMemo(() => {
    return users.reduce((acc, u) => acc + (u.loginCount || 1), 0);
  }, [users]);

  return (
    <div className="h-full overflow-y-auto pr-1 space-y-6 max-w-7xl mx-auto pb-16">
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-slate-200/80 shadow-2xs">
        <div className="flex items-center gap-3.5">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-50 text-blue-600 border border-blue-200 shadow-xs">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
              User Management & System Audit Logs
            </h1>
            <p className="text-xs text-slate-500">
              Track portal user logins, access sessions, and tamper-evident change activities
            </p>
          </div>
        </div>

        <Button type="button" variant="secondary" dense onClick={fetchUsersAndLogs} disabled={loading}>
          <RefreshCw className={clsx("h-3.5 w-3.5", loading && "animate-spin text-blue-600")} />
          <span>Refresh Data</span>
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
        <StatCard label="Registered Users" value={users.length} icon={Users} tone="blue" />
        <StatCard label="Total Login Sessions" value={totalLogins} icon={UserCheck} tone="emerald" />
        <StatCard label="Audit Log Entries" value={logs.length} icon={History} tone="gold" />
        <StatCard label="Active Database" value="Supabase Cloud" icon={Shield} tone="default" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("users")}
            className={clsx(
              "flex items-center gap-2 rounded-full px-5 py-2 text-xs font-bold transition shadow-xs",
              activeTab === "users"
                ? "bg-blue-600 text-white"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            )}
          >
            <Users className="h-4 w-4" />
            <span>Active Users ({users.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("audit")}
            className={clsx(
              "flex items-center gap-2 rounded-full px-5 py-2 text-xs font-bold transition shadow-xs",
              activeTab === "audit"
                ? "bg-blue-600 text-white"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            )}
          >
            <History className="h-4 w-4" />
            <span>System Activity Logs ({logs.length})</span>
          </button>
        </div>
      </div>

      {activeTab === "users" && (
        <div className="space-y-4">
          <Panel className="p-4 bg-white flex flex-wrap items-center justify-between gap-3 shadow-2xs">
            <div className="relative flex-1 min-w-[240px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Search user name or corporate email..."
                className="w-full rounded-full border border-slate-200 bg-slate-50 pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-blue-600 outline-none transition"
              />
            </div>
            <span className="text-xs font-semibold text-slate-400">
              Showing {filteredUsers.length} of {users.length} users
            </span>
          </Panel>

          {loading ? (
            <div className="py-20 text-center text-slate-400 space-y-2">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600" />
              <p className="text-xs">Loading user sessions...</p>
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
                              <p className="text-[10px] text-slate-400 font-mono">SSO Authenticated User</p>
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

      {activeTab === "audit" && (
        <div className="space-y-4">
          <Panel className="p-4 bg-white flex flex-wrap items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-1.5">
              {[
                { id: "all", label: "All Activities" },
                { id: "login", label: "Logins" },
                { id: "create", label: "Creations" },
                { id: "update", label: "Updates" },
                { id: "delete", label: "Deletions" },
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
                placeholder="Search audit events or author..."
                className="w-full rounded-full border border-slate-200 bg-slate-50 pl-8 pr-3 py-1 text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-blue-600 outline-none transition"
              />
            </div>
          </Panel>

          {loading ? (
            <div className="py-20 text-center text-slate-400 space-y-2">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600" />
              <p className="text-xs">Loading activity stream...</p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <EmptyState>
              <History className="h-10 w-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-700">No activity logs found</p>
              <p className="text-xs text-slate-400">All system events, user logins, and updates will be logged here</p>
            </EmptyState>
          ) : (
            <div className="space-y-2.5">
              {filteredLogs.map((log) => {
                const act = log.action?.toLowerCase() || "";
                const isLogin = act === "login";
                const isCreate = act === "create";
                const isUpdate = act === "update";
                const isDelete = act === "delete";
                const date = new Date(log.changed_at);
                const dateStr = !isNaN(date.getTime())
                  ? date.toLocaleString("en-US", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })
                  : "-";

                return (
                  <Panel key={log.id} className="p-3.5 sm:p-4 bg-white hover:border-blue-300 transition duration-150 shadow-2xs flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <span className={clsx(
                        "px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase shrink-0 border",
                        isLogin && "bg-blue-50 text-blue-700 border-blue-200",
                        isCreate && "bg-emerald-50 text-emerald-700 border-emerald-200",
                        isUpdate && "bg-amber-50 text-amber-700 border-amber-200",
                        isDelete && "bg-rose-50 text-rose-700 border-rose-200",
                        !isLogin && !isCreate && !isUpdate && !isDelete && "bg-slate-100 text-slate-700 border-slate-200"
                      )}>
                        {log.action}
                      </span>
                      <div className="space-y-0.5 min-w-0">
                        <p className="text-xs font-bold text-slate-900 leading-snug break-words">
                          {log.summary}
                        </p>
                        <div className="flex flex-wrap items-center gap-x-3 text-[10px] text-slate-400 font-mono">
                          <span>Target: {log.entity_table} ({log.entity_id})</span>
                          {log.changed_by && <span>By: {log.changed_by}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1.5 shrink-0">
                      <span>{dateStr}</span>
                    </div>
                  </Panel>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
