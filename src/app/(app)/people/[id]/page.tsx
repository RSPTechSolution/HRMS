import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/ui/Icon";
import { WordReveal } from "@/components/ui/WordReveal";
import { FormMessage } from "@/components/ui/FormFeedback";
import { MonthCalendar } from "@/components/attendance/MonthCalendar";
import { DocumentsPanel } from "@/components/people/DocumentsPanel";
import { EmployeeForm, SelfEditForm } from "@/components/people/EmployeeForm";
import { logoutAction, logoutEverywhereAction } from "@/app/(auth)/actions";
import { istDateKey, monthKey, parseMonthKey, shiftMonth } from "@/lib/dates";
import { formatMinutes } from "@/lib/format";
import { formatIsoDate } from "@/lib/time";
import type { CurrentUser } from "@/domain/auth/types";
import { EMPLOYMENT_TYPE_LABELS, GENDER_LABELS, STATUS_LABELS } from "@/domain/people/types";
import { requireUser } from "@/server/auth/current-user";
import { listAudit } from "@/server/audit";
import { currentMonth } from "@/server/clock";
import { listDocuments } from "@/server/documents/documents";
import { getMonth } from "@/server/attendance/views";
import { getDirectory, getProfile, type ProfileView } from "@/server/people/directory";
import { listDepartments, listDesignations } from "@/server/people/structure";

export const metadata: Metadata = { title: "Profile" };

type SP = { tab?: string; edit?: string; month?: string; invited?: string; saved?: string };

