-- Repair: auto-create profiles on signup + backfill + RPC fallback
-- Run once in Supabase SQL Editor (idempotent).

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, plan, tokens_balance, tokens_period_start)
  VALUES (NEW.id, 'free', 10000, timezone('utc'::text, now()))
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

INSERT INTO public.profiles (user_id, plan, tokens_balance, tokens_period_start)
SELECT u.id, 'free', 10000, timezone('utc'::text, now())
FROM auth.users u
LEFT JOIN public.profiles p ON p.user_id = u.id
WHERE p.user_id IS NULL
ON CONFLICT (user_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.ensure_my_profile()
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  row public.profiles;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;

  INSERT INTO public.profiles (user_id, plan, tokens_balance, tokens_period_start)
  VALUES (uid, 'free', 10000, timezone('utc'::text, now()))
  ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO row FROM public.profiles WHERE user_id = uid;
  RETURN row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_my_profile() TO authenticated;

NOTIFY pgrst, 'reload schema';
