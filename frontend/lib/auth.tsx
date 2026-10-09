"use client";

import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { setUnauthorizedHandler } from "@/lib/api/client";
import { authApi } from "@/lib/api/endpoints";
import type { CurrentUser } from "@/lib/types";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthContextValue {
  status: AuthStatus;
  user: CurrentUser | null;
  login: (credentials: { account_id: string; username: string; password: string }) => Promise<CurrentUser>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const LOGIN_PATH = "/login";

export function loginUrl(nextPath: string): string {
  return `${LOGIN_PATH}?next=${encodeURIComponent(nextPath)}`;
}

/** Only allow same-site relative redirects after sign-in. */
export function safeNextPath(raw: string | null): string {
  if (raw && raw.startsWith("/") && !raw.startsWith("//") && !raw.startsWith(LOGIN_PATH)) return raw;
  return "/route53/v2/hostedzones";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<CurrentUser | null>(null);

  // The session lives in an HTTP-only cookie, so ask the API who we are.
  useEffect(() => {
    const controller = new AbortController();
    authApi
      .me(controller.signal)
      .then((current) => {
        setUser(current);
        setStatus("authenticated");
      })
      .catch(() => {
        // 401 (no session) and network failures both lead to the sign-in page,
        // which reports connectivity problems when the user tries to sign in.
        if (controller.signal.aborted) return;
        setUser(null);
        setStatus("unauthenticated");
      });
    return () => controller.abort();
  }, []);

  // If any API call reports an expired session, send the user back to sign in.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null);
      setStatus("unauthenticated");
      if (!window.location.pathname.startsWith(LOGIN_PATH)) {
        router.replace(loginUrl(window.location.pathname + window.location.search));
      }
    });
    return () => setUnauthorizedHandler(null);
  }, [router, pathname]);

  const login = useCallback(async (credentials: { account_id: string; username: string; password: string }) => {
    const current = await authApi.login(credentials);
    setUser(current);
    setStatus("authenticated");
    return current;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      // A full navigation resets all client state and avoids racing the
      // protected-route redirect (which would add ?next=).
      window.location.replace(LOGIN_PATH);
    }
  }, []);

  const value = useMemo(() => ({ status, user, login, logout }), [status, user, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
