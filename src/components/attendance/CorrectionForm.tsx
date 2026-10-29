"use client";
import { useActionState, useEffect, useRef } from "react";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { errorProps, FormError } from "@/components/ui/FormFeedback";
import { useToast } from "@/components/ui/Toaster";
import { requestCorrectionAction } from "@/app/(app)/attendance/actions";

export function CorrectionForm({ defaultDate, earliest, latest }: { defaultDate: string; earliest: string; latest: string }) {
  const [state, action] = useActionState(requestCorrectionAction, undefined);
  const toast = useToast();
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.sentAt) {
      toast("Correction sent to your manager");
      ref.current?.reset();
    }
  }, [state?.sentAt, toast]);
  const invalid = errorProps("fix-error", state?.error);
  return (
    <form ref={ref} action={action} id="fix" className="card" noValidate>
      <div className="card-h"><span className="card-t">Fix a day</span><span className="card-a">Goes to your manager</span></div>
      <div className="form-grid">
        <div className="full">
          <label className="label" htmlFor="fix-date">Day</label>
          <input id="fix-date" name="workDate" type="date" className="field" min={earliest} max={latest} defaultValue={defaultDate} key={defaultDate} required {...invalid} />
        </div>
        <div>
          <label className="label" htmlFor="fix-in">Checked in at</label>
          <input id="fix-in" name="inTime" type="time" className="field" defaultValue="09:30" required {...invalid} />
        </div>
        <div>
          <label className="label" htmlFor="fix-out">Checked out at</label>
          <input id="fix-out" name="outTime" type="time" className="field" defaultValue="18:30" required {...invalid} />
        </div>
        <div>
          <label className="label" htmlFor="fix-bs">Break from <span className="muted">(optional)</span></label>
          <input id="fix-bs" name="breakStart" type="time" className="field" />
        </div>
        <div>
          <label className="label" htmlFor="fix-be">Break until <span className="muted">(optional)</span></label>
          <input id="fix-be" name="breakEnd" type="time" className="field" />
        </div>
        <div className="full">
          <label className="label" htmlFor="fix-reason">What happened?</label>
          <textarea id="fix-reason" name="reason" className="field" rows={3} maxLength={300} placeholder="Forgot to check in after the client call" required {...invalid} />
        </div>
      </div>
      {state?.error ? <FormError id="fix-error">{state.error}</FormError> : null}
      <div className="actions-row"><SubmitButton>Send for approval</SubmitButton></div>
    </form>
  );
}
