"use client";
import { useTransition } from "react";
import { useToast } from "@/components/ui/Toaster";
import { runCloseDayAction } from "@/app/(app)/attendance/actions";

/** Admin "Run now" for the nightly attendance close (spec §3.2). */
export function JobsCard() {
  const [pending, start] = useTransition();
  const toast = useToast();
  return (
    <section className="card rv" style={{ marginTop: 16 }}>
      <div className="card-h"><span className="card-t">Scheduled jobs</span><span className="card-a">Runs nightly at 00:30</span></div>
      <p className="muted">Close yesterday&apos;s attendance: flags missed check-outs and absences and tells the people concerned. Safe to run again.</p>
      <div className="actions-row">
        <button
          type="button"
          className="btn btn-ghost"
          disabled={pending}
          aria-busy={pending}
          onClick={() => start(async () => {
            const res = await runCloseDayAction();
            toast(res.ok ? res.message : res.error);
          })}
        >
          {pending ? <span className="spin" aria-hidden="true" /> : null}
          Close yesterday&apos;s attendance now
        </button>
      </div>
    </section>
  );
}
