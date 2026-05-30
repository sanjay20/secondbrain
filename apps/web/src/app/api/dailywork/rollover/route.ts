import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { startOfDayInTz } from "@/lib/datetime";

export async function POST(req: Request) {
  const configuredSecret = process.env.ROLLOVER_SECRET;
  const secret = req.headers.get("x-rollover-secret");
  if (!configuredSecret || !secret || secret !== configuredSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  // Gather all users with pending past tasks
  const users = await prisma.user.findMany({
    where: {
      tasks: {
        some: {
          completedAt: null,
          scheduledDate: { lt: now },
        },
      },
    },
    select: { id: true, timezone: true },
  });

  let totalMoved = 0;

  for (const user of users) {
    const todayStart = startOfDayInTz(now, user.timezone);

    // Only roll over tasks scheduled before today's start in the user's tz
    const pastTasks = await prisma.task.findMany({
      where: {
        userId: user.id,
        completedAt: null,
        scheduledDate: { lt: todayStart },
      },
    });

    for (const task of pastTasks) {
      await prisma.task.update({
        where: { id: task.id },
        data: {
          originalDate: task.originalDate ?? task.scheduledDate,
          scheduledDate: todayStart,
          rolledOver: true,
        },
      });
      totalMoved++;
    }
  }

  return NextResponse.json({ moved: totalMoved });
}
