// Phacolog — Partner Data Edge Function v3
// GET /functions/v1/partner-data
// Authorization: Bearer <partner-token>
// Returns anonymized surgical data + platform metrics. No PII exposed.
//
// Security:
//   - Tokens stored in Supabase Secrets (PARTNER_TOKEN_JJ, PARTNER_TOKEN_OFTA)
//   - CORS restricted to known origins
//   - Rate limiting: 30 req / IP / hour via rate_limits table

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

// ── Partner config — public metadata, no secrets here ─────────────────────
const PARTNER_DEFS: Array<{ envKey: string; cfg: PartnerConfig }> = [
  {
    envKey: "PARTNER_TOKEN_JJ",
    cfg: {
      name: "Johnson & Johnson MedTech",
      type: "equipment",
      shortName: "J&J",
      color: "#C8102E",
      darkColor: "#900A1F",
      equipmentFilter: ["Intuitiv", "Signature", "Faros"],
      filterLabel: "Cirurgias com equipamentos J&J",
      highlights: { equipment: ["Intuitiv", "Signature", "Faros"], lio_prefix: "TECNIS" },
    },
  },
  {
    envKey: "PARTNER_TOKEN_OFTA",
    cfg: {
      name: "Ofta",
      type: "pharma",
      shortName: "Ofta",
      color: "#1A6BB5",
      darkColor: "#124F87",
      equipmentFilter: null,
      filterLabel: "Todas as cirurgias do programa",
      highlights: null,
    },
  },
];

// Resolved once at cold start — tokens come from Supabase Secrets
const TOKENS: Record<string, PartnerConfig> = {};
for (const { envKey, cfg } of PARTNER_DEFS) {
  const tok = Deno.env.get(envKey);
  if (tok) TOKENS[tok] = cfg;
}

// ── CORS — restricted to known origins ────────────────────────────────────
const ALLOWED_ORIGINS = [
  "https://cassebfelipe2.github.io",
  "http://localhost:5500",
  "http://127.0.0.1:5500",
  "http://localhost:3000",
];

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") ?? "";
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Vary": "Origin",
  };
}

// ── Rate limit config ──────────────────────────────────────────────────────
const RATE_LIMIT = 30; // max requests per IP per hour

Deno.serve(async (req: Request) => {
  const cors = corsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  function resp(data: unknown, status = 200) {
    return new Response(JSON.stringify(data), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );

  // ── Rate limiting (degrades gracefully if table not yet created) ──────────
  const rawIp = req.headers.get("x-forwarded-for") ?? "unknown";
  const ip = rawIp.split(",")[0].trim().substring(0, 45);
  const hour = new Date().toISOString().substring(0, 13); // "YYYY-MM-DDTHH"
  const rlKey = `pd:${ip}:${hour}`;

  const { data: rlRow, error: rlErr } = await sb
    .from("rate_limits")
    .select("count")
    .eq("key", rlKey)
    .maybeSingle();

  if (!rlErr) {
    const rlCount = (rlRow && rlRow.count ? Number(rlRow.count) : 0) + 1;

    if (rlCount > RATE_LIMIT) {
      return new Response(
        JSON.stringify({ error: "Muitas tentativas. Tente novamente em 1 hora." }),
        { status: 429, headers: { ...cors, "Content-Type": "application/json", "Retry-After": "3600" } }
      );
    }

    sb.from("rate_limits")
      .upsert({ key: rlKey, count: rlCount, updated_at: new Date().toISOString() })
      .then(() => {})
      .catch(() => {});
  }

  // ── Auth ─────────────────────────────────────────────────────────────────
  const auth = req.headers.get("Authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const cfg = TOKENS[token];
  if (!cfg) return resp({ error: "Token inválido ou expirado." }, 401);

  // ── 1. Platform metrics (global, unfiltered, no PII) ────────────────────
  const today = new Date();
  const d30 = new Date(today); d30.setDate(d30.getDate() - 30);
  const d30str = d30.toISOString().split("T")[0];
  const thisMonth = today.getFullYear() + "-" + String(today.getMonth() + 1).padStart(2, "0");

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
    sb.from("surgeries").select("user_id").gte("surgery_date", d30str).not("user_id", "is", null),
    sb.from("surgeries").select("surgery_date").not("surgery_date", "is", null),
  ]);

  const activeSurgeons = new Set(
    (activeUserRows ?? []).map((r: { user_id: string }) => r.user_id)
  ).size;

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

  // ── 2. Partner surgeries with embedded followups + complications ──────────
  // Using PostgREST relationship join avoids a separate .in(ids) query that
  // can exceed URL length limits when there are many surgeries (e.g. Ofta = all).
  let surgQ = sb.from("surgeries").select(
    "id, surgery_date, eye, technique, equipment, cat_grade, " +
    "lio_model, lio_power, lio_type, lio_material, " +
    "surgeon_name, supervisor, anesthesia, has_complication, " +
    "mental_confidence, mental_control, mental_stress, " +
    "complications(name), " +
    "followups(type, completed_at, visual_acuity, avcc, pio, refraction, conduta)"
  ).order("surgery_date", { ascending: false });

  if (cfg.equipmentFilter) surgQ = surgQ.in("equipment", cfg.equipmentFilter);

  const { data: surgeries, error: surgErr } = await surgQ;
  if (surgErr) {
    console.error("surgeries query error:", surgErr.message);
    return resp({ error: "Erro ao buscar cirurgias." }, 500);
  }

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
    surgeries: surgeries ?? [],
    generated_at: new Date().toISOString(),
  });
});
