"use client";
import { useActionState, useEffect, useRef } from "react";
import { Icon } from "@/components/ui/Icon";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { errorProps, FormError } from "@/components/ui/FormFeedback";
import { useToast } from "@/components/ui/Toaster";
import { DOCUMENT_CATEGORIES, DOCUMENT_LABELS } from "@/domain/documents/files";
import { uploadDocumentAction, verifyDocumentAction } from "@/app/(app)/people/actions";

type Doc = { id: string; label: string; fileName: string; size: number; verified: boolean; uploadedAt: string };

const kb = (bytes: number) => (bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

export function DocumentsPanel({ employeeId, documents, canVerify, canUpload }: { employeeId: string; documents: Doc[]; canVerify: boolean; canUpload: boolean }) {
  const [state, action] = useActionState(uploadDocumentAction, undefined);
  const toast = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.message) {
      toast("Document uploaded");
      formRef.current?.reset();
    }
  }, [state, toast]);

  return (
    <div className="grid">
      <div className="card s8">
        <div className="card-h"><span className="card-t">Documents</span><span className="card-a">{documents.length} on file</span></div>
        {documents.length === 0 ? <p className="muted">No documents yet.</p> : null}
        {documents.map((d) => (
          <div className="row" key={d.id}>
            <span className="nt-ic"><Icon name="file" /></span>
            <div>
              <div className="t">{d.label}</div>
              <div className="s">
                <a className="link" href={`/api/files/${d.id}`} target="_blank" rel="noopener">{d.fileName}</a> · {kb(d.size)}
              </div>
            </div>
            <span style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
              {d.verified ? <span className="pill">Verified</span> : <span className="pill warn">Not verified</span>}
              {canVerify && !d.verified ? (
                <form action={verifyDocumentAction.bind(null, d.id, employeeId)}>
                  <button type="submit" className="btn btn-ghost" aria-label={`Verify ${d.label}`}>Verify</button>
                </form>
              ) : null}
            </span>
          </div>
        ))}
      </div>
      {canUpload ? (
        <form ref={formRef} action={action} className="card s4" noValidate>
          <div className="card-h"><span className="card-t">Upload</span></div>
          <input type="hidden" name="employeeId" value={employeeId} />
          <label className="label" htmlFor="doc-category">Document type</label>
          <select id="doc-category" name="category" className="field" defaultValue="" {...errorProps("doc-error", state?.error)}>
            <option value="">Choose…</option>
            {DOCUMENT_CATEGORIES.map((c) => <option key={c} value={c}>{DOCUMENT_LABELS[c]}</option>)}
          </select>
          <label className="label" htmlFor="doc-file">File (PDF, JPG or PNG, up to 10 MB)</label>
          <input id="doc-file" name="file" type="file" accept="application/pdf,image/png,image/jpeg" className="field" {...errorProps("doc-error", state?.error)} />
          {state?.error ? <FormError id="doc-error">{state.error}</FormError> : null}
          <div className="actions-row"><SubmitButton><Icon name="upload" /> Upload</SubmitButton></div>
        </form>
      ) : null}
    </div>
  );
}
