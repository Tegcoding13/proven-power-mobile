"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { createClient } from "../../lib/supabase/client";
import { saveNotificationSettings, sendTestEmail } from "./actions";

type DeptSetting = {
  department: string;
  email_recipients: string[];
  sms_recipients: string[];
  email_enabled: boolean;
  sms_enabled: boolean;
};

const DEPT_LABELS: Record<string, string> = {
  service:  "Service",
  parts:    "Parts",
  messages: "Messages",
  storage:  "Winter Storage",
  sales:    "Sales",
  general:  "General / Manager",
};

const DEPT_ORDER = ["service", "parts", "messages", "storage", "sales", "general"];

function RecipientEditor({
  label,
  values,
  onChange,
  placeholder,
}: {
  label: string;
  values: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
}) {
  const [draft, setDraft] = useState("");

  function add() {
    const v = draft.trim();
    if (v && !values.includes(v)) onChange([...values, v]);
    setDraft("");
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-semibold text-gray-600">{label}</p>
      <div className="flex flex-wrap gap-1 min-h-8">
        {values.map((v) => (
          <span key={v} className="flex items-center gap-1 bg-gray-100 rounded-full px-3 py-1 text-xs text-gray-800">
            {v}
            <button onClick={() => onChange(values.filter((x) => x !== v))} className="text-gray-400 hover:text-red-500 ml-1 leading-none">✕</button>
          </span>
        ))}
        {values.length === 0 && <span className="text-xs text-gray-300 italic">None configured</span>}
      </div>
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          placeholder={placeholder}
          className="flex-1 min-h-9 rounded-lg border border-gray-300 px-3 text-sm text-black"
        />
        <button onClick={add} disabled={!draft.trim()} className="min-h-9 px-4 rounded-lg bg-gray-100 text-sm font-semibold text-gray-700 disabled:opacity-40">
          Add
        </button>
      </div>
    </div>
  );
}

