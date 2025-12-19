import { createClient } from "@supabase/supabase-js";

function isPlaceholder(v) {
  if (!v) return true;
  const s = String(v).trim();
  return s.startsWith("__put_") || s.includes("__put_your_");
}

/**
 * Admin client (Service Role)
 *
 * In local/dev environments it's common to not have Supabase configured.
 * Previously this module threw on import, preventing the server from starting at all.
 * We degrade gracefully: return `null` when not configured, and let callers handle it.
 */
let _cached = null;
let _cacheKey = "";

export function getSupabaseAdminMissingKeys() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const missing = [];
  if (isPlaceholder(url)) missing.push("SUPABASE_URL");
  if (isPlaceholder(serviceKey)) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  return missing;
}

export function isSupabaseAdminEnabled() {
  return getSupabaseAdminMissingKeys().length === 0;
}

export function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey || isPlaceholder(url) || isPlaceholder(serviceKey))
    return null;

  const nextKey = `${url.length}:${serviceKey.length}`; // do not store secrets; only stable shape
  if (_cached && _cacheKey === nextKey) return _cached;

  _cached = createClient(url, serviceKey, { auth: { persistSession: false } });
  _cacheKey = nextKey;
  return _cached;
}
