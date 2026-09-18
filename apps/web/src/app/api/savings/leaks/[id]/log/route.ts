import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  LEAK_INTENSITY_MAX,
  LEAK_INTENSITY_MIN,
  LEAK_NOTE_MAX_LEN,
} from "@secondbrain/types";
import { todayLocalMidnight } from "@/lib/life-savings";

const logSchema = z.object({
  /** yyyy-MM-dd; defaults to today. Lets you own up to yesterday's slip. */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  intensity: z.number().int().min(LEAK_INTENSITY_MIN).max(LEAK_INTENSITY_MAX).default(1),
  note: z.string().trim().max(LEAK_NOTE_MAX_LEN).optional(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  const leak = await prisma.savingsLeak.findFirst({ where: { id, userId: user.id } });
  if (!leak) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as unknown;

  let data: z.infer<typeof logSchema>;
  try {
    data = logSchema.parse(body ?? {});
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: err.errors }, { status: 400 });
    }
    throw err;
  }

  // Local midnight, matching how habit / mood / gratitude logs are written, so
  // a leak lands in the same day bucket as the habits it competed with.
  const date = data.date
    ? (() => {
        const [y, m, d] = data.date!.split("-").map(Number);
        return new Date(y, m - 1, d);
      })()
    : todayLocalMidnight();

  const log = await prisma.savingsLeakLog.create({
    data: {
      leakId: leak.id,
      userId: user.id,
      date,
      // Snapshot the price at log time — see PATCH on the catalog route.
      cost: leak.cost,
      intensity: data.intensity,
      note: data.note ?? null,
    },
  });

  return NextResponse.json(log, { status: 201 });
}
