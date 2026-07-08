"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

function getGreeting() {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return "Good morning";
  if (h >= 12 && h < 17) return "Good afternoon";
  return "Good evening";
}

export function HomeClient({ firstName }: { firstName: string }) {
  const router = useRouter();
  const [greeting, setGreeting] = useState(getGreeting);

  useEffect(() => {
    setGreeting(getGreeting());
    const id = setInterval(() => router.refresh(), 60_000);
    return () => clearInterval(id);
  }, [router]);

  return (
    <h1 className="text-xl font-semibold text-gray-900">
      {greeting}, {firstName}.
    </h1>
  );
}
