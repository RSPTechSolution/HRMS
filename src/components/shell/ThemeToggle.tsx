"use client";
import { Icon } from "@/components/ui/Icon";

export function toggleTheme(origin?: { x: number; y: number }): void {
  const root = document.documentElement;
  const next = root.dataset.theme === "dark" ? "light" : "dark";
  const apply = () => {
    root.dataset.theme = next;
    document.cookie = `lnp_theme=${next}; path=/; max-age=31536000; samesite=lax`;
  };
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!("startViewTransition" in document) || reduce) {
    apply();
    return;
  }
  const x = origin?.x ?? innerWidth - 80;
  const y = origin?.y ?? 40;
  const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  document.startViewTransition(apply).ready.then(() => {
    root.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
      { duration: 650, easing: "cubic-bezier(.2,.75,.2,1)", pseudoElement: "::view-transition-new(root)" },
    );
  });
}

export function ThemeToggle() {
  return (
    <button
      type="button"
      className="icon-btn"
      aria-label="Switch light or dark theme"
      onClick={(e) => toggleTheme(e.clientX ? { x: e.clientX, y: e.clientY } : undefined)}
    >
      <Icon name="moon" className="i ic-moon" />
      <Icon name="sun" className="i ic-sun" />
    </button>
  );
}
