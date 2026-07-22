import { NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("send_maintenance_due_notifications");

  if (error) {
    console.error("Maintenance reminder cron error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ notified: data });
}
