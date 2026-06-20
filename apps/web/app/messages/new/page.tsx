"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MessageDepartment } from "@proven-power/shared-types";
import { createClient } from "../../../lib/supabase/client";
import { useBusinessAccount } from "../../../lib/business-account";

const DEPARTMENTS: { value: MessageDepartment; label: string }[] = [
  { value: "sales", label: "Sales" },
  { value: "service", label: "Service" },
  { value: "parts", label: "Parts" },
  { value: "office", label: "Office" },
];

export default function NewMessagePage() {
  const router = useRouter();
  const { businessAccount, isLoading: isLoadingAccount } = useBusinessAccount();

  const [department, setDepartment] = useState<MessageDepartment>("service");
  const [body, setBody] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!businessAccount) {
      setErrorMessage("Still loading your account — try again in a moment.");
      return;
    }
    setErrorMessage(null);
    setIsSubmitting(true);

    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setIsSubmitting(false);
      return;
    }

    const { data: thread, error: threadError } = await supabase
      .from("message_threads")
      .insert({ business_account_id: businessAccount.id, department })
      .select("*")
      .single();

    if (threadError || !thread) {
      setErrorMessage(threadError?.message ?? "Failed to start conversation.");
      setIsSubmitting(false);
      return;
    }

    await supabase.from("messages").insert({
      thread_id: thread.id,
      sender_profile_id: userData.user.id,
      sender_type: "customer",
      body: body.trim(),
    });

    setIsSubmitting(false);
    router.replace(`/messages/${thread.id}`);
  }

  return (
    <div className="flex flex-1 flex-col gap-4 px-4 py-8 max-w-md mx-auto w-full">
      <Link href="/messages" className="text-sm text-green-700">
        ← Back to Messages
      </Link>
      <h1 className="text-2xl font-bold text-green-700">New Message</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <p className="font-semibold text-black mb-2">Department</p>
          <div className="flex flex-wrap gap-2">
            {DEPARTMENTS.map((option) => (
              <button
                type="button"
                key={option.value}
                onClick={() => setDepartment(option.value)}
                className={`min-h-12 rounded-full px-4 font-semibold ${department === option.value ? "bg-green-600 text-white" : "bg-gray-100 text-black"}`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <textarea
          placeholder="What can we help with?"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={4}
          className="rounded-lg border border-gray-300 bg-gray-50 p-4 text-base text-black"
        />

        {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}

        <button
          type="submit"
          disabled={!body.trim() || isSubmitting || isLoadingAccount}
          className="min-h-12 rounded-lg bg-green-600 text-white font-semibold disabled:opacity-70"
        >
          {isSubmitting ? "Sending..." : isLoadingAccount ? "Loading your account..." : "Send"}
        </button>
      </form>
    </div>
  );
}
