import { NextResponse } from "next/server";
import { syncMachineFinderInventory } from "../../../../lib/machinefinder-sync";
import { createServiceRoleClient } from "../../../../lib/supabase/service-role";

// Invoked on a schedule by Vercel Cron (see vercel.json). Vercel signs cron
// requests with this bearer token automatically when CRON_SECRET is set.
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createServiceRoleClient();
    const result = await syncMachineFinderInventory(supabase);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Sync failed." }, { status: 500 });
  }
}
