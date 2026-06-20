import Link from "next/link";
import { createClient } from "../lib/supabase/server";
import { logOut } from "./(auth)/actions";

export default async function StaffHomePage() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub;

  const { data: profile } = userId
    ? await supabase.from("profiles").select("*").eq("id", userId).single()
    : { data: null };

  const { data: staffRole } = userId
    ? await supabase.from("staff_roles").select("department, dealership_location_id").eq("profile_id", userId).single()
    : { data: null };

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-3xl font-bold text-green-700">Proven Power — Staff</h1>
      <p className="text-lg text-black">
        Welcome{profile?.full_name ? `, ${profile.full_name}` : ""}
        {staffRole?.department ? ` (${staffRole.department})` : ""}.
      </p>
      <p className="max-w-md text-sm text-gray-700">
        Promotions and analytics tools land here in upcoming milestones.
      </p>

      <div className="flex flex-wrap justify-center gap-3">
        <Link href="/service" className="min-h-12 flex items-center rounded-lg bg-green-600 px-6 font-semibold text-white">
          Service Queue
        </Link>
        <Link href="/parts" className="min-h-12 flex items-center rounded-lg bg-green-600 px-6 font-semibold text-white">
          Parts Queue
        </Link>
        <Link href="/messages" className="min-h-12 flex items-center rounded-lg bg-green-600 px-6 font-semibold text-white">
          Message Inbox
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
