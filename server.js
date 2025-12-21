import fs from "fs";
import dotenv from "dotenv";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";

import { callUpstageChat } from "./services/upstageClient.js";
import {
  getSupabaseAdmin,
  getSupabaseAdminMissingKeys,
} from "./services/supabaseAdmin.js";
import {
  getSupabaseAnon,
  getSupabaseAnonMissingKeys,
} from "./services/supabaseAnon.js";
import { buildScriptDocx } from "./export/docBuilder.js";
import { buildDocx } from "./services/docxBuilder.js";

const app = express();
app.use(helmet());
// Body parser (JSON). If JSON is invalid, we return a friendly 400 JSON (see error handler below).
app.use(express.json({ limit: "1mb" }));

function apiError(
  res,
  status,
  { code, message, field, where, extra, requestId } = {}
) {
  const payload = {
    ok: false,
    ...(requestId ? { requestId } : {}),
    ...(where ? { where } : {}),
    error: {
      code: code || "INTERNAL_ERROR",
      message: message || "internal_error",
      ...(field ? { field } : {}),
      ...(extra && typeof extra === "object" ? extra : {}),
    },
  };
  return res.status(status).json(payload);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Load environment variables from local files (without hardcoding secrets).
 *
 * Note: Some environments block `.env` file generation. We also support `env.local`.
 * Priority: env.local -> .env
 */
const envCandidates = [
  path.resolve(process.cwd(), "env.local"),
  path.resolve(process.cwd(), ".env"),
];

const loadedFrom = [];
for (const p of envCandidates) {
  if (fs.existsSync(p)) {
    dotenv.config({ path: p });
    loadedFrom.push(path.basename(p));
  }
}

function isPlaceholder(v) {
  if (!v) return true;
  const s = String(v).trim();
  return s.startsWith("__put_") || s.includes("__put_your_");
}

function missingKeys(keys) {
  return keys.filter((k) => isPlaceholder(process.env[k]));
}

function getMissingUpstage() {
  return missingKeys(["UPSTAGE_API_KEY", "UPSTAGE_BASE_URL"]);
}

function getMissingAuthEnv() {
  // Login feature removed: no auth env is required.
  return [];
}

console.log(
  `[env] loadedFrom=${loadedFrom.length ? loadedFrom.join(",") : "none"} ` +
    `upstage=${
      getMissingUpstage().length
        ? "missing:" + getMissingUpstage().join(",")
        : "ok"
    } ` +
    `auth=${
      getMissingAuthEnv().length
        ? "missing:" + getMissingAuthEnv().join(",")
        : "ok"
    } ` +
    `supabaseAdmin=${
      getSupabaseAdminMissingKeys().length
        ? "missing:" + getSupabaseAdminMissingKeys().join(",")
        : "ok"
    }`
);

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: Number(process.env.RATE_LIMIT_PER_MIN || 30),
});

// [Fix] Handle favicon.ico explicitly to avoid 500s from heavy middlewares
app.get("/favicon.ico", (req, res) => res.status(204).end());

app.use("/api/", limiter);

function getCookie(req, name) {
  const cookie = req.headers?.cookie;
  if (!cookie) return "";
  const parts = cookie.split(";").map((s) => s.trim());
  for (const p of parts) {
    if (!p) continue;
    const idx = p.indexOf("=");
    if (idx === -1) continue;
    const k = p.slice(0, idx).trim();
    if (k !== name) continue;
    return decodeURIComponent(p.slice(idx + 1));
  }
  return "";
}

function setCookie(res, name, value, opts = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  if (opts.maxAgeSec) parts.push(`Max-Age=${opts.maxAgeSec}`);
  if (opts.path) parts.push(`Path=${opts.path}`);
  if (opts.httpOnly) parts.push("HttpOnly");
  if (opts.sameSite) parts.push(`SameSite=${opts.sameSite}`);
  if (opts.secure) parts.push("Secure");
  res.setHeader("Set-Cookie", parts.join("; "));
}

function signAdminCookieValue() {
  const secret = String(process.env.ADMIN_PANEL_PASSWORD || "");
  const payload = "1"; // fixed payload, signed (prevents user forging cookie)
  const mac = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("base64url");
  return `${payload}.${mac}`;
}

function verifyAdminCookieValue(v) {
  const secret = String(process.env.ADMIN_PANEL_PASSWORD || "");
  if (!secret) return false;
  const [payload, mac] = String(v || "").split(".");
  if (payload !== "1" || !mac) return false;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("base64url");
  try {
    return crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expected));
  } catch {
    return false;
  }
}

function requireAdmin(req, res) {
  const cookie = getCookie(req, "admin_auth");
  if (!verifyAdminCookieValue(cookie)) {
    res.status(401).json({ ok: false, error: "unauthorized" });
    return false;
  }
  return true;
}

