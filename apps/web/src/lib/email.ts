import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendReminderEmail(opts: {
  to: string;
  entryContent: string;
  category: string;
  scheduledAt: Date;
}) {
  await resend.emails.send({
    from: process.env.FROM_EMAIL ?? "onboarding@resend.dev",
    to: opts.to,
    subject: "SecondBrain — Follow-up reminder",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2 style="margin:0 0 16px;color:#1a1a1a">Follow-up reminder</h2>
        <div style="background:#f4f4f5;border-radius:8px;padding:16px;margin-bottom:16px">
          <p style="margin:0 0 8px;font-size:12px;color:#71717a;text-transform:uppercase;letter-spacing:.05em">${opts.category}</p>
          <p style="margin:0;color:#1a1a1a">${opts.entryContent}</p>
        </div>
        <p style="color:#71717a;font-size:14px">Scheduled for: ${opts.scheduledAt.toLocaleString()}</p>
        <a href="${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/journal"
           style="display:inline-block;margin-top:16px;padding:10px 20px;background:#7c3aed;color:#fff;border-radius:6px;text-decoration:none;font-size:14px">
          Open Journal
        </a>
      </div>
    `,
  });
}
