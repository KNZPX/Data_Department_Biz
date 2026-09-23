"use client";

import { useEffect, useState, useMemo } from "react";
import { Check, Clock, Copy, ExternalLink, KeyRound, Loader2, LogIn, ShieldAlert, ShieldCheck, X } from "lucide-react";
import { Button, Modal, Panel, Textarea } from "@/components/ui";

type TokenStatus = {
  hasToken: boolean;
  accessToken?: string | null;
  expiresAt: string | null;
  expired: boolean;
};

export function TokenModal({
  isOpen,
  onClose,
  onSuccess,
  authError,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  authError?: string | null;
}) {
  const [tokenStatus, setTokenStatus] = useState<TokenStatus | null>(null);
  const [tokenInput, setTokenInput] = useState("");
  const [savingToken, setSavingToken] = useState(false);
  const [tokenSaveError, setTokenSaveError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!isOpen) return;
    void fetchTokenStatus();
  }, [isOpen]);

  // Live 1-second interval for countdown timer
  useEffect(() => {
    if (!isOpen) return;
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, [isOpen]);

  async function fetchTokenStatus() {
    try {
      const res = await fetch("/api/powerbi/token", { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (res.ok && json) setTokenStatus(json as TokenStatus);
    } catch {
      // Ignored
    }
  }

  // Calculate remaining countdown
  const countdown = useMemo(() => {
    if (!tokenStatus?.expiresAt) return null;
    const expiresMs = new Date(tokenStatus.expiresAt).getTime();
    const diff = expiresMs - now;

    if (diff <= 0) {
      return { expired: true, text: "Expired", minutes: 0, seconds: 0, percent: 0 };
    }

    const totalSec = Math.floor(diff / 1000);
    const hours = Math.floor(totalSec / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    const seconds = totalSec % 60;

    const pad = (n: number) => n.toString().padStart(2, "0");
    const formatted = hours > 0 ? (hours + "h " + pad(minutes) + "m " + pad(seconds) + "s") : (pad(minutes) + "m " + pad(seconds) + "s");

    // Max token life is typically 3600s (1 hour)
    const percent = Math.min(100, Math.max(0, (diff / (3600 * 1000)) * 100));

    return {
      expired: false,
      text: formatted,
      hours,
      minutes,
      seconds,
      percent,
    };
  }, [tokenStatus?.expiresAt, now]);

  async function handleCopyToken() {
    if (!tokenStatus?.accessToken) return;
    try {
      await navigator.clipboard.writeText(tokenStatus.accessToken);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const el = document.createElement("textarea");
      el.value = tokenStatus.accessToken;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  async function handleSaveToken() {
    setSavingToken(true);
    setTokenSaveError(null);
    try {
      const res = await fetch("/api/powerbi/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: tokenInput }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(json?.error || ("Save failed (" + res.status + ")"));
      }
      setTokenInput("");
      onClose();
      onSuccess?.();
    } catch (error) {
      setTokenSaveError(error instanceof Error ? error.message : "Failed to save token");
    } finally {
      setSavingToken(false);
    }
  }

  if (!isOpen) return null;

  return (
    <Modal className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-900/50 p-3 backdrop-blur-xs sm:p-6 animate-in fade-in duration-150">
      <Panel className="my-auto w-full max-w-2xl rounded-3xl bg-white p-5 shadow-2xl border border-slate-200/90 sm:p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-blue-50 text-blue-600 border border-blue-200/80 shadow-xs">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 sm:text-lg">OAuth Token Inspector</h2>
              <p className="text-xs text-slate-500">Live Power BI access token inspection & session countdown</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {authError ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
            <span className="font-bold">Sign-in error: </span>
            {authError}
          </div>
        ) : null}

        {/* Live Token Status & Countdown Bar */}
        <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-800">Connection Status:</span>
              {tokenStatus?.hasToken && !tokenStatus.expired && countdown && !countdown.expired ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold text-blue-700 border border-blue-200">
                  <span className="h-2 w-2 rounded-full bg-blue-600 animate-pulse" />
                  Active Token
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-0.5 text-[11px] font-bold text-rose-700 border border-rose-200">
                  <span className="h-2 w-2 rounded-full bg-rose-500" />
                  Expired / Required
                </span>
              )}
            </div>

            {/* Countdown Display */}
            {countdown ? (
              <div className="flex items-center gap-2 bg-white px-3 py-1 rounded-full border border-slate-200 shadow-2xs">
                <Clock className="h-3.5 w-3.5 text-blue-600 animate-spin" />
                <span className="text-[11px] font-mono font-bold text-slate-700">
                  {countdown.expired ? (
                    <span className="text-rose-600 font-extrabold">Session Expired</span>
                  ) : (
                    <span>Expires in: <strong className="text-blue-600">{countdown.text}</strong></span>
                  )}
                </span>
              </div>
            ) : null}
          </div>

          {/* Expiry Timestamp & Progress Bar */}
          {tokenStatus?.expiresAt && countdown && !countdown.expired ? (
            <div className="space-y-1.5 pt-1">
              <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                <span>Valid until: {new Date(tokenStatus.expiresAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
                <span>{Math.round(countdown.percent)}% session remaining</span>
              </div>
              <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 rounded-full transition-all duration-1000"
                  style={{ width: countdown.percent + "%" }}
                />
              </div>
            </div>
          ) : null}
        </div>

        {/* DIRECT TOKEN DISPLAY */}
        {tokenStatus?.accessToken ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                <span>Live Bearer Token</span>
              </label>
              <Button type="button" variant="secondary" dense onClick={handleCopyToken}>
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5 text-blue-600" />}
                <span>{copied ? "Copied!" : "Copy Token"}</span>
              </Button>
            </div>

            <div className="relative">
              <textarea
                readOnly
                rows={4}
                value={tokenStatus.accessToken}
                className="w-full rounded-2xl bg-slate-900 text-emerald-400 font-mono text-[11px] p-3 border border-slate-800 leading-relaxed break-all select-all focus:outline-none"
              />
            </div>
          </div>
        ) : null}

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-2">
            <a
              href="/api/powerbi/auth/start"
              className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700 active:scale-[0.98] transition"
            >
              <LogIn className="h-3.5 w-3.5 text-white" />
              <span>Refresh Token via Microsoft</span>
            </a>

            <button
              type="button"
              onClick={() => setPasteOpen((v) => !v)}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800 underline decoration-dotted transition px-2"
            >
              {pasteOpen ? "Hide manual input" : "Manual paste"}
            </button>
          </div>

          <Button type="button" variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>

        {/* Manual Paste Section */}
        {pasteOpen ? (
          <div className="mt-3 space-y-3 rounded-2xl border border-slate-200 p-4 bg-slate-50/50 animate-in fade-in">
            <p className="text-[11px] text-slate-500">
              Paste an active Power BI Bearer Access Token directly to update credentials:
            </p>
            <Textarea
              rows={3}
              placeholder="Paste Bearer eyJhbGciOi..."
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              className="font-mono text-xs bg-white"
            />
            {tokenSaveError ? (
              <p className="text-[11px] text-rose-600 font-medium">{tokenSaveError}</p>
            ) : null}
            <div className="flex justify-end">
              <Button
                type="button"
                variant="primary"
                dense
                disabled={savingToken || !tokenInput.trim()}
                onClick={handleSaveToken}
              >
                {savingToken ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                <span>Save Manual Token</span>
              </Button>
            </div>
          </div>
        ) : null}
      </Panel>
    </Modal>
  );
}
