import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { loadCurrentUser } from "@/server/auth/users";
import { localFileStore } from "@/server/documents/store";
import { listDocuments, openDocument, uploadDocument, verifyDocument } from "@/server/documents/documents";
import { makeEmployee, resetDb } from "../helpers/db";

const store = localFileStore(fs.mkdtempSync(path.join(os.tmpdir(), "lnp-docs-")));
const pdf = (name = "pan.pdf", size?: number) => {
  const body = new TextEncoder().encode("%PDF-1.7\nhello");
  const data = size ? new Uint8Array(size).fill(65) : body;
  if (size) data.set(body);
  return new File([data], name, { type: "application/pdf" });
};

async function org() {
  const hr = await makeEmployee({ name: "Neha Verma", isHR: true });
  const manager = await makeEmployee({ name: "Ananya Sharma" });
  const engineer = await makeEmployee({ name: "Arjun Mehta", managerId: manager.employee.id });
  const colleague = await makeEmployee({ name: "Riya Kapoor" });
  const me = async (u: { user: { id: string } }) => (await loadCurrentUser(u.user.id))!;
  return { hr, manager, engineer, colleague, me };
}

describe("documents", () => {
  beforeEach(resetDb);

  it("lets people upload their own documents and read them back", async () => {
    const { engineer, me } = await org();
    const u = await me(engineer);
    const res = await uploadDocument(u, { employeeId: engineer.employee.id, category: "ID_PROOF", file: pdf() }, store);
    if (!res.ok) throw new Error(res.error);
    const list = (await listDocuments(u, engineer.employee.id))!;
    expect(list).toEqual([expect.objectContaining({ id: res.id, category: "ID_PROOF", label: "ID proof", fileName: "pan.pdf", verified: false })]);
    const opened = (await openDocument(u, res.id, store))!;
    expect(opened.mimeType).toBe("application/pdf");
    expect(new TextDecoder().decode(opened.bytes)).toContain("%PDF");
    expect(await db.auditLog.count({ where: { action: "document.upload", entityId: res.id } })).toBe(1);
  });

  it("lets HR upload for anyone but not managers, and hides documents from colleagues", async () => {
    const { hr, manager, engineer, colleague, me } = await org();
    const byHr = await uploadDocument(await me(hr), { employeeId: engineer.employee.id, category: "OFFER_LETTER", file: pdf("offer.pdf") }, store);
    if (!byHr.ok) throw new Error(byHr.error);
    expect(await uploadDocument(await me(manager), { employeeId: engineer.employee.id, category: "OTHER", file: pdf() }, store)).toEqual({
      ok: false,
      error: "You don't have permission to do that.",
    });
    expect(await listDocuments(await me(manager), engineer.employee.id)).toBeNull();
    expect(await listDocuments(await me(colleague), engineer.employee.id)).toBeNull();
    expect(await openDocument(await me(colleague), byHr.id, store)).toBeNull();
  });

  it("checks the file itself, its size and its category", async () => {
    const { engineer, me } = await org();
    const u = await me(engineer);
    const fake = new File([new TextEncoder().encode("<html>not a pdf</html>")], "cv.pdf", { type: "application/pdf" });
    expect(await uploadDocument(u, { employeeId: engineer.employee.id, category: "OTHER", file: fake }, store)).toEqual({ ok: false, error: "Upload a PDF, JPG or PNG." });
    expect(await uploadDocument(u, { employeeId: engineer.employee.id, category: "OTHER", file: pdf("big.pdf", 11 * 1024 * 1024) }, store)).toEqual({ ok: false, error: "Files can be up to 10 MB." });
    expect(await uploadDocument(u, { employeeId: engineer.employee.id, category: "PASSPORT", file: pdf() }, store)).toEqual({ ok: false, error: "Pick a document type." });
    expect(await uploadDocument(u, { employeeId: engineer.employee.id, category: "OTHER", file: new File([], "") }, store)).toEqual({ ok: false, error: "Choose a file to upload." });
    expect(await db.document.count()).toBe(0);
  });

  it("lets HR verify a document and tells the owner", async () => {
    const { hr, engineer, me } = await org();
    const res = await uploadDocument(await me(engineer), { employeeId: engineer.employee.id, category: "ID_PROOF", file: pdf() }, store);
    if (!res.ok) throw new Error(res.error);
    expect(await verifyDocument(await me(engineer), res.id)).toEqual({ ok: false, error: "You don't have permission to do that." });
    expect(await verifyDocument(await me(hr), res.id)).toEqual({ ok: true, id: res.id });
    expect((await db.document.findUniqueOrThrow({ where: { id: res.id } })).verifiedById).toBe(hr.employee.id);
    const note = await db.notification.findFirstOrThrow({ where: { userId: engineer.user.id, kind: "document.verified" } });
    expect(note.title).toBe("HR verified your ID proof");
  });
});