// Protect admin pages even though they are static.
app.use((req, res, next) => {
  if (
    req.path === "/admin/suggestions.html" ||
    req.path.startsWith("/admin/")
  ) {
    // allow admin login page static
    if (req.path === "/admin.html") return next();
    // allow admin assets under /admin/* only if authed
    if (!verifyAdminCookieValue(getCookie(req, "admin_auth"))) {
      return res.redirect("/admin.html");
    }
  }
  return next();
});

// First entry: redirect "/" to the subject selector screen.
// (Routing/flow change only — does not touch any generator logic.)
app.get("/", (req, res) => {
  return res.redirect(302, "/subjects/");
});

// 정적 파일 서빙
app.use(express.static(path.join(__dirname, "public")));

/**
 * /api/voice (stub)
 * - Some clients/browsers may probe this endpoint.
 * - We return 200 JSON to avoid noisy 404 "Failed to load resource" errors.
 * - Not implemented yet: keep feature intact without breaking the app.
 */
app.all("/api/voice", (req, res) => {
  return res.json({
    ok: false,
    error: { code: "NOT_IMPLEMENTED", message: "Voice API is not implemented" },
  });
});

/**
 * Server-side "teacher" identity
 *
 * DB schema requires `scripts.created_by` to reference `auth.users(id)` (uuid, NOT NULL).
 * Since we no longer do client-side Supabase auth, we create/ensure a single internal
 * teacher user in Supabase Auth (service role only) and use its uuid for all inserts.
 *
 * IMPORTANT: Never expose service role key to the browser.
 */
let _cachedTeacherUserId = null;
let _cachedTeacherRole = null;

function getTeacherEmail() {
  // local-only domain; does not need to be a real mailbox
  return `teacher@local.invalid`;
}

async function ensureTeacherProfile(uid) {
  const admin = getSupabaseAdmin();
  if (!admin) return { role: null };

  // One source of truth for role: profiles.role
  await admin
    .from("profiles")
    .upsert({ id: uid, role: "teacher" }, { onConflict: "id" });

  const { data } = await admin
    .from("profiles")
    .select("role")
    .eq("id", uid)
    .maybeSingle();

  const role = data?.role || "teacher";
  if (_cachedTeacherUserId === uid) _cachedTeacherRole = role;
  return { role };
}

async function getOrCreateTeacherUserId() {
  if (_cachedTeacherUserId) return _cachedTeacherUserId;

  const missingAdmin = getSupabaseAdminMissingKeys();
  const admin = getSupabaseAdmin();
  if (!admin) {
    const err = new Error(
      `Supabase admin not configured (missing: ${missingAdmin.join(", ")})`
    );
    err.code = "SUPABASE_ADMIN_MISSING";
    err.missing = missingAdmin;
    throw err;
  }

  const email = getTeacherEmail();

  const { data: listData, error: listErr } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  if (listErr) throw listErr;

  const existing = (listData?.users || []).find((u) => u.email === email);
  if (existing?.id) {
    _cachedTeacherUserId = existing.id;
    return _cachedTeacherUserId;
  }

  // Create an internal user so FK constraint on `scripts.created_by` is satisfied.
  const randomPass = crypto.randomBytes(24).toString("base64url");
  const { data: created, error: createErr } = await admin.auth.admin.createUser(
    {
      email,
      password: randomPass,
      email_confirm: true,
    }
  );
  if (createErr) throw createErr;
  if (!created?.user?.id)
    throw new Error("Failed to create internal teacher user");

  _cachedTeacherUserId = created.user.id;
  return _cachedTeacherUserId;
}

/**
 * Login removed: always attach a server-side teacher context.
 * This keeps DB FK constraints satisfied via an internal Supabase Auth user.
 */
async function attachTeacherContext(req, res, next) {
  try {
    const uid = await getOrCreateTeacherUserId();
    const { role } = await ensureTeacherProfile(uid);
    req.auth = { role: role || "teacher", sub: "server", uid };
    return next();
  } catch (e) {
    console.error("Auth Context Error:", e.message);
    const requestId = String(req.get("x-request-id") || "").trim();
    return apiError(res, 503, {
      requestId: requestId || undefined,
      where: "supabase",
      code: "SUPABASE_ADMIN_NOT_CONFIGURED",
      message: "Supabase admin not configured",
      extra:
        process.env.NODE_ENV !== "production"
          ? { missing: getSupabaseAdminMissingKeys() }
          : undefined,
    });
  }
}

/**
 * /api/health
 * Env + Supabase 연결 확인 (민감정보 출력 금지)
 */
app.get("/api/health", async (req, res) => {
  try {
    const missing = [...getSupabaseAdminMissingKeys(), ...getMissingUpstage()];

    // Let the user know if insecure defaults are in effect (still ok for local dev).
    const usingDefaultCreds = false;

    if (missing.length) {
      return res.json({ ok: false, where: "env", missing, usingDefaultCreds });
    }

    const admin = getSupabaseAdmin();
    const { error } = await admin.from("topics").select("id").limit(1);
    if (error) throw error;

    return res.json({ ok: true, usingDefaultCreds });
  } catch (e) {
    console.error("Health Check Error:", e.message);
    return res
      .status(500)
      .json({ ok: false, where: "supabase", error: e.message });
  }
});

