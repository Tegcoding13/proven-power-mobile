import Link from "next/link";
import { createClient } from "../lib/supabase/server";
import { logOut } from "./(auth)/actions";

export default async function HomePage() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub;

  const { data: profile } = userId
    ? await supabase.from("profiles").select("*").eq("id", userId).single()
    : { data: null };

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-3xl font-bold text-green-700">Proven Power</h1>
      <p className="text-lg text-black">Welcome{profile?.full_name ? `, ${profile.full_name}` : ""}.</p>
      <p className="max-w-md text-sm text-gray-700">
        Service, Parts, and Messages land here in upcoming milestones.
      </p>

      <Link href="/garage" className="min-h-12 flex items-center rounded-lg bg-green-600 px-6 font-semibold text-white">
        My Garage
      </Link>

      <form action={logOut}>
        <button type="submit" className="min-h-12 rounded-lg bg-gray-100 px-6 font-semibold text-black">
          Sign Out
        </button>
      </form>
    </div>
  );
}
