import { createClient } from "@supabase/supabase-js";

function isPlaceholder(v) {
  if (!v) return true;
  const s = String(v).trim();
  return s.startsWith("__put_") || s.includes("__put_your_");
}

let _cached = null;
let _cacheKey = "";

export function getSupabaseAnonMissingKeys() {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  const missing = [];
  if (isPlaceholder(url)) missing.push("SUPABASE_URL");
  if (isPlaceholder(anonKey)) missing.push("SUPABASE_ANON_KEY");
  return missing;
}

export function getSupabaseAnon() {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey || isPlaceholder(url) || isPlaceholder(anonKey))
    return null;

  const nextKey = `${url.length}:${anonKey.length}`;
  if (_cached && _cacheKey === nextKey) return _cached;

  _cached = createClient(url, anonKey, { auth: { persistSession: false } });
  _cacheKey = nextKey;
  return _cached;
}



