import { createContext } from "react";
import type { Shop } from "../types/api";

export interface AuthContextValue {
  shop: Shop | null;
  loading: boolean;
  sessionError: string;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (values: Record<string, string>) => Promise<void>;
  signOut: () => Promise<void>;
  updateShop: (shop: Shop | null) => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
