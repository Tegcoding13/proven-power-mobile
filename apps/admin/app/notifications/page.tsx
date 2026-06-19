"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { NotificationCategory, NotificationChannel, NotificationRule } from "@proven-power/shared-types";
import { createClient } from "../../lib/supabase/client";

const CATEGORIES: { value: NotificationCategory; label: string; hasLeadTime?: boolean }[] = [
  { value: "maintenance_due", label: "Maintenance due" },
  { value: "warranty_expiring", label: "Warranty expiring", hasLeadTime: true },
  { value: "powergard_expiring", label: "PowerGard expiring", hasLeadTime: true },
  { value: "service_status", label: "Service status updates" },
  { value: "parts_status", label: "Parts status updates" },
  { value: "message", label: "New messages" },
  { value: "promo", label: "Promotions" },
  { value: "recall", label: "Safety recalls" },
];

const CHANNELS: NotificationChannel[] = ["push", "sms", "email"];

function ruleKey(category: string, channel: string) {
  return `${category}:${channel}`;
}

export default function NotificationRulesPage() {
  const [rules, setRules] = useState<Map<string, NotificationRule>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("notification_rules")
      .select("*")
      .is("business_account_id", null)
      .then(({ data }) => {
        const map = new Map<string, NotificationRule>();
        (data ?? []).forEach((rule) => map.set(ruleKey(rule.category, rule.channel), rule));
        setRules(map);
        setIsLoading(false);
      });
  }, []);

  async function toggleRule(category: NotificationCategory, channel: NotificationChannel) {
    const key = ruleKey(category, channel);
    const existing = rules.get(key);
    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();

    setSavingKey(key);
    if (existing) {
      const { data: updated } = await supabase
        .from("notification_rules")
        .update({ is_enabled: !existing.is_enabled })
        .eq("id", existing.id)
        .select("*")
        .single();
      if (updated) setRules((prev) => new Map(prev).set(key, updated));
    } else {
      const { data: created } = await supabase
        .from("notification_rules")
        .insert({
          business_account_id: null,
          category,
          channel,
          is_enabled: false, // toggling off the fail-open default
          created_by_profile_id: userData.user?.id,
        })
        .select("*")
        .single();
      if (created) setRules((prev) => new Map(prev).set(key, created));
    }
    setSavingKey(null);
  }

  async function updateLeadTime(category: NotificationCategory, channel: NotificationChannel, leadTimeDays: number) {
    const key = ruleKey(category, channel);
    const existing = rules.get(key);
    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();

    if (existing) {
      const { data: updated } = await supabase
        .from("notification_rules")
        .update({ lead_time_days: leadTimeDays })
        .eq("id", existing.id)
        .select("*")
        .single();
      if (updated) setRules((prev) => new Map(prev).set(key, updated));
    } else {
      const { data: created } = await supabase
        .from("notification_rules")
        .insert({
          business_account_id: null,
          category,
          channel,
          lead_time_days: leadTimeDays,
          created_by_profile_id: userData.user?.id,
        })
        .select("*")
        .single();
      if (created) setRules((prev) => new Map(prev).set(key, created));
    }
  }

  if (isLoading) {
    return <p className="px-4 py-8 text-gray-700">Loading...</p>;
  }

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-8 max-w-3xl mx-auto w-full">
      <div>
        <h1 className="text-2xl font-bold text-green-700">Notification Rules</h1>
        <p className="text-sm text-gray-700 mt-1">
          Dealership-wide defaults for automated alerts. Any account without its own override uses these. (Per-account
          overrides aren&apos;t editable here yet — they share the same <code>notification_rules</code> table, keyed by
          business account.)
        </p>
      </div>

      <table className="w-full border-collapse">
        <thead>
          <tr className="text-left text-sm text-gray-700">
            <th className="py-2">Alert</th>
            {CHANNELS.map((channel) => (
              <th key={channel} className="py-2 capitalize text-center">{channel}</th>
            ))}
            <th className="py-2">Lead time</th>
          </tr>
        </thead>
        <tbody>
          {CATEGORIES.map((category) => (
            <tr key={category.value} className="border-t border-gray-200">
              <td className="py-3 text-black">{category.label}</td>
              {CHANNELS.map((channel) => {
                const key = ruleKey(category.value, channel);
                const rule = rules.get(key);
                const isEnabled = rule?.is_enabled ?? true; // fail-open default
                return (
                  <td key={channel} className="py-3 text-center">
                    <input
                      type="checkbox"
                      checked={isEnabled}
                      disabled={savingKey === key}
                      onChange={() => toggleRule(category.value, channel)}
                      className="w-5 h-5 accent-green-600"
                    />
                  </td>
                );
              })}
              <td className="py-3">
                {category.hasLeadTime ? (
                  <input
                    type="number"
                    min={0}
                    placeholder="days before"
                    defaultValue={rules.get(ruleKey(category.value, "push"))?.lead_time_days ?? ""}
                    onBlur={(e) => {
                      const value = Number(e.target.value);
                      if (!Number.isNaN(value)) updateLeadTime(category.value, "push", value);
                    }}
                    className="w-24 min-h-10 rounded border border-gray-300 px-2 text-sm text-black"
                  />
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <Link href="/" className="text-sm text-green-700">
        ← Back home
      </Link>
    </div>
  );
}
