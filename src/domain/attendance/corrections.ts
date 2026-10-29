import { z } from "zod";
import { addDays, isRealDate, istDateTime } from "@/lib/dates";

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a time like 09:30.");
const optionalTime = z.preprocess((v) => (v === "" || v === undefined ? null : v), time.nullable());

export const correctionInputSchema = z.object({
  workDate: z.string().refine(isRealDate, "Pick a day."),
  inTime: time,
  outTime: time,
  breakStart: optionalTime,
  breakEnd: optionalTime,
  reason: z.string().trim().min(5, "Tell your manager what happened (at least 5 characters).").max(300),
});
export type CorrectionInput = z.infer<typeof correctionInputSchema>;

export type CorrectionTimes = { ok: true; inAt: Date; outAt: Date; breakStartAt: Date | null; breakEndAt: Date | null } | { ok: false; error: string };

/** Times are IST wall-clock on `workDate`; an earlier check-out is never read as "next day". */
export function validateCorrection(input: CorrectionInput, ctx: { today: string; windowDays: number; hasOpenCorrection: boolean }): CorrectionTimes {
  if (input.workDate >= ctx.today) return { ok: false, error: "Pick a day before today." };
  if (input.workDate < addDays(ctx.today, -ctx.windowDays)) return { ok: false, error: `Corrections are only possible for the last ${ctx.windowDays} days.` };
  if (ctx.hasOpenCorrection) return { ok: false, error: "There's already a correction waiting for that day." };
  const inAt = istDateTime(input.workDate, input.inTime);
  const outAt = istDateTime(input.workDate, input.outTime);
  if (outAt <= inAt) return { ok: false, error: "Check-out must be after check-in." };
  if ((input.breakStart === null) !== (input.breakEnd === null)) return { ok: false, error: "Give both break times or neither." };
  let breakStartAt: Date | null = null;
  let breakEndAt: Date | null = null;
  if (input.breakStart && input.breakEnd) {
    breakStartAt = istDateTime(input.workDate, input.breakStart);
    breakEndAt = istDateTime(input.workDate, input.breakEnd);
    if (breakStartAt <= inAt || breakEndAt >= outAt || breakEndAt <= breakStartAt) {
      return { ok: false, error: "The break must sit inside the working hours." };
    }
  }
  return { ok: true, inAt, outAt, breakStartAt, breakEndAt };
}
