import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  const from = process.env.FROM_EMAIL ?? "onboarding@resend.dev";
  await resend.emails.send({
    from,
    to,
    subject: "Reset your Portfolio Tracker password",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#07070c;color:#e8e8ed;border-radius:12px;">
        <div style="margin-bottom:24px;">
          <span style="font-size:18px;font-weight:700;color:#f0f0f5;">Portfolio Tracker</span>
        </div>
        <h1 style="font-size:22px;font-weight:700;margin:0 0 8px;color:#f5f5fa;">Reset your password</h1>
        <p style="color:rgba(255,255,255,0.5);margin:0 0 24px;line-height:1.6;">
          We received a request to reset your password. Click the button below to choose a new one.
          This link expires in <strong style="color:rgba(255,255,255,0.75);">1 hour</strong>.
        </p>
        <a href="${resetUrl}"
           style="display:inline-block;padding:14px 28px;background:linear-gradient(135deg,#6366f1,#818cf8);color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px;">
          Reset password
        </a>
        <p style="color:rgba(255,255,255,0.3);font-size:13px;margin:24px 0 0;line-height:1.5;">
          If you didn't request this, you can safely ignore this email — your password won't change.
        </p>
      </div>
    `,
  });
}
