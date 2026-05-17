-- subscriptions: controle de assinaturas Pro
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status                 TEXT        NOT NULL DEFAULT 'free',  -- 'active' | 'canceled' | 'past_due'
  plan                   TEXT        DEFAULT 'monthly',        -- 'monthly' | 'annual'
  stripe_customer_id     TEXT,
  stripe_subscription_id TEXT,
  current_period_end     TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Usuário lê apenas a própria assinatura
CREATE POLICY "read own subscription" ON public.subscriptions
  FOR SELECT USING (auth.uid() = user_id);

-- Escrita somente via service_role (webhook Stripe)
-- (sem política de INSERT/UPDATE = bloqueado para anon/authenticated)

-- Índice para lookup por customer_id no webhook
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_user_id_idx       ON public.subscriptions(user_id);
CREATE INDEX        IF NOT EXISTS subscriptions_stripe_cust_idx   ON public.subscriptions(stripe_customer_id);
CREATE INDEX        IF NOT EXISTS subscriptions_stripe_sub_idx    ON public.subscriptions(stripe_subscription_id);