/**
 * POST /api/suggestions
 * Public endpoint: anyone can submit. Insert is done via Supabase anon key + RLS.
 */
app.post("/api/suggestions", async (req, res) => {
  try {
    const { message, category, page, ua } = req.body || {};
    if (typeof message !== "string" || message.trim().length < 20)
      return res
        .status(400)
        .json({ ok: false, error: "validation_failed", field: "message" });
    if (message.trim().length > 1000)
      return res
        .status(400)
        .json({ ok: false, error: "validation_failed", field: "message" });

    const anon = getSupabaseAnon();
    if (!anon) {
      return res.status(503).json({
        ok: false,
        where: "supabase",
        error: "Supabase anon not configured",
        missing: getSupabaseAnonMissingKeys(),
      });
    }

    const payload = {
      message: message.trim(),
      category:
        typeof category === "string" && category.trim()
          ? category.trim().slice(0, 40)
          : null,
      page:
        typeof page === "string" && page.trim()
          ? page.trim().slice(0, 200)
          : null,
      ua: typeof ua === "string" && ua.trim() ? ua.trim().slice(0, 300) : null,
    };

    const { error } = await anon.from("suggestions").insert(payload);
    if (error) throw error;
    return res.json({ ok: true });
  } catch (e) {
    console.error("Suggestions Error:", e?.stack || e);
    return res.status(500).json({ ok: false, error: "submit_failed" });
  }
});

/**
 * POST /api/admin/login
 * Compares env password and sets HttpOnly cookie.
 */
app.post("/api/admin/login", (req, res) => {
  const envPw = String(process.env.ADMIN_PANEL_PASSWORD || "");
  if (!envPw) {
    return res
      .status(503)
      .json({ ok: false, error: "admin_password_not_configured" });
  }
  const pw = String(req.body?.password || "");
  if (!pw)
    return res
      .status(400)
      .json({ ok: false, error: "validation_failed", field: "password" });
  if (pw !== envPw)
    return res.status(401).json({ ok: false, error: "invalid_password" });

  const val = signAdminCookieValue();
  setCookie(res, "admin_auth", val, {
    httpOnly: true,
    sameSite: "Lax",
    path: "/",
    maxAgeSec: 60 * 60 * 24 * 7,
    secure: process.env.NODE_ENV === "production",
  });
  return res.json({ ok: true });
});

/**
 * GET /api/admin/suggestions
 * Admin-only: list suggestions using service role (server only).
 */
app.get("/api/admin/suggestions", async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;
    const admin = getSupabaseAdmin();
    if (!admin) {
      return res.status(503).json({
        ok: false,
        requestId,
        error: {
          code: "SUPABASE_ADMIN_NOT_CONFIGURED",
          message: "Supabase admin not configured",
        },
      });
    }
    const { data, error } = await admin
      .from("suggestions")
      .select("id, created_at, message, category, page, ua, status, admin_note")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    return res.json({ ok: true, items: data || [] });
  } catch (e) {
    console.error("Admin Suggestions List Error:", e?.stack || e);
    return res.status(500).json({ ok: false, error: "list_failed" });
  }
});

/**
 * PATCH /api/admin/suggestions/:id
 * Admin-only: update status/admin_note using service role.
 */
app.patch("/api/admin/suggestions/:id", async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;
    const id = String(req.params?.id || "");
    const status = String(req.body?.status || "").trim();
    const admin_note = String(req.body?.admin_note || "");
    const allowed = ["new", "triaged", "done"];
    if (!id)
      return res
        .status(400)
        .json({ ok: false, error: "validation_failed", field: "id" });
    if (status && !allowed.includes(status))
      return res
        .status(400)
        .json({ ok: false, error: "validation_failed", field: "status" });
    if (admin_note.length > 2000)
      return res
        .status(400)
        .json({ ok: false, error: "validation_failed", field: "admin_note" });

    const admin = getSupabaseAdmin();
    if (!admin) {
      return res.status(503).json({
        ok: false,
        where: "supabase",
        error: "Supabase admin not configured",
        missing: getSupabaseAdminMissingKeys(),
      });
    }
    const patch = {};
    if (status) patch.status = status;
    if (typeof admin_note === "string") patch.admin_note = admin_note;
    const { data, error } = await admin
      .from("suggestions")
      .update(patch)
      .eq("id", id)
      .select("id, status, admin_note")
      .single();
    if (error) throw error;
    return res.json({ ok: true, item: data });
  } catch (e) {
    console.error("Admin Suggestions Patch Error:", e?.stack || e);
    return res.status(500).json({ ok: false, error: "update_failed" });
  }
});

