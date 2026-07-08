"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

type Props = {
  title: string;
  backHref?: string;
  backLabel?: string;
};

export function AdminPageHeader({ title, backHref, backLabel }: Props) {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => router.refresh(), 60_000);
    return () => clearInterval(id);
  }, [router]);

  return (
    <div className="sticky top-0 z-20 bg-[#1a3d2b] px-4 h-14 flex items-center justify-between shadow-md shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        {backHref && (
          <Link href={backHref} title={backLabel ?? "Back"}
            className="text-white/60 hover:text-white transition-colors shrink-0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
          </Link>
        )}
        <span className="text-white font-semibold text-base truncate">{title}</span>
      </div>

      <Link href="/" title="Dashboard home"
        className="flex items-center gap-1.5 text-white/60 hover:text-white transition-colors shrink-0 text-sm font-medium">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
        <span className="hidden sm:inline">Home</span>
      </Link>
    </div>
  );
}
