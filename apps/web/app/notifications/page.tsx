import Link from "next/link";
import { createClient } from "../../lib/supabase/server";
import { MarkReadOnView } from "./mark-read-on-view";

function timeAgo(dateString: string): string {
  const diffMs = Date.now() - new Date(dateString).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default async function NotificationsPage() {
  const supabase = await createClient();
  const { data: notifications } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false });

  const unreadIds = (notifications ?? []).filter((n) => !n.is_read).map((n) => n.id);

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-8 max-w-2xl mx-auto w-full">
      <MarkReadOnView ids={unreadIds} />
      <Link href="/" className="text-sm text-green-700">
        ← Back home
      </Link>
      <h1 className="text-2xl font-bold text-green-700">Notifications</h1>

      {!notifications || notifications.length === 0 ? (
        <p className="text-gray-700">No notifications yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {notifications.map((n) => {
            const content = (
              <div className={`rounded-xl border border-gray-200 p-4 flex gap-3 ${n.is_read ? "bg-white" : "bg-green-50"}`}>
                {!n.is_read ? <div className="w-2 h-2 rounded-full bg-green-600 mt-2 shrink-0" /> : <div className="w-2 shrink-0" />}
                <div>
                  <p className="font-bold text-black">{n.title}</p>
                  {n.body ? <p className="text-sm text-gray-700 mt-1">{n.body}</p> : null}
                  <p className="text-xs text-gray-500 mt-1">{timeAgo(n.created_at)}</p>
                </div>
              </div>
            );
            return (
              <li key={n.id}>
                {n.link ? (
                  <Link href={n.link} className="block hover:opacity-90">
                    {content}
                  </Link>
                ) : (
                  content
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
