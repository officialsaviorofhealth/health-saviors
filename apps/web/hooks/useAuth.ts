"use client";
import { useState, useEffect, useCallback } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

interface AuthUser {
  id: string;
  name?: string;
  email?: string;
  streakDays: number;
  level: number;
  totalPoints: string;
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Check for existing token on mount
  useEffect(() => {
    const stored = localStorage.getItem("h2e_token");
    const storedUser = localStorage.getItem("h2e_user");
    if (stored && storedUser) {
      setToken(stored);
      try { setUser(JSON.parse(storedUser)); } catch {}
    }
    setLoading(false);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (data.success) {
        setToken(data.data.token);
        setUser(data.data.user);
        localStorage.setItem("h2e_token", data.data.token);
        localStorage.setItem("h2e_user", JSON.stringify(data.data.user));
        return data.data;
      }
      throw new Error(data.error?.message || "Login failed");
    } catch (e: any) {
      console.error("Auth login failed:", e);
      throw e;
    }
  }, []);

  const register = useCallback(async (email: string, password: string, name?: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, ...(name ? { name } : {}) }),
      });
      const data = await res.json();
      if (data.success) {
        setToken(data.data.token);
        setUser(data.data.user);
        localStorage.setItem("h2e_token", data.data.token);
        localStorage.setItem("h2e_user", JSON.stringify(data.data.user));
        return data.data;
      }
      throw new Error(data.error?.message || "Registration failed");
    } catch (e: any) {
      console.error("Auth register failed:", e);
      throw e;
    }
  }, []);

  const disconnect = useCallback(() => {
    setToken(null);
    setUser(null);
    localStorage.removeItem("h2e_token");
    localStorage.removeItem("h2e_user");
  }, []);

  const isAuthenticated = !!token && !!user;

  return { user, token, loading, isAuthenticated, login, register, disconnect };
}
