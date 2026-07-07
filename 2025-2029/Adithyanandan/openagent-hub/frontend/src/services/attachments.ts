export interface AttachmentMeta {
  id: string;
  filename: string;
  content_type: string;
  size: number;
}

export async function uploadAttachment(file: File, token: string): Promise<AttachmentMeta> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch('/api/attachments', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Upload failed' }));
    throw new Error(err.detail || 'Upload failed');
  }
  return res.json();
}

export function attachmentUrl(id: string): string {
  return `/api/attachments/${id}`;
}
