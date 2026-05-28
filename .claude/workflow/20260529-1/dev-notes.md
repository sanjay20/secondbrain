# Dev Notes — SB-1 Journal Reminders
**Branch:** feature/SB-1-journal-reminders  
**Commit:** 5c8bcf8

## Decisions that differ from the plan

1. **`reminder.status` kept in DB on cancel** — plan said "update status to cancelled then delete". Changed to a straight DELETE instead. Simpler; the UI shows the Bell button again immediately. No orphan rows.

2. **Push subscription stored on `User` not on `Reminder`** — plan correctly called this out. One subscription covers all reminders for a user. Stored as `Json?` on the User model.

3. **VAPID lazy-init in `push.ts`** — wrapped `setVapidDetails` in a guard so it only runs once per process and skips gracefully if env vars aren't set yet (avoids crashing dev builds without keys).

4. **`FROM_EMAIL` defaults to `onboarding@resend.dev`** — this is Resend's universal test sender that works on the free tier without a verified domain. Production should replace with a real domain address once DNS is verified.

5. **`minDatetime()` recalculates on each render** — gives a 1-minute buffer so the "min" attribute on the datetime picker stays accurate without a side-effect. Acceptable for this low-frequency interaction.

## What still needs manual setup before reminders fire

1. **Resend API key** — replace `RESEND_API_KEY=re_placeholder_*` in `.env.local` with a real key from https://resend.com (free, no credit card). Until then the process route will log an error and skip email.

2. **Systemd timer** — create two unit files in `~/.config/systemd/user/` then enable:

```ini
# ~/.config/systemd/user/secondbrain-reminder.service
[Unit]
Description=SecondBrain reminder processor

[Service]
Type=oneshot
ExecStart=/bin/bash -c 'wget -q -O /dev/null --post-data="" --header="x-reminder-secret: 168042f65f6ffc5adbbe6e100c20f28302b65396cf2411b1" http://localhost:3000/api/reminders/process'
```

```ini
# ~/.config/systemd/user/secondbrain-reminder.timer
[Unit]
Description=Run SecondBrain reminder processor every minute

[Timer]
OnBootSec=60
OnUnitActiveSec=60

[Install]
WantedBy=timers.target
```

```bash
systemctl --user daemon-reload
systemctl --user enable --now secondbrain-reminder.timer
systemctl --user list-timers   # verify it appears
```

> Note: uses `wget` (installed) not `curl` (not installed).

3. **Browser push only on HTTPS** — works on https://colt-tidings-wad.ngrok-free.dev. Will silently skip push subscription on http://localhost:3000 (Notification API is undefined over plain HTTP — the `requestPushPermission()` function handles this gracefully).
