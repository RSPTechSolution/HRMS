"use client";
import { useState, useTransition } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toaster";
import { decideAction } from "@/app/(app)/approvals/actions";
import type { InboxItem } from "@/server/approvals/inbox";

/** Approve in one click, or decline with a short reason; the row folds away once decided. */
export function ApprovalRow({ item }: { item: InboxItem }) {
  const [mode, setMode] = useState<"idle" | "declining" | "approved" | "declined">("idle");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const toast = useToast();
  const done = mode === "approved" || mode === "declined";

  const decide = (decision: "APPROVED" | "DECLINED") =>
    start(async () => {
      const res = await decideAction(item.id, decision, decision === "DECLINED" ? reason : undefined);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setMode(decision === "APPROVED" ? "approved" : "declined");
      toast(`${decision === "APPROVED" ? "Approved" : "Declined"} ${item.requester}'s ${item.label.toLowerCase()}`);
    });

  return (
    <div className={`ap${done ? " gone" : ""}${mode === "approved" ? " yes" : mode === "declined" ? " no" : ""}`} aria-hidden={done || undefined}>
      <div>
        <div className="ap-in">
          <Avatar name={item.requester} />
          <div>
            <div className="t">{item.requester}</div>
            <div className="s">{item.label} · {item.summary} · {item.ago}</div>
            {item.detail ? <div className="s" style={{ color: "var(--ink)" }}>{item.detail}</div> : null}
          </div>
          {mode === "idle" ? (
            <div className="ap-b">
              <button type="button" className="y" aria-label={`Approve ${item.requester}'s ${item.label.toLowerCase()}`} disabled={pending} onClick={() => decide("APPROVED")}><Icon name="check" /></button>
              <button type="button" className="n" aria-label={`Decline ${item.requester}'s ${item.label.toLowerCase()}`} disabled={pending} onClick={() => setMode("declining")}><Icon name="x" /></button>
            </div>
          ) : null}
        </div>
        {mode === "declining" ? (
          <form
            className="row"
            onSubmit={(e) => {
              e.preventDefault();
              decide("DECLINED");
            }}
          >
            <label className="sr" htmlFor={`reason-${item.id}`}>Reason for declining</label>
            <input
              id={`reason-${item.id}`}
              className="field"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="A short reason they'll see"
              autoFocus
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `err-${item.id}` : undefined}
            />
            <button type="submit" className="btn btn-primary" disabled={pending}>Decline</button>
            <button type="button" className="btn btn-ghost" onClick={() => { setMode("idle"); setError(null); }}>Cancel</button>
          </form>
        ) : null}
        {error ? <p id={`err-${item.id}`} className="form-error" role="alert">{error}</p> : null}
      </div>
    </div>
  );
}
