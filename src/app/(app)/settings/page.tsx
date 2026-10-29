import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SettingRow } from "@/components/settings/SettingRow";
import { JobsCard } from "@/components/settings/JobsCard";
import { WordReveal } from "@/components/ui/WordReveal";
import { can } from "@/domain/auth/permissions";
import { SETTING_KEYS, SETTING_META } from "@/domain/settings/settings";
import { requireUser } from "@/server/auth/current-user";
import { getSettings } from "@/server/settings";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireUser();
  if (!can(user, "settings.manage")) notFound();
  const settings = await getSettings();
  return (
    <main className="page" aria-label="Settings">
      <header className="ph">
        <div className="rv">
          <div className="eyebrow">Admin</div>
          <WordReveal text="Settings" />
          <p className="lede">Company-wide rules. Every change is recorded in the audit log.</p>
        </div>
      </header>
      <section className="card rv" style={{ "--i": 1 } as React.CSSProperties}>
        {SETTING_KEYS.map((key) => (
          <SettingRow key={key} settingKey={key} label={SETTING_META[key].label} help={SETTING_META[key].help} kind={SETTING_META[key].kind} value={settings[key]} />
        ))}
      </section>
      <JobsCard />
    </main>
  );
}