function validateGenerateInput(body) {
  const b = body || {};
  const subjectRaw = b.subject;
  const topic = b.topic;
  const topicRationaleRaw = b.topicRationale ?? b.curriculumRationale;
  const coreValuesRaw = b.coreValues ?? b.core_values;
  const eraRaw = b.era ?? b.topicEra ?? b.topic_era;
  const gradeBand = b.grade_band ?? b.gradeBand;
  const durationMin = b.duration_min ?? b.durationMin;
  const groupSize = b.group_size ?? b.groupSize;
  const scenesCountRaw = b.scenesCount ?? b.scenes_count;
  const charactersCountRaw = b.charactersCount ?? b.characters_count;
  const fastMode = b.fastMode;

  const allowedSubjects = ["국어", "사회", "도덕", "역사", "영어", "english"];
  let subject =
    typeof subjectRaw === "string" && subjectRaw.trim()
      ? subjectRaw.trim()
      : "국어";
  // If an unexpected value arrives, fall back safely instead of failing the request.
  if (!allowedSubjects.includes(subject)) subject = "국어";

  if (typeof topic !== "string" || !topic.trim())
    return { ok: false, field: "topic" };
  if (topic.trim().length > Number(process.env.MAX_TOPIC_LEN || 80))
    return { ok: false, field: "topic" };

  if (
    typeof gradeBand !== "string" ||
    !["LOW", "MID", "HIGH"].includes(gradeBand)
  )
    return { ok: false, field: "grade_band" };

  if (typeof durationMin !== "number" || !Number.isFinite(durationMin))
    return { ok: false, field: "duration_min" };
  if (durationMin < 3 || durationMin > 20)
    return { ok: false, field: "duration_min" };

  if (typeof groupSize !== "number" || !Number.isFinite(groupSize))
    return { ok: false, field: "group_size" };
  if (groupSize < 3 || groupSize > 12)
    return { ok: false, field: "group_size" };

  // optional (achievement-element rationale summary from sample)
  let topicRationale = "";
  if (typeof topicRationaleRaw === "string" && topicRationaleRaw.trim()) {
    topicRationale = topicRationaleRaw.trim();
    if (topicRationale.length > 200)
      return { ok: false, field: "topicRationale" };
  }

  // optional core values (moral subject uses this, but keep generic + safe)
  const allowedCoreValues = ["성실", "배려", "정의", "책임"];
  let coreValues = [];
  if (
    coreValuesRaw !== undefined &&
    coreValuesRaw !== null &&
    coreValuesRaw !== ""
  ) {
    if (!Array.isArray(coreValuesRaw))
      return { ok: false, field: "coreValues" };
    const uniq = Array.from(
      new Set(
        coreValuesRaw
          .map((v) => (typeof v === "string" ? v.trim() : ""))
          .filter(Boolean)
      )
    );
    if (uniq.some((v) => !allowedCoreValues.includes(v)))
      return { ok: false, field: "coreValues" };
    if (uniq.length > 2) return { ok: false, field: "coreValues" };
    coreValues = uniq;
  }

  // optional era (history only)
  const allowedEras = [
    "선사",
    "고대(삼국·통일신라·발해)",
    "고려",
    "조선",
    "개항기·대한제국",
    "일제강점기",
    "광복 이후(현대)",
  ];
  let era = "";
  if (subject === "역사") {
    if (typeof eraRaw === "string" && eraRaw.trim()) {
      const e = eraRaw.trim();
      if (!allowedEras.includes(e)) return { ok: false, field: "era" };
      era = e;
    }
  }

  // optional counts (but if provided by client, must be valid)
  let scenesCount = null;
  if (
    scenesCountRaw !== undefined &&
    scenesCountRaw !== null &&
    scenesCountRaw !== ""
  ) {
    const n = Number(scenesCountRaw);
    if (!Number.isFinite(n)) return { ok: false, field: "scenesCount" };
    if (n < 1 || n > 8) return { ok: false, field: "scenesCount" };
    scenesCount = n;
  }

  let charactersCount = null;
  if (
    charactersCountRaw !== undefined &&
    charactersCountRaw !== null &&
    charactersCountRaw !== ""
  ) {
    const n = Number(charactersCountRaw);
    if (!Number.isFinite(n)) return { ok: false, field: "charactersCount" };
    if (n < 3 || n > 12) return { ok: false, field: "charactersCount" };
    charactersCount = n;
  }

  // optional
  const gradeRaw = b.grade;
  const grade = Number.isFinite(Number(gradeRaw))
    ? Number(gradeRaw)
    : { LOW: 2, MID: 4, HIGH: 6 }[gradeBand] || 4;

  const discussionMode = Boolean(b.options?.discussionMode ?? b.discussionMode);

  return {
    ok: true,
    value: {
      subject,
      topic: topic.trim(),
      topicRationale,
      coreValues,
      era,
      gradeBand,
      durationMin,
      groupSize,
      grade,
      scenesCount,
      charactersCount,
      options: { discussionMode },
      fastMode: fastMode !== false,
    },
  };
}

/**
 * Recommend a scene count when the client doesn't provide one.
 * Keep it simple, stable, and within allowed range (1~8).
 */
