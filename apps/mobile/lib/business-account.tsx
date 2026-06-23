import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { BusinessAccount } from "@proven-power/shared-types";
import { supabase } from "./supabase";
import { useAuth } from "./auth-context";

/**
 * Phase 1 customers are solo owners of a single business account (created
 * automatically at sign-up). Multi-business selection UI is Phase 2 — for now
 * this just returns the first active membership.
 *
 * Shared via context (not a plain per-component hook) specifically so every
 * consumer sees the same data at the same time. Independent fetches per
 * component caused a real bug: right after a customer picked their store on
 * the onboarding screen, the root navigator's own stale copy still thought
 * primary_location_id was null and bounced them straight back to onboarding.
 */
interface BusinessAccountContextValue {
  businessAccount: BusinessAccount | null;
  isLoading: boolean;
  refresh: () => Promise<void>;
}

const BusinessAccountContext = createContext<BusinessAccountContextValue>({
  businessAccount: null,
  isLoading: true,
  refresh: async () => {},
});

export function BusinessAccountProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [businessAccount, setBusinessAccount] = useState<BusinessAccount | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchBusinessAccount = useCallback(async (): Promise<BusinessAccount | null> => {
    if (!session?.user) return null;

    const { data: membership } = await supabase
      .from("business_account_members")
      .select("business_account_id")
      .eq("profile_id", session.user.id)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    if (!membership) return null;

    const { data: account } = await supabase
      .from("business_accounts")
      .select("*")
      .eq("id", membership.business_account_id)
      .single();

    return account ?? null;
  }, [session?.user]);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setBusinessAccount(await fetchBusinessAccount());
    setIsLoading(false);
  }, [fetchBusinessAccount]);

  useEffect(() => {
    setIsLoading(true);
    fetchBusinessAccount().then((account) => {
      setBusinessAccount(account);
      setIsLoading(false);
    });
  }, [fetchBusinessAccount]);

  return (
    <BusinessAccountContext.Provider value={{ businessAccount, isLoading, refresh }}>
      {children}
    </BusinessAccountContext.Provider>
  );
}

export function useBusinessAccount() {
  return useContext(BusinessAccountContext);
}
