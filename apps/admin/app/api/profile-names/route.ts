"use server";

import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "../../../lib/supabase/service-role";

export async function POST(req: NextRequest) {
  const { ids } = await req.json() as { ids: string[] };
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({});
  }
  const supabase = createServiceRoleClient();
  const { data } = await supabase.from("profiles").select("id, full_name").in("id", ids);
  const map: Record<string, string> = {};
  for (const p of data ?? []) {
    map[p.id] = p.full_name ?? "Unknown";
  }
  return NextResponse.json(map);
}
