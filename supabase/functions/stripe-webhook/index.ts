// Phacolog — Stripe Webhook Handler
// POST /functions/v1/stripe-webhook
//
// Eventos tratados:
//   checkout.session.completed      → ativa assinatura
//   invoice.payment_succeeded       → renova período
//   customer.subscription.updated   → atualiza status / período
//   customer.subscription.deleted   → cancela assinatura
//
// Secrets necessários (supabase secrets set):
//   STRIPE_SECRET_KEY
//   STRIPE_WEBHOOK_SECRET

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14?target=deno";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-04-10",
  httpClient: Stripe.createFetchHttpClient(),
});

const sb = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } }
);

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const body = await req.text();
  const sig  = req.headers.get("stripe-signature");
  const secret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, sig!, secret);
  } catch (err) {
    console.error("Webhook signature error:", err);
    return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 400 });
  }

  try {
    switch (event.type) {

      // ── Checkout concluído → primeira ativação ──────────────────────────
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId      = session.client_reference_id;   // user_id passado no link
        const customerId  = session.customer as string;
        const subId       = session.subscription as string;

        if (!userId) { console.warn("checkout.session sem client_reference_id"); break; }

        const sub = await stripe.subscriptions.retrieve(subId);
        const plan = sub.items.data[0]?.price?.recurring?.interval === "year" ? "annual" : "monthly";

        await sb.from("subscriptions").upsert({
          user_id:                userId,
          status:                 "active",
          plan,
          stripe_customer_id:     customerId,
          stripe_subscription_id: subId,
          current_period_end:     new Date(sub.current_period_end * 1000).toISOString(),
          updated_at:             new Date().toISOString(),
        }, { onConflict: "user_id" });

        console.log(`Assinatura ativada: user=${userId} plan=${plan}`);
        break;
      }

      // ── Pagamento de fatura → renova período ────────────────────────────
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        if (!invoice.subscription) break;

        const sub = await stripe.subscriptions.retrieve(invoice.subscription as string);
        await sb.from("subscriptions")
          .update({
            status:            "active",
            current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
            updated_at:        new Date().toISOString(),
          })
          .eq("stripe_subscription_id", sub.id);

        console.log(`Assinatura renovada: sub=${sub.id}`);
        break;
      }

      // ── Assinatura atualizada (upgrade, downgrade, status) ──────────────
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const plan = sub.items.data[0]?.price?.recurring?.interval === "year" ? "annual" : "monthly";

        await sb.from("subscriptions")
          .update({
            status:            sub.status === "active" ? "active" : sub.status,
            plan,
            current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
            updated_at:        new Date().toISOString(),
          })
          .eq("stripe_subscription_id", sub.id);

        console.log(`Assinatura atualizada: sub=${sub.id} status=${sub.status}`);
        break;
      }

      // ── Assinatura cancelada ────────────────────────────────────────────
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;

        await sb.from("subscriptions")
          .update({
            status:     "canceled",
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_subscription_id", sub.id);

        console.log(`Assinatura cancelada: sub=${sub.id}`);
        break;
      }

      default:
        console.log(`Evento ignorado: ${event.type}`);
    }
  } catch (err) {
    console.error("Erro ao processar evento:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
