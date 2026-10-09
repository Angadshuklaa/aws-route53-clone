import type { Metadata } from "next";
import { Suspense } from "react";

import { SignInPage } from "@/components/auth/SignInPage";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <Suspense>
      <SignInPage />
    </Suspense>
  );
}