function recommendScenesCount({ durationMin, groupSize, discussionMode }) {
  const dur = Number(durationMin) || 5;
  const gs = Number(groupSize) || 5;
  const discuss = Boolean(discussionMode);

  // Base by duration (shorter => fewer scenes)
  let n = dur <= 5 ? 3 : dur <= 8 ? 4 : dur <= 12 ? 5 : 6;

  // Adjust by group size (bigger group can handle a bit more)
  if (gs >= 9) n += 1;
  else if (gs <= 4) n -= 1;

  // Discussion/writing option tends to need more structure
  if (discuss) n += 1;

  // Clamp to safe range (server allows 1~8)
  n = Math.max(1, Math.min(8, n));
  return n;
}

/**
 * /api/generate
 */
app.post("/api/generate", attachTeacherContext, async (req, res) => {
  // Debug helper: allows quick connectivity checks without triggering LLM/DB.
  if (req?.body?.ping === true) {
    return res.json({ ok: true, pong: true });
  }

  const reqId =
    String(req.get("x-request-id") || "").trim() ||
    (crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(6).toString("hex"));
  const t0 = Date.now();
  const deadlineMs = Math.max(
    3000,
    Number(process.env.GENERATE_TIMEOUT_MS || 30000)
  );

  console.log(`[generate:${reqId}] start`);
  let deadlineTimer = null;
  let timedOut = false;

  // [Fix] 1. Env Check (Fail fast if env is missing)
  const hasKey = Boolean(process.env.UPSTAGE_API_KEY);
  console.log(`[generate:${reqId}] payload_diagnosis:`, {
    subject: req.body?.subject,
    topicLen: (req.body?.topic || "").length,
    gradeBand: req.body?.grade_band,
    fastMode: req.body?.fastMode,
    hasUpstageKey: hasKey,
    hasSupabaseKey: Boolean(process.env.SUPABASE_URL),
  });

  if (!hasKey) {
      console.error(`[generate:${reqId}] Missing UPSTAGE_API_KEY`);
      return apiError(res, 500, {
          requestId: reqId,
          code: "ENV_MISSING",
          message: "Server misconfiguration (key missing)",
      });
  }

  try {
    // Hard deadline: never leave the request hanging.
    deadlineTimer = setTimeout(() => {
      if (res.headersSent) return;
      timedOut = true;
      console.warn(
        `[generate:${reqId}] request_timeout after ${deadlineMs}ms (no response sent)`
      );
      apiError(res, 504, {
        requestId: reqId,
        code: "REQUEST_TIMEOUT",
        message: "Request timed out",
        where: "server",
      });
    }, deadlineMs);
  } catch {
    // ignore timer failures
  }

  try {
    const canRespond = () => !timedOut && !res.headersSent;

    const validated = validateGenerateInput(req.body);
    if (!validated.ok) {
      console.log(
        `[generate:${reqId}] validation_failed field=${validated.field}`
      );
      if (!canRespond()) return;
      return res.status(400).json({
        ok: false,
        // New structured error (requested shape)
        error: {
          code: "VALIDATION_FAILED",
          field: validated.field,
          message: `${validated.field} is required`,
        },
        requestId: reqId,
        // Backward-compat (existing client checks these)
        error_code: "validation_failed",
        field: validated.field,
      });
    }

    const missingUpstage = getMissingUpstage();
    if (missingUpstage.length) {
      console.log(
        `[generate:${reqId}] upstage_missing=${missingUpstage.join(",")}`
      );
      if (!canRespond()) return;
      return apiError(res, 503, {
        requestId: reqId,
        where: "upstage",
        code: "UPSTAGE_NOT_CONFIGURED",
        message: "Upstage not configured",
        extra: { missing: missingUpstage },
      });
    }

    const admin = getSupabaseAdmin();
    if (!admin) {
      console.log(
        `[generate:${reqId}] supabase_admin_missing=${getSupabaseAdminMissingKeys().join(
          ","
        )}`
      );
      if (!canRespond()) return;
      return apiError(res, 503, {
        requestId: reqId,
        where: "supabase",
        code: "SUPABASE_ADMIN_NOT_CONFIGURED",
        message: "Supabase admin not configured",
        extra: { missing: getSupabaseAdminMissingKeys() },
      });
    }

    const {
      subject,
      topic,
      topicRationale,
      coreValues,
      era,
      grade,
      gradeBand,
      durationMin,
      groupSize,
      scenesCount,
      charactersCount,
      options,
      fastMode,
    } = validated.value;

    // Fast mode: auto-adjust heavy parameters to make "30s 내 결과" 현실적으로 가능하게.
    const effectiveFastMode = fastMode !== false;
    const adjusted = {};
    const applyAdjust = (key, fromVal, toVal) => {
      if (fromVal !== toVal) adjusted[key] = { from: fromVal, to: toVal };
      return toVal;
    };

    const fastScenesThreshold = Number(process.env.FASTMODE_SCENES_THRESHOLD || 6);
    const fastMaxScenes = Number(process.env.FASTMODE_MAX_SCENES || 4);
    const fastCharsThreshold = Number(process.env.FASTMODE_CHARS_THRESHOLD || 8);
    const fastMaxChars = Number(process.env.FASTMODE_MAX_CHARS || 6);
    const fastDurationThreshold = Number(process.env.FASTMODE_DURATION_THRESHOLD || 10);
    const fastMaxDuration = Number(process.env.FASTMODE_MAX_DURATION || 8);

    const recommendedSceneCount =
      scenesCount === null || scenesCount === undefined
        ? recommendScenesCount({
            durationMin,
            groupSize,
            discussionMode: options?.discussionMode,
          })
        : null;

    const baseScenesCount =
      scenesCount === null || scenesCount === undefined
        ? recommendedSceneCount
        : scenesCount;

    const effScenesCount =
      effectiveFastMode &&
      Number.isFinite(Number(baseScenesCount)) &&
      baseScenesCount > fastScenesThreshold
        ? applyAdjust(
            "scenesCount",
            baseScenesCount,
            Math.min(fastMaxScenes, baseScenesCount)
          )
        : baseScenesCount;
    const effCharsCount =
      effectiveFastMode &&
      Number.isFinite(Number(charactersCount)) &&
      charactersCount > fastCharsThreshold
        ? applyAdjust(
            "charactersCount",
            charactersCount,
            Math.min(fastMaxChars, charactersCount)
          )
        : charactersCount;
    const effDurationMin =
      effectiveFastMode && durationMin > fastDurationThreshold
        ? applyAdjust("duration_min", durationMin, Math.min(fastMaxDuration, durationMin))
        : durationMin;

    // Upstream timeout should be shorter than browser Abort(30s).
    const upstreamTimeoutMs = Math.max(
      3000,
      Math.min(
        deadlineMs - 2000,
        Number(process.env.UPSTAGE_GENERATE_TIMEOUT_MS || 25000)
      )
    );

    console.log(`[generate:${reqId}] upstage_call begin`);
    const result = await callUpstageChat({
      subject,
      topic,
      topicRationale,
      grade,
      gradeBand,
      durationMin: effDurationMin,
      groupSize,
      scenesCount: effScenesCount,
      charactersCount: effCharsCount,
      coreValues,
      era,
      discussionMode: options.discussionMode,
      // Ensure the whole upstream generation (including retry) stays within the upstream budget.
      timeoutMs: upstreamTimeoutMs,
      fastMode: effectiveFastMode,
    });
    console.log(
      `[generate:${reqId}] upstage_call done in ${Date.now() - t0}ms`
    );
    if (!canRespond()) return;

    // include for future extension / client debug (no secrets)
    result.subject = subject;
    result.grade = grade;
    result.gradeBand = gradeBand;
    if (topicRationale) {
      result.header = result.header || {};
      result.header.rationale = topicRationale;
    }
    if (Array.isArray(coreValues) && coreValues.length) {
      result.header = result.header || {};
      // Keep both keys for backward/forward compatibility (SSoT in script JSON).
      result.header.coreValues = coreValues;
      result.header.core_values = coreValues;
    }
    if (era) {
      result.header = result.header || {};
      result.header.era = era;
    }

    const insertPayload = {
      topic_title: topic,
      grade_band: gradeBand,
      duration_min: effDurationMin,
      group_size: groupSize,
      script_json: result,
      created_by: req.auth.uid,
    };

    try {
      console.log(`[generate:${reqId}] db_insert begin`);
      const { data, error } = await admin
        .from("scripts")
        .insert(insertPayload)
        .select("id")
        .single();
      if (error) throw error;

      console.log(
        `[generate:${reqId}] ok scriptId=${data.id} total=${Date.now() - t0}ms`
      );
      const notice = effectiveFastMode
        ? "빠른 생성 모드로 생성했어요"
        : undefined;
      if (!canRespond()) return;
      return res.json({
        ok: true,
        requestId: reqId,
        scriptId: data.id,
        script: result,
        usedSceneCount: effScenesCount,
        ...(recommendedSceneCount !== null
          ? { recommendedSceneCount: recommendedSceneCount }
          : {}),
        ...(notice ? { notice } : {}),
        ...(Object.keys(adjusted).length ? { adjusted } : {}),
        mode: effectiveFastMode ? "fast" : "full",
      });
    } catch (dbErr) {
      console.error("DB Insert Error:", dbErr.message);
      const debugAllowed = process.env.NODE_ENV !== "production";
      // Don't block returning the generated script even if DB insert fails.
      // This prevents "pending forever" UX and keeps core generation usable.
      const notice = "생성은 완료했지만 저장에 실패했어요(임시 결과).";
      if (!canRespond()) return;
      return res.status(200).json({
        ok: true,
        requestId: reqId,
        scriptId: "",
        script: result,
        notice,
        saved: false,
        usedSceneCount: effScenesCount,
        ...(recommendedSceneCount !== null
          ? { recommendedSceneCount: recommendedSceneCount }
          : {}),
        ...(Object.keys(adjusted).length ? { adjusted } : {}),
        mode: effectiveFastMode ? "fast" : "full",
        ...(debugAllowed
          ? { debug: { dbError: String(dbErr?.message || "") } }
          : {}),
      });
    }
  } catch (e) {
    if (res.headersSent || timedOut) {
      console.warn(`[generate:${reqId}] error after response sent:`, e?.code || e?.message || e);
      return;
    }
    console.error("Generate Error:", e?.stack || e);
    if (e?.code === "UPSTREAM_TIMEOUT") {
      return apiError(res, 502, {
        requestId: reqId,
        where: "upstage",
        code: "UPSTREAM_TIMEOUT",
        message: "Model timed out",
      });
    }
    if (e?.code === "UPSTREAM_FETCH_FAILED") {
      return apiError(res, 502, {
        requestId: reqId,
        where: "upstage",
        code: "UPSTREAM_FETCH_FAILED",
        message: "Upstage fetch failed",
      });
    }
    if (e?.code === "UPSTREAM_ERROR") {
      return apiError(res, 502, {
        requestId: reqId,
        where: "upstage",
        code: "UPSTREAM_ERROR",
        message: "Upstage returned error",
        extra: { status: e?.status },
      });
    }

    // [Fix] 502 Bad Gateway for Invalid JSON (instead of safeParse crash)
    if (e?.code === "INVALID_JSON_FROM_MODEL") {
      return apiError(res, 502, {
        requestId: reqId,
        where: "model_output",
        code: "MODEL_BAD_JSON",
        message: "Model response was not valid JSON",
        // Safer to truncate preview to avoid gigantic logs or response bloat
        rawPreview: (e.sample || "").slice(0, 400),
      });
    }
    if (
      e?.code === "INVALID_JSON_FROM_MODEL" ||
      e?.message === "INVALID_JSON_FROM_MODEL"
    ) {
      const debugAllowed = process.env.NODE_ENV !== "production";
      const sample =
        debugAllowed && typeof e?.sample === "string" ? e.sample : undefined;
      const detail =
        debugAllowed && typeof e?.detail === "string" ? e.detail : undefined;
      return res.status(502).json({
        ok: false,
        error: {
          code: "INVALID_JSON_FROM_MODEL",
          message: "Model response was not valid JSON",
        },
        requestId: reqId,
        error_code: "INVALID_JSON_FROM_MODEL",
        ...(sample || detail
          ? {
              debug: {
                ...(detail ? { detail } : {}),
                ...(sample ? { sample } : {}),
              },
            }
          : {}),
      });
    }
    return apiError(res, 500, {
      requestId: reqId,
      where: "server",
      code: "GENERATE_FAILED",
      message: "generate_failed",
    });
  } finally {
    if (deadlineTimer) clearTimeout(deadlineTimer);
  }
});

