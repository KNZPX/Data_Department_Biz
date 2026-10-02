"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, CheckCircle2, Cloud, CloudOff, Database, KeyRound, Building2, Loader2, Megaphone, Palette, ShieldCheck, RotateCcw, Save, ShieldAlert } from "lucide-react";
import { clsx } from "clsx";
import { Input, Textarea } from "@/components/ui";
import { TokenModal } from "@/components/TokenModal";
import { useAccess, useAuth } from "@/components/auth/LoginGate";
import { toast } from "@/components/feedback";
import { useT } from "@/lib/i18n";
import { OrganisationTab } from "@/features/settings/OrganisationTab";
import { PagesTab } from "@/features/settings/PagesTab";
import { ANNOUNCEMENT_EVENT, type Announcement, type AnnouncementRecord } from "@/components/layout/AnnouncementBanner";
import {
  ACCENTS,
  DENSITIES,
  LANGUAGES,
  THEMES,
  FONTS,
  MOTIONS,
  RADII,
  SURFACES,
  isHex,
  mix,
  useTheme,
  type Appearance,
} from "@/context/ThemeContext";

type Tab = "appearance" | "team" | "organisation" | "pages" | "connection";

const TABS: { id: Tab; label: string; icon: typeof Palette }[] = [
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "team", label: "Team announcement", icon: Megaphone },
  { id: "organisation", label: "Organisation", icon: Building2 },
  { id: "pages", label: "Pages & access", icon: ShieldCheck },
  { id: "connection", label: "Connection", icon: KeyRound },
];

export function SettingsPage() {
  const t = useT();
  const params = useSearchParams();
  const router = useRouter();
  const asked = params.get("tab");
  const initial = (asked === "portal" ? "team" : asked || "appearance") as Tab;
  const [activeTab, setActiveTab] = useState<Tab>(TABS.some((t) => t.id === initial) ? initial : "appearance");

  function pick(t: Tab) {
    setActiveTab(t);
    router.replace(`/settings?tab=${t}`, { scroll: false });
  }

  return (
    <div className="h-full overflow-y-auto pr-1">
      <div className="mx-auto max-w-5xl space-y-5 pb-12">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-[22px] font-semibold tracking-tight text-slate-900">{t("Settings")}</h2>
            <p className="text-[13.5px] text-slate-500">{t("Your own look, the team announcement, and connections.")}</p>
          </div>
          <div className="inline-flex max-w-full overflow-x-auto rounded-lg bg-slate-100 p-0.5 [scrollbar-width:none]" role="tablist">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={activeTab === id}
                onClick={() => pick(id)}
                className={clsx(
                  "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-[13px] font-medium transition-all duration-200",
                  activeTab === id ? "bg-white text-slate-900 shadow-[0_1px_2px_rgb(16_24_40/0.1)]" : "text-slate-500 hover:text-slate-900"
                )}
              >
                <Icon className="h-4 w-4" />
                {t(label)}
              </button>
            ))}
          </div>
        </div>

        <div key={activeTab} className="fade-enter">
          {activeTab === "appearance" && <AppearanceTab />}
          {activeTab === "team" && <AnnouncementTab />}
          {activeTab === "organisation" && <OrganisationTab />}
          {activeTab === "pages" && <PagesTab />}
          {activeTab === "connection" && <ConnectionTab />}
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  const t = useT();
  return (
    <section className="grid gap-3 border-b border-slate-100 py-5 last:border-0 md:grid-cols-[200px_1fr] md:gap-6">
      <div>
        <h3 className="text-[14px] font-semibold text-slate-900">{t(title)}</h3>
        {hint && <p className="mt-0.5 text-[12.5px] leading-snug text-slate-500">{hint}</p>}
      </div>
      <div>{children}</div>
    </section>
  );
}

function Choice({ active, onClick, children, className }: { active: boolean; onClick: () => void; children: React.ReactNode; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={clsx(
        "relative rounded-xl border bg-white p-3 text-left transition-all duration-200",
        active ? "border-blue-500 ring-4 ring-blue-100" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/60",
        className
      )}
    >
      {active && (
        <span className="pop-in absolute right-2 top-2 grid h-5 w-5 place-items-center rounded-full bg-blue-600 text-white">
          <Check className="h-3 w-3" strokeWidth={3} />
        </span>
      )}
      {children}
    </button>
  );
}

