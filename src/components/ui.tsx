"use client";

import { clsx } from "clsx";
import { AlertCircle, Search, X, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

export function Button({
  className,
  variant = "primary",
  dense = false,
  size,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost" | "gold";
  dense?: boolean;
  size?: "icon" | "iconWide";
}) {
  return (
    <button
      className={clsx(
        "btn rounded-lg font-medium shadow-none transition duration-150 active:scale-[0.98]",
        dense ? "btn-sm h-8 min-h-8 text-xs px-3" : "h-9 min-h-9 text-[13.5px] px-4",
        size === "iconWide" && "h-9 w-9 p-0 sm:w-auto sm:px-3.5",
        size === "icon" && "h-9 w-9 p-0",
        variant === "primary" && "bg-blue-600 hover:bg-blue-700 text-white border-blue-600 shadow-[0_1px_2px_rgb(16_24_40/0.08)]",
        variant === "secondary" && "btn-outline border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300 hover:text-slate-900",
        variant === "danger" && "bg-rose-600 hover:bg-rose-700 text-white border-rose-600",
        variant === "gold" && "bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-100",
        variant === "ghost" && "btn-ghost border-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900",
        className,
      )}
      {...props}
    />
  );
}

export function IconButton({
  icon: Icon,
  tone = "default",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { icon: LucideIcon; tone?: "default" | "danger" | "edit" | "gold" }) {
  return (
    <button
      type="button"
      className={clsx(
        "btn btn-sm btn-square h-8 w-8 min-h-8 shrink-0 rounded-lg shadow-none transition duration-150 active:scale-95",
        tone === "danger" && "btn-soft text-rose-600 bg-rose-50 border border-rose-100 hover:bg-rose-100",
        tone === "edit" && "btn-soft text-blue-600 bg-blue-50 border border-blue-100 hover:bg-blue-100",
        tone === "gold" && "btn-soft text-blue-600 bg-blue-50 border border-blue-100 hover:bg-blue-100",
        tone === "default" && "btn-ghost border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-900",
        className,
      )}
      {...props}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}

export function ViewToggle<T extends string>({
  value,
  onChange,
  options,
  compact = false,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string; icon?: LucideIcon; count?: number | string }[];
  compact?: boolean;
}) {
  return (
    <div className="inline-flex items-center gap-0.5 rounded-lg bg-slate-100 p-0.5">
      {options.map((option) => {
        const Icon = option.icon;
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={clsx(
              "btn btn-sm h-8 min-h-8 rounded-md px-3 text-xs font-medium border-none shadow-none transition-all duration-200",
              active
                ? "bg-white text-slate-900 shadow-[0_1px_2px_rgb(16_24_40/0.1)]"
                : "btn-ghost bg-transparent text-slate-500 hover:bg-transparent hover:text-slate-900",
            )}
          >
            {Icon ? <Icon className="h-3.5 w-3.5 mr-1" /> : null}
            <span className={compact && Icon ? "hidden sm:inline" : undefined}>{option.label}</span>
            {option.count !== undefined ? (
              <span
                className={clsx(
                  "badge badge-xs ml-1 border-none font-mono font-medium",
                  active ? "bg-blue-50 text-blue-700" : "bg-slate-200/70 text-slate-500",
                )}
              >
                {option.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export function Field({
  label,
  children,
  className,
  dense = false,
  hint,
  error,
  required,
}: {
  label: string;
  children: ReactNode;
  className?: string;
  dense?: boolean;
  hint?: ReactNode;
  error?: string | null;
  required?: boolean;
}) {
  return (
    <div className={clsx("form-control w-full min-w-0 font-medium text-slate-800", dense ? "gap-1 text-xs" : "gap-1.5 text-sm", className)}>
      <label className="label py-0 justify-start gap-1 font-semibold text-slate-800">
        <span className="label-text font-semibold text-slate-800">{label}</span>
        {required ? <span className="text-rose-500 font-semibold">*</span> : null}
      </label>
      {children}
      {hint && !error ? (
        <span className="text-[11px] font-normal text-slate-500 leading-tight">
          {hint}
        </span>
      ) : null}
      {error ? (
        <span className="text-[11px] font-medium text-rose-600 flex items-center gap-1">
          <AlertCircle className="h-3 w-3 shrink-0" />
          {error}
        </span>
      ) : null}
    </div>
  );
}

export function Input({
  className,
  dense = false,
  icon: Icon,
  rightElement,
  clearable = false,
  onClear,
  value,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  dense?: boolean;
  icon?: LucideIcon;
  rightElement?: ReactNode;
  clearable?: boolean;
  onClear?: () => void;
}) {
  const hasValue = value !== undefined && value !== null && String(value).length > 0;

  if (Icon || rightElement || clearable) {
    return (
      <label
        className={clsx(
          "input input-bordered flex items-center gap-2 rounded-lg bg-white border-slate-200 text-slate-900 shadow-none transition focus-within:border-blue-400 focus-within:outline-none focus-within:ring-4 focus-within:ring-blue-100",
          dense ? "input-sm h-8 px-3 text-xs" : "h-9 px-3 text-sm",
          className,
        )}
      >
        {Icon ? <Icon className={clsx("shrink-0 text-slate-400", dense ? "h-3.5 w-3.5" : "h-4 w-4")} /> : null}
        <input
          {...props}
          value={value}
          className="grow bg-transparent text-slate-900 placeholder:text-slate-400 text-xs sm:text-sm outline-none"
        />
        {clearable && hasValue && onClear ? (
          <button
            type="button"
            onClick={onClear}
            className="btn btn-ghost btn-circle btn-xs text-slate-400 hover:text-slate-700"
            title="Clear"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
        {rightElement ? <div className="shrink-0">{rightElement}</div> : null}
      </label>
    );
  }

  return (
    <input
      {...props}
      value={value}
      className={clsx(
        "input input-bordered w-full rounded-lg bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 shadow-none transition focus:border-blue-400 focus:outline-none focus:ring-4 focus:ring-blue-100",
        dense ? "input-sm h-8 px-3 text-xs" : "h-9 px-3 text-sm",
        className,
      )}
    />
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder = "Search...",
  dense = false,
  className,
}: {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  dense?: boolean;
  className?: string;
}) {
  return (
    <Input
      icon={Search}
      clearable
      onClear={() => onChange("")}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      dense={dense}
      className={className}
    />
  );
}

export function Select({
  className,
  dense = false,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { dense?: boolean }) {
  return (
    <select
      {...props}
      className={clsx(
        "select select-bordered w-full rounded-lg bg-white border-slate-200 text-slate-900 shadow-none transition focus:border-blue-400 focus:outline-none focus:ring-4 focus:ring-blue-100",
        dense ? "select-sm h-8 px-2.5 text-xs" : "h-9 px-3 text-sm",
        className,
      )}
    />
  );
}

export function Textarea({ dense = false, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { dense?: boolean }) {
  return (
    <textarea
      {...props}
      className={clsx(
        "textarea textarea-bordered w-full rounded-lg bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 shadow-none transition focus:border-blue-400 focus:outline-none focus:ring-4 focus:ring-blue-100",
        dense ? "min-h-12 px-3 py-2 text-xs" : "min-h-24 px-3.5 py-2.5 text-sm",
        props.className,
      )}
    />
  );
}

export function Panel({ children, className, dense = false }: { children: ReactNode; className?: string; dense?: boolean }) {
  return (
    <div className={clsx("card bg-white border border-slate-200/80 shadow-[0_1px_2px_rgb(16_24_40/0.04)] rounded-xl", dense ? "p-4 sm:p-5" : "p-5 sm:p-6", className)}>
      {children}
    </div>
  );
}

const subscribeNoop = () => () => {};

export function Modal({ className, children }: { className?: string; children: ReactNode }) {
  const mounted = useSyncExternalStore(subscribeNoop, () => true, () => false);
  if (!mounted) return null;
  return createPortal(
    <div className={clsx("modal modal-open fade-enter fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-900/35 p-2.5 backdrop-blur-[2px] transition-all sm:p-4", className)}>
      <div className="contents [&>*]:[animation:pop-in_var(--dur-3)_var(--ease-out-soft)_backwards]">{children}</div>
    </div>,
    document.body
  );
}

export function StatCard({
  label,
  value,
  tone = "default",
  icon: Icon,
  className,
}: {
  label: string;
  value: ReactNode;
  tone?: "default" | "gold" | "blue" | "emerald";
  icon?: LucideIcon;
  className?: string;
}) {
  const toneBg: Record<string, string> = {
    default: "bg-blue-50 text-blue-600",
    gold: "bg-blue-50 text-blue-600",
    blue: "bg-blue-50 text-blue-600",
    emerald: "bg-emerald-50 text-emerald-700",
  };

  return (
    <div
      className={clsx(
        "card lift bg-white border border-slate-200/80 p-4 sm:p-5 shadow-[0_1px_2px_rgb(16_24_40/0.04)] rounded-xl",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="text-xs sm:text-sm font-medium text-slate-500">{label}</div>
        {Icon ? (
          <div className={clsx("grid h-9 w-9 shrink-0 place-items-center rounded-lg", toneBg[tone])}>
            <Icon className="h-4.5 w-4.5" />
          </div>
        ) : null}
      </div>
      <div className="mt-1 text-xl font-semibold tabular-nums tracking-tight text-slate-900 sm:text-2xl">
        {typeof value === "number" ? <CountUp value={value} /> : value}
      </div>
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="card border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500 rounded-xl fade-enter">
      {children}
    </div>
  );
}

/** Animates a number from its previous value (0 on first render) to `value`. */
export function CountUp({ value, duration = 700, format = (n: number) => Math.round(n).toLocaleString() }: { value: number; duration?: number; format?: (n: number) => string }) {
  const [shown, setShown] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    const motion = document.documentElement.dataset.motion;
    const start = from.current;
    if (motion === "off" || start === value) {
      from.current = value;
      const id = requestAnimationFrame(() => setShown(value));
      return () => cancelAnimationFrame(id);
    }
    const ms = motion === "reduced" ? Math.min(200, duration) : duration;
    const t0 = performance.now();
    let id = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / ms);
      const eased = 1 - Math.pow(1 - k, 3);
      const v = start + (value - start) * eased;
      from.current = v;
      setShown(v);
      if (k < 1) id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [value, duration]);
  return <>{format(shown)}</>;
}
