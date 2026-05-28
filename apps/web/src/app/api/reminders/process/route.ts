import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendReminderEmail } from "@/lib/email";
import { sendPushNotification } from "@/lib/push";
import type { PushSubscription } from "web-push";

export async function POST(req: Request) {
  const configuredSecret = process.env.REMINDER_PROCESS_SECRET;
  const secret = req.headers.get("x-reminder-secret");
  if (!configuredSecret || !secret || secret !== configuredSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const due = await prisma.reminder.findMany({
    where: { status: "pending", scheduledAt: { lte: new Date() } },
    include: {
      journalEntry: { select: { content: true, category: true } },
      user: { select: { email: true, pushSubscription: true } },
    },
  });

  let processed = 0;
  for (const reminder of due) {
    try {
      if (reminder.user.pushSubscription) {
        await sendPushNotification(reminder.user.pushSubscription as unknown as PushSubscription, {
          title: "SecondBrain reminder",
          body: reminder.journalEntry.content.slice(0, 100),
          url: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/journal`,
        });
      }

      await sendReminderEmail({
        to: reminder.user.email,
        entryContent: reminder.journalEntry.content,
        category: reminder.journalEntry.category,
        scheduledAt: reminder.scheduledAt,
      });

      await prisma.reminder.update({ where: { id: reminder.id }, data: { status: "sent" } });
      processed++;
    } catch (err) {
      console.error(`[REMINDER] failed for ${reminder.id}:`, err);
    }
  }

  return NextResponse.json({ processed });
}
