import Link from "next/link";
import { createClient } from "../lib/supabase/server";
import { logOut } from "./(auth)/actions";

export default async function StaffHomePage() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub;

  const [
    { data: profile },
    { data: staffRole },
    { count: newServiceCount },
    { count: newPartsCount },
    { count: newMessageCount },
  ] = await Promise.all([
    userId ? supabase.from("profiles").select("*").eq("id", userId).single() : Promise.resolve({ data: null }),
    userId ? supabase.from("staff_roles").select("department, dealership_location_id").eq("profile_id", userId).single() : Promise.resolve({ data: null }),
    supabase.from("service_requests").select("*", { count: "exact", head: true }).eq("status", "submitted"),
    supabase.from("parts_requests").select("*", { count: "exact", head: true }).eq("status", "submitted"),
    supabase.from("message_threads").select("*", { count: "exact", head: true }).eq("status", "open"),
  ]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-3xl font-bold text-green-700">Proven Power — Staff</h1>
      <p className="text-lg text-black">
        Welcome{profile?.full_name ? `, ${profile.full_name}` : ""}
        {staffRole?.department ? ` (${staffRole.department})` : ""}.
      </p>

      <div className="flex flex-wrap justify-center gap-3">
        <Link href="/service" className="relative min-h-12 flex items-center rounded-lg bg-green-600 px-6 font-semibold text-white">
          Service Queue
          {newServiceCount ? (
            <span className="absolute -top-2 -right-2 min-w-[22px] h-[22px] px-1 rounded-full bg-red-600 text-white text-xs font-bold flex items-center justify-center">
              {newServiceCount > 99 ? "99+" : newServiceCount}
            </span>
          ) : null}
        </Link>
        <Link href="/parts" className="relative min-h-12 flex items-center rounded-lg bg-green-600 px-6 font-semibold text-white">
          Parts Queue
          {newPartsCount ? (
            <span className="absolute -top-2 -right-2 min-w-[22px] h-[22px] px-1 rounded-full bg-red-600 text-white text-xs font-bold flex items-center justify-center">
              {newPartsCount > 99 ? "99+" : newPartsCount}
            </span>
          ) : null}
        </Link>
        <Link href="/messages" className="relative min-h-12 flex items-center rounded-lg bg-green-600 px-6 font-semibold text-white">
          Message Inbox
          {newMessageCount ? (
            <span className="absolute -top-2 -right-2 min-w-[22px] h-[22px] px-1 rounded-full bg-red-600 text-white text-xs font-bold flex items-center justify-center">
              {newMessageCount > 99 ? "99+" : newMessageCount}
            </span>
          ) : null}
        </Link>
        <Link href="/inventory" className="min-h-12 flex items-center rounded-lg bg-green-600 px-6 font-semibold text-white">
          Inventory
        </Link>
        <Link href="/winter-storage" className="min-h-12 flex items-center rounded-lg bg-green-600 px-6 font-semibold text-white">
          Winter Storage
        </Link>
        <Link href="/promotions" className="min-h-12 flex items-center rounded-lg bg-green-600 px-6 font-semibold text-white">
          Promotions
        </Link>
        <Link href="/notifications" className="min-h-12 flex items-center rounded-lg bg-green-600 px-6 font-semibold text-white">
          Notification Rules
        </Link>
      </div>

      <form action={logOut}>
        <button type="submit" className="min-h-12 rounded-lg bg-gray-100 px-6 font-semibold text-black">
          Sign Out
        </button>
      </form>
    </div>
  );
}