function AppearanceTab() {
  const t = useT();
  const { appearance, setAppearance, resetAppearance, saveState } = useTheme();
  const { user } = useAuth();
  const [hex, setHex] = useState(appearance.accent);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHex(appearance.accent);
  }, [appearance.accent]);
  const set = (p: Partial<Appearance>) => setAppearance(p);
  const custom = !ACCENTS.some((a) => a.hex.toLowerCase() === appearance.accent.toLowerCase());

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
      <div className="rounded-xl border border-slate-200/80 bg-white px-5 shadow-[0_1px_2px_rgb(16_24_40/0.04)]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 py-4">
          <div>
            <h3 className="text-[15px] font-semibold text-slate-900">{t("Your appearance")}</h3>
            <p className="text-[12.5px] text-slate-500">
              Only you see these choices. They&rsquo;re saved to {user?.email ? <span className="font-medium text-slate-700">{user.email}</span> : "your account"} and follow you to any computer.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <SaveBadge state={saveState} />
            <button
              type="button"
              onClick={resetAppearance}
              className="flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 text-[12.5px] font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Reset
            </button>
          </div>
        </div>

        <Section title="Accent colour" hint="Buttons, links, the active page and charts' highlight.">
          <div className="flex flex-wrap items-center gap-2.5">
            {ACCENTS.map((a) => {
              const on = a.hex.toLowerCase() === appearance.accent.toLowerCase();
              return (
                <button
                  key={a.id}
                  type="button"
                  title={a.name}
                  aria-label={a.name}
                  aria-pressed={on}
                  onClick={() => set({ accent: a.hex })}
                  className={clsx(
                    "grid h-9 w-9 place-items-center rounded-full transition-transform duration-200 hover:scale-110",
                    on && "ring-2 ring-offset-2"
                  )}
                  style={{ background: a.hex, ["--tw-ring-color" as string]: a.hex }}
                >
                  {on && <Check className="pop-in h-4 w-4 text-white" strokeWidth={3} />}
                </button>
              );
            })}
            <label
              className={clsx(
                "flex h-9 items-center gap-2 rounded-full border pl-1 pr-3 text-[12.5px] transition",
                custom ? "border-blue-500 ring-4 ring-blue-100" : "border-slate-200"
              )}
              title="Pick any colour"
            >
              <input
                type="color"
                value={appearance.accent}
                onChange={(e) => set({ accent: e.target.value })}
                className="h-7 w-7 cursor-pointer rounded-full border-0 bg-transparent p-0 [&::-webkit-color-swatch]:rounded-full [&::-webkit-color-swatch]:border-0 [&::-webkit-color-swatch-wrapper]:p-0"
                aria-label="Custom accent colour"
              />
              <input
                value={hex}
                onChange={(e) => {
                  const v = e.target.value.startsWith("#") ? e.target.value : `#${e.target.value}`;
                  setHex(v);
                  if (isHex(v)) set({ accent: v });
                }}
                className="w-[72px] bg-transparent font-mono text-[12px] uppercase text-slate-700 outline-none"
                aria-label="Accent hex code"
                maxLength={7}
              />
            </label>
          </div>
        </Section>

        <Section title="Theme" hint="Light is the default. Dark re-colours every page for you only.">
          <div className="grid gap-2.5 sm:grid-cols-3">
            {THEMES.map((t) => (
              <Choice key={t.id} active={appearance.theme === t.id} onClick={() => set({ theme: t.id })}>
                <span className="mb-2 flex h-14 overflow-hidden rounded-lg border border-slate-200">
                  {(t.id === "system" ? ["#f8f9fb", "#0d1117"] : [t.id === "dark" ? "#0d1117" : "#f8f9fb"]).map((bg, i) => (
                    <span key={i} className="flex flex-1 p-1.5" style={{ background: bg }}>
                      <span className="w-1/4 rounded-sm" style={{ background: bg === "#0d1117" ? "#161b24" : "#ffffff" }} />
                      <span className="ml-1.5 flex-1 rounded-sm" style={{ background: bg === "#0d1117" ? "#161b24" : "#ffffff" }} />
                    </span>
                  ))}
                </span>
                <span className="block text-[13px] font-medium text-slate-900">{t.name}</span>
                <span className="block text-[11.5px] text-slate-500">{t.hint}</span>
              </Choice>
            ))}
          </div>
        </Section>

        <Section title="Language" hint="Menus, buttons and the main labels. Data and names stay as they are.">
          <div className="grid gap-2.5 sm:grid-cols-2">
            {LANGUAGES.map((l) => (
              <Choice key={l.id} active={appearance.language === l.id} onClick={() => set({ language: l.id })}>
                <span className="block text-[15px] font-semibold text-slate-900">{l.name}</span>
                <span className="block text-[11.5px] text-slate-500">{l.hint}</span>
              </Choice>
            ))}
          </div>
        </Section>

        <Section title="Background" hint="White stays the main colour; this sets the space behind panels.">
          <div className="grid gap-2.5 sm:grid-cols-3">
            {SURFACES.map((s) => (
              <Choice key={s.id} active={appearance.surface === s.id} onClick={() => set({ surface: s.id })}>
                <span className="mb-2 flex h-14 overflow-hidden rounded-lg border border-slate-200" style={{ background: s.bg }}>
                  <span className="w-1/4 border-r border-slate-200 bg-white" />
                  <span className="m-2 flex-1 rounded-md border border-slate-200 bg-white" />
                </span>
                <span className="block text-[13px] font-medium text-slate-900">{s.name}</span>
                <span className="block text-[11.5px] text-slate-500">{s.hint}</span>
              </Choice>
            ))}
          </div>
        </Section>

        <Section title="Corners" hint="How rounded cards, buttons and inputs are.">
          <div className="grid gap-2.5 sm:grid-cols-3">
            {RADII.map((r) => (
              <Choice key={r.id} active={appearance.radius === r.id} onClick={() => set({ radius: r.id })}>
                <span className="mb-2 flex h-10 items-center gap-2">
                  {[0, 1].map((i) => (
                    <span
                      key={i}
                      className="h-9 w-12 border border-slate-300 bg-slate-50"
                      style={{ borderRadius: r.id === "rounded" ? 12 : r.id === "soft" ? 6 : 2 }}
                    />
                  ))}
                </span>
                <span className="block text-[13px] font-medium text-slate-900">{r.name}</span>
                <span className="block text-[11.5px] text-slate-500">{r.hint}</span>
              </Choice>
            ))}
          </div>
        </Section>

        <Section title="Font" hint="All three read Thai and English well.">
          <div className="grid gap-2.5 sm:grid-cols-3">
            {FONTS.map((f) => (
              <Choice key={f.id} active={appearance.font === f.id} onClick={() => set({ font: f.id })}>
                <span className="mb-1 block text-[22px] leading-tight text-slate-900" style={{ fontFamily: f.family }}>
                  Aa กขค 123
                </span>
                <span className="block text-[12.5px] text-slate-600" style={{ fontFamily: f.family }}>
                  {f.name}
                </span>
              </Choice>
            ))}
          </div>
        </Section>

        <Section title="Density" hint="Compact fits more rows in tables and lists.">
          <div className="grid gap-2.5 sm:grid-cols-2">
            {DENSITIES.map((d) => (
              <Choice key={d.id} active={appearance.density === d.id} onClick={() => set({ density: d.id })}>
                <span className="mb-2 flex flex-col" style={{ gap: d.id === "compact" ? 3 : 6 }}>
                  {[0, 1, 2].map((i) => (
                    <span key={i} className="h-2 rounded bg-slate-200" style={{ width: `${90 - i * 18}%` }} />
                  ))}
                </span>
                <span className="block text-[13px] font-medium text-slate-900">{d.name}</span>
                <span className="block text-[11.5px] text-slate-500">{d.hint}</span>
              </Choice>
            ))}
          </div>
        </Section>

        <Section title="Motion" hint="Page transitions, menus, the sliding nav highlight and counting numbers.">
          <div className="grid gap-2.5 sm:grid-cols-3">
            {MOTIONS.map((m) => (
              <Choice key={m.id} active={appearance.motion === m.id} onClick={() => set({ motion: m.id })}>
                <span className="mb-2 flex h-6 items-center">
                  <span
                    className={clsx("h-2.5 w-2.5 rounded-full bg-blue-600", m.id === "full" && "animate-bounce", m.id === "reduced" && "animate-pulse")}
                  />
                </span>
                <span className="block text-[13px] font-medium text-slate-900">{m.name}</span>
                <span className="block text-[11.5px] text-slate-500">{m.hint}</span>
              </Choice>
            ))}
          </div>
        </Section>

        <Section title="Sidebar" hint="You can also collapse it from the sidebar itself.">
          <div className="inline-flex rounded-lg bg-slate-100 p-0.5">
            {[
              [false, "Expanded"],
              [true, "Icons only"],
            ].map(([v, label]) => (
              <button
                key={String(v)}
                type="button"
                onClick={() => set({ sidebarCollapsed: v as boolean })}
                className={clsx(
                  "rounded-md px-3 py-1.5 text-[13px] font-medium transition-all",
                  appearance.sidebarCollapsed === v ? "bg-white text-slate-900 shadow-[0_1px_2px_rgb(16_24_40/0.1)]" : "text-slate-500 hover:text-slate-900"
                )}
              >
                {label as string}
              </button>
            ))}
          </div>
        </Section>
      </div>

      <div className="lg:sticky lg:top-0 lg:self-start">
        <p className="mb-2 text-[12px] font-medium uppercase tracking-[0.06em] text-slate-400">Preview</p>
        <Preview a={appearance} />
      </div>
    </div>
  );
}

