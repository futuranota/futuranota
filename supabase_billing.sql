-- Stripe billing + referral rewards (run in Supabase SQL Editor — idempotent)

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS billing_status TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referral_credits_balance DOUBLE PRECISION NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.affiliates (
  code TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT affiliates_user_id_key UNIQUE (user_id)
);

CREATE TABLE IF NOT EXISTS public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_subscription_id TEXT,
  reward_credits INT NOT NULL DEFAULT 50,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT referrals_referred_user_id_key UNIQUE (referred_user_id)
);

CREATE INDEX IF NOT EXISTS referrals_referrer_user_id_idx ON public.referrals (referrer_user_id);

ALTER TABLE public.affiliates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select own affiliate" ON public.affiliates;
CREATE POLICY "select own affiliate" ON public.affiliates
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "select own referrals as referrer" ON public.referrals;
CREATE POLICY "select own referrals as referrer" ON public.referrals
  FOR SELECT USING (auth.uid() = referrer_user_id);

-- Inserts/updates: service role (webhook) only — no client policies.

NOTIFY pgrst, 'reload schema';
