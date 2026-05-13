-- Rate limiting table for Edge Functions
-- Only accessible by service role (bypasses RLS). No public policies.
CREATE TABLE IF NOT EXISTS public.rate_limits (
  key        TEXT        PRIMARY KEY,
  count      INTEGER     NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
