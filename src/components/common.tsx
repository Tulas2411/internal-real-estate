"use client";
import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { Building2, LoaderCircle, RotateCw } from "lucide-react";
import { label } from "@/lib/labels";
import { Button } from "./ui/button";
export class ApiError extends Error { constructor(public code: string, message: string, public details?: unknown) { super(message); } }
export async function request<T = unknown>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`/api/app/${path}`, { cache: "no-store", ...options, headers: { ...(options?.body instanceof FormData ? {} : { "Content-Type": "application/json" }), ...options?.headers } });
  const data = await response.json();
  if (!response.ok) {
    if (data.code === "UNAUTHENTICATED") window.location.assign("/login");
    if (data.code === "PASSWORD_CHANGE_REQUIRED") window.location.assign("/password");
    const fields = data.fieldErrors ? Object.entries(data.fieldErrors).map(([k, v]) => `${k}: ${(v as string[]).join(", ")}`).join(" · ") : "";
    throw new ApiError(data.code, data.message + (fields ? ` ${fields}` : ""), data.details);
  }
  return data;
}
export const mutate = <T = unknown,>(path: string, data: unknown, method = "POST") => request<T>(path, { method, body: JSON.stringify(data) });
export function useResource<T>(path: string) {
  const [data, setData] = useState<T>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const reload = useCallback(() => setRevision(v => v + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    let current = true;
    request<T>(path, { signal: controller.signal }).then(value => { if (current) { setData(value); setError(""); setLoading(false); } }).catch(e => { if (current && e.name !== "AbortError") { setError(e.message); setLoading(false); } });
    return () => { current = false; controller.abort(); };
  }, [path, revision]);
  return { data, error, loading, reload };
}
export function Loading() { return <div className="empty"><LoaderCircle className="spin" /><p>Đang tải dữ liệu…</p></div>; }
export function ErrorBox({ message, retry }: { message: string; retry?: () => void }) { return <div className="error-box" role="alert"><p>{message}</p>{retry && <Button variant="outline" onClick={retry}><RotateCw size={16} /> Thử lại</Button>}</div>; }
export function Empty({ children = "Chưa có dữ liệu phù hợp." }: { children?: React.ReactNode }) { return <div className="empty"><Building2 size={36} /><h3>Chưa có dữ liệu</h3><p>{children}</p></div>; }
export function Badge({ value }: { value: string }) { return <span className={`badge badge-${value.toLowerCase()}`}>{label(value)}</span>; }
export function Title({ title, description, children }: { title: string; description?: string; children?: React.ReactNode }) { return <header className="page-title"><div><p className="eyebrow">KHÔNG GIAN LÀM VIỆC</p><h1>{title}</h1>{description && <p className="muted">{description}</p>}</div><div className="actions">{children}</div></header>; }
export type Field = { name: string; label: string; type?: "text" | "number" | "textarea" | "date" | "password" | "email"; options?: { value: string; label: string }[]; required?: boolean; hint?: string; group?: string };
export const options = (values: readonly string[]) => values.map(value => ({ value, label: label(value) }));
export function DataForm({ fields, initial = {}, submit, submitLabel = "Lưu thay đổi", schema, transform, onDone }: { fields: Field[]; initial?: Record<string, unknown>; submit: (data: Record<string, unknown>) => Promise<unknown>; submitLabel?: string; schema?: z.ZodType; transform?: (data: Record<string, string>) => Record<string, unknown>; onDone?: () => void }) {
  const defaults = Object.fromEntries(fields.map(f => [f.name, initial[f.name] == null ? (f.options?.[0]?.value ?? "") : String(initial[f.name]).slice(0, f.type === "date" ? 10 : undefined)]));
  const { register, handleSubmit, formState: { isDirty, isSubmitting }, reset } = useForm<Record<string, string>>({ defaultValues: defaults });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  useEffect(() => {
    if (!isDirty) return;
    const before = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    const navigate = (e: MouseEvent) => { if ((e.target as Element).closest("a[href]") && !window.confirm("Bạn có thay đổi chưa lưu. Rời trang?")) e.preventDefault(); };
    window.addEventListener("beforeunload", before); document.addEventListener("click", navigate, true);
    return () => { window.removeEventListener("beforeunload", before); document.removeEventListener("click", navigate, true); };
  }, [isDirty]);
  return <form className="data-form" onSubmit={handleSubmit(async values => {
    setError(""); setSuccess(false);
    try {
      const data = transform ? transform(values) : values;
      if (schema) { const checked = schema.safeParse(data); if (!checked.success) { setError(checked.error.issues.map(x => `${fields.find(f => f.name === x.path[0])?.label ?? "Thông tin"}: ${x.message}`).join(" · ")); return; } }
      await submit(data); reset(values); setSuccess(true); onDone?.();
    } catch (e) { setError(e instanceof Error ? e.message : "Không thể lưu."); }
  })}>
    <div className="form-grid">{fields.map((field, index) => <div className={field.type === "textarea" ? "field full" : "field"} key={field.name}>
      {field.group && fields[index - 1]?.group !== field.group && <p className="field-group">{field.group}</p>}
      <label htmlFor={field.name}>{field.label}{field.required && " *"}</label>
      {field.options ? <select id={field.name} {...register(field.name)} required={field.required}>{field.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select> : field.type === "textarea" ? <textarea id={field.name} rows={3} {...register(field.name)} /> : <input id={field.name} type={field.type ?? "text"} step={field.type === "number" ? "any" : undefined} autoComplete={field.type === "password" ? "new-password" : undefined} {...register(field.name)} required={field.required} />}
      {field.hint && <small className="muted">{field.hint}</small>}
    </div>)}</div>
    {error && <ErrorBox message={error} />}{success && <p className="success" role="status">Đã lưu thành công.</p>}
    <div className="form-footer"><span className="muted">{isDirty ? "Có thay đổi chưa lưu" : ""}</span><Button disabled={isSubmitting}>{isSubmitting && <LoaderCircle size={16} className="spin" />}{isSubmitting ? "Đang lưu…" : submitLabel}</Button></div>
  </form>;
}
