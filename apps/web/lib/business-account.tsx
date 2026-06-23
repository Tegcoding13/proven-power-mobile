"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { BusinessAccount } from "@proven-power/shared-types";
import { createClient } from "./supabase/client";

/**
 * Phase 1 customers are solo owners of a single business account (created
 * automatically at sign-up). Multi-business selection UI is Phase 2.
 *
 * Shared via context (not a plain per-component hook) specifically so every
 * consumer — including StoreSelectionGate — sees the same data at the same
 * time. Independent fetches per component caused a real bug: right after a
 * customer picked their store, the gate's own stale copy would still think
 * primary_location_id was null and bounce them straight back.
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
  const [businessAccount, setBusinessAccount] = useState<BusinessAccount | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchBusinessAccount = useCallback(async (): Promise<BusinessAccount | null> => {
    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return null;

    const { data: membership } = await supabase
      .from("business_account_members")
      .select("business_account_id")
      .eq("profile_id", userData.user.id)
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
  }, []);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setBusinessAccount(await fetchBusinessAccount());
    setIsLoading(false);
  }, [fetchBusinessAccount]);

  useEffect(() => {
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
