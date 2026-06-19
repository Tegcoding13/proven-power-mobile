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

  const tiles = [
    { href: "/garage", label: "My Garage", icon: "🚜" },
    { href: "/service", label: "Service", icon: "🔧" },
    { href: "/parts", label: "Parts", icon: "⚙️" },
    { href: "/messages", label: "Messages", icon: "💬" },
    { href: "/inventory", label: "Inventory", icon: "📋" },
    { href: "/winter-storage", label: "Winter Storage", icon: "❄️" },
    { href: "/locations", label: "Locations", icon: "📍" },
  ];

  return (
    <div className="flex flex-1 flex-col items-center gap-6 px-4 py-8 text-center">
      <div>
        <h1 className="text-3xl font-bold text-green-700">Proven Power</h1>
        <p className="text-lg text-black">Welcome{profile?.full_name ? `, ${profile.full_name}` : ""}.</p>
      </div>

      <div className="grid grid-cols-3 gap-4 max-w-md w-full">
        {tiles.map((tile) => (
          <Link
            key={tile.href}
            href={tile.href}
            className="aspect-square flex flex-col items-center justify-center gap-2 rounded-lg border border-gray-300 p-2 hover:bg-green-50"
          >
            <span className="text-3xl">{tile.icon}</span>
            <span className="text-xs font-semibold text-black text-center">{tile.label}</span>
          </Link>
        ))}
      </div>

      <form action={logOut}>
        <button type="submit" className="min-h-12 rounded-lg bg-gray-100 px-6 font-semibold text-black">
          Sign Out
        </button>
      </form>
    </div>
  );
}
