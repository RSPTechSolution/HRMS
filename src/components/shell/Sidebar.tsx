"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLayoutEffect, useRef } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/ui/Icon";
import { isActivePath, type NavLink } from "./nav";

export function Sidebar({ links, fullName, role }: { links: NavLink[]; fullName: string; role: string }) {
  const pathname = usePathname();
  const navRef = useRef<HTMLElement>(null);
  const pillRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const move = () => {
      const active = navRef.current?.querySelector<HTMLElement>('[aria-current="page"]');
      const pill = pillRef.current;
      if (!pill) return;
      if (!active) {
        pill.style.opacity = "0";
        return;
      }
      pill.style.opacity = "1";
      pill.style.width = `${active.offsetWidth}px`;
      pill.style.height = `${active.offsetHeight}px`;
      pill.style.transform = `translate(${active.offsetLeft}px, ${active.offsetTop}px)`;
    };
    move();
    window.addEventListener("resize", move);
    return () => window.removeEventListener("resize", move);
  }, [pathname]);

  return (
    <aside className="side" aria-label="Sidebar">
      <div className="brand"><span className="brand-mark">ln</span><span>LN People</span></div>
      <nav ref={navRef} className="nav" aria-label="Main">
        <span ref={pillRef} className="nav-pill" aria-hidden="true" />
        {links.map((l) => (
          <Link key={l.href} href={l.href} className="nav-btn" aria-current={isActivePath(pathname, l.href) ? "page" : undefined}>
            <Icon name={l.icon} />
            <span>{l.label}</span>
          </Link>
        ))}
      </nav>
      <div className="side-foot">
        <p className="hint">Press <kbd>Ctrl K</kbd> to jump anywhere</p>
        <div className="me">
          <Avatar name={fullName} />
          <div>{fullName}<small>{role}</small></div>
        </div>
      </div>
    </aside>
  );
}
