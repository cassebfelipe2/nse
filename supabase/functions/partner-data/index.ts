// Phacolog — Partner Data Edge Function
// GET /functions/v1/partner-data
// Authorization: Bearer <partner-token>
// Returns anonymized surgery data for authorized partners (no PII)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface PartnerConfig {
  name: string;
  shortName: string;
  color: string;
  darkColor: string;
  bgColor: string;
  filterLabel: string;
  equipmentFilter: string[] | null;
}

// Tokens hardcoded here — rotate as needed via redeploy
const PARTNER_TOKENS: Record<string, PartnerConfig> = {
  "jj-phacolog-2025": {
    name: "Johnson & Johnson MedTech",
    shortName: "J&J",
    color: "#C8102E",
    darkColor: "#900A1F",
    bgColor: "#FFF5F5",
    filterLabel: "Equipamentos J&J (Intuitiv · Signature · Faros)",
    equipmentFilter: ["Intuitiv", "Signature", "Faros"],
  },
  "ofta-phacolog-2025": {
    name: "Ofta",
    shortName: "Ofta",
    color: "#004B87",
    darkColor: "#003366",
    bgColor: "#EEF4FF",
    filterLabel: "Todas as cirurgias do programa",
    equipmentFilter: null,
  },
};

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS });
  }

  const auth = req.headers.get("Authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const config = PARTNER_TOKENS[token];

  if (!config) {
    return json({ error: "Token inválido ou expirado." }, 401);
  }

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );

  // 1. Fetch surgeries (no PII columns)
  let surgQ = sb.from("surgeries").select(
    "id, surgery_date, eye, technique, equipment, cat_grade, " +
    "lio_model, lio_power, lio_type, lio_material, " +
    "surgeon_name, supervisor, anesthesia, has_complication, " +
    "mental_confidence, mental_control, mental_stress"
  ).order("surgery_date", { ascending: false });

  if (config.equipmentFilter) {
    surgQ = surgQ.in("equipment", config.equipmentFilter);
  }

  const { data: surgeries, error: surgErr } = await surgQ;
  if (surgErr) {
    console.error("surgeries error:", surgErr.message);
    return json({ error: "Erro ao buscar cirurgias." }, 500);
  }
  if (!surgeries || surgeries.length === 0) {
    return json({ partner: config, surgeries: [], generated_at: new Date().toISOString() });
  }

  const ids = surgeries.map((s: { id: string }) => s.id);

  // 2. Fetch complications for these surgeries (separate query — FK may not be declared)
  const { data: complications } = await sb
    .from("complications")
    .select("surgery_id, name")
    .in("surgery_id", ids);

  // 3. Fetch followups for these surgeries
  const { data: followups } = await sb
    .from("followups")
    .select("surgery_id, type, completed_at, visual_acuity, avcc, pio, refraction")
    .in("surgery_id", ids);

  // 4. Index by surgery_id for O(1) merge
  const complMap: Record<string, { name: string }[]> = {};
  for (const c of complications ?? []) {
    if (!complMap[c.surgery_id]) complMap[c.surgery_id] = [];
    complMap[c.surgery_id].push({ name: c.name });
  }

  const followMap: Record<string, object[]> = {};
  for (const f of followups ?? []) {
    if (!followMap[f.surgery_id]) followMap[f.surgery_id] = [];
    followMap[f.surgery_id].push({
      type: f.type,
      completed_at: f.completed_at,
      visual_acuity: f.visual_acuity,
      avcc: f.avcc,
      pio: f.pio,
      refraction: f.refraction,
    });
  }

  // 5. Attach to surgeries
  const enriched = surgeries.map((s: Record<string, unknown>) => {
    const sid = s.id as string;
    return { ...s, complications: complMap[sid] ?? [], followups: followMap[sid] ?? [] };
  });

  return json({
    partner: {
      name: config.name,
      shortName: config.shortName,
      color: config.color,
      darkColor: config.darkColor,
      bgColor: config.bgColor,
      filterLabel: config.filterLabel,
    },
    surgeries: enriched,
    generated_at: new Date().toISOString(),
  });
});
