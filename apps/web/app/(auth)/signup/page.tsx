"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signUp } from "../actions";

export default function SignupPage() {
  const [error, formAction, isPending] = useActionState(signUp, null);

  return (
    <div className="flex flex-1 items-center justify-center px-4">
      <form action={formAction} className="w-full max-w-sm flex flex-col gap-4">
        <h1 className="text-2xl font-bold text-green-700">Create your account</h1>

        <input
          name="fullName"
          type="text"
          placeholder="Full name"
          autoComplete="name"
          required
          className="min-h-12 rounded-lg border border-gray-300 bg-gray-50 px-4 text-base text-black"
        />
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
          autoComplete="new-password"
          required
          className="min-h-12 rounded-lg border border-gray-300 bg-gray-50 px-4 text-base text-black"
        />

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <button
          type="submit"
          disabled={isPending}
          className="min-h-12 rounded-lg bg-green-600 text-white font-semibold disabled:opacity-70"
        >
          {isPending ? "Creating account..." : "Sign Up"}
        </button>

        <Link href="/login" className="text-center text-green-700">
          Already have an account? Log in
        </Link>
      </form>
    </div>
  );
}
