/** Errors are announced immediately (role="alert"); confirmations politely (role="status"). Pair inputs with aria-describedby={id}. */
export function FormError({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <p id={id} className="form-error" role="alert">
      {children}
    </p>
  );
}

export function FormMessage({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <p id={id} className="form-msg" role="status">
      {children}
    </p>
  );
}

/** Props for an input that should point at a form-level error when there is one. */
export function errorProps(errorId: string, error: string | undefined) {
  return error ? { "aria-invalid": true as const, "aria-describedby": errorId } : {};
}
