// Phacolog — Web Push Edge Function
// Triggered daily at 20:00 BRT (23:00 UTC) via pg_cron
// Sends push notifications to users with pending post-op follow-ups

import webpush from "npm:web-push@3.6.7";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";

webpush.setVapidDetails("mailto:cassebfs@gmail.com", VAPID_PUBLIC, VAPID_PRIVATE);

Deno.serve(async (req: Request) => {
  // Accept service-role JWT or our own CRON_SECRET header
  const auth = req.headers.get("Authorization") ?? "";
  const secret = req.headers.get("x-cron-secret") ?? "";
  const hasAuth = auth.startsWith("Bearer ") || (CRON_SECRET && secret === CRON_SECRET);
  if (!hasAuth) {
    return new Response("Unauthorized", { status: 401 });
  }

  const sb = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false },
  });

  const today = new Date().toISOString().split("T")[0];
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 60);
  const cutoffStr = cutoff.toISOString().split("T")[0];

  // 1. Surgeries from last 60 days (D30 check needs 30d, buffer to 60d for late entries)
  const { data: surgeries, error: sErr } = await sb
    .from("surgeries")
    .select("id, user_id, surgery_date")
    .lte("surgery_date", today)
    .gte("surgery_date", cutoffStr);

  if (sErr) {
    console.error("surgeries query error:", sErr);
    return new Response(JSON.stringify({ error: sErr.message }), { status: 500 });
  }
  if (!surgeries?.length) {
    return new Response(JSON.stringify({ sent: 0, reason: "no recent surgeries" }), { status: 200 });
  }

  // 2. Completed followups for these surgeries
  const surgeryIds = surgeries.map((s) => s.id);
  const { data: followups } = await sb
    .from("followups")
    .select("surgery_id, type")
    .in("surgery_id", surgeryIds);

  const fSet: Record<string, Set<string>> = {};
  for (const f of followups ?? []) {
    if (!fSet[f.surgery_id]) fSet[f.surgery_id] = new Set();
    fSet[f.surgery_id].add(f.type);
  }

  // 3. Tally pending follow-ups per user
  const byUser: Record<string, number> = {};
  const todayMs = new Date(today).getTime();

  for (const s of surgeries) {
    const done = fSet[s.id] ?? new Set<string>();
    const surgMs = new Date(s.surgery_date).getTime();
    const DAY = 86400000;
    let pending = 0;

    // D1 due the day after surgery
    if (!done.has("D1") && surgMs + DAY <= todayMs) pending++;
    // D7 due 7 days after surgery
    if (!done.has("D7") && surgMs + 7 * DAY <= todayMs) pending++;
    // D30 due 30 days after surgery
    if (!done.has("D30") && surgMs + 30 * DAY <= todayMs) pending++;

    if (pending > 0) {
      byUser[s.user_id] = (byUser[s.user_id] ?? 0) + pending;
    }
  }

  if (!Object.keys(byUser).length) {
    return new Response(
      JSON.stringify({ sent: 0, reason: "no pending followups" }),
      { status: 200 }
    );
  }

  // 4. Fetch subscriptions for users with pending follow-ups
  const userIds = Object.keys(byUser);
  const { data: subs, error: subErr } = await sb
    .from("push_subscriptions")
    .select("user_id, subscription")
    .in("user_id", userIds);

  if (subErr) {
    console.error("subscriptions query error:", subErr);
    return new Response(JSON.stringify({ error: subErr.message }), { status: 500 });
  }

  let sent = 0;
  const errors: string[] = [];

  for (const sub of subs ?? []) {
    const n = byUser[sub.user_id] ?? 0;
    if (!n || !sub.subscription) continue;

    const body = n === 1
      ? "1 retorno pós-operatório pendente"
      : `${n} retornos pós-operatórios pendentes`;

    const payload = JSON.stringify({ title: "Phacolog", body, url: "/nse/" });

    try {
      await webpush.sendNotification(sub.subscription, payload, { TTL: 86400 });
      sent++;
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message?: string };
      // 400/401 = VAPID mismatch or malformed; 404/410 = expired — clean up in all cases
      if ([400, 401, 404, 410].includes(e.statusCode ?? 0)) {
        await sb.from("push_subscriptions").delete().eq("user_id", sub.user_id);
      }
      errors.push(`uid=${sub.user_id} status=${e.statusCode} msg=${e.message}`);
    }
  }

  console.log(`send-push: sent=${sent} total_subs=${subs?.length ?? 0} errors=${errors.length}`);
  return new Response(
    JSON.stringify({ sent, total: subs?.length ?? 0, errors }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});
