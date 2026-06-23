"use client";

import { useEffect } from "react";
import { createClient } from "../../lib/supabase/client";

export function MarkReadOnView({ ids }: { ids: string[] }) {
  useEffect(() => {
    if (ids.length === 0) return;
    const supabase = createClient();
    supabase.from("notifications").update({ is_read: true }).in("id", ids).then();
  }, [ids]);

  return null;
}
