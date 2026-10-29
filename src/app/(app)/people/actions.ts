"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { requireUser } from "@/server/auth/current-user";
import { createEmployee, sendInvite, updateEmployee, updateMyDetails } from "@/server/people/employees";
import { createDepartment, createDesignation, renameDepartment, renameDesignation } from "@/server/people/structure";
import { uploadDocument, verifyDocument } from "@/server/documents/documents";

export type PeopleFormState = { error?: string; field?: string; message?: string } | undefined;

const fields = (fd: FormData) => Object.fromEntries([...fd.entries()].filter(([, v]) => typeof v === "string")) as Record<string, string>;

export async function createEmployeeAction(_prev: PeopleFormState, fd: FormData): Promise<PeopleFormState> {
  const user = await requireUser();
  const result = await createEmployee(user, fields(fd));
  if (!result.ok) return { error: result.error, field: result.field };
  after(() => sendInvite(result.id));
  revalidatePath("/people");
  redirect(`/people/${result.id}?invited=1`);
}

export async function updateEmployeeAction(id: string, _prev: PeopleFormState, fd: FormData): Promise<PeopleFormState> {
  const user = await requireUser();
  const result = await updateEmployee(user, id, fields(fd));
  if (!result.ok) return { error: result.error, field: result.field };
  revalidatePath(`/people/${id}`);
  redirect(`/people/${id}?saved=1`);
}

export async function updateMyDetailsAction(_prev: PeopleFormState, fd: FormData): Promise<PeopleFormState> {
  const user = await requireUser();
  const result = await updateMyDetails(user, fields(fd));
  if (!result.ok) return { error: result.error, field: result.field };
  revalidatePath(`/people/${user.employeeId}`);
  redirect(`/people/${user.employeeId}?tab=personal&saved=1`);
}

export async function uploadDocumentAction(_prev: PeopleFormState, fd: FormData): Promise<PeopleFormState> {
  const user = await requireUser();
  const file = fd.get("file");
  const employeeId = String(fd.get("employeeId") ?? "");
  const result = await uploadDocument(user, { employeeId, category: String(fd.get("category") ?? ""), file: file instanceof File ? file : null });
  if (!result.ok) return { error: result.error };
  revalidatePath(`/people/${employeeId}`);
  return { message: "Uploaded." };
}

export async function verifyDocumentAction(documentId: string, employeeId: string): Promise<void> {
  const user = await requireUser();
  await verifyDocument(user, documentId);
  revalidatePath(`/people/${employeeId}`);
}

export async function saveStructureAction(_prev: PeopleFormState, fd: FormData): Promise<PeopleFormState> {
  const user = await requireUser();
  const kind = String(fd.get("kind"));
  const id = String(fd.get("id") ?? "");
  const name = String(fd.get("name") ?? "");
  const level = Number(fd.get("level") ?? 1);
  const result =
    kind === "department"
      ? id ? await renameDepartment(user, id, name) : await createDepartment(user, name)
      : id ? await renameDesignation(user, id, name, level) : await createDesignation(user, name, level);
  if (!result.ok) return { error: result.error };
  revalidatePath("/people/structure");
  return { message: "Saved." };
}
