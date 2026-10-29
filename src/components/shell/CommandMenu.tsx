"use client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import type { IconName } from "@/components/ui/icon-names";
import { logoutAction } from "@/app/(auth)/actions";
import type { NavLink } from "./nav";
import { toggleTheme } from "./ThemeToggle";

type Command = { group: string; label: string; icon: IconName; run: () => void };

export function CommandMenu({ links }: { links: NavLink[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(false);
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastFocus = useRef<HTMLElement | null>(null);

  const commands = useMemo<Command[]>(
    () => [
      ...links.map((l) => ({ group: "Go to", label: l.label, icon: l.icon, run: () => router.push(l.href) })),
      { group: "Actions", label: "Switch light / dark theme", icon: "moon", run: () => toggleTheme() },
      { group: "Actions", label: "Sign out", icon: "logout", run: () => void logoutAction() },
    ],
    [links, router],
  );
  const filtered = commands.filter((c) => c.label.toLowerCase().includes(query.trim().toLowerCase()));
  const active = Math.min(index, Math.max(0, filtered.length - 1));

  const show = useCallback(() => {
    lastFocus.current = document.activeElement as HTMLElement | null;
    setQuery("");
    setIndex(0);
    setOpen(true);
    requestAnimationFrame(() => {
      setVisible(true);
      inputRef.current?.focus();
    });
  }, []);
  const hide = useCallback(() => {
    setVisible(false);
    setTimeout(() => setOpen(false), 200);
    lastFocus.current?.focus?.({ preventScroll: true });
  }, []);
  const run = (i: number) => {
    const c = filtered[i];
    if (!c) return;
    hide();
    c.run();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test((document.activeElement as HTMLElement | null)?.tagName ?? "");
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (open) hide();
        else show();
      } else if (e.key === "/" && !open && !typing) {
        e.preventDefault();
        show();
      }
    };
    const onOpen = () => show();
    window.addEventListener("keydown", onKey);
    window.addEventListener("lnp:open-command", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("lnp:open-command", onOpen);
    };
  }, [open, show, hide]);

  if (!open) return null;
  return (
    <div className={`cmdk${visible ? " open" : ""}`} role="dialog" aria-modal="true" aria-label="Command menu">
      <div className="cmdk-bg" onClick={hide} />
      <div className="cmdk-panel">
        <div className="cmdk-in">
          <Icon name="search" />
          <input
            ref={inputRef}
            role="combobox"
            aria-expanded="true"
            aria-controls="cmdk-list"
            aria-activedescendant={filtered.length ? `cmd-${active}` : undefined}
            placeholder="Search pages and actions…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIndex(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setIndex((active + 1) % Math.max(1, filtered.length));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setIndex((active - 1 + filtered.length) % Math.max(1, filtered.length));
              } else if (e.key === "Enter") {
                e.preventDefault();
                run(active);
              } else if (e.key === "Escape") {
                e.preventDefault();
                hide();
              } else if (e.key === "Tab") {
                e.preventDefault();
              }
            }}
          />
          <kbd>Esc</kbd>
        </div>
        <ul className="cmdk-list" id="cmdk-list" role="listbox">
          {filtered.length === 0 ? <li className="cmdk-empty">Nothing found for “{query}”</li> : null}
          {filtered.map((c, i) => {
            const header = i === 0 || filtered[i - 1].group !== c.group ? c.group : null;
            return (
              <li key={`${c.group}-${c.label}`} role="presentation">
                {header ? <div className="cmdk-g">{header}</div> : null}
                <div
                  id={`cmd-${i}`}
                  role="option"
                  aria-selected={i === active}
                  className="cmdk-it"
                  onPointerMove={() => setIndex(i)}
                  onClick={() => run(i)}
                >
                  <Icon name={c.icon} />
                  <span>{c.label}</span>
                </div>
              </li>
            );
          })}
        </ul>
        <div className="cmdk-foot"><span><kbd>↑</kbd> <kbd>↓</kbd> move</span><span><kbd>↵</kbd> open</span><span><kbd>/</kbd> also opens this</span></div>
      </div>
    </div>
  );
}
