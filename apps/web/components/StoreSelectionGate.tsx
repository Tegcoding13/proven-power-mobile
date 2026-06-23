"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useBusinessAccount } from "../lib/business-account";

const EXEMPT_PATHS = ["/login", "/signup", "/onboarding"];

export function StoreSelectionGate() {
  const pathname = usePathname();
  const router = useRouter();
  const { businessAccount, isLoading } = useBusinessAccount();

  useEffect(() => {
    if (isLoading) return;
    if (EXEMPT_PATHS.some((path) => pathname.startsWith(path))) return;
    if (businessAccount && !businessAccount.primary_location_id) {
      router.replace("/onboarding/choose-store");
    }
  }, [isLoading, businessAccount, pathname, router]);

  return null;
}