function Rows({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <dl className="dl">
      {rows.map(([label, value]) => (
        <div key={label} style={{ display: "contents" }}>
          <dt>{label}</dt>
          <dd>{value || "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

async function EditForm({ profile, viewer }: { profile: ProfileView; viewer: CurrentUser }) {
  const isAdmin = viewer.isAdmin;
  const [designations, departments, people] = await Promise.all([listDesignations(), listDepartments(), getDirectory(viewer, {}, async () => new Map())]);
  return (
    <EmployeeForm
      mode="edit"
      employeeId={profile.id}
      designations={designations.map((d) => ({ id: d.id, label: d.title }))}
      departments={departments.map((d) => ({ id: d.id, label: d.name }))}
      managers={people.map((p) => ({ id: p.id, label: `${p.fullName}${p.designation ? ` · ${p.designation}` : ""}` }))}
      canAssignRoles={isAdmin}
      canEditEmail={isAdmin}
      initial={{
        fullName: profile.fullName,
        workEmail: profile.email,
        designationId: profile.designationId,
        departmentId: profile.departmentId,
        managerId: profile.managerId,
        location: profile.location,
        joinedOn: profile.joinedOn,
        probationEndsOn: profile.probationEndsOn,
        employmentType: profile.employmentType,
        status: profile.status,
        ...profile.personal,
        bankHolder: profile.bank?.holder,
        bankAccount: profile.bank?.account,
        bankIfsc: profile.bank?.ifsc,
        pan: profile.ids?.pan,
        aadhaar: profile.ids?.aadhaar,
        ...profile.roles,
      }}
    />
  );
}

export default async function PersonPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SP> }) {
  const user = await requireUser();
  const { id } = await params;
  const sp = await searchParams;
  const profile = await getProfile(user, id);
  if (!profile) notFound();
  const a = profile.access;
  const isSelf = user.employeeId === profile.id;

  const tabs: [string, string][] = [["overview", "Overview"]];
  if (a.personal) tabs.push(["personal", "Personal"]);
  if (a.bank !== "NONE" || a.ids !== "NONE") tabs.push(["job", "Bank and IDs"]);
  if (a.documents) tabs.push(["documents", "Documents"]);
  if (a.attendance) tabs.push(["attendance", "Attendance"]);
  if (a.audit) tabs.push(["audit", "History"]);
  const tab = tabs.some(([k]) => k === sp.tab) ? sp.tab! : "overview";
  const editing = sp.edit === "1" && a.edit !== "NONE";

  return (
    <main className="page" aria-label={profile.fullName}>
      <header className="ph">
        <div className="rv" style={{ display: "flex", gap: 18, alignItems: "center" }}>
          <Avatar name={profile.fullName} size="lg" />
          <div>
            <div className="eyebrow">{[profile.designation, profile.department].filter(Boolean).join(" · ") || profile.code}</div>
            <WordReveal text={profile.fullName} />
          </div>
        </div>
        <div className="actions-row" style={{ marginTop: 0 }}>
          {profile.status !== "ACTIVE" ? <span className={`pill ${profile.status === "EXITED" ? "bad" : "warn"}`}>{STATUS_LABELS[profile.status]}</span> : null}
          {a.edit === "FULL" && !editing ? <Link className="btn btn-ghost" href={`/people/${profile.id}?edit=1`}><Icon name="edit" /> Edit</Link> : null}
          {a.edit === "SELF" && !editing ? <Link className="btn btn-ghost" href={`/people/${profile.id}?tab=personal&edit=1`}><Icon name="edit" /> Edit my details</Link> : null}
        </div>
      </header>

      {sp.invited ? <FormMessage id="invited">Invite sent to {profile.email}. They&apos;ll get a link to set their password.</FormMessage> : null}
      {sp.saved ? <FormMessage id="saved">Saved.</FormMessage> : null}

      {editing ? (
        a.edit === "FULL" ? <EditForm profile={profile} viewer={user} /> : <SelfEditForm initial={profile.personal ?? {}} />
      ) : (
        <>
          <nav className="tabs" aria-label="Profile sections">
            {tabs.map(([k, label]) => (
              <Link key={k} className="tab" href={`/people/${profile.id}?tab=${k}`} aria-current={tab === k ? "page" : undefined}>{label}</Link>
            ))}
          </nav>

          {tab === "overview" ? (
            <section className="grid">
              <div className="card s8">
                <Rows rows={[
                  ["Employee code", profile.code],
                  ["Work email", <a key="e" className="link" href={`mailto:${profile.email}`}>{profile.email}</a>],
                  ["Designation", profile.designation],
                  ["Department", profile.department],
                  ["Reports to", profile.managerId ? <Link key="m" className="link" href={`/people/${profile.managerId}`}>{profile.managerName}</Link> : null],
                  ["Location", profile.location],
                  ["Employment", EMPLOYMENT_TYPE_LABELS[profile.employmentType]],
                  ["Joined", formatIsoDate(profile.joinedOn)],
                  ...(a.personal && profile.probationEndsOn ? ([["Probation ends", formatIsoDate(profile.probationEndsOn)]] as [string, string][]) : []),
                ]} />
              </div>
              {isSelf ? (
                <div className="card s4">
                  <div className="card-h"><span className="card-t">Security</span></div>
                  <p className="muted">Signed in on a shared computer? Sign out everywhere to end every session, including this one.</p>
                  <div className="actions-row">
                    <form action={logoutAction}><button type="submit" className="btn btn-ghost">Sign out</button></form>
                    <form action={logoutEverywhereAction}><button type="submit" className="btn btn-ghost">Sign out everywhere</button></form>
                  </div>
                </div>
              ) : null}
            </section>
          ) : null}

          {tab === "personal" && profile.personal ? (
            <div className="card">
              <Rows rows={[
                ["Date of birth", profile.personal.dateOfBirth ? formatIsoDate(profile.personal.dateOfBirth) : null],
                ["Gender", profile.personal.gender ? GENDER_LABELS[profile.personal.gender as keyof typeof GENDER_LABELS] : null],
                ["Blood group", profile.personal.bloodGroup],
                ["Phone", profile.personal.phone],
                ["Personal email", profile.personal.personalEmail],
                ["Current address", profile.personal.currentAddress],
                ["Permanent address", profile.personal.permanentAddress],
                ["Emergency contact", [profile.personal.emergencyName, profile.personal.emergencyRelation, profile.personal.emergencyPhone].filter(Boolean).join(" · ")],
                ["Birthday visible", profile.personal.showBirthday ? "Yes" : "No"],
              ]} />
            </div>
          ) : null}

          {tab === "job" ? (
            <div className="card">
              <Rows rows={[
                ["Account holder", profile.bank?.holder],
                ["Account number", profile.bank?.account],
                ["IFSC", profile.bank?.ifsc],
                ["PAN", profile.ids?.pan],
                ["Aadhaar", profile.ids?.aadhaar],
              ]} />
            </div>
          ) : null}

          {tab === "documents" ? <DocumentsTab viewer={user} employeeId={profile.id} /> : null}
          {tab === "attendance" ? <AttendanceTab viewer={user} employeeId={profile.id} monthParam={sp.month} /> : null}
          {tab === "audit" ? <AuditTab employeeId={profile.id} /> : null}
        </>
      )}
    </main>
  );
}

async function DocumentsTab({ viewer, employeeId }: { viewer: CurrentUser; employeeId: string }) {
  const documents = (await listDocuments(viewer, employeeId)) ?? [];
  return <DocumentsPanel employeeId={employeeId} documents={documents} canVerify={viewer.isHR || viewer.isAdmin} canUpload />;
}

async function AttendanceTab({ viewer, employeeId, monthParam }: { viewer: CurrentUser; employeeId: string; monthParam?: string }) {
  const now = currentMonth();
  const parsed = parseMonthKey(monthParam);
  const shown = parsed && monthKey(parsed) <= monthKey(now) ? parsed : now;
  const result = await getMonth(viewer, employeeId, shown.year, shown.month);
  if (!result.ok) return <p className="muted">{result.error}</p>;
  const prev = monthKey(shiftMonth(shown.year, shown.month, -1));
  const next = monthKey(shiftMonth(shown.year, shown.month, 1));
  const label = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(shown.year, shown.month - 1, 1)));
  return (
    <div className="card">
      <div className="card-h">
        <span className="card-t">{label}</span>
        <span className="month-nav">
          <Link href={`/people/${employeeId}?tab=attendance&month=${prev}`} aria-label="Previous month"><Icon name="left" /></Link>
          <Link href={`/people/${employeeId}?tab=attendance&month=${next}`} aria-label="Next month" aria-disabled={next > monthKey(now) ? "true" : undefined}><Icon name="right" /></Link>
        </span>
      </div>
      <p className="muted" style={{ marginBottom: 12 }}>
        Average day {formatMinutes(result.stats.averageMinutes)} · {result.stats.fullDays} full · {result.stats.shortDays} short · {result.stats.absences} absent
      </p>
      <MonthCalendar days={result.days} />
    </div>
  );
}

async function AuditTab({ employeeId }: { employeeId: string }) {
  const rows = await listAudit({ entityType: "Employee", entityId: employeeId, take: 50 });
  return (
    <div className="card">
      {rows.length === 0 ? <p className="muted">No changes recorded yet.</p> : null}
      {rows.map((r) => {
        const after = r.after ? Object.keys(JSON.parse(r.after) as Record<string, unknown>) : [];
        return (
          <div className="row" key={r.id}>
            <span className="nt-ic"><Icon name="edit" /></span>
            <div>
              <div className="t">{r.action === "employee.create" ? "Profile created" : r.action === "employee.self_update" ? "Updated their own details" : "Profile updated by HR"}</div>
              <div className="s">{formatIsoDate(istDateKey(r.at))} ·{after.slice(0, 6).join(", ")}{after.length > 6 ? "…" : ""}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
