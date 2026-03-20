import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  const from = process.env.FROM_EMAIL ?? "onboarding@resend.dev";
  await resend.emails.send({
    from,
    to,
    subject: "Reset your VectorFi password",
    html: `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;background:#ffffff;">
        <div style="background:#07070c;padding:28px 32px;border-radius:12px 12px 0 0;">
          <span style="font-size:18px;font-weight:700;color:#f0f0f5;letter-spacing:-0.3px;">VectorFi</span>
        </div>
        <div style="padding:32px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;">
          <h1 style="font-size:22px;font-weight:700;margin:0 0 8px;color:#111827;">Reset your password</h1>
          <p style="color:#6b7280;margin:0 0 24px;line-height:1.6;font-size:15px;">
            We received a request to reset your password. Click the button below to choose a new one.
            This link expires in <strong style="color:#374151;">1 hour</strong>.
          </p>
          <a href="${resetUrl}"
             style="display:inline-block;padding:14px 28px;background:linear-gradient(135deg,#6366f1,#818cf8);color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px;">
            Reset password
          </a>
          <p style="color:#9ca3af;font-size:13px;margin:24px 0 0;line-height:1.5;">
            If you didn't request this, you can safely ignore this email — your password won't change.
          </p>
          <hr style="border:none;border-top:1px solid #f3f4f6;margin:24px 0 16px;" />
          <p style="color:#d1d5db;font-size:12px;margin:0;">
            VectorFi · <a href="https://vectorfi.app" style="color:#a5b4fc;text-decoration:none;">vectorfi.app</a>
          </p>
        </div>
      </div>
    `,
  });
}
