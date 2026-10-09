"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";

interface FollowDetail {
  href?: string;
  external?: boolean;
}

// Same shape as Cloudscape's onFollow handlers (Link, BreadcrumbGroup, SideNavigation).
type FollowHandler = (event: CustomEvent<FollowDetail>) => void;

/**
 * Cloudscape links render real anchors. This turns plain left-clicks into
 * client-side navigation while leaving new-tab clicks to the browser.
 */
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
