"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

// -----------------------------------------------------------------------------
// Per-person appearance. Saved to the signed-in person's row in Supabase
// (/api/me/preferences) and cached in localStorage per email so the next load
// paints with the right look before the request comes back.
// -----------------------------------------------------------------------------

export type SurfaceId = "white" | "snow" | "mist";
export type RadiusId = "rounded" | "soft" | "sharp";
export type FontId = "plex" | "noto" | "anuphan";
export type MotionId = "full" | "reduced" | "off";
export type DensityId = "comfortable" | "compact";
export type ThemeId = "light" | "dark" | "system";
export type LanguageId = "en" | "th";
export type PageSizeId = "auto" | "100" | "90" | "80";

export type Appearance = {
  accent: string;
  surface: SurfaceId;
  radius: RadiusId;
  font: FontId;
  motion: MotionId;
  density: DensityId;
  theme: ThemeId;
  language: LanguageId;
  pageSize: PageSizeId;
  sidebarCollapsed: boolean;
};

export const DEFAULT_APPEARANCE: Appearance = {
  accent: "#2563EB",
  surface: "snow",
  radius: "rounded",
  font: "plex",
  motion: "full",
  density: "comfortable",
  theme: "light",
  language: "en",
  pageSize: "auto",
  sidebarCollapsed: false,
};

export const ACCENTS: { id: string; name: string; hex: string }[] = [
  { id: "blue", name: "Blue", hex: "#2563EB" },
  { id: "royal", name: "Royal", hex: "#4262FF" },
  { id: "sky", name: "Sky", hex: "#0284C7" },
  { id: "teal", name: "Teal", hex: "#0D9488" },
  { id: "indigo", name: "Indigo", hex: "#4F46E5" },
  { id: "violet", name: "Violet", hex: "#7C3AED" },
  { id: "rose", name: "Rose", hex: "#E11D48" },
  { id: "amber", name: "Amber", hex: "#D97706" },
  { id: "graphite", name: "Graphite", hex: "#334155" },
];

export const SURFACES: { id: SurfaceId; name: string; hint: string; bg: string }[] = [
  { id: "white", name: "Pure white", hint: "Everything on white", bg: "#FFFFFF" },
  { id: "snow", name: "Snow", hint: "White panels on a hint of grey", bg: "#F8F9FB" },
  { id: "mist", name: "Mist", hint: "More contrast between panels", bg: "#F1F3F6" },
];

export const RADII: { id: RadiusId; name: string; hint: string }[] = [
  { id: "rounded", name: "Rounded", hint: "Friendly, soft corners" },
  { id: "soft", name: "Subtle", hint: "Tighter corners" },
  { id: "sharp", name: "Sharp", hint: "Square, dense data look" },
];

export const FONTS: { id: FontId; name: string; family: string }[] = [
  { id: "plex", name: "IBM Plex Sans Thai", family: '"IBM Plex Sans Thai", sans-serif' },
  { id: "noto", name: "Noto Sans Thai", family: '"Noto Sans Thai", sans-serif' },
  { id: "anuphan", name: "Anuphan", family: '"Anuphan", sans-serif' },
];

export const MOTIONS: { id: MotionId; name: string; hint: string }[] = [
  { id: "full", name: "Full", hint: "Page, menu and number animations" },
  { id: "reduced", name: "Reduced", hint: "Quick fades only" },
  { id: "off", name: "Off", hint: "No animation" },
];

export const PAGE_SIZES: { id: PageSizeId; name: string; hint: string }[] = [
  { id: "auto", name: "Auto", hint: "90% (85% on small laptops)" },
  { id: "100", name: "100%", hint: "Full size" },
  { id: "90", name: "90%", hint: "A little smaller" },
  { id: "80", name: "80%", hint: "Fit the most" },
];

export const DENSITIES: { id: DensityId; name: string; hint: string }[] = [
  { id: "comfortable", name: "Comfortable", hint: "Default spacing" },
  { id: "compact", name: "Compact", hint: "Fit more rows on screen" },
];

