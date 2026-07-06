import Link from "next/link";
import { notFound } from "next/navigation";
import { createServiceRoleClient } from "../../../lib/supabase/service-role";
import { StatusBadge } from "../../../components/StatusBadge";

type Props = { params: Promise<{ profileId: string }> };

async function getData(profileId: string) {
  const supabase = createServiceRoleClient();

  const [
    { data: profile },
    { data: memberRows },
  ] = await Promise.all([
    supabase.from("profiles").select("id, full_name, phone").eq("id", profileId).single(),
    supabase.from("business_account_members").select("business_account_id").eq("profile_id", profileId),
  ]);

  if (!profile) return null;

  // Get email from auth
  let email: string | null = null;
  try {
    const { data: { user } } = await supabase.auth.admin.getUserById(profileId);
    email = user?.email ?? null;
  } catch { /* skip */ }

  const bizIds = (memberRows ?? []).map((m) => m.business_account_id);

  const [
    { data: equipment },
    { data: serviceRequests },
    { data: partsRequests },
    { data: messageThreads },
    { data: storageSignups },
  ] = await Promise.all([
    bizIds.length
      ? supabase.from("equipment").select("id, make, model, model_year, serial_number, nickname").in("business_account_id", bizIds).is("deleted_at", null).order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),

    bizIds.length
      ? supabase.from("service_requests").select("id, request_type, status, created_at, equipment_id").in("business_account_id", bizIds).order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),

    bizIds.length
      ? supabase.from("parts_requests").select("id, request_type, status, created_at").in("business_account_id", bizIds).order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),

    bizIds.length
      ? supabase.from("message_threads").select("id, department, status, created_at").in("business_account_id", bizIds).order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),

    bizIds.length
      ? supabase.from("winter_storage_signups").select("id, status, requested_dropoff_date, requested_pickup_date, equipment_id").in("business_account_id", bizIds).order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);

  const equipById = new Map((equipment ?? []).map((e) => [e.id, e]));

  return { profile, email, equipment: equipment ?? [], serviceRequests: serviceRequests ?? [], partsRequests: partsRequests ?? [], messageThreads: messageThreads ?? [], storageSignups: storageSignups ?? [], equipById };
}

function SectionHeader({ title, count }: { title: string; count: number }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <h2 className="font-bold text-gray-800 text-sm uppercase tracking-wide">{title}</h2>
      <span className="text-xs text-gray-400 font-semibold">{count}</span>
    </div>
  );
}

function EmptyRow({ label }: { label: string }) {
  return <p className="text-sm text-gray-300 italic py-2">{label}</p>;
}

