"use client";
import { useState, useCallback } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("h2e_token");
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

export function useApi<T = any>(endpoint?: string) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const get = useCallback(async (params?: Record<string, string>) => {
    if (!endpoint) return;
    setLoading(true); setError(null);
    try {
      const url = new URL(`${API_BASE}${endpoint}`);
      if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
      const res = await fetch(url.toString(), { headers: authHeaders() });
      if (res.status === 401) { localStorage.removeItem("h2e_token"); setError("Session expired"); setLoading(false); return; }
      const json = await res.json();
      if (json.success) setData(json.data);
      else setError(json.error?.message || "Request failed");
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  }, [endpoint]);

  const post = useCallback(async (endpointOrBody: string | unknown, body?: unknown) => {
    setLoading(true); setError(null);
    const resolvedEndpoint = typeof endpointOrBody === "string" ? endpointOrBody : endpoint || "";
    const resolvedBody = typeof endpointOrBody === "string" ? body : endpointOrBody;
    try {
      const res = await fetch(`${API_BASE}${resolvedEndpoint}`, {
        method: "POST", headers: authHeaders(),
        body: JSON.stringify(resolvedBody),
      });
      if (res.status === 401) { localStorage.removeItem("h2e_token"); setError("Session expired"); setLoading(false); return null; }
      const json = await res.json();
      if (json.success) { setData(json.data); return json.data; }
      else setError(json.error?.message || "Request failed");
    } catch (e: any) { setError(e.message); }
    setLoading(false);
    return null;
  }, [endpoint]);

  const put = useCallback(async (ep: string, body: unknown) => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${API_BASE}${ep}`, { method: "PUT", headers: authHeaders(), body: JSON.stringify(body) });
      const json = await res.json();
      if (json.success) { setData(json.data); return json.data; }
      else setError(json.error?.message || "Request failed");
    } catch (e: any) { setError(e.message); }
    setLoading(false);
    return null;
  }, []);

  const del = useCallback(async (ep: string) => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${API_BASE}${ep}`, { method: "DELETE", headers: authHeaders() });
      const json = await res.json();
      if (json.success) { setData(json.data); return json.data; }
      else setError(json.error?.message || "Request failed");
    } catch (e: any) { setError(e.message); }
    setLoading(false);
    return null;
  }, []);

  return { data, loading, error, get, post, put, del, setData };
}
