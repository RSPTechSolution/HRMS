"use client";
import { useEffect, useRef } from "react";

/** Custom cursor, magnetic buttons, ripples, card spotlight and tilt — fine pointers only, off for reduced motion. */
export function Interactions() {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
    const root = document.documentElement;

    const onDown = (e: PointerEvent) => {
      const b = (e.target as Element).closest?.<HTMLButtonElement>(".btn");
      if (!b || reduce || b.disabled) return;
      const r = b.getBoundingClientRect();
      const s = document.createElement("span");
      s.className = "rip";
      s.style.left = `${e.clientX - r.left}px`;
      s.style.top = `${e.clientY - r.top}px`;
      b.append(s);
      s.addEventListener("animationend", () => s.remove());
    };
    document.addEventListener("pointerdown", onDown);
    if (!fine || reduce) return () => document.removeEventListener("pointerdown", onDown);

    const dot = dotRef.current!;
    const ring = ringRef.current!;
    let x = -100, y = -100, rx = -100, ry = -100, raf = 0;
    let mag: HTMLElement | null = null;
    let tilt: HTMLElement | null = null;

    const onMove = (e: PointerEvent) => {
      x = e.clientX;
      y = e.clientY;
      dot.style.transform = `translate(${x}px,${y}px)`;
      root.classList.add("cursor-on");
      const t = e.target as Element;
      const m = t.closest?.<HTMLElement>("[data-magnetic]") ?? null;
      if (mag && mag !== m) mag.style.transform = "";
      mag = m;
      if (m && !(m as HTMLButtonElement).disabled) {
        const r = m.getBoundingClientRect();
        m.style.transform = `translate(${(x - r.left - r.width / 2) * 0.28}px,${(y - r.top - r.height / 2) * 0.4}px)`;
      }
      const tc = t.closest?.<HTMLElement>("[data-tilt]") ?? null;
      if (tilt && tilt !== tc) tilt.style.transform = "";
      tilt = tc;
      if (tc) {
        const r = tc.getBoundingClientRect();
        const px = (x - r.left) / r.width - 0.5;
        const py = (y - r.top) / r.height - 0.5;
        tc.style.transform = `perspective(800px) rotateX(${-py * 7}deg) rotateY(${px * 7}deg) translateY(-3px)`;
      }
      const sp = t.closest?.<HTMLElement>(".spot");
      if (sp) {
        const r = sp.getBoundingClientRect();
        sp.style.setProperty("--mx", `${x - r.left}px`);
        sp.style.setProperty("--my", `${y - r.top}px`);
      }
    };
    const onOver = (e: PointerEvent) => {
      const t = e.target as Element;
      ring.classList.toggle("hover", !!t.closest?.("a,button,input,textarea,select,label,[data-cursor]"));
      const dark = !!t.closest?.(".side,.auth-art,.toast");
      ring.classList.toggle("dark", dark);
      root.classList.toggle("cursor-dark", dark);
    };
    const onLeave = () => root.classList.remove("cursor-on");
    const onPress = () => ring.classList.add("down");
    const onRelease = () => ring.classList.remove("down");
    const loop = () => {
      rx += (x - rx) * 0.18;
      ry += (y - ry) * 0.18;
      ring.style.transform = `translate(${rx}px,${ry}px)`;
      raf = requestAnimationFrame(loop);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerover", onOver);
    root.addEventListener("mouseleave", onLeave);
    window.addEventListener("pointerdown", onPress);
    window.addEventListener("pointerup", onRelease);
    raf = requestAnimationFrame(loop);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerover", onOver);
      root.removeEventListener("mouseleave", onLeave);
      window.removeEventListener("pointerdown", onPress);
      window.removeEventListener("pointerup", onRelease);
      cancelAnimationFrame(raf);
      root.classList.remove("cursor-on", "cursor-dark");
    };
  }, []);

  return (
    <>
      <div ref={ringRef} className="cur-ring" aria-hidden="true"><span /></div>
      <div ref={dotRef} className="cur-dot" aria-hidden="true" />
    </>
  );
}
