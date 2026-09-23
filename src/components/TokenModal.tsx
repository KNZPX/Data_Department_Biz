"use client";

import { useEffect, useState } from "react";
import { Check, Copy, ExternalLink, KeyRound, Loader2, LogIn, X } from "lucide-react";
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

  useEffect(() => {
    if (!isOpen) return;
    void fetchTokenStatus();
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
        throw new Error(json?.error || `Save failed (${res.status})`);
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
      <Panel className="my-auto w-full max-w-xl rounded-3xl bg-white p-5 shadow-2xl border border-slate-200/90 sm:p-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-amber-50 text-amber-700 border border-amber-200/80 shadow-xs">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 sm:text-lg">Power BI Connection</h2>
              <p className="text-xs text-slate-500">Sign in with Microsoft to access reports & dashboards</p>
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
          <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
            <span className="font-bold">Sign-in error: </span>
            {authError}
          </div>
        ) : null}

        <div className="mt-4 space-y-4 text-xs text-slate-600">
          <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-800">OAuth Connection</span>
              {tokenStatus?.hasToken && !tokenStatus.expired ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Active
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-700 border border-amber-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                  Sign-in required
                </span>
              )}
            </div>

            {tokenStatus?.expiresAt ? (
              <p className="mt-2 text-[11px] text-slate-500 font-mono">
                Expires: {new Date(tokenStatus.expiresAt).toLocaleString("th-TH")}
              </p>
            ) : null}

            <div className="mt-4 flex flex-wrap gap-2">
              <a
                href="/api/powerbi/auth/start"
                className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-slate-800 active:scale-[0.98] transition"
              >
                <LogIn className="h-4 w-4 text-amber-400" />
                <span>Sign in with Microsoft</span>
              </a>

              {tokenStatus?.accessToken ? (
                <Button type="button" variant="secondary" dense onClick={handleCopyToken}>
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{copied ? "Copied!" : "Copy Token"}</span>
                </Button>
              ) : null}
            </div>
          </div>

          <div>
            <button
              type="button"
              onClick={() => setPasteOpen((v) => !v)}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800 underline decoration-dotted transition"
            >
              {pasteOpen ? "Hide manual token paste" : "Manual token paste fallback"}
            </button>

            {pasteOpen ? (
              <div className="mt-3 space-y-3 rounded-2xl border border-slate-200 p-4 bg-slate-50/40">
                <p className="text-[11px] text-slate-500">
                  If Microsoft sign-in cannot be reached, you can paste a Bearer Access Token directly:
                </p>
                <Textarea
                  rows={3}
                  placeholder="Paste Bearer eyJhbGciOi..."
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  className="font-mono text-xs"
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
          </div>
        </div>

        <div className="mt-5 flex justify-end border-t border-slate-100 pt-3">
          <Button type="button" variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      </Panel>
    </Modal>
  );
}
