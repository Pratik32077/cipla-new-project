export const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export async function apiFetch(path: string, options: RequestInit = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      ...(options.body && !(options.body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
      ...options.headers,
    },
  });
  return res;
}

export async function uploadFile(
  url: string,
  fieldName: string,
  file: File
): Promise<Response> {
  const form = new FormData();
  form.append(fieldName, file);
  return fetch(`${BASE}${url}`, {
    method: "POST",
    credentials: "include",
    body: form,
  });
}

export function exportUrl(path: string) {
  return `${BASE}${path}`;
}
