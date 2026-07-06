import twilio from "twilio";

function getClient() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) return null;
  return twilio(sid, token);
}

const FROM_NUMBER = process.env.TWILIO_FROM_NUMBER ?? "";

export async function sendSms(to: string[], body: string): Promise<void> {
  const client = getClient();
  if (!client) {
    console.warn("[sms] Twilio env vars not set — skipping SMS send");
    return;
  }
  await Promise.allSettled(
    to.map((number) =>
      client.messages.create({ from: FROM_NUMBER, to: number, body })
    )
  );
}

export async function sendVerificationSms(to: string, code: string): Promise<void> {
  await sendSms([to], `Your Proven Power verification code is: ${code}. It expires in 10 minutes.`);
}
