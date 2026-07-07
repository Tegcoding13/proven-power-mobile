import Link from "next/link";

type Action = { href: string; label: string };

export function PageHeader({ title, action }: { title: string; action?: Action }) {
  return (
    <div className="sticky top-0 z-20 bg-[#1a3d2b] px-4 h-14 flex items-center justify-between shadow-md">
      <div className="flex items-center gap-3 min-w-0">
        <Link href="/" className="text-white/60 hover:text-white transition-colors shrink-0">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </Link>
        <span className="text-white font-semibold text-base truncate">{title}</span>
      </div>
      {action && (
        <Link
          href={action.href}
          className="shrink-0 bg-white text-[#1a3d2b] rounded-lg px-3 h-8 flex items-center text-sm font-bold hover:bg-green-50 transition-colors"
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}
