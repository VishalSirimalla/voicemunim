import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { ApiError, request, tokenStore } from "../services/api";
import type { Shop } from "../types/api";
import { AuthContext } from "./auth-context";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [shop, setShop] = useState<Shop | null>(null);
  const [loading, setLoading] = useState(() => Boolean(tokenStore.get()));
  const [sessionError, setSessionError] = useState("");

  useEffect(() => {
    if (!tokenStore.get()) return;
    request<Shop>("/auth/me")
      .then(setShop)
      .catch((error: unknown) => {
        if (error instanceof ApiError && error.status === 401) {
          tokenStore.clear();
          setShop(null);
        } else {
          setSessionError(error instanceof Error ? error.message : "Could not verify your saved session.");
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const saveSession = useCallback((data: { token: string; shop: Shop }) => {
    tokenStore.set(data.token);
    setSessionError("");
    setShop(data.shop);
  }, []);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const data = await request<{ token: string; shop: Shop }>("/auth/login", {
        method: "POST",
        body: { email, password },
        token: null,
      });
      saveSession(data);
    },
    [saveSession],
  );

  const signUp = useCallback(
    async (values: Record<string, string>) => {
      const data = await request<{ token: string; shop: Shop }>("/auth/register", {
        method: "POST",
        body: values,
        token: null,
      });
      saveSession(data);
    },
    [saveSession],
  );

  const signOut = useCallback(async () => {
    try {
      await request("/auth/logout", { method: "POST" });
    } finally {
      tokenStore.clear();
      setShop(null);
    }
  }, []);

  const value = useMemo(
    () => ({ shop, loading, sessionError, signIn, signUp, signOut, updateShop: setShop }),
    [shop, loading, sessionError, signIn, signUp, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
