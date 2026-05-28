import webpush from "web-push";
import type { PushSubscription } from "web-push";

let vapidConfigured = false;

function ensureVapid() {
  if (vapidConfigured) return;
  const email = process.env.VAPID_EMAIL;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!email || !pub || !priv) return;
  webpush.setVapidDetails(email, pub, priv);
  vapidConfigured = true;
}

export async function sendPushNotification(
  subscription: PushSubscription,
  payload: { title: string; body: string; url: string }
) {
  ensureVapid();
  await webpush.sendNotification(subscription, JSON.stringify(payload));
}
