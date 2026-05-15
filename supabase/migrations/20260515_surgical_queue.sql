-- surgical_queue: fila de indicações para olho contralateral
CREATE TABLE IF NOT EXISTS public.surgical_queue (
  id           TEXT        PRIMARY KEY,
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pat_local_id TEXT        NOT NULL,
  eye          TEXT,
  cat_grade    TEXT,
  difficulty   TEXT,
  obs          TEXT,
  done         BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at   TEXT,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.surgical_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own queue" ON public.surgical_queue;
CREATE POLICY "own queue" ON public.surgical_queue FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
