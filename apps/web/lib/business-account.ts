"use client";

import { useEffect, useState } from "react";
import type { BusinessAccount } from "@proven-power/shared-types";
import { createClient } from "./supabase/client";

/**
 * Phase 1 customers are solo owners of a single business account (created
 * automatically at sign-up). Multi-business selection UI is Phase 2.
 */
export function useBusinessAccount() {
  const [businessAccount, setBusinessAccount] = useState<BusinessAccount | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    let isCurrent = true;

    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        if (isCurrent) setIsLoading(false);
        return;
      }

      const { data: membership } = await supabase
        .from("business_account_members")
        .select("business_account_id")
        .eq("profile_id", userData.user.id)
        .eq("status", "active")
        .limit(1)
        .maybeSingle();

      if (!isCurrent) return;
      if (!membership) {
        setIsLoading(false);
        return;
      }

      const { data: account } = await supabase
        .from("business_accounts")
        .select("*")
        .eq("id", membership.business_account_id)
        .single();

      if (!isCurrent) return;
      setBusinessAccount(account ?? null);
      setIsLoading(false);
    })();

    return () => {
      isCurrent = false;
    };
  }, []);

  return { businessAccount, isLoading };
}
