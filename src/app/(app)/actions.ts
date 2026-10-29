"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/server/auth/current-user";
import { markAllRead } from "@/server/notifications";

export async function markAllNotificationsReadAction(): Promise<void> {
  const user = await requireUser();
  await markAllRead(user.userId);
  revalidatePath("/", "layout");
}
