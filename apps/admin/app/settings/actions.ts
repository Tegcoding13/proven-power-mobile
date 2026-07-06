"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "../../lib/supabase/server";

type NotificationSettingsRow = {
  department: string;
  email_recipients: string[];
  sms_recipients: string[];
  email_enabled: boolean;
  sms_enabled: boolean;
  updated_at: string;
};

export async function saveNotificationSettings(
  department: string,
  emailRecipients: string[],
  smsRecipients: string[],
  emailEnabled: boolean,
  smsEnabled: boolean
): Promise<string | null> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("notification_settings")
    .update({
      email_recipients: emailRecipients,
      sms_recipients: smsRecipients,
      email_enabled: emailEnabled,
      sms_enabled: smsEnabled,
      updated_at: new Date().toISOString(),
    } satisfies Partial<NotificationSettingsRow>)
    .eq("department", department);

  if (error) return (error as { message: string }).message;
  revalidatePath("/settings");
  return null;
}

export async function sendTestEmail(department: string): Promise<string | null> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from("notification_settings")
    .select("*")
    .eq("department", department)
    .single();

  const row = data as NotificationSettingsRow | null;
  if (!row || row.email_recipients.length === 0) return "No email recipients configured for this department.";

  const { sendEmail } = await import("../../lib/email");
  await sendEmail({
    to: row.email_recipients,
    subject: `Test Notification — ${department} (Proven Power)`,
    html: `<div style="font-family:Arial,sans-serif;padding:24px"><h2 style="color:#1a3d2b">Test Notification</h2><p>This is a test notification for the <strong>${department}</strong> department. If you received this, email alerts are working correctly.</p><p style="color:#6b7280;font-size:12px">Proven Power · Oconomowoc &amp; Waukesha, WI</p></div>`,
  });

  return null;
}
