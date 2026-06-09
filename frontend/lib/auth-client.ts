"use client";

import { useEffect } from "react";
import type { Tokens } from "./api";
import { useAuthStore } from "./auth-store";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api/v1";

const REFRESH_BUFFER_MS = 60_000;

let refreshInFlight: Promise<string | null> | null = null;

async function fetchRefresh(refreshToken: string): Promise<Tokens> {
  const res = await fetch(`${API_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  let body: { success?: boolean; data?: Tokens; error?: { message?: string } };
  try {
    body = await res.json();
  } catch {
    throw new Error("refresh failed");
  }
  if (!res.ok || body.success === false) {
    throw new Error(body.error?.message || "refresh failed");
  }
  return body.data as Tokens;
}

export async function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const { refreshToken, clearAuth, updateTokens } = useAuthStore.getState();
    if (!refreshToken) {
      clearAuth();
      return null;
    }

    try {
      const tokens = await fetchRefresh(refreshToken);
      updateTokens(tokens);
      return tokens.access_token;
    } catch {
      clearAuth();
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

function tokenNeedsRefresh(expiresAt: string | null): boolean {
  if (!expiresAt) return true;
  return new Date(expiresAt).getTime() <= Date.now() + REFRESH_BUFFER_MS;
}

export async function getValidAccessToken(token?: string | null): Promise<string | null> {
  const state = useAuthStore.getState();
  const accessToken = token ?? state.accessToken;
  if (!accessToken) return null;

  if (!tokenNeedsRefresh(state.tokenExpiresAt)) {
    return accessToken;
  }

  return refreshAccessToken();
}

export async function logoutUser(): Promise<void> {
  const { refreshToken, clearAuth } = useAuthStore.getState();

  if (refreshToken) {
    try {
      await fetch(`${API_URL}/auth/logout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
    } catch {
      // Best-effort revoke; always clear local session.
    }
  }

  clearAuth();
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const maybeRefresh = () => {
      const { accessToken, refreshToken, tokenExpiresAt } = useAuthStore.getState();
      if (!accessToken || !refreshToken) return;
      if (tokenNeedsRefresh(tokenExpiresAt)) {
        void refreshAccessToken();
      }
    };

    maybeRefresh();

    const interval = setInterval(maybeRefresh, 60_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") maybeRefresh();
    };

    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return children;
}
