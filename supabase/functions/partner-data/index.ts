// Phacolog — Partner Data Edge Function v2
// GET /functions/v1/partner-data
// Authorization: Bearer <partner-token>
// Returns anonymized surgical data + platform metrics. No PII exposed.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface PartnerHighlights {
  equipment?: string[];
  lio_prefix?: string;
}

interface PartnerConfig {
  name: string;
  type: "equipment" | "pharma" | "generic";
  shortName: string;
  color: string;
  darkColor: string;
  equipmentFilter: string[] | null;
  filterLabel: string;
  highlights: PartnerHighlights | null;
}

const TOKENS: Record<string, PartnerConfig> = {
  "jj-phacolog-2025": {
    name: "Johnson & Johnson MedTech",
    type: "equipment",
    shortName: "J&J",
    color: "#C8102E",
    darkColor: "#900A1F",
    equipmentFilter: ["Intuitiv", "Signature", "Faros"],
    filterLabel: "Cirurgias com equipamentos J&J",
    highlights: { equipment: ["Intuitiv", "Signature", "Faros"], lio_prefix: "TECNIS" },
  },
  "ofta-phacolog-2025": {
    name: "Ofta",
    type: "pharma",
    shortName: "Ofta",
    color: "#1A6BB5",
    darkColor: "#124F87",
    equipmentFilter: null,
    filterLabel: "Todas as cirurgias do programa",
    highlights: null,
  },
};

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

function resp(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const auth = req.headers.get("Authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const cfg = TOKENS[token];
  if (!cfg) return resp({ error: "Token inválido ou expirado." }, 401);

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );

  const today = new Date();
  const d30 = new Date(today); d30.setDate(d30.getDate() - 30);
  const d30str = d30.toISOString().split("T")[0];
  const thisMonth = today.getFullYear() + "-" + String(today.getMonth() + 1).padStart(2, "0");

  // ── 1. Platform metrics (global, unfiltered, no PII) ──────────────

  // Auth users (email/password accounts) — requires service role
  const { data: authData } = await sb.auth.admin.listUsers({ perPage: 1000, page: 1 });
  const authUsers: { created_at: string }[] = (authData && authData.users) ? authData.users : [];
  const totalUsers: number = (authData && authData.total != null) ? authData.total : authUsers.length;
  const d30iso = d30.toISOString();
  const newUsers30d = authUsers.filter(function (u: { created_at: string }) { return u.created_at >= d30iso; }).length;

  const [
    { count: totalSurgeries },
    { count: surgeries30d },
    { data: activeUserRows },
    { data: monthlyCounts },
  ] = await Promise.all([
    sb.from("surgeries").select("*", { count: "exact", head: true }),
    sb.from("surgeries").select("*", { count: "exact", head: true }).gte("surgery_date", d30str),
    // Active users = distinct user_id who performed surgery in last 30d
    sb.from("surgeries").select("user_id").gte("surgery_date", d30str).not("user_id", "is", null),
    // Monthly counts for last 6 months (surgery_date YYYY-MM prefix)
    sb.from("surgeries").select("surgery_date").not("surgery_date", "is", null),
  ]);

  const activeSurgeons = new Set((activeUserRows ?? []).map((r: { user_id: string }) => r.user_id)).size;

  // Build monthly map from raw dates
  const monthMap: Record<string, number> = {};
  for (const row of monthlyCounts ?? []) {
    const m = (row as { surgery_date: string }).surgery_date.substring(0, 7);
    monthMap[m] = (monthMap[m] ?? 0) + 1;
  }

  const platformMetrics = {
    total_users: totalUsers,
    new_users_30d: newUsers30d,
    total_surgeries: totalSurgeries ?? 0,
    surgeries_30d: surgeries30d ?? 0,
    active_surgeons_30d: activeSurgeons,
    this_month: monthMap[thisMonth] ?? 0,
    monthly_map: monthMap,
  };

  // ── 2. Partner surgeries (filtered) ───────────────────────────────

  let surgQ = sb.from("surgeries").select(
    "id, surgery_date, eye, technique, equipment, cat_grade, " +
    "lio_model, lio_power, lio_type, lio_material, " +
    "surgeon_name, supervisor, anesthesia, has_complication, " +
    "mental_confidence, mental_control, mental_stress"
  ).order("surgery_date", { ascending: false });

  if (cfg.equipmentFilter) surgQ = surgQ.in("equipment", cfg.equipmentFilter);

  const { data: surgeries, error: surgErr } = await surgQ;
  if (surgErr) {
    console.error("surgeries:", surgErr.message);
    return resp({ error: "Erro ao buscar cirurgias." }, 500);
  }
  if (!surgeries || surgeries.length === 0) {
    return resp({ partner: cfg, platform_metrics: platformMetrics, surgeries: [], generated_at: new Date().toISOString() });
  }

  const ids = surgeries.map((s: { id: string }) => s.id);

  // ── 3. Complications + followups (separate queries, safe) ─────────

  const [{ data: complications }, { data: followups }] = await Promise.all([
    sb.from("complications").select("surgery_id, name").in("surgery_id", ids),
    sb.from("followups")
      .select("surgery_id, type, completed_at, visual_acuity, avcc, pio, refraction, conduta")
      .in("surgery_id", ids),
  ]);

  const complMap: Record<string, { name: string }[]> = {};
  for (const c of complications ?? []) {
    const cc = c as { surgery_id: string; name: string };
    if (!complMap[cc.surgery_id]) complMap[cc.surgery_id] = [];
    complMap[cc.surgery_id].push({ name: cc.name });
  }

  const followMap: Record<string, object[]> = {};
  for (const f of followups ?? []) {
    const ff = f as {
      surgery_id: string; type: string; completed_at: string | null;
      visual_acuity: string | null; avcc: string | null; pio: number | null;
      refraction: string | null; conduta: string | null;
    };
    if (!followMap[ff.surgery_id]) followMap[ff.surgery_id] = [];
    followMap[ff.surgery_id].push({
      type: ff.type, completed_at: ff.completed_at,
      visual_acuity: ff.visual_acuity, avcc: ff.avcc,
      pio: ff.pio, refraction: ff.refraction, conduta: ff.conduta,
    });
  }

  const enriched = surgeries.map((s: Record<string, unknown>) => {
    const sid = s.id as string;
    return { ...s, complications: complMap[sid] ?? [], followups: followMap[sid] ?? [] };
  });

  return resp({
    partner: {
      name: cfg.name,
      type: cfg.type,
      shortName: cfg.shortName,
      color: cfg.color,
      darkColor: cfg.darkColor,
      filterLabel: cfg.filterLabel,
      highlights: cfg.highlights,
    },
    platform_metrics: platformMetrics,
    surgeries: enriched,
    generated_at: new Date().toISOString(),
  });
});
