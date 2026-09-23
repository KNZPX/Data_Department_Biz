"use client";

import { clsx } from "clsx";
import { AlertCircle, Search, X, type LucideIcon } from "lucide-react";
import { useSyncExternalStore } from "react";
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
        "btn rounded-full font-semibold transition duration-150 active:scale-[0.98]",
        dense ? "btn-sm text-xs px-3.5" : "text-sm px-5",
        size === "iconWide" && "h-9 w-9 p-0 sm:h-10 sm:w-auto sm:px-4",
        size === "icon" && "h-9 w-9 p-0 sm:h-10 sm:w-10",
        variant === "primary" && "btn-neutral text-white shadow-xs hover:bg-slate-800",
        variant === "secondary" && "btn-outline border-slate-200 bg-white text-slate-800 hover:bg-slate-100 hover:border-slate-300",
        variant === "danger" && "btn-error text-white shadow-xs hover:opacity-90",
        variant === "gold" && "btn-warning text-slate-950 font-bold shadow-xs",
        variant === "ghost" && "btn-ghost text-slate-600 hover:bg-slate-100 hover:text-slate-900",
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
        "btn btn-circle btn-sm shrink-0 shadow-2xs transition duration-150 active:scale-95",
        tone === "danger" && "btn-error btn-soft text-rose-600 border border-rose-200",
        tone === "edit" && "btn-info btn-soft text-blue-600 border border-blue-200",
        tone === "gold" && "btn-warning btn-soft text-amber-700 border border-amber-300",
        tone === "default" && "btn-ghost border border-slate-200 bg-white text-slate-500 hover:text-slate-900",
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
    <div className="inline-flex items-center gap-1 rounded-full p-1 bg-slate-100 border border-slate-200/60">
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
              "btn btn-sm rounded-full px-3.5 text-xs font-semibold border-none transition duration-150",
              active
                ? "btn-neutral text-white shadow-xs"
                : "btn-ghost text-slate-600 hover:bg-white/80 hover:text-slate-900",
            )}
          >
            {Icon ? <Icon className="h-3.5 w-3.5 mr-1" /> : null}
            <span className={compact && Icon ? "hidden sm:inline" : undefined}>{option.label}</span>
            {option.count !== undefined ? (
              <span
                className={clsx(
                  "badge badge-xs ml-1 font-mono font-bold",
                  active ? "badge-primary text-white" : "badge-ghost text-slate-600",
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
        {required ? <span className="text-rose-500 font-bold">*</span> : null}
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
          "input input-bordered flex items-center gap-2 rounded-full bg-white border-slate-200 text-slate-900 shadow-2xs transition focus-within:border-slate-800 focus-within:ring-2 focus-within:ring-slate-800/10",
          dense ? "input-sm h-8 px-3 text-xs" : "h-10 px-4 text-sm",
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
        "input input-bordered w-full rounded-full bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 shadow-2xs transition focus:border-slate-800 focus:ring-2 focus:ring-slate-800/10",
        dense ? "input-sm h-8 px-3 text-xs" : "h-10 px-4 text-sm",
        className,
      )}
    />
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder = "ค้นหา...",
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
        "select select-bordered w-full rounded-full bg-white border-slate-200 text-slate-900 shadow-2xs transition focus:border-slate-800",
        dense ? "select-sm h-8 px-2.5 text-xs" : "h-10 px-3.5 text-sm",
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
        "textarea textarea-bordered w-full rounded-2xl bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 shadow-2xs transition focus:border-slate-800",
        dense ? "min-h-12 px-3 py-2 text-xs" : "min-h-24 px-3.5 py-2.5 text-sm",
        props.className,
      )}
    />
  );
}

export function Panel({ children, className, dense = false }: { children: ReactNode; className?: string; dense?: boolean }) {
  return (
    <div className={clsx("card bg-white border border-slate-200/80 shadow-xs rounded-3xl", dense ? "p-4 sm:p-5" : "p-5 sm:p-6", className)}>
      {children}
    </div>
  );
}

const subscribeNoop = () => () => {};

export function Modal({ className, children }: { className?: string; children: ReactNode }) {
  const mounted = useSyncExternalStore(subscribeNoop, () => true, () => false);
  if (!mounted) return null;
  return createPortal(
    <div className={clsx("modal modal-open fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-900/60 p-2.5 backdrop-blur-xs transition-all sm:p-4", className)}>
      {children}
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
    default: "bg-slate-100 text-slate-800",
    gold: "bg-amber-100 text-amber-800",
    blue: "bg-blue-100 text-blue-800",
    emerald: "bg-emerald-100 text-emerald-800",
  };

  return (
    <div
      className={clsx(
        "card bg-white border border-slate-200/80 p-4 sm:p-5 shadow-2xs rounded-3xl transition duration-200 hover:border-slate-300 hover:shadow-xs",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="text-xs sm:text-sm font-medium text-slate-500">{label}</div>
        {Icon ? (
          <div className={clsx("grid h-9 w-9 shrink-0 place-items-center rounded-2xl shadow-2xs", toneBg[tone])}>
            <Icon className="h-4.5 w-4.5" />
          </div>
        ) : null}
      </div>
      <div className="text-xl sm:text-2xl font-bold font-mono text-slate-900 mt-1">{value}</div>
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="card border-2 border-dashed border-slate-200 bg-slate-50/50 p-8 text-center text-sm text-slate-500 rounded-3xl">
      {children}
    </div>
  );
}