/**
 * /api/docx
 * scriptId로 문서 생성 (POST 요청으로 전환)
 */
app.post("/api/docx", attachTeacherContext, async (req, res) => {
  const requestId =
    String(req.get("x-request-id") || "").trim() ||
    (crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(6).toString("hex"));
  const body = req.body || {};
  const bodyKeys = body && typeof body === "object" ? Object.keys(body) : [];
  console.log(`[docx:${requestId}] start keys=${bodyKeys.join(",")}`);

  try {
    const { script, exportOptions, scriptId, layoutMode, hideCurriculum } =
      req.body || {};

    // Preferred: generate docx from the exact script the user just generated (Single Source of Truth).
    if (script && typeof script === "object") {
      const scriptKeys =
        script && typeof script === "object" ? Object.keys(script) : [];
      console.log(
        `[docx:${requestId}] build begin (script keys=${scriptKeys.join(",")})`
      );
      const topicTitle = script.topic_title || "대본";
      const twoColumn = Boolean(exportOptions?.twoColumn);
      const includeStandards = exportOptions?.includeStandards !== false;

      const { buffer, filename } = await buildDocx(topicTitle, script, {
        columns: twoColumn ? 2 : 1,
        includeStandards,
        // Never use "preview-only" for downloads: worksheet must be fully rendered.
        grade: script.grade,
        durationMin: script.durationMin,
        groupSize: script.groupSize,
      });
      console.log(`[docx:${requestId}] build done size=${buffer?.length || 0}`);

      const encodedFilename = encodeURIComponent(filename + ".docx");
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename*=UTF-8''${encodedFilename}`
      );
      res.setHeader("X-Request-Id", requestId);
      return res.send(buffer);
    }

    // Backward-compat: scriptId-based export (debug only)
    if (!scriptId) {
      return res.status(400).json({
        ok: false,
        requestId,
        error: {
          code: "VALIDATION_FAILED",
          field: "content",
          message: "export content is required",
        },
      });
    }

    const admin = getSupabaseAdmin();
    if (!admin) {
      return res.status(503).json({
        ok: false,
        where: "supabase",
        error: "Supabase admin not configured",
        missing: getSupabaseAdminMissingKeys(),
      });
    }

    const { data: row, error: rowErr } = await admin
      .from("scripts")
      .select(
        "id, topic_title, script_json, duration_min, group_size, created_by"
      )
      .eq("id", scriptId)
      .eq("created_by", req.auth.uid)
      .maybeSingle();
    if (rowErr) throw rowErr;
    if (!row)
      return res.status(404).json({
        ok: false,
        requestId,
        error: { code: "NOT_FOUND", message: "script not found" },
      });

    const columns = layoutMode === "oneColumn" ? 1 : 2;
    const includeStandards = !hideCurriculum;

    const { buffer, filename } = await buildDocx(
      row.topic_title,
      row.script_json,
      {
        columns,
        includeStandards,
        // Never use "preview-only" for downloads: worksheet must be fully rendered.
        scriptId: scriptId,
        durationMin: row.duration_min,
        groupSize: row.group_size,
        grade: row.script_json.grade,
      }
    );

    // 파일명 인코딩 (한글 포함 대응)
    const encodedFilename = encodeURIComponent(filename + ".docx");

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename*=UTF-8''${encodedFilename}`
    );
    res.setHeader("X-Request-Id", requestId);
    return res.send(buffer);
  } catch (e) {
    console.error(`[docx:${requestId}] error:`, e?.stack || e);
    const debugAllowed = process.env.NODE_ENV !== "production";
    return res.status(500).json({
      ok: false,
      requestId,
      error: {
        code: "DOCX_EXPORT_FAILED",
        message: "export_failed",
        ...(debugAllowed ? { detail: String(e?.message || "") } : {}),
      },
    });
  }
});

