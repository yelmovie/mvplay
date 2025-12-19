import { createClient } from "@supabase/supabase-js";

function isPlaceholder(v) {
  if (!v) return true;
  const s = String(v).trim();
  return s.startsWith("__put_") || s.includes("__put_your_");
}

/**
 * User-scoped client (Anon key)
 *
 * Do NOT throw on import: allow server to start even if Supabase isn't configured.
 * Callers should handle missing config at request-time.
 */
export function getSupabaseUserMissingKeys() {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  const missing = [];
  if (isPlaceholder(url)) missing.push("SUPABASE_URL");
  if (isPlaceholder(anonKey)) missing.push("SUPABASE_ANON_KEY");
  return missing;
}

export function isSupabaseUserEnabled() {
  return getSupabaseUserMissingKeys().length === 0;
}

function getSupabaseUserConfig() {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  return { url, anonKey };
}

function assertSupabaseUserEnabled() {
  if (!isSupabaseUserEnabled()) {
    const missing = getSupabaseUserMissingKeys().join(", ");
    throw new Error(`Supabase not configured (missing: ${missing})`);
  }
}

/**
 * 토큰으로 사용자 확인
 */
export async function getUserFromToken(token) {
  assertSupabaseUserEnabled();
  const { url, anonKey } = getSupabaseUserConfig();
  const supabase = createClient(url, anonKey);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);
  if (error || !user) {
    throw new Error("Invalid or expired token");
  }
  return user;
}

/**
 * 유저 컨텍스트 주입 후 DB insert 수행
 */
export async function insertScriptAsUser(token, payload) {
  assertSupabaseUserEnabled();
  const { url, anonKey } = getSupabaseUserConfig();
  const supabase = createClient(url, anonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });

  // payload mapping:
  // topic_title, grade_band, duration_min, group_size, script_json, created_by
  const { data, error } = await supabase
    .from("scripts")
    .insert(payload)
    .select("id, topic_title, created_at")
    .single();

  if (error) {
    console.error("DB Insert Error:", error.message);
    throw new Error("Database insertion failed");
  }

  return data;
}

/**
 * 유저 컨텍스트로 스크립트 조회 (RLS 적용)
 */
export async function getScriptByIdAsUser(token, scriptId) {
  assertSupabaseUserEnabled();
  const { url, anonKey } = getSupabaseUserConfig();
  const supabase = createClient(url, anonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });

  const { data, error } = await supabase
    .from("scripts")
    .select(
      "id, topic_title, script_json, created_by, duration_min, group_size"
    )
    .eq("id", scriptId)
    .single();

  if (error || !data) {
    console.error("DB Select Error:", error?.message);
    throw new Error("Script not found or access denied");
  }

  return data;
}
