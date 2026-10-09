"use client";

import Spinner from "@cloudscape-design/components/spinner";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { loginUrl, useAuth } from "@/lib/auth";

export function FullPageSpinner({ label }: { label: string }) {
  return (
    <div className="full-page-center" role="status" aria-live="polite">
      <Spinner size="large" />
      <span style={{ position: "absolute", left: -9999 }}>{label}</span>
    </div>
  );
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === "unauthenticated") router.replace(loginUrl(pathname + window.location.search));
  }, [status, router, pathname]);

  if (status !== "authenticated") return <FullPageSpinner label="Checking your session" />;
  return <>{children}</>;
}
