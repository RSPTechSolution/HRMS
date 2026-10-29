import { Avatar } from "@/components/ui/Avatar";
import { ToastProvider } from "@/components/ui/Toaster";
import { CommandMenu } from "@/components/shell/CommandMenu";
import { NotificationsBell } from "@/components/shell/NotificationsBell";
import { SearchTrigger } from "@/components/shell/SearchTrigger";
import { Sidebar } from "@/components/shell/Sidebar";
import { ThemeToggle } from "@/components/shell/ThemeToggle";
import { navFor } from "@/components/shell/nav";
import { primaryRoleLabel } from "@/domain/auth/permissions";
import { requireUser } from "@/server/auth/current-user";
import { getShellView } from "@/server/shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const { items, unread } = await getShellView(user.userId);
  const links = navFor(user);

  return (
    <ToastProvider>
      <div className="app">
        <Sidebar links={links} fullName={user.fullName} role={primaryRoleLabel(user)} />
        <div className="main">
          <header className="top">
            <SearchTrigger />
            <div className="top-actions">
              <ThemeToggle />
              <NotificationsBell items={items} unread={unread} />
              <Avatar name={user.fullName} />
            </div>
          </header>
          {children}
        </div>
      </div>
      <CommandMenu links={links} />
    </ToastProvider>
  );
}
