import { avatarColor, initials } from "@/lib/avatar";

export function Avatar({ name, size = "md" }: { name: string; size?: "xs" | "md" | "lg" }) {
  return (
    <span className={`av${size === "md" ? "" : ` ${size}`}`} style={{ background: avatarColor(name) }} aria-hidden="true">
      {initials(name)}
    </span>
  );
}
