import Link from "next/link";
import Image from "next/image";
import { createClient } from "../lib/supabase/server";
import { logOut } from "./(auth)/actions";

type NavItem = {
  href: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  countKey: string | null;
};

function IconWrench() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  );
}
function IconBox() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  );
}
function IconMessage() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}
function IconSnowflake() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="2" x2="12" y2="22" /><line x1="2" y1="12" x2="22" y2="12" />
      <polyline points="7 7 12 2 17 7" /><polyline points="7 17 12 22 17 17" />
      <polyline points="2 7 7 12 2 17" /><polyline points="22 7 17 12 22 17" />
    </svg>
  );
}
function IconTruck() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="3" width="15" height="13" /><polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
      <circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" />
    </svg>
  );
}
function IconMegaphone() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 11l19-9-9 19-2-8-8-2z" />
    </svg>
  );
}
function IconBell() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}
function IconUsers() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

const NAV_ITEMS: NavItem[] = [
  { href: "/service",      label: "Service Queue",      description: "Incoming service requests",           icon: <IconWrench />,    countKey: "service"   },
  { href: "/parts",        label: "Parts Queue",         description: "Parts orders & stock checks",         icon: <IconBox />,       countKey: "parts"     },
  { href: "/messages",     label: "Message Inbox",       description: "Customer messages",                   icon: <IconMessage />,   countKey: "messages"  },
  { href: "/winter-storage", label: "Winter Storage",   description: "Drop-off & pick-up calendar",         icon: <IconSnowflake />, countKey: null        },
  { href: "/inventory",    label: "Inventory",           description: "Equipment listings",                  icon: <IconTruck />,     countKey: null        },
  { href: "/promotions",   label: "Promotions",          description: "Customer promotions & announcements", icon: <IconMegaphone />, countKey: null        },
  { href: "/notifications", label: "Notification Rules", description: "Push & SMS automation",              icon: <IconBell />,      countKey: null        },
  { href: "/staff",        label: "Staff Management",    description: "Invite staff & manage roles",         icon: <IconUsers />,     countKey: null        },
];

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

  const counts: Record<string, number> = {
    service: newServiceCount ?? 0,
    parts: newPartsCount ?? 0,
    messages: newMessageCount ?? 0,
  };

  const totalPending = (newServiceCount ?? 0) + (newPartsCount ?? 0) + (newMessageCount ?? 0);
  const firstName = profile?.full_name?.split(" ")[0] ?? "there";
  const department = staffRole?.department ?? null;

  return (
    <div className="min-h-screen bg-[#f4f5f7] flex flex-col">
      {/* Header */}
      <header className="bg-[#1a3d2b] text-white px-6 py-0 flex items-center justify-between h-14 shadow-lg">
        <div className="flex items-center gap-4">
          <Image src="/logo.png" alt="Proven Power" width={180} height={45} className="object-contain brightness-0 invert" />
          <div className="h-5 w-px bg-white/20" />
          <span className="text-white/60 text-xs font-medium tracking-wide uppercase">Staff Portal</span>
        </div>
        <div className="flex items-center gap-4">
          {profile?.full_name && (
            <div className="hidden sm:block text-right">
              <p className="text-sm font-medium leading-tight">{profile.full_name}</p>
              {department && <p className="text-xs text-white/50 capitalize leading-tight">{department}</p>}
            </div>
          )}
          <form action={logOut}>
            <button type="submit" className="h-8 rounded border border-white/25 px-3 text-xs font-medium text-white/80 hover:text-white hover:border-white/50 transition-colors">
              Sign out
            </button>
          </form>
        </div>
      </header>

      <main className="flex-1 max-w-4xl w-full mx-auto px-5 py-7 flex flex-col gap-6">
        {/* Welcome */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Good morning, {firstName}.</h1>
            <p className="text-sm text-gray-400 mt-0.5">
              {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
            </p>
          </div>
          {totalPending > 0 && (
            <div className="flex items-center gap-2.5 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
              <p className="text-sm text-red-700 font-medium">
                {totalPending} item{totalPending !== 1 ? "s" : ""} need attention
              </p>
            </div>
          )}
        </div>

        {/* Card grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {NAV_ITEMS.map((item) => {
            const badge = item.countKey ? counts[item.countKey] : 0;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="relative bg-white rounded-xl border border-gray-200 hover:border-green-600 hover:shadow-sm transition-all p-4 flex flex-col gap-3 group"
              >
                {badge > 0 && (
                  <span className="absolute top-3 right-3 min-w-[20px] h-5 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                    {badge > 99 ? "99+" : badge}
                  </span>
                )}
                <span className="text-gray-400 group-hover:text-green-700 transition-colors">
                  {item.icon}
                </span>
                <div>
                  <p className="text-sm font-semibold text-gray-900 leading-tight">{item.label}</p>
                  <p className="text-xs text-gray-400 mt-0.5 leading-snug">{item.description}</p>
                </div>
              </Link>
            );
          })}
        </div>

        <p className="text-center text-xs text-gray-300 pt-2">
          Proven Power · Oconomowoc &amp; Waukesha, WI
        </p>
      </main>
    </div>
  );
}
