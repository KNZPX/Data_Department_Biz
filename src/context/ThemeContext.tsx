"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

export type ColorPresetId = "violet" | "amber" | "sapphire" | "emerald" | "rose" | "slate";
export type CanvasPresetId = "soft" | "crisp" | "warm";
export type RadiusPresetId = "squircle" | "standard";

export interface ColorPreset {
  id: ColorPresetId;
  name: string;
  primary: string;
  primaryHover: string;
  primaryLight: string;
  primaryGlow: string;
  gradientFrom: string;
  gradientTo: string;
  textColor: string;
}

export const COLOR_PRESETS: Record<ColorPresetId, ColorPreset> = {
  violet: {
    id: "violet",
    name: "Royal Violet",
    primary: "#6C5CE7",
    primaryHover: "#5B4DDF",
    primaryLight: "#EDE9FE",
    primaryGlow: "rgba(108, 92, 231, 0.35)",
    gradientFrom: "#7048E8",
    gradientTo: "#5F3DC4",
    textColor: "#ffffff",
  },
  amber: {
    id: "amber",
    name: "Biz Gold (Amber CI)",
    primary: "#B45309",
    primaryHover: "#92400E",
    primaryLight: "#FEF3C7",
    primaryGlow: "rgba(180, 83, 9, 0.35)",
    gradientFrom: "#D97706",
    gradientTo: "#B45309",
    textColor: "#ffffff",
  },
  sapphire: {
    id: "sapphire",
    name: "Ocean Sapphire",
    primary: "#2563EB",
    primaryHover: "#1D4ED8",
    primaryLight: "#DBEAFE",
    primaryGlow: "rgba(37, 99, 235, 0.35)",
    gradientFrom: "#3B82F6",
    gradientTo: "#1D4ED8",
    textColor: "#ffffff",
  },
  emerald: {
    id: "emerald",
    name: "Emerald Mint",
    primary: "#059669",
    primaryHover: "#047857",
    primaryLight: "#D1FAE5",
    primaryGlow: "rgba(5, 150, 105, 0.35)",
    gradientFrom: "#10B981",
    gradientTo: "#047857",
    textColor: "#ffffff",
  },
  rose: {
    id: "rose",
    name: "Rose Sunset",
    primary: "#E11D48",
    primaryHover: "#BE123C",
    primaryLight: "#FFE4E6",
    primaryGlow: "rgba(225, 29, 72, 0.35)",
    gradientFrom: "#F43F5E",
    gradientTo: "#BE123C",
    textColor: "#ffffff",
  },
  slate: {
    id: "slate",
    name: "Midnight Slate",
    primary: "#1E293B",
    primaryHover: "#0F172A",
    primaryLight: "#F1F5F9",
    primaryGlow: "rgba(30, 41, 59, 0.35)",
    gradientFrom: "#334155",
    gradientTo: "#0F172A",
    textColor: "#ffffff",
  },
};

export interface CanvasPreset {
  id: CanvasPresetId;
  name: string;
  bg: string;
  cardBg: string;
}

export const CANVAS_PRESETS: Record<CanvasPresetId, CanvasPreset> = {
  soft: {
    id: "soft",
    name: "Soft Lavender/Slate (As Reference)",
    bg: "#F4F6FB",
    cardBg: "#ffffff",
  },
  crisp: {
    id: "crisp",
    name: "Crisp Minimal White",
    bg: "#F8FAFC",
    cardBg: "#ffffff",
  },
  warm: {
    id: "warm",
    name: "Warm Pastel Sand",
    bg: "#FAF8F5",
    cardBg: "#ffffff",
  },
};

interface ThemeContextType {
  colorPreset: ColorPresetId;
  setColorPreset: (id: ColorPresetId) => void;
  canvasPreset: CanvasPresetId;
  setCanvasPreset: (id: CanvasPresetId) => void;
  radiusPreset: RadiusPresetId;
  setRadiusPreset: (id: RadiusPresetId) => void;
  currentTheme: ColorPreset;
  currentCanvas: CanvasPreset;
}

const ThemeContext = createContext<ThemeContextType>({
  colorPreset: "violet",
  setColorPreset: () => {},
  canvasPreset: "soft",
  setCanvasPreset: () => {},
  radiusPreset: "squircle",
  setRadiusPreset: () => {},
  currentTheme: COLOR_PRESETS.violet,
  currentCanvas: CANVAS_PRESETS.soft,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [colorPreset, setColorPresetState] = useState<ColorPresetId>("violet");
  const [canvasPreset, setCanvasPresetState] = useState<CanvasPresetId>("soft");
  const [radiusPreset, setRadiusPresetState] = useState<RadiusPresetId>("squircle");

  useEffect(() => {
    try {
      const savedColor = localStorage.getItem("portal_theme_color") as ColorPresetId | null;
      if (savedColor && COLOR_PRESETS[savedColor]) {
        setColorPresetState(savedColor);
      }
      const savedCanvas = localStorage.getItem("portal_theme_canvas") as CanvasPresetId | null;
      if (savedCanvas && CANVAS_PRESETS[savedCanvas]) {
        setCanvasPresetState(savedCanvas);
      }
      const savedRadius = localStorage.getItem("portal_theme_radius") as RadiusPresetId | null;
      if (savedRadius === "squircle" || savedRadius === "standard") {
        setRadiusPresetState(savedRadius);
      }
    } catch {}
  }, []);

  const setColorPreset = (id: ColorPresetId) => {
    setColorPresetState(id);
    try {
      localStorage.setItem("portal_theme_color", id);
    } catch {}
  };

  const setCanvasPreset = (id: CanvasPresetId) => {
    setCanvasPresetState(id);
    try {
      localStorage.setItem("portal_theme_canvas", id);
    } catch {}
  };

  const setRadiusPreset = (id: RadiusPresetId) => {
    setRadiusPresetState(id);
    try {
      localStorage.setItem("portal_theme_radius", id);
    } catch {}
  };

  const currentTheme = COLOR_PRESETS[colorPreset] || COLOR_PRESETS.violet;
  const currentCanvas = CANVAS_PRESETS[canvasPreset] || CANVAS_PRESETS.soft;

  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    root.style.setProperty("--theme-primary", currentTheme.primary);
    root.style.setProperty("--theme-primary-hover", currentTheme.primaryHover);
    root.style.setProperty("--theme-primary-light", currentTheme.primaryLight);
    root.style.setProperty("--theme-primary-glow", currentTheme.primaryGlow);
    root.style.setProperty("--theme-gradient-from", currentTheme.gradientFrom);
    root.style.setProperty("--theme-gradient-to", currentTheme.gradientTo);
    root.style.setProperty("--theme-canvas", currentCanvas.bg);
    root.style.setProperty("--theme-card", currentCanvas.cardBg);
    root.style.setProperty("--theme-radius", radiusPreset === "squircle" ? "1.75rem" : "1rem");
  }, [currentTheme, currentCanvas, radiusPreset]);

  return (
    <ThemeContext.Provider
      value={{
        colorPreset,
        setColorPreset,
        canvasPreset,
        setCanvasPreset,
        radiusPreset,
        setRadiusPreset,
        currentTheme,
        currentCanvas,
      }}
    >
      <div
        style={{
          backgroundColor: currentCanvas.bg,
          minHeight: "100vh",
          transition: "background-color 0.3s ease",
        }}
      >
        {children}
      </div>
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
