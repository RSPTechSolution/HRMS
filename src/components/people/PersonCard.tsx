import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import type { DirectoryEntry } from "@/server/people/directory";

const PRESENCE: Record<DirectoryEntry["today"], string> = { IN: "In now", BREAK: "On a break", OUT: "Checked out", NOT_IN: "Not in yet" };

export function PersonCard({ person, index }: { person: DirectoryEntry; index: number }) {
  return (
    <Link href={`/people/${person.id}`} className="pcard" data-tilt style={{ "--i": index } as React.CSSProperties}>
      <div className="pc-top">
        <Avatar name={person.fullName} size="lg" />
        {person.department ? <span className="tag">{person.department}</span> : null}
      </div>
      <h3>{person.fullName}</h3>
      <p className="role">{person.designation ?? "—"}</p>
      <div className="pc-status">
        <i className={`sd ${person.today}`} aria-hidden="true" />
        {person.status === "EXITED" ? "Exited" : person.status === "NOTICE" ? `${PRESENCE[person.today]} · on notice` : PRESENCE[person.today]}
      </div>
    </Link>
  );
}
