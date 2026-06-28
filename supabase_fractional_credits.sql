-- Fractional credit debits (e.g. 2.5 credits per agent / Launch Radar run)
ALTER TABLE public.profiles
  ALTER COLUMN search_count TYPE DOUBLE PRECISION USING search_count::double precision;
