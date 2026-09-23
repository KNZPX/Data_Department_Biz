"use client";

import { clsx } from "clsx";
import { AlertCircle, Minus, Search, TrendingDown, TrendingUp, X, type LucideIcon } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
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
        "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold transition duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40",
        size === "iconWide"
          ? "h-9 w-9 px-0 sm:h-10 sm:w-auto sm:px-4"
          : size === "icon"
            ? "h-9 w-9 px-0 sm:h-10 sm:w-10"
            : dense
              ? "h-8 px-3.5 text-xs"
              : "h-10 px-5 text-sm",
        variant === "primary" && "bg-slate-900 text-white shadow-xs hover:bg-slate-800 active:bg-slate-950",
        variant === "secondary" && "border border-slate-200/90 bg-white text-slate-800 shadow-xs hover:bg-slate-50 active:bg-slate-100",
        variant === "danger" && "bg-rose-600 text-white shadow-xs hover:bg-rose-700 active:bg-rose-800",
        variant === "gold" && "bg-amber-500 text-slate-950 shadow-xs hover:bg-amber-400 active:bg-amber-600",
        variant === "ghost" && "text-slate-600 hover:bg-slate-200/60 hover:text-slate-900",
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
        "grid h-8 w-8 shrink-0 place-items-center rounded-full border shadow-xs transition duration-150 active:scale-[0.94]",
        tone === "danger" && "border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 hover:border-rose-300",
        tone === "edit" && "border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100 hover:border-blue-300",
        tone === "gold" && "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100",
        tone === "default" && "border-slate-200/90 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900",
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
    <div className="inline-flex items-center gap-1.5 rounded-full p-0.5 bg-slate-100">
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
              "inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold transition duration-150 active:scale-[0.96]",
              active
                ? "bg-slate-900 text-white shadow-xs"
                : "text-slate-600 hover:bg-white/60 hover:text-slate-900",
            )}
          >
            {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
            <span className={compact && Icon ? "hidden sm:inline" : undefined}>{option.label}</span>
            {option.count !== undefined ? (
              <span
                className={clsx(
                  "ml-1 inline-block rounded-full px-1.5 py-0.2 text-[10px]",
                  active ? "bg-white/20 text-white" : "bg-slate-200 text-slate-600",
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
    <label className={clsx("grid min-w-0 font-medium text-slate-800", dense ? "gap-1 text-xs" : "gap-1.5 text-sm", className)}>
      <span className="flex items-center gap-1 font-semibold text-slate-800">
        <span>{label}</span>
        {required ? <span className="text-rose-500 font-bold">*</span> : null}
      </span>
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
    </label>
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
      <div
        className={clsx(
          "relative flex items-center w-full min-w-0 rounded-full border border-slate-200/90 bg-white text-slate-900 shadow-xs transition duration-150 focus-within:border-slate-900 focus-within:ring-2 focus-within:ring-slate-900/5",
          dense ? "h-8 px-3 text-xs" : "h-10 px-4 text-sm",
          className,
        )}
      >
        {Icon ? (
          <Icon className={clsx("shrink-0 text-slate-400 mr-2", dense ? "h-3.5 w-3.5" : "h-4 w-4")} />
        ) : null}
        <input
          {...props}
          value={value}
          className="w-full min-w-0 bg-transparent outline-none placeholder:text-slate-400 text-slate-900 text-xs sm:text-sm"
        />
        {clearable && hasValue && onClear ? (
          <button
            type="button"
            onClick={onClear}
            className="shrink-0 p-0.5 text-slate-400 hover:text-slate-700 rounded-full transition"
            title="Clear"
          >
            <X className={dense ? "h-3 w-3" : "h-3.5 w-3.5"} />
          </button>
        ) : null}
        {rightElement ? <div className="shrink-0 ml-1.5">{rightElement}</div> : null}
      </div>
    );
  }

  return (
    <input
      {...props}
      value={value}
      className={clsx(
        "w-full min-w-0 rounded-full border border-slate-200/90 bg-white text-slate-900 placeholder:text-slate-400 outline-none shadow-xs transition duration-150 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/5",
        dense ? "h-8 px-3 text-xs" : "h-10 px-4 text-sm",
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
        "w-full min-w-0 rounded-full border border-slate-200/90 bg-white text-slate-900 outline-none shadow-xs transition duration-150 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/5",
        dense ? "h-8 px-2.5 text-xs" : "h-10 px-3.5 text-sm",
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
        "rounded-2xl border border-slate-200/90 bg-white text-slate-900 placeholder:text-slate-400 outline-none shadow-xs transition duration-150 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/5",
        dense ? "min-h-12 px-3 py-2 text-xs" : "min-h-24 px-3.5 py-2.5 text-sm",
        props.className,
      )}
    />
  );
}

export function Panel({ children, className, dense = false }: { children: ReactNode; className?: string; dense?: boolean }) {
  return <section className={clsx("rounded-3xl border border-slate-200/80 bg-white shadow-xs", dense ? "p-4 sm:p-5" : "p-5 sm:p-6", className)}>{children}</section>;
}

const subscribeNoop = () => () => {};

export function Modal({ className, children }: { className?: string; children: ReactNode }) {
  const mounted = useSyncExternalStore(subscribeNoop, () => true, () => false);
  if (!mounted) return null;
  return createPortal(
    <div className={clsx("fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-900/50 p-2.5 backdrop-blur-xs transition-all sm:p-4", className)}>
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
        "grid gap-1.5 rounded-3xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs transition duration-200 hover:border-slate-300",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="text-xs sm:text-sm font-medium text-slate-500">{label}</div>
        {Icon ? (
          <div className={clsx("grid h-8 w-8 shrink-0 place-items-center rounded-xl", toneBg[tone])}>
            <Icon className="h-4 w-4" />
          </div>
        ) : null}
      </div>
      <div className="text-xl sm:text-2xl font-bold font-mono text-slate-900">{value}</div>
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500">{children}</div>;
}
