import { QueryClient } from "@tanstack/react-query";

async function fetchJSON(url: string, options?: RequestInit) {
  const base = (window as any).__API_BASE__ ?? "";
  const fullUrl = url.startsWith("http") ? url : `${base}${url}`;
  const res = await fetch(fullUrl, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status}: ${text}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: ({ queryKey }) => fetchJSON(queryKey[0] as string),
      staleTime: 0,           // always consider data stale → refetch on mount
      gcTime: 5 * 60_000,     // keep in cache 5 min
      refetchOnMount: true,   // refetch every time component mounts (page nav / refresh)
      refetchOnWindowFocus: true, // refetch when tab regains focus
      retry: 1,
    },
  },
});

export async function apiRequest(method: string, url: string, body?: unknown) {
  return fetchJSON(url, {
    method,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}
