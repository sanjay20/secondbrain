import { headers } from "next/headers";
import { Webhook } from "svix";
import { prisma } from "@/lib/db";

interface ClerkUserEvent {
  type: string;
  data: {
    id: string;
    email_addresses: Array<{ email_address: string }>;
    first_name?: string;
    last_name?: string;
    image_url?: string;
  };
}

export async function POST(req: Request) {
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
  if (!webhookSecret) return new Response("Webhook secret not configured", { status: 500 });

  const headerPayload = await headers();
  const svix_id = headerPayload.get("svix-id");
  const svix_timestamp = headerPayload.get("svix-timestamp");
  const svix_signature = headerPayload.get("svix-signature");

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response("Missing svix headers", { status: 400 });
  }

  const payload = await req.text();
  const wh = new Webhook(webhookSecret);

  let event: ClerkUserEvent;
  try {
    event = wh.verify(payload, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as ClerkUserEvent;
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  const { type, data } = event;

  if (type === "user.created" || type === "user.updated") {
    const name = [data.first_name, data.last_name].filter(Boolean).join(" ") || null;
    await prisma.user.upsert({
      where: { clerkId: data.id },
      update: { email: data.email_addresses[0]?.email_address ?? "", name, imageUrl: data.image_url },
      create: { clerkId: data.id, email: data.email_addresses[0]?.email_address ?? "", name, imageUrl: data.image_url },
    });
  }

  if (type === "user.deleted") {
    await prisma.user.deleteMany({ where: { clerkId: data.id } });
  }

  return new Response("OK", { status: 200 });
}
