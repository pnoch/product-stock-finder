// Transactional email delivery via the Resend HTTP API (no SDK dependency).
//
// Configure with RESEND_API_KEY + EMAIL_FROM. Without them, sends are skipped
// and logged — the app keeps working, but users cannot receive reset/verify
// links, so production deployments must set both. Never log message bodies or
// tokens; only the recipient and outcome.

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export async function sendEmail(message: EmailMessage): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    console.warn(
      `[Email] Not configured (RESEND_API_KEY/EMAIL_FROM) — skipped "${message.subject}" to ${message.to}`,
    );
    return false;
  }
  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[Email] Send failed (${res.status}): ${body.slice(0, 300)}`);
      return false;
    }
    return true;
  } catch (error) {
    console.error("[Email] Send error:", error);
    return false;
  }
}
