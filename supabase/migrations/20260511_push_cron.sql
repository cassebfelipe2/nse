-- Daily push notification cron job
-- Runs at 23:00 UTC = 20:00 BRT (UTC-3)
-- Requires pg_cron + pg_net extensions (both enabled by default on Supabase)

-- Enable extensions (idempotent)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove existing job if present, then recreate
SELECT cron.unschedule('phacolog-push-daily') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'phacolog-push-daily'
);

SELECT cron.schedule(
  'phacolog-push-daily',
  '0 23 * * *',
  $$
  SELECT net.http_post(
    url     := 'https://lvvlapgsrljvjenneobf.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type',    'application/json',
      'x-cron-secret',   current_setting('app.cron_secret', true)
    ),
    body    := '{}'::jsonb
  );
  $$
);

-- Store the cron secret in Postgres settings so the cron job can read it.
-- IMPORTANT: run this separately with your actual CRON_SECRET value:
--   ALTER DATABASE postgres SET app.cron_secret = '<your-cron-secret>';
-- The same value must be set in Supabase Edge Function secrets as CRON_SECRET.
