"use client";

// App-wide toasts and confirm dialogs (instead of the browser's alert/confirm).
//   toast("Saved")                     toast.error("Couldn't save", { body })
//   if (await confirmDialog({ title: "Delete board?", danger: true })) ...
import { useSyncExternalStore } from "react";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { clsx } from "clsx";

type Kind = "success" | "error" | "info";
type ToastItem = { id: number; kind: Kind; title: string; body?: string; action?: { label: string; onClick: () => void } };
type ToastOpts = { body?: string; action?: ToastItem["action"]; duration?: number };

let toasts: ToastItem[] = [];
const toastSubs = new Set<() => void>();
const emitToasts = () => toastSubs.forEach((f) => f());
let nextId = 1;

function push(kind: Kind, title: string, opts: ToastOpts = {}) {
  const id = nextId++;
  toasts = [...toasts.slice(-3), { id, kind, title, body: opts.body, action: opts.action }];
  emitToasts();
  const ms = opts.duration ?? (kind === "error" ? 7000 : 3500);
  setTimeout(() => dismiss(id), ms);
  return id;
}
function dismiss(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emitToasts();
}

export const toast = Object.assign((title: string, opts?: ToastOpts) => push("success", title, opts), {
  error: (title: string, opts?: ToastOpts) => push("error", title, opts),
  info: (title: string, opts?: ToastOpts) => push("info", title, opts),
  dismiss,
});

const ICONS = { success: CheckCircle2, error: XCircle, info: Info };
const TONES = { success: "text-emerald-600", error: "text-rose-600", info: "text-blue-600" };

export function Toaster() {
  const list = useSyncExternalStore(
    (f) => {
      toastSubs.add(f);
      return () => toastSubs.delete(f);
    },
    () => toasts,
    () => toasts
  );
  return (
    <div aria-live="polite" className="pointer-events-none fixed bottom-4 left-1/2 z-[100] flex w-[min(92vw,420px)] -translate-x-1/2 flex-col gap-2">
      {list.map((t) => {
        const Icon = ICONS[t.kind];
        return (
          <div
            key={t.id}
            role={t.kind === "error" ? "alert" : "status"}
            className="pop-in pointer-events-auto flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 pr-2 shadow-[0_12px_32px_-8px_rgb(16_24_40/0.25)]"
          >
            <Icon className={clsx("mt-0.5 h-5 w-5 shrink-0", TONES[t.kind])} />
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-medium text-slate-900">{t.title}</p>
              {t.body && <p className="mt-0.5 text-[12.5px] leading-snug text-slate-500">{t.body}</p>}
            </div>
            {t.action && (
              <button
                type="button"
                onClick={() => {
                  t.action!.onClick();
                  dismiss(t.id);
                }}
                className="shrink-0 rounded-md px-2 py-1 text-[12.5px] font-medium text-blue-600 hover:bg-blue-50"
              >
                {t.action.label}
              </button>
            )}
            <button type="button" onClick={() => dismiss(t.id)} className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-slate-400 hover:bg-slate-100" aria-label="Dismiss">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ---- Confirm ---------------------------------------------------------------
type ConfirmOpts = { title: string; body?: string; confirmLabel?: string; cancelLabel?: string; danger?: boolean };
type ConfirmState = (ConfirmOpts & { resolve: (ok: boolean) => void }) | null;
let confirmState: ConfirmState = null;
const confirmSubs = new Set<() => void>();
const emitConfirm = () => confirmSubs.forEach((f) => f());

export function confirmDialog(opts: ConfirmOpts): Promise<boolean> {
  return new Promise((resolve) => {
    confirmState?.resolve(false);
    confirmState = { ...opts, resolve };
    emitConfirm();
  });
}
function closeConfirm(ok: boolean) {
  const s = confirmState;
  confirmState = null;
  emitConfirm();
  s?.resolve(ok);
}

export function ConfirmHost() {
  const s = useSyncExternalStore(
    (f) => {
      confirmSubs.add(f);
      return () => confirmSubs.delete(f);
    },
    () => confirmState,
    () => null
  );
  if (!s) return null;
  return (
    <div
      className="fade-enter fixed inset-0 z-[90] grid place-items-center bg-slate-900/35 p-4 backdrop-blur-[2px]"
      onMouseDown={(e) => e.target === e.currentTarget && closeConfirm(false)}
      onKeyDown={(e) => {
        if (e.key === "Escape") closeConfirm(false);
      }}
    >
      <div role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" className="pop-in w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-2xl">
        <div className="flex gap-3">
          <span className={clsx("grid h-10 w-10 shrink-0 place-items-center rounded-full", s.danger ? "bg-rose-50 text-rose-600" : "bg-blue-50 text-blue-600")}>
            {s.danger ? <AlertTriangle className="h-5 w-5" /> : <Info className="h-5 w-5" />}
          </span>
          <div className="min-w-0">
            <h3 id="confirm-title" className="text-[15px] font-semibold text-slate-900">
              {s.title}
            </h3>
            {s.body && <p className="mt-1 whitespace-pre-line text-[13.5px] leading-relaxed text-slate-600">{s.body}</p>}
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={() => closeConfirm(false)} className="h-9 rounded-lg border border-slate-200 px-4 text-[13.5px] font-medium text-slate-700 hover:bg-slate-50">
            {s.cancelLabel || "Cancel"}
          </button>
          <button
            type="button"
            autoFocus
            onClick={() => closeConfirm(true)}
            className={clsx(
              "h-9 rounded-lg px-4 text-[13.5px] font-medium text-white transition active:scale-[0.98]",
              s.danger ? "bg-rose-600 hover:bg-rose-700" : "bg-blue-600 hover:bg-blue-700"
            )}
          >
            {s.confirmLabel || "OK"}
          </button>
        </div>
      </div>
    </div>
  );
}
