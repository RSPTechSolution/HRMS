import "server-only";
import { db } from "@/lib/db";
import { can } from "@/domain/auth/permissions";
import type { CurrentUser } from "@/domain/auth/types";
import { DOCUMENT_LABELS, isDocumentCategory, MAX_DOCUMENT_BYTES, safeFileName, sniffFileType, type DocumentCategory } from "@/domain/documents/files";
import { writeAudit } from "@/server/audit";
import { notifyEmployees } from "@/server/notifications";
import { localFileStore, type FileStore } from "./store";

type Result = { ok: true; id: string } | { ok: false; error: string };
const DENIED: Result = { ok: false, error: "You don't have permission to do that." };

/** Documents are personal: the employee and HR/Admin only — not managers (spec §5.3). */
const canAccess = (viewer: CurrentUser, employeeId: string) => viewer.employeeId === employeeId || can(viewer, "employees.manage");

export async function uploadDocument(
  actor: CurrentUser,
  input: { employeeId: string; category: string; file: File | null },
  store: FileStore = localFileStore(),
): Promise<Result> {
  if (!canAccess(actor, input.employeeId)) return DENIED;
  const file = input.file;
  if (!file || file.size === 0) return { ok: false, error: "Choose a file to upload." };
  if (file.size > MAX_DOCUMENT_BYTES) return { ok: false, error: "Files can be up to 10 MB." };
  if (!isDocumentCategory(input.category)) return { ok: false, error: "Pick a document type." };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mimeType = sniffFileType(bytes);
  if (!mimeType) return { ok: false, error: "Upload a PDF, JPG or PNG." };
  if (!(await db.employee.findUnique({ where: { id: input.employeeId }, select: { id: true } }))) return { ok: false, error: "That person doesn't exist." };

  const storageKey = await store.save(bytes);
  try {
    const id = await db.$transaction(async (tx) => {
      const doc = await tx.document.create({
        data: { employeeId: input.employeeId, category: input.category, fileName: safeFileName(file.name), mimeType, size: bytes.byteLength, storageKey, uploadedById: actor.employeeId },
      });
      await writeAudit(tx, { actorId: actor.userId, action: "document.upload", entityType: "Document", entityId: doc.id, after: { employeeId: input.employeeId, category: input.category, size: bytes.byteLength } });
      return doc.id;
    });
    return { ok: true, id };
  } catch (err) {
    await store.remove(storageKey);
    throw err;
  }
}

export async function listDocuments(viewer: CurrentUser, employeeId: string) {
  if (!canAccess(viewer, employeeId)) return null;
  const docs = await db.document.findMany({ where: { employeeId }, orderBy: { createdAt: "desc" } });
  return docs.map((d) => ({
    id: d.id,
    category: d.category as DocumentCategory,
    label: DOCUMENT_LABELS[d.category as DocumentCategory] ?? d.category,
    fileName: d.fileName,
    size: d.size,
    verified: d.verifiedAt !== null,
    uploadedAt: d.createdAt.toISOString(),
  }));
}

export async function verifyDocument(actor: CurrentUser, id: string): Promise<Result> {
  if (!can(actor, "employees.manage")) return DENIED;
  const doc = await db.document.findUnique({ where: { id } });
  if (!doc) return { ok: false, error: "That document doesn't exist." };
  await db.$transaction(async (tx) => {
    await tx.document.update({ where: { id }, data: { verifiedAt: new Date(), verifiedById: actor.employeeId } });
    await writeAudit(tx, { actorId: actor.userId, action: "document.verify", entityType: "Document", entityId: id });
    const label = DOCUMENT_LABELS[doc.category as DocumentCategory] ?? "document";
    await notifyEmployees(tx, [doc.employeeId], { kind: "document.verified", title: `HR verified your ${label}`, link: `/people/${doc.employeeId}?tab=documents` });
  });
  return { ok: true, id };
}

/** Null both when the document doesn't exist and when the viewer may not see it. */
export async function openDocument(viewer: CurrentUser, id: string, store: FileStore = localFileStore()) {
  const doc = await db.document.findUnique({ where: { id } });
  if (!doc || !canAccess(viewer, doc.employeeId)) return null;
  return { bytes: await store.read(doc.storageKey), mimeType: doc.mimeType, fileName: doc.fileName };
}
