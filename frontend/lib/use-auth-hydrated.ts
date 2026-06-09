"use client";

import { useAuthStore } from "./auth-store";

export function useAuthHydrated(): boolean {
  return useAuthStore((s) => s._hasHydrated);
}
