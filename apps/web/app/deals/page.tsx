import Link from "next/link";
import { createClient } from "../../lib/supabase/server";

export default async function DealsPage() {
  const supabase = await createClient();
  const { data: promotions } = await supabase
    .from("promotions")
    .select("*")
    .order("starts_at", { ascending: false });

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-8 max-w-2xl mx-auto w-full">
      <Link href="/" className="text-sm text-green-700">
        ← Back home
      </Link>
      <h1 className="text-2xl font-bold text-green-700">Deals & Offers</h1>

      {!promotions || promotions.length === 0 ? (
        <p className="text-gray-700">No current offers right now — check back soon.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {promotions.map((promo) => (
            <li key={promo.id} className="bg-green-50 rounded-[20px] p-5">
              <p className="font-bold text-green-700 text-lg">{promo.title}</p>
              {promo.body ? <p className="text-sm text-gray-700 mt-2">{promo.body}</p> : null}
              {promo.ends_at ? (
                <p className="text-xs text-gray-500 mt-2">
                  Expires {new Date(promo.ends_at).toLocaleDateString()}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
