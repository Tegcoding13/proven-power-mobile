import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.RESEND_FROM_EMAIL ?? "notifications@provenpower.com";

export type EmailPayload = {
  to: string[];
  subject: string;
  html: string;
};

export async function sendEmail(payload: EmailPayload): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.warn("[email] RESEND_API_KEY not set — skipping email send");
    return;
  }
  if (payload.to.length === 0) return;

  const { error } = await resend.emails.send({
    from: `Proven Power <${FROM}>`,
    to: payload.to,
    subject: payload.subject,
    html: payload.html,
  });

  if (error) console.error("[email] Send failed:", error);
}

function baseTemplate(title: string, body: string): string {
  return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px">
      <div style="background:#1a3d2b;padding:16px 24px;border-radius:8px 8px 0 0">
        <h1 style="color:white;margin:0;font-size:18px">Proven Power — Staff Notification</h1>
      </div>
      <div style="border:1px solid #e5e7eb;border-top:none;padding:24px;border-radius:0 0 8px 8px">
        <h2 style="color:#1a3d2b;margin-top:0">${title}</h2>
        ${body}
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
        <p style="color:#9ca3af;font-size:12px;margin:0">
          Proven Power · Oconomowoc &amp; Waukesha, WI<br/>
          This is an automated staff notification. Do not reply to this email.
        </p>
      </div>
    </div>
  `;
}

export function buildNewServiceRequestEmail(data: { customerName: string; requestType: string; description?: string; adminUrl: string }): EmailPayload {
  return {
    to: [],
    subject: `New Service Request — ${data.customerName}`,
    html: baseTemplate("New Service Request", `
      <p><strong>Customer:</strong> ${data.customerName}</p>
      <p><strong>Type:</strong> ${data.requestType.replace(/_/g, " ")}</p>
      ${data.description ? `<p><strong>Notes:</strong> ${data.description}</p>` : ""}
      <a href="${data.adminUrl}" style="display:inline-block;background:#2f7a36;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600;margin-top:8px">
        View in Admin
      </a>
    `),
  };
}

export function buildNewPartsRequestEmail(data: { customerName: string; requestType: string; adminUrl: string }): EmailPayload {
  return {
    to: [],
    subject: `New Parts Request — ${data.customerName}`,
    html: baseTemplate("New Parts Request", `
      <p><strong>Customer:</strong> ${data.customerName}</p>
      <p><strong>Type:</strong> ${data.requestType.replace(/_/g, " ")}</p>
      <a href="${data.adminUrl}" style="display:inline-block;background:#2f7a36;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600;margin-top:8px">
        View in Admin
      </a>
    `),
  };
}

export function buildNewMessageEmail(data: { customerName: string; department: string; preview: string; adminUrl: string }): EmailPayload {
  return {
    to: [],
    subject: `New Message — ${data.customerName}`,
    html: baseTemplate("New Customer Message", `
      <p><strong>Customer:</strong> ${data.customerName}</p>
      <p><strong>Department:</strong> ${data.department}</p>
      <p><strong>Message:</strong> ${data.preview}</p>
      <a href="${data.adminUrl}" style="display:inline-block;background:#2f7a36;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600;margin-top:8px">
        Reply in Admin
      </a>
    `),
  };
}

export function buildNewStorageSignupEmail(data: { customerName: string; unit: string; dropoffDate?: string | null; pickupDate?: string | null; adminUrl: string }): EmailPayload {
  return {
    to: [],
    subject: `New Winter Storage Request — ${data.customerName}`,
    html: baseTemplate("New Winter Storage Sign-Up", `
      <p><strong>Customer:</strong> ${data.customerName}</p>
      <p><strong>Unit:</strong> ${data.unit}</p>
      ${data.dropoffDate ? `<p><strong>Drop-off:</strong> ${data.dropoffDate}</p>` : ""}
      ${data.pickupDate  ? `<p><strong>Pick-up:</strong> ${data.pickupDate}</p>`  : ""}
      <a href="${data.adminUrl}" style="display:inline-block;background:#2f7a36;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600;margin-top:8px">
        Review in Admin
      </a>
    `),
  };
}

// Customer-facing emails
export function buildStorageConfirmationEmail(data: { customerName: string; unit: string; dropoffDate?: string | null; pickupDate?: string | null }): EmailPayload {
  return {
    to: [],
    subject: "Winter Storage Confirmed — Proven Power",
    html: baseTemplate("Your Winter Storage is Confirmed!", `
      <p>Hi ${data.customerName},</p>
      <p>Great news — your winter storage request has been confirmed.</p>
      <p><strong>Unit:</strong> ${data.unit}</p>
      ${data.dropoffDate ? `<p><strong>Drop-off Date:</strong> ${data.dropoffDate}</p>` : ""}
      ${data.pickupDate  ? `<p><strong>Pick-up Date:</strong> ${data.pickupDate}</p>`  : ""}
      <p>If you have any questions, reply to this email or call us at your nearest location.</p>
      <p>Thank you for choosing Proven Power!</p>
    `),
  };
}
