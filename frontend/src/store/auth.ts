import { create } from "zustand";

import { authApi } from "@/api/auth";
import { usersApi } from "@/api/users";
import { queryClient } from "@/lib/queryClient";
import type { LoginRequest, RegisterRequest, UserProfile } from "@/types/api";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthState {
  user: UserProfile | null;
  status: AuthStatus;
  /** Restore the session on app load by probing /users/me. */
  bootstrap: () => Promise<void>;
  login: (body: LoginRequest) => Promise<void>;
  register: (body: RegisterRequest) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: UserProfile) => void;
  /** Called by the http layer when the session is irrecoverable. */
  clear: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  status: "loading",

  bootstrap: async () => {
    try {
      const user = await usersApi.me();
      set({ user, status: "authenticated" });
    } catch {
      set({ user: null, status: "unauthenticated" });
    }
  },

  login: async (body) => {
    const res = await authApi.login(body);
    set({ user: res.user, status: "authenticated" });
  },

  register: async (body) => {
    const res = await authApi.register(body);
    set({ user: res.user, status: "authenticated" });
  },

  logout: async () => {
    try {
      await authApi.logout();
    } finally {
      set({ user: null, status: "unauthenticated" });
      queryClient.clear();
    }
  },

  setUser: (user) => set({ user }),
  clear: () => {
    set({ user: null, status: "unauthenticated" });
    queryClient.clear();
  },
}));
