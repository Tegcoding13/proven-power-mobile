import { PageHeader } from "../../components/PageHeader";
import { createClient } from "../../lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function DealsPage() {
  const supabase = await createClient();
  const { data: promotions } = await supabase
    .from("promotions")
    .select("*")
    .order("starts_at", { ascending: false });

  return (
    <div className="flex flex-1 flex-col min-h-screen bg-gray-50">
      <PageHeader title="Deals & Offers" />

      <div className="max-w-2xl mx-auto w-full px-4 py-6 flex flex-col gap-6">
        {!promotions || promotions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mb-4 text-3xl">🏷️</div>
            <p className="font-semibold text-gray-900">No current offers</p>
            <p className="text-sm text-gray-500 mt-1">Check back soon — exclusive deals and seasonal promotions are on the way.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {promotions.map((promo) => {
              const expired = promo.ends_at && new Date(promo.ends_at) < new Date();
              const daysLeft = promo.ends_at
                ? Math.ceil((new Date(promo.ends_at).getTime() - Date.now()) / 86400000)
                : null;

              return (
                <div key={promo.id} className={`bg-white rounded-2xl shadow-sm overflow-hidden border border-transparent ${expired ? "opacity-60" : ""}`}>
                  <div className="bg-gradient-to-r from-[#1a3d2b] to-[#2d6a4a] px-5 py-4">
                    <p className="text-white font-bold text-lg leading-snug">{promo.title}</p>
                    {daysLeft !== null && !expired && (
                      <p className="text-white/60 text-xs mt-1">
                        {daysLeft <= 3
                          ? `⚡ Ends in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}`
                          : `Expires ${new Date(promo.ends_at!).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`}
                      </p>
                    )}
                    {expired && <p className="text-white/40 text-xs mt-1">Expired</p>}
                  </div>

                  {promo.body && (
                    <div className="px-5 py-4">
                      <p className="text-sm text-gray-700 leading-relaxed">{promo.body}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
