"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Tokens, User } from "./api";

type AuthState = {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  tokenExpiresAt: string | null;
  _hasHydrated: boolean;
  setHasHydrated: (value: boolean) => void;
  setAuth: (user: User, tokens: Tokens) => void;
  updateTokens: (tokens: Tokens) => void;
  clearAuth: () => void;
  logout: () => void;
  isAuthenticated: () => boolean;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      tokenExpiresAt: null,
      _hasHydrated: false,
      setHasHydrated: (value) => set({ _hasHydrated: value }),
      setAuth: (user, tokens) =>
        set({
          user,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          tokenExpiresAt: tokens.expires_at,
        }),
      updateTokens: (tokens) =>
        set({
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          tokenExpiresAt: tokens.expires_at,
        }),
      clearAuth: () =>
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          tokenExpiresAt: null,
        }),
      logout: () => get().clearAuth(),
      isAuthenticated: () => !!get().accessToken,
    }),
    {
      name: "eventra-auth",
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        tokenExpiresAt: state.tokenExpiresAt,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
