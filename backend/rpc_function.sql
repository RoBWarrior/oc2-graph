-- Run this in Supabase SQL Editor AFTER the schema.sql
-- This creates a safe read-only SQL execution function

CREATE OR REPLACE FUNCTION execute_sql(query TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
  query_upper TEXT;
BEGIN
  -- Safety check: only allow SELECT statements
  query_upper := UPPER(TRIM(query));
  IF query_upper NOT LIKE 'SELECT%' THEN
    RAISE EXCEPTION 'Only SELECT queries are allowed';
  END IF;
  
  -- Block dangerous keywords
  IF query_upper LIKE '%DROP%' OR 
     query_upper LIKE '%DELETE%' OR 
     query_upper LIKE '%INSERT%' OR 
     query_upper LIKE '%UPDATE%' OR
     query_upper LIKE '%TRUNCATE%' OR
     query_upper LIKE '%ALTER%' THEN
    RAISE EXCEPTION 'Query contains forbidden keywords';
  END IF;

  EXECUTE 'SELECT jsonb_agg(row_to_json(t)) FROM (' || query || ') t' INTO result;
  RETURN COALESCE(result, '[]'::jsonb);
END;
$$;

-- Grant execute permission to anon role
GRANT EXECUTE ON FUNCTION execute_sql(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION execute_sql(TEXT) TO authenticated;