import { redirect } from "next/navigation";
import { requireUser } from "@/server/auth/current-user";

/** "My profile" is the person's own page in the directory. */
export default async function ProfilePage() {
  const user = await requireUser();
  redirect(`/people/${user.employeeId}`);
}