export const THEMES: { id: ThemeId; name: string; hint: string }[] = [
  { id: "light", name: "Light", hint: "White panels (default)" },
  { id: "dark", name: "Dark", hint: "Easier on the eyes at night" },
  { id: "system", name: "Match my computer", hint: "Follows your OS setting" },
];

export const LANGUAGES: { id: LanguageId; name: string; hint: string }[] = [
  { id: "en", name: "English", hint: "Menus and buttons in English" },
  { id: "th", name: "ไทย", hint: "เมนูและปุ่มหลักเป็นภาษาไทย" },
];

// ---- colour helpers ---------------------------------------------------------
function toRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const n = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  return [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) || 0) as [number, number, number];
}
function toHex([r, g, b]: number[]) {
  return "#" + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("").toUpperCase();
}
export function mix(hex: string, with_: string, amount: number) {
  const a = toRgb(hex);
  const b = toRgb(with_);
  return toHex(a.map((v, i) => v + (b[i] - v) * amount));
}
export function isHex(v: string) {
  return /^#([0-9a-f]{6})$/i.test(v);
}

/** The colour object older pages read via useTheme().currentTheme. */
export type ColorPreset = {
  primary: string;
  primaryHover: string;
  primaryLight: string;
  primaryGlow: string;
  gradientFrom: string;
  gradientTo: string;
  textColor: string;
};

function colorsFor(accent: string): ColorPreset {
  const [r, g, b] = toRgb(accent);
  return {
    primary: accent,
    primaryHover: mix(accent, "#000000", 0.14),
    primaryLight: mix(accent, "#FFFFFF", 0.9),
    primaryGlow: `rgba(${r}, ${g}, ${b}, 0.28)`,
    gradientFrom: mix(accent, "#FFFFFF", 0.12),
    gradientTo: mix(accent, "#000000", 0.12),
    textColor: "#FFFFFF",
  };
}

function sanitize(raw: unknown): Partial<Appearance> {
  if (!raw || typeof raw !== "object") return {};
  const r = raw as Record<string, unknown>;
  const out: Partial<Appearance> = {};
  if (typeof r.accent === "string" && isHex(r.accent)) out.accent = r.accent.toUpperCase();
  if (SURFACES.some((s) => s.id === r.surface)) out.surface = r.surface as SurfaceId;
  if (RADII.some((s) => s.id === r.radius)) out.radius = r.radius as RadiusId;
  if (FONTS.some((s) => s.id === r.font)) out.font = r.font as FontId;
  if (MOTIONS.some((s) => s.id === r.motion)) out.motion = r.motion as MotionId;
  if (DENSITIES.some((s) => s.id === r.density)) out.density = r.density as DensityId;
  if (PAGE_SIZES.some((s) => s.id === r.pageSize)) out.pageSize = r.pageSize as PageSizeId;
  if (THEMES.some((s) => s.id === r.theme)) out.theme = r.theme as ThemeId;
  if (LANGUAGES.some((s) => s.id === r.language)) out.language = r.language as LanguageId;
  if (typeof r.sidebarCollapsed === "boolean") out.sidebarCollapsed = r.sidebarCollapsed;
  return out;
}

const LAST_KEY = "appearance:last";
const keyFor = (email: string) => `appearance:${email.toLowerCase()}`;

function readLocal(key: string): Partial<Appearance> {
  try {
    const v = localStorage.getItem(key);
    return v ? sanitize(JSON.parse(v)) : {};
  } catch {
    return {};
  }
}
function writeLocal(key: string, value: Appearance) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

function applyToDocument(a: Appearance) {
  const root = document.documentElement;
  const c = colorsFor(a.accent);
  root.style.setProperty("--theme-primary", c.primary);
  root.style.setProperty("--theme-primary-hover", c.primaryHover);
  root.style.setProperty("--theme-primary-light", c.primaryLight);
  root.style.setProperty("--theme-primary-glow", c.primaryGlow);
  root.style.setProperty("--theme-gradient-from", c.gradientFrom);
  root.style.setProperty("--theme-gradient-to", c.gradientTo);
  root.dataset.surface = a.surface;
  root.dataset.radius = a.radius;
  root.dataset.font = a.font;
  root.dataset.motion = a.motion;
  root.dataset.density = a.density;
  root.dataset.zoom = a.pageSize;
  const dark = a.theme === "dark" || (a.theme === "system" && window.matchMedia?.("(prefers-color-scheme: dark)").matches);
  root.dataset.theme = dark ? "dark" : "light";
  root.style.colorScheme = dark ? "dark" : "light";
  root.lang = a.language;
}

