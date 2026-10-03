// The whole app is drawn at a page zoom (Settings → Appearance → Page size;
// "Auto" shrinks it a little on laptop-size screens). With CSS zoom on <html>,
// getBoundingClientRect / clientX are in screen pixels while styles are in
// CSS pixels, so code that turns one into the other divides by this.
export function appZoom(): number {
  if (typeof window === "undefined") return 1;
  const z = parseFloat(getComputedStyle(document.documentElement).zoom || "1");
  return Number.isFinite(z) && z > 0 ? z : 1;
}