// Express final error handler (always JSON for /api/*)
app.use((err, req, res, next) => {
  console.error("[api] unhandled error:", err?.stack || err);
  if (req?.path?.startsWith("/api/")) {
    if (res.headersSent) return;
    // If JSON body is malformed, express.json throws a SyntaxError. Treat it as 400.
    const isJsonSyntax =
      err instanceof SyntaxError &&
      typeof err?.message === "string" &&
      (err.message.includes("JSON") ||
        err.message.includes("Unexpected token"));
    if (isJsonSyntax) {
      return res.status(400).json({
        ok: false,
        error: { code: "INVALID_JSON", message: "Request body is not valid JSON" },
      });
    }
    return res
      .status(500)
      .json({ ok: false, error: { code: "INTERNAL_ERROR", message: "internal_error" } });
  }
  return next(err);
});

/**
 * Global safety: do not let the dev process crash and reset active connections.
 * - `node --watch` may restart processes quickly; PORT can be in use temporarily.
 * - Handle EADDRINUSE with retry + backoff instead of throwing.
 * - Close the server on SIGTERM/SIGINT to release the port promptly.
 */
process.on("unhandledRejection", (reason) => {
  console.error("[fatal] unhandledRejection:", reason);
});

process.on("uncaughtException", (err) => {
  console.error("[fatal] uncaughtException:", err);
  // Do not exit; keep the process alive to avoid ERR_CONNECTION_RESET.
});

