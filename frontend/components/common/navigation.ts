"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";

interface FollowDetail {
  href?: string;
  external?: boolean;
}

type FollowHandler = (event: CustomEvent<FollowDetail>) => void;

export function useFollow(): FollowHandler {
  const router = useRouter();
  return useCallback(
    (event: CustomEvent<FollowDetail>) => {
      const { href, external } = event.detail;
      if (!href || external) return;
      event.preventDefault();
      router.push(href);
    },
    [router],
  );
}
