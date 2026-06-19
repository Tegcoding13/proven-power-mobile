import { useEffect, useState } from "react";
import type { BusinessAccount } from "@proven-power/shared-types";
import { supabase } from "./supabase";
import { useAuth } from "./auth-context";

/**
 * Phase 1 customers are solo owners of a single business account (created
 * automatically at sign-up). Multi-business selection UI is Phase 2 — for now
 * this just returns the first active membership.
 */
export function useBusinessAccount() {
  const { session } = useAuth();
  const [businessAccount, setBusinessAccount] = useState<BusinessAccount | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!session?.user) {
      setBusinessAccount(null);
      setIsLoading(false);
      return;
    }

    let isCurrent = true;
    setIsLoading(true);

    (async () => {
      const { data: membership } = await supabase
        .from("business_account_members")
        .select("business_account_id")
        .eq("profile_id", session.user.id)
        .eq("status", "active")
        .limit(1)
        .maybeSingle();

      if (!isCurrent) return;

      if (!membership) {
        setBusinessAccount(null);
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
  }, [session?.user]);

  return { businessAccount, isLoading };
}
