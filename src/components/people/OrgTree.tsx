import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import type { OrgNode } from "@/domain/people/hierarchy";

type Person = { id: string; fullName: string; designation: string | null; department: string | null };

function Card({ person }: { person: Person }) {
  return (
    <>
      <Avatar name={person.fullName} size="xs" />
      <span>
        <Link className="link" href={`/people/${person.id}`}>{person.fullName}</Link>
        <small>{[person.designation, person.department].filter(Boolean).join(" · ")}</small>
      </span>
    </>
  );
}

function Branch({ node, people }: { node: OrgNode; people: Record<string, Person> }) {
  const person = people[node.id];
  if (!person) return null;
  if (node.children.length === 0) {
    return <li><div className="leaf"><Card person={person} /></div></li>;
  }
  return (
    <li>
      <details open>
        <summary aria-label={`${person.fullName}, ${node.children.length} direct reports`}>
          <Card person={person} />
          <span className="tag">{node.children.length}</span>
        </summary>
        <ul>{node.children.map((c) => <Branch key={c.id} node={c} people={people} />)}</ul>
      </details>
    </li>
  );
}

export function OrgTree({ roots, people }: { roots: OrgNode[]; people: Record<string, Person> }) {
  return (
    <div className="org">
      <ul>{roots.map((r) => <Branch key={r.id} node={r} people={people} />)}</ul>
    </div>
  );
}
