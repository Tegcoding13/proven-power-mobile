"use client";

import { useActionState } from "react";
import Link from "next/link";
import { logIn } from "../actions";

export default function LoginPage() {
  const [error, formAction, isPending] = useActionState(logIn, null);

  return (
    <div className="flex flex-1 items-center justify-center px-4">
      <form action={formAction} className="w-full max-w-sm flex flex-col gap-4">
        <h1 className="text-3xl font-bold text-green-700">Proven Power</h1>
        <h2 className="text-xl text-black">Log in</h2>

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

        <Link href="/signup" className="text-center text-green-700">
          New here? Create an account
        </Link>
      </form>
    </div>
  );
}
