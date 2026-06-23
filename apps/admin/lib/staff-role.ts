"use client";

import { useEffect, useState } from "react";
import type { StaffRole } from "@proven-power/shared-types";
import { createClient } from "./supabase/client";

/**
 * The logged-in staff member's own role row — used to default queue filters
 * to their assigned store (managers/staff with no location assigned see
 * everything, matching staff_roles.dealership_location_id's existing
 * null-means-all-locations convention).
 */
export function useStaffRole() {
  const [staffRole, setStaffRole] = useState<StaffRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        setIsLoading(false);
        return;
      }
      const { data } = await supabase
        .from("staff_roles")
        .select("*")
        .eq("profile_id", userData.user.id)
        .eq("is_active", true)
        .maybeSingle();
      setStaffRole(data ?? null);
      setIsLoading(false);
    })();
  }, []);

  return { staffRole, isLoading };
}