function SaveBadge({ state }: { state: ReturnType<typeof useTheme>["saveState"] }) {
  if (state === "idle") return null;
  const map = {
    saving: { icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />, text: "Saving…", cls: "text-slate-500" },
    saved: { icon: <Cloud className="h-3.5 w-3.5" />, text: "Saved to your account", cls: "text-emerald-700" },
    error: { icon: <CloudOff className="h-3.5 w-3.5" />, text: "Couldn't save — kept on this computer", cls: "text-coral" },
    local: { icon: <CloudOff className="h-3.5 w-3.5" />, text: "Saved on this computer", cls: "text-slate-500" },
  }[state];
  return (
    <span key={state} className={clsx("fade-enter flex items-center gap-1.5 text-[12px]", map.cls)}>
      {map.icon}
      {map.text}
    </span>
  );
}

/** A small mock of the app painted with the chosen settings. */
function Preview({ a }: { a: Appearance }) {
  const surface = SURFACES.find((s) => s.id === a.surface)!.bg;
  const r = a.radius === "rounded" ? 10 : a.radius === "soft" ? 6 : 3;
  const font = FONTS.find((f) => f.id === a.font)!.family;
  const light = mix(a.accent, "#FFFFFF", 0.9);
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_8px_24px_-12px_rgb(16_24_40/0.18)]" style={{ fontFamily: font }}>
      <div className="flex h-[260px]">
        <div className={clsx("flex shrink-0 flex-col gap-1 border-r border-slate-200 bg-white p-2 transition-all duration-300", a.sidebarCollapsed ? "w-10" : "w-24")}>
          <span className="mb-1 grid h-5 w-5 place-items-center text-[8px] font-bold text-white" style={{ background: a.accent, borderRadius: r / 2 }}>
            BA
          </span>
          {["Home", "Reports", "DAX", "Boards"].map((n, i) => (
            <span
              key={n}
              className="flex h-5 items-center gap-1 px-1 text-[9px]"
              style={{ borderRadius: r / 2, background: i === 2 ? light : undefined, color: i === 2 ? a.accent : "#4b5565", fontWeight: i === 2 ? 600 : 400 }}
            >
              <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: i === 2 ? a.accent : "#cdd2da" }} />
              {!a.sidebarCollapsed && n}
            </span>
          ))}
        </div>
        <div className="flex-1 space-y-2 p-2.5" style={{ background: surface }}>
          <div className="text-[11px] font-semibold text-slate-900">DAX dictionary</div>
          <div className="grid grid-cols-2 gap-1.5">
            {[849, 1877].map((n) => (
              <div key={n} className="border border-slate-200 bg-white p-1.5" style={{ borderRadius: r }}>
                <div className="text-[8px] text-slate-500">Measures</div>
                <div className="text-[13px] font-semibold text-slate-900">{n.toLocaleString()}</div>
              </div>
            ))}
          </div>
          <div className="space-y-1 border border-slate-200 bg-white p-1.5" style={{ borderRadius: r }}>
            {[70, 55, 82].map((w, i) => (
              <div key={i} className="flex items-center gap-1" style={{ height: a.density === "compact" ? 9 : 13 }}>
                <span className="h-1.5 rounded-full bg-slate-200" style={{ width: `${w}%` }} />
              </div>
            ))}
          </div>
          <div className="flex gap-1.5">
            <span className="px-2 py-1 text-[9px] font-medium text-white" style={{ background: a.accent, borderRadius: r / 1.5 }}>
              New measure
            </span>
            <span className="border border-slate-200 bg-white px-2 py-1 text-[9px] text-slate-700" style={{ borderRadius: r / 1.5 }}>
              Export
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
function Card({ icon: Icon, title, hint, action, children }: { icon: typeof Palette; title: string; hint: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-5 rounded-xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgb(16_24_40/0.04)] md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-blue-50 text-blue-600">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-[15px] font-semibold text-slate-900">{title}</h3>
            <p className="text-[12.5px] text-slate-500">{hint}</p>
          </div>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function AnnouncementTab() {
  const { isAdmin } = useAccess();
  const [loaded, setLoaded] = useState<AnnouncementRecord | null>(null);
  const [draft, setDraft] = useState<Announcement>({ active: false, message: "", tone: "info", link: "", linkLabel: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/team-settings?key=announcement", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: AnnouncementRecord | null) => {
        if (!j) return;
        setLoaded(j);
        if (j.value) setDraft({ tone: "info", link: "", linkLabel: "", ...j.value });
      })
      .catch(() => {});
  }, []);

  const norm = (x?: Partial<Announcement> | null) => JSON.stringify([!!x?.active, x?.message || "", x?.tone || "info", x?.link || "", x?.linkLabel || ""]);
  const changed = norm(draft) !== norm(loaded?.value);
  const linkOk = !draft.link || /^(https?:\/\/|\/)/.test(draft.link);

  async function save() {
    if (!linkOk) return toast.error("The link should start with https:// or /");
    setSaving(true);
    try {
      const value: Announcement = { ...draft, message: draft.message.trim(), link: draft.link?.trim(), linkLabel: draft.linkLabel?.trim() };
      const res = await fetch("/api/team-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "announcement", value }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "The server didn't accept it");
      setLoaded(json);
      setDraft(value);
      window.dispatchEvent(new CustomEvent(ANNOUNCEMENT_EVENT, { detail: json }));
      toast(value.active ? "Announcement is live" : "Announcement turned off", { body: value.active ? "Everyone sees it at the top of every page." : undefined });
    } catch (e) {
      toast.error("Couldn't save the announcement", { body: e instanceof Error ? e.message : undefined });
    } finally {
      setSaving(false);
    }
  }

  const warning = draft.tone === "warning";
  return (
    <Card
      icon={Megaphone}
      title="Team announcement"
      hint="One short notice shown to everyone at the top of every page — a data refresh delay, a new model, a deadline."
      action={
        loaded?.updatedAt && (
          <span className="text-[12px] text-slate-400">
            Last changed by {loaded.updatedBy || "an admin"} · {new Date(loaded.updatedAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
          </span>
        )
      }
    >
      {!isAdmin && (
        <p className="mb-4 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-[12.5px] text-slate-600">
          <ShieldAlert className="h-4 w-4 text-slate-400" /> Only admins can change the announcement.
        </p>
      )}
      <fieldset disabled={!isAdmin} className="space-y-4 text-[13px] disabled:opacity-70">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-slate-700">Show the announcement</p>
            <p className="text-[12px] text-slate-500">People can hide it; it comes back when the message changes.</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={draft.active}
            onClick={() => setDraft({ ...draft, active: !draft.active })}
            className={clsx("relative h-6 w-11 rounded-full transition-colors duration-200", draft.active ? "bg-blue-600" : "bg-slate-300")}
          >
            <span className={clsx("absolute left-0 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200", draft.active ? "translate-x-[22px]" : "translate-x-0.5")} />
          </button>
        </div>

        <label className="block space-y-1.5">
          <span className="flex justify-between font-medium text-slate-700">
            Message <span className="font-normal tabular-nums text-slate-400">{draft.message.length}/240</span>
          </span>
          <Textarea
            rows={2}
            maxLength={240}
            value={draft.message}
            onChange={(e) => setDraft({ ...draft, message: e.target.value })}
            placeholder="e.g. BPK Finance refresh is late today — numbers update by 11:00."
          />
        </label>

        <div>
          <span className="mb-1.5 block font-medium text-slate-700">Style</span>
          <div className="inline-flex rounded-lg bg-slate-100 p-0.5">
            {(
              [
                ["info", "Info"],
                ["warning", "Heads-up"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setDraft({ ...draft, tone: id })}
                className={clsx(
                  "rounded-md px-3 py-1 text-[12.5px] font-medium transition",
                  (draft.tone || "info") === id ? "bg-white text-slate-900 shadow-[0_1px_2px_rgb(16_24_40/0.1)]" : "text-slate-500 hover:text-slate-900"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
          <label className="block space-y-1.5">
            <span className="font-medium text-slate-700">
              Link <span className="font-normal text-slate-400">(optional)</span>
            </span>
            <Input value={draft.link || ""} onChange={(e) => setDraft({ ...draft, link: e.target.value })} placeholder="https://… or /dax?model=PKT-D01" />
            {!linkOk && <span className="text-[12px] text-rose-600">Start with https:// or / (a page in this app).</span>}
          </label>
          <label className="block space-y-1.5">
            <span className="font-medium text-slate-700">Link text</span>
            <Input value={draft.linkLabel || ""} onChange={(e) => setDraft({ ...draft, linkLabel: e.target.value })} placeholder="Open" />
          </label>
        </div>

        {draft.message.trim() && (
          <div>
            <span className="mb-1.5 block font-medium text-slate-700">Preview</span>
            <div
              className={clsx(
                "flex items-center gap-2.5 rounded-lg border px-3 py-2",
                warning ? "border-amber-200 bg-amber-50 text-amber-900" : "border-blue-100 bg-blue-50 text-blue-900",
                !draft.active && "opacity-50"
              )}
            >
              <Megaphone className={clsx("h-4 w-4 shrink-0", warning ? "text-amber-600" : "text-blue-600")} />
              <span className="flex-1 font-medium">{draft.message}</span>
              {draft.link && <span className="text-[12.5px] font-medium">{draft.linkLabel || "Open"} ↗</span>}
            </div>
            {!draft.active && <p className="mt-1 text-[12px] text-slate-400">Turned off — nobody sees it until you switch it on.</p>}
          </div>
        )}

        {isAdmin && (
          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving || !changed || (draft.active && !draft.message.trim())}
              className="flex h-9 items-center gap-2 rounded-lg bg-blue-600 px-4 text-[13px] font-medium text-white transition hover:bg-blue-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {draft.active ? "Publish to the team" : "Save"}
            </button>
          </div>
        )}
      </fieldset>
    </Card>
  );
}

function ConnectionTab() {
  const [tokenStatus, setTokenStatus] = useState<{ hasToken: boolean; expiresAt: string | null; expired: boolean } | null>(null);
  const [tokenModalOpen, setTokenModalOpen] = useState(false);

  async function fetchToken() {
    try {
      const res = await fetch("/api/powerbi/token", { cache: "no-store" });
      if (res.ok) setTokenStatus(await res.json());
    } catch {}
  }
  useEffect(() => {
    fetch("/api/powerbi/token", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j && setTokenStatus(j))
      .catch(() => {});
  }, []);

  return (
    <Card
      icon={KeyRound}
      title="Microsoft 365 and database"
      hint="Power BI REST API, Microsoft Entra ID and Supabase."
      action={
        <button
          type="button"
          onClick={() => setTokenModalOpen(true)}
          className="flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 text-[13px] font-medium text-white transition hover:bg-blue-700"
        >
          <KeyRound className="h-4 w-4" /> Update token
        </button>
      }
    >
      {tokenStatus?.hasToken ? (
        <div className="space-y-1.5 rounded-lg border border-emerald-200 bg-emerald-50/60 p-4 text-[13px]">
          <div className="flex items-center gap-2 font-medium text-emerald-800">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Microsoft 365 access token active
          </div>
          <p className="text-[12px] text-emerald-700">Expires {tokenStatus.expiresAt ? new Date(tokenStatus.expiresAt).toLocaleString() : "with this session"}</p>
          <p className="font-mono text-[11.5px] text-emerald-800">Dataset.Read.All · Report.Read.All · Group.Read.All</p>
        </div>
      ) : (
        <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-4 text-[13px]">
          <div className="mb-1 flex items-center gap-2 font-medium text-amber-800">
            <ShieldAlert className="h-4 w-4 text-amber-600" /> No active token
          </div>
          <p className="text-[12px] text-amber-700">Sign in with your Microsoft work account to sync reports and run queries.</p>
        </div>
      )}
      <div className="space-y-1 rounded-lg border border-slate-200 bg-slate-50 p-4 text-[13px]">
        <div className="flex items-center gap-2 font-medium text-slate-800">
          <Database className="h-4 w-4 text-blue-600" /> Supabase PostgreSQL
        </div>
        <p className="text-[12px] text-slate-500">Reports, change logs, licenses, boards and each person&rsquo;s appearance are stored here.</p>
      </div>
      <TokenModal isOpen={tokenModalOpen} onClose={() => setTokenModalOpen(false)} onSuccess={() => void fetchToken()} />
    </Card>
  );
}
