-- Futura Nota — vacuum hot tables (run alone in SQL Editor; not inside a transaction).
VACUUM (ANALYZE) public.campaigns;
VACUUM (ANALYZE) public.nodes;
VACUUM (ANALYZE) public.canvas_nodes;