type Ctx = {
  appearance: Appearance;
  /** Change one or more settings; saved for the signed-in person. */
  setAppearance: (patch: Partial<Appearance>) => void;
  resetAppearance: () => void;
  /** Load the signed-in person's saved look (called once they're known). */
  loadFor: (email: string | null) => void;
  saveState: "idle" | "saving" | "saved" | "error" | "local";
  currentTheme: ColorPreset;
  // Kept for older callers.
  currentCanvas: { bg: string; cardBg: string };
};

const ThemeContext = createContext<Ctx>({
  appearance: DEFAULT_APPEARANCE,
  setAppearance: () => {},
  resetAppearance: () => {},
  loadFor: () => {},
  saveState: "idle",
  currentTheme: colorsFor(DEFAULT_APPEARANCE.accent),
  currentCanvas: { bg: "#F8F9FB", cardBg: "#FFFFFF" },
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [appearance, setState] = useState<Appearance>(DEFAULT_APPEARANCE);
  const [saveState, setSaveState] = useState<Ctx["saveState"]>("idle");
  const emailRef = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Paint with the last look used in this browser while we find out who's here.
  useEffect(() => {
    const last = { ...DEFAULT_APPEARANCE, ...readLocal(LAST_KEY) };
    applyToDocument(last);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(last);
  }, []);

  useEffect(() => {
    applyToDocument(appearance);
    if (appearance.theme !== "system" || !window.matchMedia) return;
    // Follow the OS when it switches between light and dark.
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyToDocument(appearance);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [appearance]);

  const persist = useCallback((next: Appearance) => {
    writeLocal(LAST_KEY, next);
    const email = emailRef.current;
    if (!email) {
      setSaveState("local");
      return;
    }
    writeLocal(keyFor(email), next);
    setSaveState("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch("/api/me/preferences", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prefs: { appearance: next } }),
        });
        setSaveState(res.ok ? "saved" : "error");
      } catch {
        setSaveState("error");
      }
    }, 450);
  }, []);

  const setAppearance = useCallback(
    (patch: Partial<Appearance>) => {
      setState((prev) => {
        const next = { ...prev, ...sanitize({ ...prev, ...patch }) };
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const resetAppearance = useCallback(() => {
    setState(DEFAULT_APPEARANCE);
    persist(DEFAULT_APPEARANCE);
  }, [persist]);

  const loadFor = useCallback((email: string | null) => {
    const e = email?.toLowerCase() || null;
    if (emailRef.current === e) return;
    emailRef.current = e;
    if (!e) return;
    const cached = readLocal(keyFor(e));
    if (Object.keys(cached).length) setState({ ...DEFAULT_APPEARANCE, ...cached });
    fetch("/api/me/preferences", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (!json || emailRef.current !== e) return;
        const saved = sanitize(json.prefs?.appearance);
        if (!Object.keys(saved).length) return;
        const next = { ...DEFAULT_APPEARANCE, ...saved };
        writeLocal(keyFor(e), next);
        writeLocal(LAST_KEY, next);
        setState(next);
      })
      .catch(() => {});
  }, []);

  const value = useMemo<Ctx>(() => {
    const surface = SURFACES.find((s) => s.id === appearance.surface) || SURFACES[1];
    return {
      appearance,
      setAppearance,
      resetAppearance,
      loadFor,
      saveState,
      currentTheme: colorsFor(appearance.accent),
      currentCanvas: { bg: surface.bg, cardBg: "#FFFFFF" },
    };
  }, [appearance, setAppearance, resetAppearance, loadFor, saveState]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
