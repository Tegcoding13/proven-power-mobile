import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "../../../lib/supabase/service-role";
import {
  sendEmail,
  buildNewServiceRequestEmail,
  buildNewPartsRequestEmail,
  buildNewMessageEmail,
  buildNewStorageSignupEmail,
} from "../../../lib/email";
import { sendSms } from "../../../lib/sms";

// Supabase Database Webhook posts here when a new row is inserted.
// Verify the shared secret so only Supabase can trigger this.

type WebhookPayload = {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  record: Record<string, unknown>;
  schema: string;
};

type NotificationSettingsRow = {
  email_recipients: string[];
  sms_recipients: string[];
  email_enabled: boolean;
  sms_enabled: boolean;
};

async function getDeptSettings(department: string): Promise<NotificationSettingsRow | null> {
  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from("notification_settings")
    .select("email_recipients, sms_recipients, email_enabled, sms_enabled")
    .eq("department", department)
    .single();
  return data as NotificationSettingsRow | null;
}

async function getProfileName(profileId: string | null | undefined): Promise<string> {
  if (!profileId) return "Unknown";
  const supabase = createServiceRoleClient();
  const { data } = await supabase.from("profiles").select("full_name").eq("id", profileId as string).single();
  return (data as { full_name?: string } | null)?.full_name ?? "Unknown";
}

async function notify(
  department: string,
  emailPayload: { subject: string; html: string },
  smsBody: string,
) {
  const settings = await getDeptSettings(department);
  if (!settings) return;

  const adminUrl = process.env.NEXT_PUBLIC_ADMIN_URL ?? "";

  if (settings.email_enabled && settings.email_recipients.length > 0) {
    await sendEmail({ to: settings.email_recipients, subject: emailPayload.subject, html: emailPayload.html });
  }
  if (settings.sms_enabled && settings.sms_recipients.length > 0) {
    await sendSms(settings.sms_recipients, smsBody);
  }
  void adminUrl;
}

export async function POST(req: NextRequest) {
  // Verify shared secret
  const secret = req.headers.get("x-webhook-secret");
  if (!secret || secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as WebhookPayload;
  if (body.type !== "INSERT") return NextResponse.json({ ok: true });

  const adminUrl = process.env.NEXT_PUBLIC_ADMIN_URL ?? "";
  const r = body.record;

  try {
    switch (body.table) {
      case "service_requests": {
        const customerName = await getProfileName(r.profile_id as string);
        const ep = buildNewServiceRequestEmail({
          customerName,
          requestType: String(r.request_type ?? ""),
          description: r.description as string | undefined,
          adminUrl: `${adminUrl}/service/${r.id}`,
        });
        await notify("service", ep, `New service request from ${customerName}. View: ${adminUrl}/service/${r.id}`);
        break;
      }

      case "parts_requests": {
        const customerName = await getProfileName(r.profile_id as string);
        const ep = buildNewPartsRequestEmail({
          customerName,
          requestType: String(r.request_type ?? ""),
          adminUrl: `${adminUrl}/parts/${r.id}`,
        });
        await notify("parts", ep, `New parts request from ${customerName}. View: ${adminUrl}/parts/${r.id}`);
        break;
      }

      case "message_threads": {
        const customerName = await getProfileName(r.customer_profile_id as string);
        const ep = buildNewMessageEmail({
          customerName,
          department: String(r.department ?? ""),
          preview: String(r.subject ?? "(no subject)"),
          adminUrl: `${adminUrl}/messages/${r.id}`,
        });
        await notify("messages", ep, `New message from ${customerName}. View: ${adminUrl}/messages/${r.id}`);
        break;
      }

      case "winter_storage_signups": {
        const customerName = await getProfileName(r.profile_id as string);
        const ep = buildNewStorageSignupEmail({
          customerName,
          unit: String(r.equipment_description ?? r.equipment_id ?? "Unknown unit"),
          dropoffDate: r.requested_dropoff_date as string | null,
          pickupDate: r.requested_pickup_date as string | null,
          adminUrl: `${adminUrl}/winter-storage`,
        });
        await notify("storage", ep, `New winter storage request from ${customerName}. View: ${adminUrl}/winter-storage`);
        break;
      }

      default:
        break;
    }
  } catch (err) {
    console.error("[notify webhook] Error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
