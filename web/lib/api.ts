const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

interface FetchOptions extends RequestInit {
  tenantId?: string;
}

async function apiFetch<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const { tenantId, ...init } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(tenantId ? { 'X-Tenant-ID': tenantId } : {}),
    ...(init.headers as Record<string, string> ?? {}),
  };

  const res = await fetch(`${API_URL}${path}`, { ...init, headers });
  const json = await res.json();

  if (!res.ok) {
    throw new Error(json.error ?? `API error ${res.status}`);
  }

  return json;
}

export const api = {
  get: <T>(path: string, opts?: FetchOptions) => apiFetch<T>(path, { ...opts, method: 'GET' }),
  post: <T>(path: string, body: unknown, opts?: FetchOptions) =>
    apiFetch<T>(path, { ...opts, method: 'POST', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown, opts?: FetchOptions) =>
    apiFetch<T>(path, { ...opts, method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string, opts?: FetchOptions) => apiFetch<T>(path, { ...opts, method: 'DELETE' }),
};
