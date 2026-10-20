-- Prompt desk usage: lifetime quick-tool calls + daily embed boxes.
-- Run in the Supabase SQL Editor. Safe to re-run.
-- Clients cannot update the counters directly. Only the functions below write them.

CREATE TABLE IF NOT EXISTS public.prompt_desk_usage (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tool_calls INTEGER NOT NULL DEFAULT 0 CHECK (tool_calls >= 0),
  embed_day DATE,
  embed_count INTEGER NOT NULL DEFAULT 0 CHECK (embed_count >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.prompt_desk_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select own prompt desk usage" ON public.prompt_desk_usage;
CREATE POLICY "select own prompt desk usage"
ON public.prompt_desk_usage
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.consume_prompt_tool_call()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  plan text;
  calls integer;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'auth');
  END IF;

  SELECT p.plan INTO plan
  FROM public.profiles p
  WHERE p.user_id = uid;

  IF plan = 'pro' THEN
    RETURN jsonb_build_object('ok', true, 'unlimited', true);
  END IF;

  INSERT INTO public.prompt_desk_usage (user_id)
  VALUES (uid)
  ON CONFLICT (user_id) DO NOTHING;

  UPDATE public.prompt_desk_usage
  SET tool_calls = tool_calls + 1,
      updated_at = timezone('utc'::text, now())
  WHERE user_id = uid
    AND tool_calls < 3
  RETURNING tool_calls INTO calls;

  IF calls IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'limit');
  END IF;

  RETURN jsonb_build_object('ok', true, 'toolCalls', calls);
END;
$$;

CREATE OR REPLACE FUNCTION public.touch_prompt_embed_day(p_day date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  plan text;
  next_count integer;
BEGIN
  IF uid IS NULL OR p_day IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'auth');
  END IF;

  SELECT p.plan INTO plan
  FROM public.profiles p
  WHERE p.user_id = uid;

  IF plan = 'pro' THEN
    RETURN jsonb_build_object('ok', true, 'unlimited', true, 'embedCount', 0);
  END IF;

  SELECT u.embed_count INTO next_count
  FROM public.prompt_desk_usage u
  WHERE u.user_id = uid
    AND u.embed_day IS NOT DISTINCT FROM p_day;

  RETURN jsonb_build_object('ok', true, 'embedCount', COALESCE(next_count, 0));
END;
$$;

CREATE OR REPLACE FUNCTION public.add_prompt_embed_box(p_day date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  plan text;
  next_count integer;
BEGIN
  IF uid IS NULL OR p_day IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'auth');
  END IF;

  SELECT p.plan INTO plan
  FROM public.profiles p
  WHERE p.user_id = uid;

  IF plan = 'pro' THEN
    RETURN jsonb_build_object('ok', true, 'unlimited', true, 'embedCount', 0);
  END IF;

  INSERT INTO public.prompt_desk_usage (user_id, embed_day, embed_count)
  VALUES (uid, p_day, 1)
  ON CONFLICT (user_id) DO NOTHING;

  UPDATE public.prompt_desk_usage
  SET embed_count = CASE
        WHEN embed_day IS DISTINCT FROM p_day THEN 1
        ELSE embed_count + 1
      END,
      embed_day = p_day,
      updated_at = timezone('utc'::text, now())
  WHERE user_id = uid
    AND (embed_day IS DISTINCT FROM p_day OR embed_count < 3)
  RETURNING embed_count INTO next_count;

  IF next_count IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'limit');
  END IF;

  RETURN jsonb_build_object('ok', true, 'embedCount', next_count);
END;
$$;

REVOKE ALL ON FUNCTION public.consume_prompt_tool_call() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.touch_prompt_embed_day(date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.add_prompt_embed_box(date) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.consume_prompt_tool_call() TO authenticated;
GRANT EXECUTE ON FUNCTION public.touch_prompt_embed_day(date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_prompt_embed_box(date) TO authenticated;

NOTIFY pgrst, 'reload schema';