const port = Number(process.env.PORT || 3000);
let server = null;

async function closeServer() {
  if (!server) return;
  const s = server;
  server = null;
  await new Promise((resolve) => s.close(() => resolve()));
}

async function listenWithRetry(attempt = 0) {
  try {
    await closeServer();

    server = app.listen(port, () => {
      console.log(`Server listening on port ${port}`);
    });

    server.on("error", async (err) => {
      const code = err?.code;
      if (code === "EADDRINUSE") {
        const delayMs = Math.min(2000, 200 + attempt * 200);
        console.warn(
          `[server] PORT ${port} is in use (EADDRINUSE). Retrying in ${delayMs}ms...`
        );
        try {
          await closeServer();
        } finally {
          setTimeout(() => {
            listenWithRetry(attempt + 1).catch((e) => {
              console.error("[server] listen retry failed:", e);
            });
          }, delayMs);
        }
        return;
      }

      // Prevent "Unhandled 'error' event" crash -> ERR_CONNECTION_RESET in browser.
      console.error("[server] listen error:", code || err?.message || err);
    });
  } catch (e) {
    console.error("[server] failed to start:", e);
    const delayMs = Math.min(2000, 200 + attempt * 200);
    setTimeout(() => {
      listenWithRetry(attempt + 1).catch((err) =>
        console.error("[server] listen retry failed:", err)
      );
    }, delayMs);
  }
}

process.on("SIGTERM", () => {
  console.warn("[dev] SIGTERM received; closing server...");
  closeServer()
    .catch((e) => console.error("[dev] closeServer failed:", e))
    .finally(() => process.exit(0));
});

process.on("SIGINT", () => {
  console.warn("[dev] SIGINT received; closing server...");
  closeServer()
    .catch((e) => console.error("[dev] closeServer failed:", e))
    .finally(() => process.exit(0));
});

await listenWithRetry();
