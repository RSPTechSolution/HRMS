import type { Metadata } from "next";
import { WordReveal } from "@/components/ui/WordReveal";
import { ApprovalRow } from "@/components/approvals/ApprovalRow";
import { withdrawAction } from "@/app/(app)/approvals/actions";
import { requireUser } from "@/server/auth/current-user";
import { getInbox } from "@/server/approvals/inbox";

export const metadata: Metadata = { title: "Approvals" };

const PILL: Record<string, string> = { PENDING: "warn", APPROVED: "", DECLINED: "bad", WITHDRAWN: "muted" };

export default async function ApprovalsPage() {
  const user = await requireUser();
  const { waiting, mine } = await getInbox(user);
  return (
    <main className="page" aria-label="Approvals">
      <header className="ph">
        <div className="rv">
          <div className="eyebrow">{waiting.length ? `${waiting.length} waiting on you` : "Nothing waiting"}</div>
          <WordReveal text="Approvals" />
        </div>
      </header>
      <section className="grid">
        <div className="card s8 rv" style={{ "--i": 1 } as React.CSSProperties}>
          <div className="card-h"><span className="card-t">Waiting on you</span></div>
          {waiting.length === 0 ? (
            <div className="empty" style={{ padding: "28px 0" }}><b>All caught up</b>Nothing needs you right now.</div>
          ) : (
            waiting.map((item) => <ApprovalRow key={item.id} item={item} />)
          )}
        </div>
        <div className="card s4 rv" style={{ "--i": 2 } as React.CSSProperties}>
          <div className="card-h"><span className="card-t">Your requests</span></div>
          {mine.length === 0 ? <p className="muted">You haven&apos;t asked for anything yet.</p> : null}
          {mine.map((r) => (
            <div className="row" key={r.id} style={{ alignItems: "flex-start" }}>
              <div>
                <div className="t">{r.label}</div>
                <div className="s">{r.summary} · {r.ago}</div>
                <div className="s">{r.where}</div>
              </div>
              <span style={{ marginLeft: "auto", display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
                <span className={`pill ${PILL[r.status] ?? "muted"}`}>{r.status === "PENDING" ? "Waiting" : r.where.split(" by ")[0]}</span>
                {r.canWithdraw ? (
                  <form action={withdrawAction.bind(null, r.id)}>
                    <button type="submit" className="link" aria-label={`Withdraw ${r.label.toLowerCase()} for ${r.summary}`}>Withdraw</button>
                  </form>
                ) : null}
              </span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