function DeptCard({ initial }: { initial: DeptSetting }) {
  const [emails, setEmails] = useState(initial.email_recipients);
  const [phones, setPhones] = useState(initial.sms_recipients);
  const [emailEnabled, setEmailEnabled] = useState(initial.email_enabled);
  const [smsEnabled, setSmsEnabled] = useState(initial.sms_enabled);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isTesting, startTestTransition] = useTransition();
  const [testMsg, setTestMsg] = useState<string | null>(null);

  function handleSave() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const err = await saveNotificationSettings(initial.department, emails, phones, emailEnabled, smsEnabled);
      if (err) setError(err);
      else setSaved(true);
    });
  }

  function handleTest() {
    setTestMsg(null);
    startTestTransition(async () => {
      const err = await sendTestEmail(initial.department);
      setTestMsg(err ?? "Test email sent!");
    });
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-gray-900">{DEPT_LABELS[initial.department] ?? initial.department}</h2>
        <span className="text-xs text-gray-400 capitalize">{initial.department}</span>
      </div>

      {/* Toggles */}
      <div className="flex gap-6">
        <label className="flex items-center gap-2 cursor-pointer">
          <div onClick={() => setEmailEnabled((v) => !v)}
            className={`w-10 h-6 rounded-full transition-colors ${emailEnabled ? "bg-green-600" : "bg-gray-200"} relative`}>
            <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${emailEnabled ? "left-5" : "left-1"}`} />
          </div>
          <span className="text-sm text-gray-700">Email alerts</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <div onClick={() => setSmsEnabled((v) => !v)}
            className={`w-10 h-6 rounded-full transition-colors ${smsEnabled ? "bg-green-600" : "bg-gray-200"} relative`}>
            <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${smsEnabled ? "left-5" : "left-1"}`} />
          </div>
          <span className="text-sm text-gray-700">SMS alerts</span>
        </label>
      </div>

      {emailEnabled && (
        <RecipientEditor
          label="Email recipients (press Enter or Add after each)"
          values={emails}
          onChange={setEmails}
          placeholder="staff@provenpower.com"
        />
      )}

      {smsEnabled && (
        <RecipientEditor
          label="SMS recipients — include country code (e.g. +12625550100)"
          values={phones}
          onChange={setPhones}
          placeholder="+12625550100"
        />
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={handleSave} disabled={isPending}
          className="min-h-9 rounded-lg bg-green-700 px-5 text-sm font-semibold text-white disabled:opacity-60">
          {isPending ? "Saving…" : "Save"}
        </button>
        {emailEnabled && emails.length > 0 && (
          <button onClick={handleTest} disabled={isTesting}
            className="min-h-9 rounded-lg border border-gray-300 px-4 text-sm font-semibold text-gray-700 disabled:opacity-60">
            {isTesting ? "Sending…" : "Send Test Email"}
          </button>
        )}
        {saved && <span className="text-sm text-green-700 font-semibold">Saved ✓</span>}
        {error && <span className="text-sm text-red-600">{error}</span>}
        {testMsg && <span className={`text-sm font-semibold ${testMsg.startsWith("Test") ? "text-green-700" : "text-red-600"}`}>{testMsg}</span>}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<DeptSetting[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).from("notification_settings").select("*").then(({ data }: { data: DeptSetting[] | null }) => {
      if (data) {
        const ordered = DEPT_ORDER.map((d) => data.find((s) => s.department === d)).filter((s): s is DeptSetting => Boolean(s));
        setSettings(ordered);
      }
      setIsLoading(false);
    });
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-green-800 text-white px-6 py-4 flex items-center gap-4 shadow-md">
        <Link href="/" className="text-green-300 hover:text-white text-sm">← Home</Link>
        <h1 className="font-bold text-lg">Settings</h1>
      </header>

      <main className="max-w-2xl w-full mx-auto px-4 py-8 flex flex-col gap-6">
        <div className="rounded-2xl bg-blue-50 border border-blue-200 p-4 text-sm text-blue-800">
          <p className="font-semibold mb-1">How alerts work</p>
          <p>When a new request arrives for a department, everyone listed here gets an email and/or SMS. Each department manages its own list — service staff only need to be on the service list, etc.</p>
        </div>

        <section className="flex flex-col gap-4">
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide">Notification Recipients by Department</h2>
          {isLoading ? (
            <p className="text-gray-500 text-sm">Loading…</p>
          ) : (
            settings.map((s) => <DeptCard key={s.department} initial={s} />)
          )}
        </section>

        <section className="bg-white rounded-2xl border border-gray-200 p-5 flex flex-col gap-3">
          <h2 className="font-bold text-gray-900">Customer Verification & Emails</h2>
          <p className="text-sm text-gray-600">
            Account verification emails are sent automatically by Supabase when a customer signs up.
            To customize the email template (add your logo, change the wording), go to:
          </p>
          <p className="text-sm font-mono bg-gray-50 rounded-lg px-3 py-2 text-gray-700">
            Supabase Dashboard → Authentication → Email Templates
          </p>
          <p className="text-sm text-gray-600 mt-1">
            For SMS verification (phone OTP), add your Twilio credentials to the environment variables and enable Phone Auth in Supabase Authentication settings.
          </p>
        </section>

        <section className="bg-white rounded-2xl border border-gray-200 p-5 flex flex-col gap-3">
          <h2 className="font-bold text-gray-900">Required Environment Variables</h2>
          <p className="text-sm text-gray-500">Add these to your Vercel project settings to enable email and SMS:</p>
          <div className="flex flex-col gap-1 font-mono text-xs bg-gray-50 rounded-lg p-3 text-gray-700">
            <span>RESEND_API_KEY=re_xxxxxxxxxxxx</span>
            <span>RESEND_FROM_EMAIL=onboarding@resend.dev  {/* change to verified domain later */}</span>
            <span>TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxx</span>
            <span>TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxx</span>
            <span>TWILIO_FROM_NUMBER=+1262xxxxxxx</span>
            <span>NEXT_PUBLIC_ADMIN_URL=https://proven-power-admin.vercel.app</span>
          </div>
        </section>
      </main>
    </div>
  );
}
