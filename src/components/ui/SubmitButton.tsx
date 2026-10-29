"use client";
import { useFormStatus } from "react-dom";

export function SubmitButton({ children, className = "btn btn-primary", label }: { children: React.ReactNode; className?: string; label?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending} aria-busy={pending} aria-label={label} data-magnetic>
      {pending ? <span className="spin" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}
