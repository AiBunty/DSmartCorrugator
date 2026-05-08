import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface AuthUser {
  user_id: string;
  tenant_id: string;
  email: string;
  role: "owner" | "admin" | "manager" | "salesperson" | "viewer";
  display_name: string;
  plan: "starter" | "professional" | "enterprise";
  currency_code: string;
  locale: string;
}

interface AuthState {
  user: AuthUser | null;
  setUser: (user: AuthUser) => void;
  clearUser: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      setUser: (user) => set({ user }),
      clearUser: () => set({ user: null }),
    }),
    {
      name: "bcp-auth",
    }
  )
);
