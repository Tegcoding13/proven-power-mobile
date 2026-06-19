"use client";

import { Suspense, useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { logIn } from "../actions";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const [error, formAction, isPending] = useActionState(logIn, null);
  const searchParams = useSearchParams();
  const rejectedAsNonStaff = searchParams.get("error") === "not_staff";

  return (
    <div className="flex flex-1 items-center justify-center px-4">
      <form action={formAction} className="w-full max-w-sm flex flex-col gap-4">
        <h1 className="text-3xl font-bold text-green-700">Proven Power</h1>
        <h2 className="text-xl text-black">Staff Login</h2>

        {rejectedAsNonStaff ? (
          <p className="text-sm text-red-600">That account isn&apos;t a staff account.</p>
        ) : null}

        <input
          name="email"
          type="email"
          placeholder="Email"
          autoComplete="email"
          required
          className="min-h-12 rounded-lg border border-gray-300 bg-gray-50 px-4 text-base text-black"
        />
        <input
          name="password"
          type="password"
          placeholder="Password"
          autoComplete="current-password"
          required
          className="min-h-12 rounded-lg border border-gray-300 bg-gray-50 px-4 text-base text-black"
        />

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <button
          type="submit"
          disabled={isPending}
          className="min-h-12 rounded-lg bg-green-600 text-white font-semibold disabled:opacity-70"
        >
          {isPending ? "Logging in..." : "Log In"}
        </button>
      </form>
    </div>
  );
}
