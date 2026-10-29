"use client";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { Icon } from "@/components/ui/Icon";
import { markAllNotificationsReadAction } from "@/app/(app)/actions";

export type BellItem = { id: string; title: string; link: string | null; ago: string; read: boolean };

export function NotificationsBell({ items, unread }: { items: BellItem[]; unread: number }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("click", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="bell-wrap" ref={ref}>
      <button
        type="button"
        className="icon-btn"
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
        aria-expanded={open}
        aria-controls="notif-pop"
        onClick={() => setOpen((o) => !o)}
      >
        <Icon name="bell" />
        {unread > 0 ? <span className="dot-badge" /> : null}
      </button>
      <div id="notif-pop" className={`pop${open ? " open" : ""}`} role="dialog" aria-label="Notifications">
        <div className="pop-h">
          <span className="card-t">Notifications</span>
          {unread > 0 ? (
            <button type="button" className="link" disabled={pending} onClick={() => startTransition(() => markAllNotificationsReadAction())}>
              Mark all read
            </button>
          ) : null}
        </div>
        {items.length === 0 ? <p className="pop-empty">You&apos;re all caught up.</p> : null}
        {items.map((n) => {
          const body = (
            <>
              <span className="nt-ic"><Icon name="bell" /></span>
              <div>
                <p>{n.title}</p>
                <small>{n.ago}</small>
              </div>
            </>
          );
          const className = `nt${n.read ? "" : " unread"}`;
          return n.link ? (
            <Link key={n.id} href={n.link} className={className} onClick={() => setOpen(false)}>{body}</Link>
          ) : (
            <div key={n.id} className={className}>{body}</div>
          );
        })}
      </div>
    </div>
  );
}
