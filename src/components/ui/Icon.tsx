import type { IconName } from "./icon-names";

export function Icon({ name, className = "i", label }: { name: IconName; className?: string; label?: string }) {
  return (
    <svg className={className} aria-hidden={label ? undefined : true} role={label ? "img" : undefined} aria-label={label}>
      <use href={`#i-${name}`} />
    </svg>
  );
}
