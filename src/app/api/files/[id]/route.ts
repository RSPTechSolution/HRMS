import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/server/auth/current-user";
import { openDocument } from "@/server/documents/documents";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const viewer = await getCurrentUser();
  if (!viewer) return new Response("Sign in first.", { status: 401 });
  const { id } = await params;
  const doc = await openDocument(viewer, id);
  // 404 rather than 403, so people can't probe which documents exist.
  if (!doc) return new Response("Not found.", { status: 404 });
  return new Response(new Blob([doc.bytes as Uint8Array<ArrayBuffer>]), {
    status: 200,
    headers: {
      "content-type": doc.mimeType,
      "content-disposition": `inline; filename="${doc.fileName}"`,
      "x-content-type-options": "nosniff",
      "cache-control": "private, no-store",
    },
  });
}