export default async function CustomerDetailPage({ params }: Props) {
  const { profileId } = await params;
  const data = await getData(profileId);
  if (!data) notFound();

  const { profile, email, equipment, serviceRequests, partsRequests, messageThreads, storageSignups, equipById } = data;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-[#1a3d2b] text-white px-6 h-14 flex items-center gap-3 shadow-lg">
        <Link href="/search" className="text-green-300 hover:text-white text-sm">← Search</Link>
        <span className="text-white/40">|</span>
        <span className="font-semibold text-sm truncate">{profile.full_name ?? "Customer"}</span>
      </header>

      <main className="max-w-3xl w-full mx-auto px-4 py-8 flex flex-col gap-8">
        {/* Customer info */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h1 className="text-xl font-bold text-gray-900">{profile.full_name ?? "Unknown"}</h1>
          <div className="flex flex-wrap gap-x-6 gap-y-1 mt-2 text-sm text-gray-500">
            {email   && <span>{email}</span>}
            {profile.phone && <span>{profile.phone}</span>}
          </div>
        </div>

        {/* Equipment */}
        <section>
          <SectionHeader title="Equipment" count={equipment.length} />
          {equipment.length === 0 ? <EmptyRow label="No equipment on file" /> : (
            <div className="flex flex-col gap-2">
              {equipment.map((eq) => (
                <div key={eq.id} className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center justify-between gap-4">
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">
                      {eq.nickname || `${eq.make} ${eq.model}${eq.model_year ? ` (${eq.model_year})` : ""}`}
                    </p>
                    {eq.serial_number && <p className="text-xs text-gray-400 mt-0.5">S/N: {eq.serial_number}</p>}
                  </div>
                  {eq.nickname && (
                    <p className="text-xs text-gray-400">{eq.make} {eq.model}{eq.model_year ? ` · ${eq.model_year}` : ""}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Service requests */}
        <section>
          <SectionHeader title="Service Requests" count={serviceRequests.length} />
          {serviceRequests.length === 0 ? <EmptyRow label="No service requests" /> : (
            <div className="flex flex-col gap-2">
              {serviceRequests.map((r) => {
                const eq = r.equipment_id ? equipById.get(r.equipment_id as string) : null;
                return (
                  <Link key={r.id} href={`/service/${r.id}`}
                    className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center justify-between gap-4 hover:border-green-500">
                    <div>
                      <p className="text-sm font-semibold text-gray-900 capitalize">{String(r.request_type).replace(/_/g, " ")}</p>
                      {eq && <p className="text-xs text-gray-400 mt-0.5">{eq.nickname || `${eq.make} ${eq.model}`}</p>}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <StatusBadge status={r.status} />
                      <span className="text-xs text-gray-400">{new Date(r.created_at).toLocaleDateString()}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        {/* Parts requests */}
        <section>
          <SectionHeader title="Parts Requests" count={partsRequests.length} />
          {partsRequests.length === 0 ? <EmptyRow label="No parts requests" /> : (
            <div className="flex flex-col gap-2">
              {partsRequests.map((r) => (
                <Link key={r.id} href={`/parts/${r.id}`}
                  className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center justify-between gap-4 hover:border-green-500">
                  <p className="text-sm font-semibold text-gray-900 capitalize">{String(r.request_type).replace(/_/g, " ")}</p>
                  <div className="flex items-center gap-3 shrink-0">
                    <StatusBadge status={r.status} />
                    <span className="text-xs text-gray-400">{new Date(r.created_at).toLocaleDateString()}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Messages */}
        <section>
          <SectionHeader title="Message Threads" count={messageThreads.length} />
          {messageThreads.length === 0 ? <EmptyRow label="No messages" /> : (
            <div className="flex flex-col gap-2">
              {messageThreads.map((t) => (
                <Link key={t.id} href={`/messages/${t.id}`}
                  className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center justify-between gap-4 hover:border-green-500">
                  <p className="text-sm font-semibold text-gray-900 capitalize">{String(t.department)} dept.</p>
                  <div className="flex items-center gap-3 shrink-0">
                    <StatusBadge status={t.status} />
                    <span className="text-xs text-gray-400">{new Date(t.created_at).toLocaleDateString()}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Winter storage */}
        <section>
          <SectionHeader title="Winter Storage" count={storageSignups.length} />
          {storageSignups.length === 0 ? <EmptyRow label="No storage sign-ups" /> : (
            <div className="flex flex-col gap-2">
              {storageSignups.map((s) => {
                const eq = s.equipment_id ? equipById.get(s.equipment_id as string) : null;
                return (
                  <div key={s.id} className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center justify-between gap-4">
                    <div>
                      {eq && <p className="text-sm font-semibold text-gray-900">{eq.nickname || `${eq.make} ${eq.model}`}</p>}
                      <p className="text-xs text-gray-400 mt-0.5">
                        {s.requested_dropoff_date ? `Drop-off: ${s.requested_dropoff_date}` : ""}
                        {s.requested_dropoff_date && s.requested_pickup_date ? " · " : ""}
                        {s.requested_pickup_date ? `Pick-up: ${s.requested_pickup_date}` : ""}
                      </p>
                    </div>
                    <StatusBadge status={s.status} />
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
